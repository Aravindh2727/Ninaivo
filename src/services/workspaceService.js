import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase/config';

export const WORKSPACE_MODES = {
  PERSONAL: 'personal',
  FAMILY: 'family',
  BUSINESS: 'business'
};

const WORKSPACES_COLLECTION = 'workspaces';

// Default categories seeded to every new workspace
export const DEFAULT_PREDEFINED_CATEGORIES = [
  'Daily Activity',
  'Agriculture',
  'Personal',
  'Family',
  'Business',
  'Important Event',
  'Reminder',
  'Income',
  'Expense'
];

/**
 * Generate default starter workspaces for new user accounts
 */
export function getDefaultStarterWorkspaces(uid, ownerName = 'Diary Owner') {
  return [
    {
      id: `ws-personal-${uid}`,
      name: 'Personal Diary',
      type: WORKSPACE_MODES.PERSONAL,
      ownerUid: uid,
      members: [uid], // Prepared for future Phase 4 multi-member sharing
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        color: '#6366f1',
        icon: 'Sparkles',
        description: 'Private reflections, health, personal achievements & daily thoughts.',
        currency: '₹'
      }
    },
    {
      id: `ws-family-${uid}`,
      name: 'My Family & Agriculture',
      type: WORKSPACE_MODES.FAMILY,
      ownerUid: uid,
      members: [uid],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        color: '#ec4899',
        icon: 'Heart',
        description: 'Family life, farm updates, field work, harvest logs & children milestones.',
        currency: '₹'
      }
    },
    {
      id: `ws-business-${uid}`,
      name: 'My Business Diary',
      type: WORKSPACE_MODES.BUSINESS,
      ownerUid: uid,
      members: [uid],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        color: '#06b6d4',
        icon: 'Briefcase',
        description: 'Client meetings, project records, income/expenses & trade decisions.',
        currency: '₹'
      }
    }
  ];
}

/**
 * Get all workspaces owned by the user
 */
export async function getWorkspacesForUser(uid, ownerName) {
  if (!uid) return [];

  const localCacheKey = `pdt_workspaces_${uid}`;
  const cached = localStorage.getItem(localCacheKey);
  let workspaces = cached ? JSON.parse(cached) : [];

  if (isFirebaseConfigured && auth.currentUser && auth.currentUser.uid === uid) {
    try {
      const q = query(
        collection(db, WORKSPACES_COLLECTION),
        where('ownerUid', '==', uid)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        workspaces = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        localStorage.setItem(localCacheKey, JSON.stringify(workspaces));
        return workspaces;
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore fetch workspaces note:', err.message);
      }
    }
  }

  // If no workspaces exist yet in cloud or cache, seed initial 3 default workspaces
  if (workspaces.length === 0) {
    workspaces = getDefaultStarterWorkspaces(uid, ownerName);
    localStorage.setItem(localCacheKey, JSON.stringify(workspaces));

    // Try seeding to Firestore ONLY if authenticated with valid user id
    if (isFirebaseConfigured && auth.currentUser && auth.currentUser.uid === uid) {
      for (const ws of workspaces) {
        try {
          const wsRef = doc(db, WORKSPACES_COLLECTION, ws.id);
          await setDoc(wsRef, {
            ...ws,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (seedErr) {
          if (seedErr?.code !== 'permission-denied') {
            console.warn('Could not seed starter workspace to Firestore:', seedErr.message);
          }
        }
      }
    }
  }

  return workspaces;
}

/**
 * Create a new workspace (Personal, Family, or Business)
 */
export async function createWorkspace(uid, { name, type, description, color, currency = '₹' }) {
  if (!uid) throw new Error('User authentication required to create workspace.');
  if (!name || !name.trim()) throw new Error('Workspace name cannot be empty.');

  const workspaceId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newWorkspace = {
    id: workspaceId,
    name: name.trim(),
    type: type || WORKSPACE_MODES.PERSONAL,
    ownerUid: uid,
    members: [uid], // Future-ready for Phase 4
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      color: color || (type === WORKSPACE_MODES.FAMILY ? '#ec4899' : type === WORKSPACE_MODES.BUSINESS ? '#06b6d4' : '#6366f1'),
      icon: type === WORKSPACE_MODES.FAMILY ? 'Heart' : type === WORKSPACE_MODES.BUSINESS ? 'Briefcase' : 'Sparkles',
      description: description?.trim() || `${name.trim()} diary workspace`,
      currency
    }
  };

  // Update local cache
  const localCacheKey = `pdt_workspaces_${uid}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const updated = [...existing, newWorkspace];
  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  // Sync to Firestore
  if (isFirebaseConfigured && auth.currentUser) {
    try {
      const wsRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
      await setDoc(wsRef, {
        ...newWorkspace,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore createWorkspace warning (saved locally):', err.message);
      }
    }
  }

  return newWorkspace;
}

/**
 * Update an existing workspace
 */
export async function updateWorkspace(uid, workspaceId, updates) {
  if (!workspaceId) throw new Error('Missing workspaceId');

  const localCacheKey = `pdt_workspaces_${uid}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const updated = existing.map(ws => {
    if (ws.id === workspaceId) {
      return {
        ...ws,
        ...updates,
        settings: { ...(ws.settings || {}), ...(updates.settings || {}) },
        updatedAt: new Date().toISOString()
      };
    }
    return ws;
  });
  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth.currentUser) {
    try {
      const wsRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
      await updateDoc(wsRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore updateWorkspace warning:', err.message);
      }
    }
  }

  return updated.find(w => w.id === workspaceId);
}

/**
 * Delete a workspace and purge its local cache
 */
export async function deleteWorkspace(uid, workspaceId) {
  if (!workspaceId) throw new Error('Missing workspaceId');

  const localCacheKey = `pdt_workspaces_${uid}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const updated = existing.filter(ws => ws.id !== workspaceId);
  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  // Also remove cached entries for this workspace
  localStorage.removeItem(`pdt_entries_${workspaceId}`);
  localStorage.removeItem(`pdt_categories_${workspaceId}`);

  if (isFirebaseConfigured && auth.currentUser) {
    try {
      const wsRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
      await deleteDoc(wsRef);
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore deleteWorkspace warning:', err.message);
      }
    }
  }

  return updated;
}

