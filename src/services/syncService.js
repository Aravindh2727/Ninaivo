/**
 * Synchronization & Offline Queue Service
 * Handles:
 * - Online / Offline detection
 * - Offline mutations queueing (create, update, delete entries)
 * - Auto-synchronization upon internet reconnection
 * - Conflict prevention (preserves original createdAt, updates updatedAt)
 * - Synchronization progress & status indicators
 */

import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config.js';

const OFFLINE_QUEUE_KEY = 'pdt_offline_mutations';
const LAST_SYNC_KEY = 'pdt_last_successful_sync';

/**
 * Check if the browser is currently online
 */
export function isOnline() {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true;
}

/**
 * Retrieve all pending mutations queued while offline
 */
export function getPendingMutations() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Get count of pending mutations
 */
export function getPendingCount() {
  return getPendingMutations().length;
}

/**
 * Retrieve last successful sync timestamp
 */
export function getLastSyncTime() {
  return localStorage.getItem(LAST_SYNC_KEY) || null;
}

/**
 * Set last sync timestamp
 */
export function recordLastSyncTime() {
  const now = new Date().toISOString();
  localStorage.setItem(LAST_SYNC_KEY, now);
  return now;
}

/**
 * Enqueue an offline mutation
 */
export function queueOfflineMutation(mutation) {
  const queue = getPendingMutations();
  const mutationId = `mut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  
  const record = {
    id: mutationId,
    timestamp: new Date().toISOString(),
    ...mutation
  };

  // If another update for the same entry exists in the queue, merge or update it
  const existingIdx = queue.findIndex(m => m.entryId === mutation.entryId && m.type === mutation.type);
  if (existingIdx >= 0 && mutation.type === 'update') {
    queue[existingIdx] = {
      ...queue[existingIdx],
      data: { ...queue[existingIdx].data, ...mutation.data },
      timestamp: record.timestamp
    };
  } else {
    queue.push(record);
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

  // Notify UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pdt-sync-status', { 
      detail: { pendingCount: queue.length, isOnline: isOnline() } 
    }));
  }

  return record;
}

/**
 * Synchronize all pending offline mutations with Firebase Firestore
 */
export async function syncPendingMutations(user) {
  if (!isOnline()) {
    return {
      synced: 0,
      failed: 0,
      remaining: getPendingCount(),
      message: 'Device is offline. Connect to the internet to sync.'
    };
  }

  const queue = getPendingMutations();
  if (queue.length === 0) {
    return { 
      synced: 0, 
      failed: 0, 
      remaining: 0, 
      message: 'All changes are synchronized.' 
    };
  }

  const activeUser = user || auth?.currentUser;
  const isDemoSession = !activeUser && Boolean(localStorage.getItem('pdt_demo_session'));

  // Scenario A: Demo session or unauthenticated visitor
  if (isDemoSession || !isFirebaseConfigured || !activeUser) {
    // Reconcile and commit all queued operations to local device storage
    const successfulIds = queue.map(op => op.id);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([]));
    const lastSyncIso = recordLastSyncTime();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pdt-sync-status', { 
        detail: { 
          pendingCount: 0, 
          isOnline: isOnline(),
          lastSync: lastSyncIso 
        } 
      }));
    }

    return {
      synced: successfulIds.length,
      conflictsPreserved: 0,
      failed: 0,
      remaining: 0,
      isDemo: true,
      message: isDemoSession 
        ? 'Device storage synchronized! Sign in to back up entries to Cloud Firestore.'
        : 'Local storage synchronized successfully.'
    };
  }

  // Scenario B: Authenticated Firebase user
  const successfulIds = [];
  const failedOps = [];
  let conflictsPreserved = 0;

  for (const op of queue) {
    try {
      const { type, workspaceId, entryId, data } = op;
      if (!workspaceId || !entryId) {
        successfulIds.push(op.id);
        continue;
      }

      // Ensure the parent workspace document exists in Firestore before writing subcollection
      try {
        const wsRef = doc(db, 'workspaces', workspaceId);
        const wsSnap = await getDoc(wsRef);
        if (!wsSnap.exists()) {
          const localWsList = JSON.parse(localStorage.getItem(`pdt_workspaces_${activeUser.uid}`) || '[]');
          const wsData = localWsList.find(w => w.id === workspaceId) || {
            id: workspaceId,
            name: 'Personal Diary',
            type: 'personal',
            ownerUid: activeUser.uid,
            members: [activeUser.uid],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            settings: { currency: '₹' }
          };
          await setDoc(wsRef, {
            ...wsData,
            ownerUid: activeUser.uid,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (wsErr) {
        console.warn('Sync workspace verification note:', wsErr.message);
      }

      const entryRef = doc(db, 'workspaces', workspaceId, 'entries', entryId);

      // Ensure createdByUid matches authenticated user for Firestore security rules
      const sanitizedData = { ...(data || {}) };
      if (!sanitizedData.createdByUid || sanitizedData.createdByUid === 'demo-user-42' || sanitizedData.createdByUid === 'anonymous' || sanitizedData.createdByUid === 'demo-owner') {
        sanitizedData.createdByUid = activeUser.uid;
      }

      if (type === 'create') {
        await setDoc(entryRef, {
          ...sanitizedData,
          createdAt: sanitizedData.createdAt ? new Date(sanitizedData.createdAt) : serverTimestamp(),
          updatedAt: serverTimestamp(),
          syncedAt: serverTimestamp()
        }, { merge: true });
        successfulIds.push(op.id);
      } else if (type === 'update') {
        let hasConflict = false;
        try {
          const remoteSnap = await getDoc(entryRef);
          if (remoteSnap.exists()) {
            const remote = remoteSnap.data();
            const remoteVersion = remote.version || 1;
            const opBaseVersion = op.baseVersion || 1;
            const remoteUpdated = remote.updatedAt?.toDate ? remote.updatedAt.toDate().toISOString() : remote.updatedAt;
            const opBaseUpdated = op.baseUpdatedAt || op.timestamp;

            if (remoteVersion > opBaseVersion || (remoteUpdated && opBaseUpdated && new Date(remoteUpdated).getTime() > new Date(opBaseUpdated).getTime() + 2000)) {
              hasConflict = true;
            }
          }
        } catch (checkErr) {
          console.warn('Sync conflict check warning:', checkErr.message);
        }

        if (hasConflict) {
          // Auto-preserve conflicting offline edit as a separate copy so neither version is lost
          const copyId = `entry-conflict-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const copyRef = doc(db, 'workspaces', workspaceId, 'entries', copyId);
          await setDoc(copyRef, {
            ...sanitizedData,
            id: copyId,
            title: `[Conflict Copy] ${sanitizedData.title || 'Untitled Note'}`,
            description: `[Auto-preserved conflict version saved during offline sync]\n\n${sanitizedData.description || ''}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            syncedAt: serverTimestamp()
          });
          conflictsPreserved++;
          successfulIds.push(op.id);
        } else {
          await updateDoc(entryRef, {
            ...sanitizedData,
            updatedAt: serverTimestamp(),
            syncedAt: serverTimestamp()
          });
          successfulIds.push(op.id);
        }
      } else if (type === 'delete') {
        await deleteDoc(entryRef);
        successfulIds.push(op.id);
      }
    } catch (err) {
      console.warn('Sync failed for mutation:', op.id, err.message);
      failedOps.push({ opId: op.id, error: err.message });
    }
  }

  // Remove succeeded mutations from queue
  const remaining = queue.filter(item => !successfulIds.includes(item.id));
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));

  let lastSyncIso = null;
  if (successfulIds.length > 0) {
    lastSyncIso = recordLastSyncTime();
  }

  // Notify UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pdt-sync-status', { 
      detail: { 
        pendingCount: remaining.length, 
        isOnline: isOnline(),
        lastSync: lastSyncIso || getLastSyncTime() 
      } 
    }));
  }

  const message = failedOps.length > 0
    ? (failedOps[0]?.error || 'Some operations failed during sync.')
    : `Successfully synchronized ${successfulIds.length} changes!`;

  return {
    synced: successfulIds.length,
    conflictsPreserved,
    failed: failedOps.length,
    remaining: remaining.length,
    failedOps,
    message
  };
}

// Global auto-sync listener when browser reconnects or starts up
if (typeof window !== 'undefined') {
  const triggerAutoSync = () => {
    if (isOnline() && getPendingCount() > 0) {
      setTimeout(() => {
        syncPendingMutations();
      }, 1000);
    }
  };

  window.addEventListener('online', () => {
    window.dispatchEvent(new CustomEvent('pdt-sync-status', { 
      detail: { pendingCount: getPendingCount(), isOnline: true } 
    }));
    triggerAutoSync();
  });

  window.addEventListener('offline', () => {
    window.dispatchEvent(new CustomEvent('pdt-sync-status', { 
      detail: { pendingCount: getPendingCount(), isOnline: false } 
    }));
  });

  // Auto-sync on page load if online and pending changes exist
  if (document.readyState === 'complete') {
    triggerAutoSync();
  } else {
    window.addEventListener('load', triggerAutoSync);
  }
}

