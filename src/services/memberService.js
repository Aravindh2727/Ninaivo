import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase/config';
import { logWorkspaceActivity, ACTIVITY_ACTIONS } from './activityService';
import { createUserNotification, NOTIFICATION_TYPES } from './notificationService';

export const WORKSPACE_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer'
};

/**
 * Check if a role has the required permission level
 */
export function hasPermission(userRole, requiredRole) {
  const roleWeights = {
    [WORKSPACE_ROLES.OWNER]: 4,
    [WORKSPACE_ROLES.ADMIN]: 3,
    [WORKSPACE_ROLES.EDITOR]: 2,
    [WORKSPACE_ROLES.VIEWER]: 1
  };

  const userWeight = roleWeights[userRole] || 1;
  const requiredWeight = roleWeights[requiredRole] || 1;
  return userWeight >= requiredWeight;
}

/**
 * Get all members for a workspace
 */
export async function getWorkspaceMembers(workspaceId, ownerUid, ownerDetails = {}) {
  if (!workspaceId) return [];

  const localKey = `pdt_members_${workspaceId}`;
  const cached = localStorage.getItem(localKey);
  let members = cached ? JSON.parse(cached) : null;

  if (members === null && isFirebaseConfigured && auth?.currentUser) {
    try {
      const membersRef = collection(db, 'workspaces', workspaceId, 'members');
      const snapshot = await getDocs(membersRef);
      if (!snapshot.empty) {
        members = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        localStorage.setItem(localKey, JSON.stringify(members));
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Could not fetch members from Firestore:', err.message);
      }
    }
  }

  // Ensure owner is included as the primary member
  if (!members || members.length === 0) {
    const ownerMember = {
      id: ownerUid || 'owner',
      uid: ownerUid || 'owner',
      displayName: ownerDetails.displayName || 'Workspace Owner',
      email: ownerDetails.email || 'owner@example.com',
      photoURL: ownerDetails.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: WORKSPACE_ROLES.OWNER,
      status: 'active',
      joinedAt: new Date().toISOString(),
      recentActivity: 'Created workspace'
    };
    members = [ownerMember];
    localStorage.setItem(localKey, JSON.stringify(members));

    if (isFirebaseConfigured && ownerUid) {
      try {
        const memRef = doc(db, 'workspaces', workspaceId, 'members', ownerUid);
        await setDoc(memRef, {
          ...ownerMember,
          serverCreatedAt: serverTimestamp()
        });
      } catch (e) {
        // ignore
      }
    }
  }

  return members;
}

/**
 * Add or update a member in the workspace
 */
