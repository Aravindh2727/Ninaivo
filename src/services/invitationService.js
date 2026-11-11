import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  arrayUnion,
  writeBatch,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase/config.js';
import { logWorkspaceActivity, ACTIVITY_ACTIONS } from './activityService.js';
import { createUserNotification, NOTIFICATION_TYPES } from './notificationService.js';
import { addWorkspaceMember, WORKSPACE_ROLES } from './memberService.js';

/**
 * Normalize Firestore Timestamp, ISO string, or number to epoch milliseconds
 */
export function getTimestampMs(val) {
  if (!val) return null;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?.toDate === 'function') return val.toDate().getTime();
  if (typeof val === 'number') return val;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? null : parsed;
}

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
  relationship = 'family',
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

  const isNever = expiresInHours === 'never' || expiresInHours === null || expiresInHours === 0 || expiresInHours === '0';
  let expiresAtMs = null;
  let expiresAt = null;

  if (!isNever) {
    const hours = Number(expiresInHours);
    const validHours = (!isNaN(hours) && hours > 0) ? hours : 48;
    expiresAtMs = Date.now() + validHours * 3600 * 1000;
    expiresAt = new Date(expiresAtMs).toISOString();
  }

  const validRole = [WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.VIEWER].includes(role)
    ? role
    : WORKSPACE_ROLES.EDITOR;

  const invitationRecord = {
    id: invitationId,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceType: workspace.type,
    tokenHash,
    rawToken, // Provided to the creator to build the link
    invitedEmail: invitedEmail?.trim() ? invitedEmail.trim().toLowerCase() : null,
    role: validRole,
    relationship: relationship || 'family',
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

  // Sync to Firestore:
  // 1. In workspace subcollection: /workspaces/{workspace.id}/invitations/{invitationId}
  // 2. In root collection: /invitations/{tokenHash} (allows recipient on any device to resolve workspace metadata)
  if (isFirebaseConfigured) {
    try {
      const invRef = doc(db, 'workspaces', workspace.id, 'invitations', invitationId);
      const rootInvRef = doc(db, 'invitations', tokenHash);
      const firestoreRecord = {
        ...invitationRecord,
        rawToken: null, // Never store plain-text token in Firestore for security
        expiresAt: expiresAtMs ? Timestamp.fromMillis(expiresAtMs) : null,
        expiresAtIso: expiresAt,
        serverCreatedAt: serverTimestamp()
      };
      await Promise.all([
        setDoc(invRef, firestoreRecord),
        setDoc(rootInvRef, firestoreRecord)
      ]);
    } catch (err) {
      console.warn('Firestore create invitation warning:', err.message);
    }
  }

  // Audit Log
  const expiryDetail = isNever ? 'never expires' : `expires in ${expiresInHours}h`;
  await logWorkspaceActivity(workspace.id, {
    action: ACTIVITY_ACTIONS.INVITE_CREATED,
    details: `Created invitation for ${invitedEmail || 'shareable link'} (${role} role, ${expiryDetail}).`,
    user: actorUser
  });

  const baseUrl = window.location.origin + window.location.pathname;
  const inviteLink = `${baseUrl}?invite=${rawToken}&ws=${workspace.id}`;

  return {
    ...invitationRecord,
    inviteLink
  };
}

/**
 * Validate an invitation token from link
 */
