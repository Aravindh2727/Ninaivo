import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase/config';

export const ACTIVITY_ACTIONS = {
  ENTRY_CREATED: 'entry_created',
  ENTRY_EDITED: 'entry_edited',
  ENTRY_DELETED: 'entry_deleted',
  MEMBER_JOINED: 'member_joined',
  MEMBER_REMOVED: 'member_removed',
  ROLE_CHANGED: 'role_changed',
  INVITE_CREATED: 'invite_created',
  INVITE_REVOKED: 'invite_revoked',
  REQUEST_SUBMITTED: 'request_submitted',
  REQUEST_APPROVED: 'request_approved',
  REQUEST_REJECTED: 'request_rejected',
  SETTINGS_CHANGED: 'settings_changed',
  BACKUP_CREATED: 'backup_created',
  RESTORE_COMPLETED: 'restore_completed',
  RESTORE_FAILED: 'restore_failed',
  IMPORT_COMPLETED: 'import_completed'
};

/**
 * Record an audit log entry for a workspace action
 */
export async function logWorkspaceActivity(workspaceId, { 
  action, 
  details, 
  entryId = null, 
  user = null 
}) {
  if (!workspaceId) return null;

  const activityId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const userUid = user?.uid || 'anonymous';
  const userName = user?.displayName || 'User';
  const userAvatar = user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
  const now = new Date().toISOString();

  const activityRecord = {
    id: activityId,
    action,
    details: details || '',
    entryId,
    userUid,
    userName,
    userAvatar,
    workspaceId,
    timestamp: now
  };

  // Sync to local cache per workspace
  const localCacheKey = `pdt_activity_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const updated = [activityRecord, ...existing];
  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  // Sync to Firestore only if authenticated
  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const docRef = doc(db, 'workspaces', workspaceId, 'activityLogs', activityId);
      await setDoc(docRef, {
        ...activityRecord,
        serverCreatedAt: serverTimestamp()
      });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore log activity warning (saved locally):', err.message);
      }
    }
  }

  return activityRecord;
}

/**
 * Retrieve activity logs for a workspace with local fallback
 */
export async function getWorkspaceActivityLogs(workspaceId) {
  if (!workspaceId) return [];

  const localCacheKey = `pdt_activity_${workspaceId}`;
  let logs = null;

  // 1. Authoritative Cloud Firestore read when online & authenticated
  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const logsRef = collection(db, 'workspaces', workspaceId, 'activityLogs');
      const q = query(logsRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        logs = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        localStorage.setItem(localCacheKey, JSON.stringify(logs));
        return logs;
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Could not fetch activity logs from Firestore:', err.message);
      }
    }
  }

  // 2. Local fallback
  const cached = localStorage.getItem(localCacheKey);
  logs = cached ? JSON.parse(cached) : [];
  return logs;
}