export async function addWorkspaceMember(workspaceId, memberData, actorUser) {
  if (!workspaceId || !memberData.uid) throw new Error('Missing workspace or member UID');

  const newMember = {
    id: memberData.uid,
    uid: memberData.uid,
    displayName: memberData.displayName || 'Team Member',
    email: memberData.email || '',
    photoURL: memberData.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    role: memberData.role || WORKSPACE_ROLES.EDITOR,
    status: 'active',
    joinedAt: new Date().toISOString(),
    recentActivity: 'Joined workspace'
  };

  const localKey = `pdt_members_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const updated = [...existing.filter(m => m.uid !== memberData.uid), newMember];
  localStorage.setItem(localKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const memRef = doc(db, 'workspaces', workspaceId, 'members', memberData.uid);
      await setDoc(memRef, {
        ...newMember,
        serverCreatedAt: serverTimestamp()
      });

      // Also update workspace document's members array & memberRoles map for fast security rule checks
      const wsRef = doc(db, 'workspaces', workspaceId);
      const memberUids = updated.map(m => m.uid);
      const memberRoles = updated.reduce((acc, m) => ({ ...acc, [m.uid]: m.role }), {});
      await updateDoc(wsRef, {
        members: memberUids,
        memberRoles
      });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore add member warning:', err.message);
      }
    }
  }

  // Audit Log
  await logWorkspaceActivity(workspaceId, {
    action: ACTIVITY_ACTIONS.MEMBER_JOINED,
    details: `${newMember.displayName} joined as ${newMember.role}.`,
    user: actorUser || { uid: memberData.uid, displayName: newMember.displayName, photoURL: newMember.photoURL }
  });

  return newMember;
}

/**
 * Change member role
 */
export async function updateMemberRole(workspaceId, targetUid, newRole, actorUser, workspace) {
  if (!workspaceId || !targetUid) throw new Error('Missing workspace or target UID');

  if (workspace?.ownerUid === targetUid) {
    throw new Error('Cannot change the role of the workspace owner.');
  }

  const localKey = `pdt_members_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const targetMember = existing.find(m => m.uid === targetUid);
  if (!targetMember) throw new Error('Member not found in workspace.');

  const updated = existing.map(m => m.uid === targetUid ? { ...m, role: newRole } : m);
  localStorage.setItem(localKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const memRef = doc(db, 'workspaces', workspaceId, 'members', targetUid);
      await updateDoc(memRef, { role: newRole });

      const wsRef = doc(db, 'workspaces', workspaceId);
      const memberRoles = updated.reduce((acc, m) => ({ ...acc, [m.uid]: m.role }), {});
      await updateDoc(wsRef, { memberRoles });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore update role warning:', err.message);
      }
    }
  }

  // Audit Log
  await logWorkspaceActivity(workspaceId, {
    action: ACTIVITY_ACTIONS.ROLE_CHANGED,
    details: `Changed role of ${targetMember.displayName} to ${newRole}.`,
    user: actorUser
  });

  // Notify member
  await createUserNotification(targetUid, {
    type: NOTIFICATION_TYPES.WORKSPACE_ACTIVITY,
    title: 'Workspace Role Updated',
    message: `Your permission role in ${workspace?.name || 'workspace'} has been updated to ${newRole}.`,
    workspaceId,
    workspaceName: workspace?.name
  });

  return updated;
}

/**
 * Remove a member from the workspace
 */
export async function removeWorkspaceMember(workspaceId, targetUid, actorUser, workspace) {
  if (!workspaceId || !targetUid) throw new Error('Missing workspace or target UID');

  if (workspace?.ownerUid === targetUid) {
    throw new Error('The workspace owner cannot be removed.');
  }

  const localKey = `pdt_members_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const targetMember = existing.find(m => m.uid === targetUid);
  const updated = existing.filter(m => m.uid !== targetUid);
  localStorage.setItem(localKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const memRef = doc(db, 'workspaces', workspaceId, 'members', targetUid);
      await deleteDoc(memRef);

      const wsRef = doc(db, 'workspaces', workspaceId);
      const memberUids = updated.map(m => m.uid);
      const memberRoles = updated.reduce((acc, m) => ({ ...acc, [m.uid]: m.role }), {});
      await updateDoc(wsRef, {
        members: memberUids,
        memberRoles
      });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore remove member warning:', err.message);
      }
    }
  }

  // Audit Log
  await logWorkspaceActivity(workspaceId, {
    action: ACTIVITY_ACTIONS.MEMBER_REMOVED,
    details: `${targetMember?.displayName || 'Member'} was removed from the workspace.`,
    user: actorUser
  });

  // Notify removed member
  await createUserNotification(targetUid, {
    type: NOTIFICATION_TYPES.MEMBER_REMOVED,
    title: 'Workspace Membership Ended',
    message: `You were removed from ${workspace?.name || 'the workspace'}.`,
    workspaceId,
    workspaceName: workspace?.name
  });

  return updated;
}

/**
 * Member willingly leaves the workspace
 */
export async function leaveWorkspace(workspaceId, user, workspace) {
  if (workspace?.ownerUid === user.uid) {
    throw new Error('Workspace owner cannot leave their own workspace. Delete the workspace instead.');
  }

  const updated = await removeWorkspaceMember(workspaceId, user.uid, user, workspace);

  // Notify workspace owner
  if (workspace?.ownerUid) {
    await createUserNotification(workspace.ownerUid, {
      type: NOTIFICATION_TYPES.WORKSPACE_ACTIVITY,
      title: 'Member Left Workspace',
      message: `${user.displayName || 'A member'} has left ${workspace?.name || 'the workspace'}.`,
      workspaceId,
      workspaceName: workspace?.name
    });
  }

  return updated;
}