export async function validateInvitationToken(token, workspaceIdHint = null) {
  if (!token) return { valid: false, reason: 'Missing invitation token.' };

  const trimmedToken = token.trim();
  const tokenHash = await hashToken(trimmedToken);

  // Check global local cache
  const globalKey = `pdt_active_invitations_map`;
  const globalMap = JSON.parse(localStorage.getItem(globalKey) || '{}');
  let invitation = globalMap[tokenHash] || null;

  // Authoritative Cloud Firestore lookup if not in local cache or always online
  if (isFirebaseConfigured) {
    try {
      // 1. Direct O(1) lookup in root /invitations/{tokenHash}
      const rootInvRef = doc(db, 'invitations', tokenHash);
      const rootSnap = await getDoc(rootInvRef);
      if (rootSnap.exists()) {
        invitation = {
          id: rootSnap.id,
          ...rootSnap.data()
        };
      } else if (workspaceIdHint) {
        // 2. Direct subcollection fallback if workspaceIdHint was supplied
        const wsInvRef = collection(db, 'workspaces', workspaceIdHint, 'invitations');
        const q = query(wsInvRef, where('tokenHash', '==', tokenHash));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          invitation = {
            id: qSnap.docs[0].id,
            ...qSnap.docs[0].data()
          };
        }
      }
    } catch (err) {
      console.warn('Error querying invitation token in Firestore:', err.message);
    }
  }

  if (!invitation) {
    return { valid: false, reason: 'Invitation not found or has been removed.' };
  }

  // Cache found invitation for fast repeat verification
  globalMap[tokenHash] = invitation;
  localStorage.setItem(globalKey, JSON.stringify(globalMap));

  if (invitation.status === 'revoked') {
    return { valid: false, reason: 'This invitation has been revoked by the workspace owner.' };
  }

  if (invitation.status === 'accepted') {
    return { valid: false, reason: 'This single-use invitation has already been accepted.' };
  }

  const expMs = getTimestampMs(invitation.expiresAt);
  if (expMs && expMs < Date.now()) {
    return { valid: false, reason: 'This invitation link has expired.' };
  }

  return {
    valid: true,
    invitation
  };
}

/**
 * Direct Accept & Land in Workspace Invitation Flow
 * Authoritative atomic Firestore transaction that verifies cryptographic token status,
 * validates email restrictions, prevents concurrent duplicate acceptances, updates workspace
 * membership and member records, and transitions invitation status in a single commit.
 */
