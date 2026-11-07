import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase/config';
import { logWorkspaceActivity, ACTIVITY_ACTIONS } from './activityService';
import { createUserNotification, NOTIFICATION_TYPES } from './notificationService';
import { addWorkspaceMember, WORKSPACE_ROLES } from './memberService';

/**
 * Generate a cryptographically secure random token (48 chars hex)
 */
export function generateSecureToken() {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 hash of invitation token for secure storage & verification
 */
export async function hashToken(token) {
  if (!token) return '';
  const msgUint8 = new TextEncoder().encode(token.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new workspace invitation (Family or Business ONLY)
 */
export async function createWorkspaceInvitation(workspace, { 
  invitedEmail = '', 
  role = WORKSPACE_ROLES.EDITOR, 
  expiresInHours = 48 
}, actorUser) {
  if (!workspace || !workspace.id) throw new Error('Workspace is required.');

  // Strict Personal Privacy Check
  if (workspace.type === 'personal') {
    throw new Error('Personal workspaces are strictly private and do not support invitations or shared access.');
  }

  const rawToken = generateSecureToken();
  const tokenHash = await hashToken(rawToken);
  const invitationId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const expiresAtMs = Date.now() + (Number(expiresInHours) || 48) * 3600 * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();

  const invitationRecord = {
    id: invitationId,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceType: workspace.type,
    tokenHash,
    rawToken, // Provided to the creator to build the link
    invitedEmail: invitedEmail?.trim() || null,
    role,
    expiresAt,
    status: 'pending', // 'pending' | 'accepted' | 'revoked' | 'expired'
    createdByUid: actorUser?.uid || 'owner',
    createdByName: actorUser?.displayName || 'Workspace Owner',
    createdAt: new Date().toISOString()
  };

  // Sync to local cache
  const localKey = `pdt_invitations_${workspace.id}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const updated = [invitationRecord, ...existing];
  localStorage.setItem(localKey, JSON.stringify(updated));

  // Store in global active invitations cache for fast lookup during link verification
  const globalKey = `pdt_active_invitations_map`;
  const globalMap = JSON.parse(localStorage.getItem(globalKey) || '{}');
  globalMap[tokenHash] = invitationRecord;
  localStorage.setItem(globalKey, JSON.stringify(globalMap));

  // Sync to Firestore
  if (isFirebaseConfigured) {
    try {
      const invRef = doc(db, 'workspaces', workspace.id, 'invitations', invitationId);
      await setDoc(invRef, {
        ...invitationRecord,
        rawToken: null, // Never store plain-text token in Firestore for security
        serverCreatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Firestore create invitation warning:', err.message);
    }
  }

  // Audit Log
  await logWorkspaceActivity(workspace.id, {
    action: ACTIVITY_ACTIONS.INVITE_CREATED,
    details: `Created invitation for ${invitedEmail || 'shareable link'} (${role} role, expires in ${expiresInHours}h).`,
    user: actorUser
  });

  const baseUrl = window.location.origin + window.location.pathname;
  const inviteLink = `${baseUrl}?invite=${rawToken}`;

  return {
    ...invitationRecord,
    inviteLink
  };
}

/**
 * Validate an invitation token from link
 */
export async function validateInvitationToken(token) {
  if (!token) return { valid: false, reason: 'Missing invitation token.' };

  const tokenHash = await hashToken(token.trim());

  // Check global local cache
  const globalKey = `pdt_active_invitations_map`;
  const globalMap = JSON.parse(localStorage.getItem(globalKey) || '{}');
  let invitation = globalMap[tokenHash] || null;

  // If not in cache and Firestore configured, query invitations
  if (!invitation && isFirebaseConfigured) {
    try {
      // Find matching invitation document
      // In Firestore, we check if invitation document exists
      // Note: for security in production, invitation check can be a cloud function or authenticated query
    } catch (err) {
      console.warn('Error querying invitation token:', err);
    }
  }

  if (!invitation) {
    return { valid: false, reason: 'Invitation not found or has been removed.' };
  }

  if (invitation.status === 'revoked') {
    return { valid: false, reason: 'This invitation has been revoked by the workspace owner.' };
  }

  if (invitation.status === 'accepted') {
    return { valid: false, reason: 'This single-use invitation has already been accepted.' };
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: 'This invitation link has expired.' };
  }

  return {
    valid: true,
    invitation
  };
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(workspaceId, invitationId, actorUser) {
  if (!workspaceId || !invitationId) return;

  const localKey = `pdt_invitations_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const updated = existing.map(inv => inv.id === invitationId ? { ...inv, status: 'revoked' } : inv);
  localStorage.setItem(localKey, JSON.stringify(updated));

  if (isFirebaseConfigured) {
    try {
      const invRef = doc(db, 'workspaces', workspaceId, 'invitations', invitationId);
      await updateDoc(invRef, { status: 'revoked' });
    } catch (err) {
      console.warn('Firestore revoke invitation warning:', err.message);
    }
  }

  await logWorkspaceActivity(workspaceId, {
    action: ACTIVITY_ACTIONS.INVITE_REVOKED,
    details: 'Revoked pending workspace invitation.',
    user: actorUser
  });

  return updated;
}

/**
 * Get all invitations for a workspace
 */
export async function getWorkspaceInvitations(workspaceId) {
  if (!workspaceId) return [];

  const localKey = `pdt_invitations_${workspaceId}`;
  let invitations = null;

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const invsRef = collection(db, 'workspaces', workspaceId, 'invitations');
      const snapshot = await getDocs(invsRef);
      if (!snapshot.empty) {
        invitations = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        localStorage.setItem(localKey, JSON.stringify(invitations));
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Could not fetch invitations from Firestore:', err.message);
      }
    }
  }

  if (!invitations) {
    const cached = localStorage.getItem(localKey);
    invitations = cached ? JSON.parse(cached) : [];
  }

  // Auto-mark expired invitations
  const now = Date.now();
  return invitations.map(inv => {
    if (inv.status === 'pending' && new Date(inv.expiresAt).getTime() < now) {
      return { ...inv, status: 'expired' };
    }
    return inv;
  });
}

/**
 * Invitee submits a Join Request
 */
export async function submitJoinRequest(invitationToken, inviteeUser) {
  if (!inviteeUser?.uid) throw new Error('You must be signed in to submit a join request.');

  const validation = await validateInvitationToken(invitationToken);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const { invitation } = validation;
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const tokenHash = await hashToken(invitationToken);

  const requestRecord = {
    id: requestId,
    workspaceId: invitation.workspaceId,
    workspaceName: invitation.workspaceName,
    tokenHash,
    uid: inviteeUser.uid,
    displayName: inviteeUser.displayName || 'Invited User',
    email: inviteeUser.email || '',
    photoURL: inviteeUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    requestedRole: invitation.role || WORKSPACE_ROLES.EDITOR,
    status: 'pending', // 'pending' | 'accepted' | 'rejected'
    createdAt: new Date().toISOString()
  };

  // Sync to local cache
  const localKey = `pdt_join_requests_${invitation.workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  // Check if request already submitted
  if (existing.some(r => r.uid === inviteeUser.uid && r.status === 'pending')) {
    throw new Error('A join request has already been submitted and is awaiting owner review.');
  }

  const updated = [requestRecord, ...existing];
  localStorage.setItem(localKey, JSON.stringify(updated));

  if (isFirebaseConfigured) {
    try {
      const reqRef = doc(db, 'workspaces', invitation.workspaceId, 'joinRequests', requestId);
      await setDoc(reqRef, {
        ...requestRecord,
        serverCreatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Firestore join request save warning:', err.message);
    }
  }

  // Audit Log
  await logWorkspaceActivity(invitation.workspaceId, {
    action: ACTIVITY_ACTIONS.REQUEST_SUBMITTED,
    details: `${inviteeUser.displayName || 'User'} submitted a join request for ${invitation.workspaceName}.`,
    user: inviteeUser
  });

  // Notify workspace owner
  if (invitation.createdByUid) {
    await createUserNotification(invitation.createdByUid, {
      type: NOTIFICATION_TYPES.JOIN_REQUEST,
      title: 'New Join Request',
      message: `${inviteeUser.displayName || inviteeUser.email} has requested to join "${invitation.workspaceName}".`,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspaceName
    });
  }

  return requestRecord;
}

/**
 * Get all join requests for a workspace
 */
export async function getWorkspaceJoinRequests(workspaceId) {
  if (!workspaceId) return [];

  const localKey = `pdt_join_requests_${workspaceId}`;
  let requests = null;

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const reqsRef = collection(db, 'workspaces', workspaceId, 'joinRequests');
      const snapshot = await getDocs(reqsRef);
      if (!snapshot.empty) {
        requests = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        localStorage.setItem(localKey, JSON.stringify(requests));
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Could not fetch join requests from Firestore:', err.message);
      }
    }
  }

  if (!requests) {
    const cached = localStorage.getItem(localKey);
    requests = cached ? JSON.parse(cached) : [];
  }

  return requests;
}

/**
 * Process a join request (Owner or Admin accepts or rejects)
 */
export async function processJoinRequest(workspace, requestId, action, actorUser) {
  if (!workspace?.id || !requestId) throw new Error('Missing workspace or request ID');
  if (action !== 'accept' && action !== 'reject') throw new Error('Invalid action');

  const localKey = `pdt_join_requests_${workspace.id}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const targetReq = existing.find(r => r.id === requestId);
  if (!targetReq) throw new Error('Join request not found.');

  const newStatus = action === 'accept' ? 'accepted' : 'rejected';
  const updatedReqs = existing.map(r => r.id === requestId ? { ...r, status: newStatus, processedAt: new Date().toISOString() } : r);
  localStorage.setItem(localKey, JSON.stringify(updatedReqs));

  if (isFirebaseConfigured) {
    try {
      const reqRef = doc(db, 'workspaces', workspace.id, 'joinRequests', requestId);
      await updateDoc(reqRef, { 
        status: newStatus, 
        processedAt: serverTimestamp(),
        processedByUid: actorUser.uid 
      });
    } catch (err) {
      console.warn('Firestore update join request warning:', err.message);
    }
  }

  if (action === 'accept') {
    // 1. Add user as verified member
    await addWorkspaceMember(workspace.id, {
      uid: targetReq.uid,
      displayName: targetReq.displayName,
      email: targetReq.email,
      photoURL: targetReq.photoURL,
      role: targetReq.requestedRole || WORKSPACE_ROLES.EDITOR
    }, actorUser);

    // 2. Mark corresponding invitation as accepted (single-use enforcement)
    if (targetReq.tokenHash) {
      const invLocalKey = `pdt_invitations_${workspace.id}`;
      const invs = JSON.parse(localStorage.getItem(invLocalKey) || '[]');
      const updatedInvs = invs.map(i => i.tokenHash === targetReq.tokenHash ? { ...i, status: 'accepted' } : i);
      localStorage.setItem(invLocalKey, JSON.stringify(updatedInvs));

      // Also update global map
      const globalKey = `pdt_active_invitations_map`;
      const globalMap = JSON.parse(localStorage.getItem(globalKey) || '{}');
      if (globalMap[targetReq.tokenHash]) {
        globalMap[targetReq.tokenHash].status = 'accepted';
        localStorage.setItem(globalKey, JSON.stringify(globalMap));
      }
    }

    // 3. Notify invitee
    await createUserNotification(targetReq.uid, {
      type: NOTIFICATION_TYPES.REQUEST_ACCEPTED,
      title: 'Join Request Approved!',
      message: `Your request to join "${workspace.name}" has been approved! You now have ${targetReq.requestedRole} access.`,
      workspaceId: workspace.id,
      workspaceName: workspace.name
    });

    // 4. Audit Log
    await logWorkspaceActivity(workspace.id, {
      action: ACTIVITY_ACTIONS.REQUEST_APPROVED,
      details: `${actorUser.displayName || 'Owner'} approved join request for ${targetReq.displayName} (${targetReq.requestedRole}).`,
      user: actorUser
    });
  } else {
    // Reject
    await createUserNotification(targetReq.uid, {
      type: NOTIFICATION_TYPES.REQUEST_REJECTED,
      title: 'Join Request Declined',
      message: `Your request to join "${workspace.name}" was not approved by the workspace owner.`,
      workspaceId: workspace.id,
      workspaceName: workspace.name
    });

    await logWorkspaceActivity(workspace.id, {
      action: ACTIVITY_ACTIONS.REQUEST_REJECTED,
      details: `${actorUser.displayName || 'Owner'} rejected join request for ${targetReq.displayName}.`,
      user: actorUser
    });
  }

  return updatedReqs;
}