export async function acceptWorkspaceInvitation(token, inviteeUser, workspaceIdHint = null) {
  if (!inviteeUser?.uid) {
    throw new Error('You must be signed in to accept a workspace invitation.');
  }

  const trimmedToken = (token || '').trim();
  if (!trimmedToken) {
    throw new Error('Missing invitation token.');
  }
  const tokenHash = await hashToken(trimmedToken);

  let workspaceId = workspaceIdHint;
  let workspaceName = '';
  let workspaceType = 'family';
  let role = WORKSPACE_ROLES.EDITOR;
  let relationship = 'family';
  let createdByUid = null;

  // 1. Authoritative Cloud Firestore Atomic Batch when online & authenticated
  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const rootInvRef = doc(db, 'invitations', tokenHash);
      const rootInvSnap = await getDoc(rootInvRef);
      if (!rootInvSnap.exists()) {
        throw new Error('Invitation not found or has been removed.');
      }

      const invData = rootInvSnap.data();

      // Security check 1: Status must be strictly pending (prevents race conditions / duplicate acceptances)
      if (invData.status === 'revoked') {
        throw new Error('This invitation has been revoked by the workspace owner.');
      }
      if (invData.status === 'accepted') {
        throw new Error('This single-use invitation has already been accepted.');
      }
      if (invData.status !== 'pending') {
        throw new Error('This invitation is no longer active.');
      }

      // Security check 2: Expiration verification
      const expMs = getTimestampMs(invData.expiresAt);
      if (expMs && expMs < Date.now()) {
        throw new Error('This invitation link has expired.');
      }

      // Security check 3: Email restriction enforcement
      if (invData.invitedEmail) {
        const userEmail = (inviteeUser.email || '').trim().toLowerCase();
        const targetEmail = invData.invitedEmail.trim().toLowerCase();
        if (userEmail !== targetEmail) {
          throw new Error(`This invitation was sent specifically to ${invData.invitedEmail}. You are currently signed in as ${inviteeUser.email || 'another user'}.`);
        }
      }

      workspaceId = invData.workspaceId;
      workspaceName = invData.workspaceName || 'Shared Workspace';
      workspaceType = invData.workspaceType || 'family';
      role = invData.role || WORKSPACE_ROLES.EDITOR;
      relationship = invData.relationship || 'family';
      createdByUid = invData.createdByUid;

      // Security check 4: Personal workspace privacy enforcement
      if (workspaceType === 'personal') {
        throw new Error('Personal workspaces are strictly private and cannot be joined.');
      }

      // Execute Atomic Batched Write across workspace members, member record, and invitation status
      const batch = writeBatch(db);

      // 1. Append to workspace members and set memberRole via arrayUnion (server-enforced atomicity)
      const wsRef = doc(db, 'workspaces', workspaceId);
      batch.update(wsRef, {
        members: arrayUnion(inviteeUser.uid),
        [`memberRoles.${inviteeUser.uid}`]: role,
        lastInviteTokenHash: tokenHash,
        updatedAt: serverTimestamp()
      });

      // 2. Create member subcollection document
      const memRef = doc(db, 'workspaces', workspaceId, 'members', inviteeUser.uid);
      const memberRecord = {
        id: inviteeUser.uid,
        uid: inviteeUser.uid,
        displayName: inviteeUser.displayName || 'Family Member',
        email: (inviteeUser.email || '').trim().toLowerCase(),
        photoURL: inviteeUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        role,
        relationship: invData.relationship || 'family',
        inviteTokenHash: tokenHash,
        status: 'active',
        joinedAt: new Date().toISOString(),
        recentActivity: 'Joined workspace via invite'
      };
      batch.set(memRef, {
        ...memberRecord,
        serverCreatedAt: serverTimestamp()
      });

      // 3. Mark root invitation document as accepted
      batch.update(rootInvRef, {
        status: 'accepted',
        acceptedByUid: inviteeUser.uid,
        acceptedAt: serverTimestamp()
      });

      // Commit all writes in a single atomic database operation
      await batch.commit();

      // Sync workspace subcollection invitation only if caller created it (owner/admin)
      // Invitee status updates are reconciled cleanly by workspace owner/admin in getWorkspaceInvitations()
      if (invData.id && invData.createdByUid === inviteeUser.uid) {
        try {
          const subInvRef = doc(db, 'workspaces', workspaceId, 'invitations', invData.id);
          await updateDoc(subInvRef, {
            status: 'accepted',
            acceptedByUid: inviteeUser.uid,
            acceptedAt: serverTimestamp()
          });
        } catch (e) {
          // Safe to ignore
        }
      }

      // Persist joined workspace ID onto invitee's own user document for reliable cross-device discovery
      try {
        const userRef = doc(db, 'users', inviteeUser.uid);
        await setDoc(userRef, {
          joinedWorkspaceIds: arrayUnion(workspaceId),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        // Non-blocking fallback metadata
      }
    } catch (err) {
      console.error('Firestore accept invitation batch error:', err);
      throw err;
    }
  } else {
    // Local / Offline fallback validation
    const validation = await validateInvitationToken(token, workspaceIdHint);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
    const { invitation } = validation;
    workspaceId = invitation.workspaceId;
    workspaceName = invitation.workspaceName;
    workspaceType = invitation.workspaceType || 'family';
    role = invitation.role || WORKSPACE_ROLES.EDITOR;
    relationship = invitation.relationship || 'family';
    createdByUid = invitation.createdByUid;

    // Email check in fallback
    if (invitation.invitedEmail) {
      const userEmail = (inviteeUser.email || '').trim().toLowerCase();
      const targetEmail = invitation.invitedEmail.trim().toLowerCase();
      if (userEmail !== targetEmail) {
        throw new Error(`This invitation was sent specifically to ${invitation.invitedEmail}. You are currently signed in as ${inviteeUser.email || 'another user'}.`);
      }
    }
  }

  // 2. Update local caches on invitee device
  const localWsKey = `pdt_workspaces_${inviteeUser.uid}`;
  const cachedWorkspaces = JSON.parse(localStorage.getItem(localWsKey) || '[]');
  if (!cachedWorkspaces.some(w => w.id === workspaceId)) {
    const wsStub = {
      id: workspaceId,
      name: workspaceName || 'Shared Workspace',
      type: workspaceType,
      ownerUid: createdByUid || 'owner',
      members: [inviteeUser.uid],
      memberRoles: { [inviteeUser.uid]: role },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        color: workspaceType === 'business' ? '#06b6d4' : '#ec4899',
        icon: workspaceType === 'business' ? 'Briefcase' : 'Heart',
        description: `${workspaceName || 'Shared'} workspace`
      }
    };
    localStorage.setItem(localWsKey, JSON.stringify([...cachedWorkspaces, wsStub]));
  }

  const localMemKey = `pdt_members_${workspaceId}`;
  const cachedMembers = JSON.parse(localStorage.getItem(localMemKey) || '[]');
  if (!cachedMembers.some(m => m.uid === inviteeUser.uid)) {
    cachedMembers.push({
      id: inviteeUser.uid,
      uid: inviteeUser.uid,
      displayName: inviteeUser.displayName || 'Family Member',
      email: inviteeUser.email || '',
      photoURL: inviteeUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      role,
      relationship,
      status: 'active',
      joinedAt: new Date().toISOString(),
      recentActivity: 'Joined workspace via invite'
    });
    localStorage.setItem(localMemKey, JSON.stringify(cachedMembers));
  }

  // Update global active invitations cache
  const globalKey = `pdt_active_invitations_map`;
  const globalMap = JSON.parse(localStorage.getItem(globalKey) || '{}');
  if (globalMap[tokenHash]) {
    globalMap[tokenHash].status = 'accepted';
    localStorage.setItem(globalKey, JSON.stringify(globalMap));
  }

  // 3. Activity Audit Log
  await logWorkspaceActivity(workspaceId, {
    action: ACTIVITY_ACTIONS.MEMBER_JOINED,
    details: `${inviteeUser.displayName || inviteeUser.email || 'User'} joined the workspace as ${role}.`,
    user: inviteeUser
  });

  // 4. Notify workspace owner
  if (createdByUid) {
    await createUserNotification(createdByUid, {
      type: NOTIFICATION_TYPES.MEMBER_JOINED,
      title: 'New Member Joined',
      message: `${inviteeUser.displayName || inviteeUser.email || 'A user'} has accepted the invitation and joined "${workspaceName}".`,
      workspaceId,
      workspaceName
    });
  }

  return {
    success: true,
    workspaceId,
    workspaceName,
    role
  };
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(workspaceId, invitationId, actorUser) {
  if (!workspaceId || !invitationId) return;

  const localKey = `pdt_invitations_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const targetInv = existing.find(inv => inv.id === invitationId);
  const tokenHash = targetInv?.tokenHash;

  const updated = existing.map(inv => inv.id === invitationId ? { ...inv, status: 'revoked' } : inv);
  localStorage.setItem(localKey, JSON.stringify(updated));

  if (tokenHash) {
    const globalKey = `pdt_active_invitations_map`;
    const globalMap = JSON.parse(localStorage.getItem(globalKey) || '{}');
    if (globalMap[tokenHash]) {
      globalMap[tokenHash].status = 'revoked';
      localStorage.setItem(globalKey, JSON.stringify(globalMap));
    }
  }

  if (isFirebaseConfigured) {
    try {
      const invRef = doc(db, 'workspaces', workspaceId, 'invitations', invitationId);
      await updateDoc(invRef, { status: 'revoked' });
      if (tokenHash) {
        const rootInvRef = doc(db, 'invitations', tokenHash);
        await updateDoc(rootInvRef, { status: 'revoked' }).catch(() => {});
      }
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

        // Reconcile pending invitations against authoritative root /invitations/{tokenHash}
        invitations = await Promise.all(invitations.map(async (inv) => {
          if (inv.status === 'pending' && inv.tokenHash) {
            try {
              const rootSnap = await getDoc(doc(db, 'invitations', inv.tokenHash));
              if (rootSnap.exists()) {
                const rootData = rootSnap.data();
                if (rootData.status && rootData.status !== inv.status) {
                  updateDoc(doc(db, 'workspaces', workspaceId, 'invitations', inv.id), {
                    status: rootData.status,
                    ...(rootData.acceptedByUid ? { acceptedByUid: rootData.acceptedByUid } : {})
                  }).catch(() => {});
                  return {
                    ...inv,
                    status: rootData.status,
                    acceptedByUid: rootData.acceptedByUid || inv.acceptedByUid
                  };
                }
              }
            } catch {
              // Ignore per-invite reconciliation check error
            }
          }
          return inv;
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
    const expMs = getTimestampMs(inv.expiresAt);
    if (inv.status === 'pending' && expMs && expMs < now) {
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

  return {
    success: true,
    ...requestRecord
  };
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

