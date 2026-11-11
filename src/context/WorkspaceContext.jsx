import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase/config';
import { useAuth } from './AuthContext';
import {
  getWorkspacesForUser,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  WORKSPACE_MODES
} from '../services/workspaceService';
import {
  getWorkspaceEntries,
  createDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry
} from '../services/entryService';
import {
  initUserPresence,
  cleanupUserPresence,
  calculateGroupPresence
} from '../services/presenceService';
import {
  getWorkspaceCategories,
  addCustomCategory,
  updateCustomCategory,
  deleteCustomCategory
} from '../services/categoryService';
import {
  getWorkspaceMembers,
  addWorkspaceMember,
  updateMemberRole,
  removeWorkspaceMember,
  leaveWorkspace,
  WORKSPACE_ROLES,
  hasPermission
} from '../services/memberService';
import {
  createWorkspaceInvitation,
  validateInvitationToken,
  acceptWorkspaceInvitation,
  getWorkspaceInvitations,
  revokeInvitation,
  submitJoinRequest,
  getWorkspaceJoinRequests,
  processJoinRequest
} from '../services/invitationService';
import {
  getWorkspaceActivityLogs,
  logWorkspaceActivity,
  ACTIVITY_ACTIONS
} from '../services/activityService';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../services/notificationService';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { currentUser, userProfile, loading: authLoading, updateUserPreferences } = useAuth();
  const effectiveUid = currentUser?.uid || null;

  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState(null);
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const preferredWsIdRef = useRef(userProfile?.preferences?.lastActiveWorkspaceId || null);
  preferredWsIdRef.current = userProfile?.preferences?.lastActiveWorkspaceId || preferredWsIdRef.current;

  // Incoming invite link token detected from URL
  const [incomingInviteToken, setIncomingInviteToken] = useState(null);
  const [incomingInviteData, setIncomingInviteData] = useState(null);

  // Detect ?invite=TOKEN in URL on mount and persist across account registration/login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('invite');
    const urlWs = params.get('ws');

    if (urlToken) {
      try {
        sessionStorage.setItem('ninaivo_pending_invite_token', urlToken);
        localStorage.setItem('ninaivo_pending_invite_token', urlToken);
        if (urlWs) {
          sessionStorage.setItem('ninaivo_pending_invite_ws', urlWs);
          localStorage.setItem('ninaivo_pending_invite_ws', urlWs);
        }
      } catch (e) {}
    }

    const token = urlToken ||
                  sessionStorage.getItem('ninaivo_pending_invite_token') ||
                  localStorage.getItem('ninaivo_pending_invite_token');
    const wsHint = urlWs ||
                   sessionStorage.getItem('ninaivo_pending_invite_ws') ||
                   localStorage.getItem('ninaivo_pending_invite_ws');

    if (token) {
      setIncomingInviteToken(token);
      validateInvitationToken(token, wsHint).then(res => {
        if (res.valid) {
          setIncomingInviteData(res.invitation);
        }
      });
    }
  }, []);

  // Re-verify pending invitation when user authenticates or switches
  useEffect(() => {
    if (!currentUser?.uid) return;

    const token = incomingInviteToken ||
                  sessionStorage.getItem('ninaivo_pending_invite_token') ||
                  localStorage.getItem('ninaivo_pending_invite_token');
    const wsHint = sessionStorage.getItem('ninaivo_pending_invite_ws') ||
                   localStorage.getItem('ninaivo_pending_invite_ws');

    if (token) {
      setIncomingInviteToken(token);
      validateInvitationToken(token, wsHint).then(res => {
        if (res.valid) {
          setIncomingInviteData(res.invitation);
        }
      });
    }
  }, [currentUser?.uid]);

  // Load workspaces strictly after auth state is confirmed
  useEffect(() => {
    // Wait for Firebase Auth session resolution before attempting any workspace operations
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!currentUser?.uid) {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setEntries([]);
      setCategories([]);
      setMembers([]);
      setInvitations([]);
      setJoinRequests([]);
      setActivityLogs([]);
      setNotifications([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadWorkspaces() {
      setLoading(true);
      try {
        const list = await getWorkspacesForUser(currentUser.uid, currentUser.displayName);
        if (!isMounted) return;

        setWorkspaces(list);

        // Retrieve last active workspace preference (preserve already active workspace if still valid)
        const preferredWsId = preferredWsIdRef.current;
        const cachedWsId = localStorage.getItem(`pdt_last_active_ws_${currentUser.uid}`);
        const targetId = preferredWsId || cachedWsId;
        setCurrentWorkspaceState((prevWs) => {
          if (prevWs?.id) {
            const refreshedPrev = list.find(w => w.id === prevWs.id);
            if (refreshedPrev) return refreshedPrev;
          }
          return list.find(w => w.id === targetId) || list[0] || null;
        });
      } catch (err) {
        if (err?.code !== 'permission-denied') {
          console.error('Error loading workspaces:', err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadWorkspaces();
    return () => { isMounted = false; };
  }, [currentUser?.uid, currentUser?.displayName, authLoading]);

  // Load workspace-scoped data (entries, categories, members, invites, requests, activity)
  useEffect(() => {
    if (!currentWorkspace?.id || !currentUser?.uid) {
      setEntries([]);
      setCategories([]);
      setMembers([]);
      setInvitations([]);
      setJoinRequests([]);
      setActivityLogs([]);
      return;
    }

    let isMounted = true;
    localStorage.setItem(`pdt_last_active_ws_${currentUser.uid}`, currentWorkspace.id);
    if (updateUserPreferences) {
      updateUserPreferences({ lastActiveWorkspaceId: currentWorkspace.id }).catch(() => {});
    }

    let unsubEntries = () => {};
    let unsubMembers = () => {};

    async function loadWorkspaceData() {
      try {
        const isWsManager =
          currentWorkspace.ownerUid === currentUser.uid ||
          ['owner', 'admin'].includes(currentWorkspace.memberRoles?.[currentUser.uid]);

        const [
          wsEntries,
          wsCategories,
          wsMembers,
          wsInvs,
          wsReqs,
          wsLogs
        ] = await Promise.all([
          getWorkspaceEntries(currentWorkspace.id, currentWorkspace.type),
          getWorkspaceCategories(currentWorkspace.id),
          getWorkspaceMembers(currentWorkspace.id, currentWorkspace.ownerUid, {
            displayName: currentUser?.displayName,
            email: currentUser?.email,
            photoURL: currentUser?.photoURL
          }),
          currentWorkspace.type !== 'personal' && isWsManager ? getWorkspaceInvitations(currentWorkspace.id) : [],
          currentWorkspace.type !== 'personal' && isWsManager ? getWorkspaceJoinRequests(currentWorkspace.id) : [],
          getWorkspaceActivityLogs(currentWorkspace.id)
        ]);

        if (isMounted) {
          setEntries(wsEntries);
          setCategories(wsCategories);
          setMembers(wsMembers);
          setInvitations(wsInvs);
          setJoinRequests(wsReqs);
          setActivityLogs(wsLogs);
        }

        // Establish real-time onSnapshot listener for shared entries
        if (isFirebaseConfigured && auth?.currentUser) {
          try {
            const entriesRef = collection(db, 'workspaces', currentWorkspace.id, 'entries');
            const qEntries = query(entriesRef, orderBy('date', 'desc'));
            unsubEntries = onSnapshot(qEntries, (snapshot) => {
              if (!isMounted) return;
              const liveEntries = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
              }));
              setEntries(liveEntries);
              localStorage.setItem(`pdt_entries_${currentWorkspace.id}`, JSON.stringify(liveEntries));
            }, (err) => {
              if (err?.code !== 'permission-denied') {
                console.warn('Realtime entries subscription note:', err.message);
              }
            });
          } catch (e) {
            console.warn('Failed to attach realtime entries listener:', e.message);
          }

          // Establish real-time onSnapshot listener for members
          if (currentWorkspace.type !== 'personal') {
            try {
              const memsRef = collection(db, 'workspaces', currentWorkspace.id, 'members');
              unsubMembers = onSnapshot(memsRef, (snapshot) => {
                if (!isMounted) return;
                if (!snapshot.empty) {
                  const liveMembers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                  setMembers(liveMembers);
                  localStorage.setItem(`pdt_members_${currentWorkspace.id}`, JSON.stringify(liveMembers));
                }
              }, (err) => {
                if (err?.code !== 'permission-denied') {
                  console.warn('Realtime members subscription note:', err.message);
                }
              });
            } catch (e) {}
          }
        }
      } catch (err) {
        if (err?.code !== 'permission-denied') {
          console.error('Error loading workspace data:', err);
        }
      }
    }

    loadWorkspaceData();
    return () => {
      isMounted = false;
      unsubEntries();
      unsubMembers();
    };
  }, [currentWorkspace?.id, currentWorkspace?.type, currentWorkspace?.ownerUid, effectiveUid, currentUser]);

  // Real-time Authenticated Presence Lifecycle
  useEffect(() => {
    if (!currentUser?.uid || !currentWorkspace?.id) return;
    const cleanup = initUserPresence(currentUser, currentWorkspace.id);
    return () => {
      if (cleanup) cleanup();
    };
  }, [currentUser?.uid, currentWorkspace?.id]);

  // Load user notifications
  useEffect(() => {
    if (!effectiveUid) return;
    let isMounted = true;

    async function loadNotifs() {
      try {
        const notifs = await getUserNotifications(effectiveUid);
        if (isMounted) setNotifications(notifs);
      } catch (e) {
        if (e?.code !== 'permission-denied') {
          console.warn('Error loading notifications:', e);
        }
      }
    }

    loadNotifs();
    return () => { isMounted = false; };
  }, [effectiveUid]);

  // Compute Current User's Role in Active Workspace
  const isOwner = currentWorkspace?.ownerUid === effectiveUid;
  const currentMember = members.find(m => m.uid === effectiveUid);
  const currentUserRole = isOwner ? WORKSPACE_ROLES.OWNER : (currentMember?.role || WORKSPACE_ROLES.VIEWER);

  const canManageWorkspace = isOwner || currentUserRole === WORKSPACE_ROLES.ADMIN;
  const canWriteEntries = isOwner || currentUserRole === WORKSPACE_ROLES.ADMIN || currentUserRole === WORKSPACE_ROLES.EDITOR;

  const switchWorkspace = (workspaceOrId) => {
    if (!workspaceOrId) return;
    let target = null;
    if (typeof workspaceOrId === 'string') {
      target = workspaces.find(w => w.id === workspaceOrId) || null;
    } else if (typeof workspaceOrId === 'object' && workspaceOrId.id) {
      target = workspaceOrId;
    }
    if (target && target.id !== currentWorkspace?.id) {
      setCurrentWorkspaceState(target);
      if (effectiveUid) {
        localStorage.setItem(`pdt_last_active_ws_${effectiveUid}`, target.id);
        if (updateUserPreferences) {
          updateUserPreferences({ lastActiveWorkspaceId: target.id }).catch(() => {});
        }
      }
    }
  };

  const createNewWorkspace = async (data) => {
    const newWs = await createWorkspace(effectiveUid, data);
    setWorkspaces(prev => [...prev, newWs]);
    setCurrentWorkspaceState(newWs);

    await logWorkspaceActivity(newWs.id, {
      action: ACTIVITY_ACTIONS.SETTINGS_CHANGED,
      details: `Created workspace "${newWs.name}" (${newWs.type} mode).`,
      user: currentUser
    });

    return newWs;
  };

  const updateCurrentWorkspace = async (updates) => {
    if (!currentWorkspace) return;
    const updated = await updateWorkspace(effectiveUid, currentWorkspace.id, updates);
    setWorkspaces(prev => prev.map(w => w.id === currentWorkspace.id ? updated : w));
    setCurrentWorkspaceState(updated);

    await logWorkspaceActivity(currentWorkspace.id, {
      action: ACTIVITY_ACTIONS.SETTINGS_CHANGED,
      details: `Updated workspace details: ${updated.name}.`,
      user: currentUser
    });

    return updated;
  };

  const removeWorkspace = async (workspaceId) => {
    const updatedList = await deleteWorkspace(effectiveUid, workspaceId);
    setWorkspaces(updatedList);
    if (currentWorkspace?.id === workspaceId) {
      setCurrentWorkspaceState(updatedList[0] || null);
    }
    return updatedList;
  };

  // Entry CRUD with Audit Logging & Permissions
  const addEntry = async (entryData, targetWsId = null) => {
    const wsId = targetWsId || entryData.workspaceId || currentWorkspace?.id;
    if (!wsId) throw new Error('No active workspace selected.');

    const targetWs = workspaces.find(w => w.id === wsId) || currentWorkspace;

    // Check write permissions on target workspace
    const isTargetOwner = targetWs.ownerUid === effectiveUid;
    const targetMember = (members && targetWs.id === currentWorkspace?.id)
      ? members.find(m => m.uid === effectiveUid)
      : null;
    const targetRole = isTargetOwner
      ? WORKSPACE_ROLES.OWNER
      : (targetWs.memberRoles?.[effectiveUid] || targetMember?.role || (isOwner ? WORKSPACE_ROLES.OWNER : WORKSPACE_ROLES.VIEWER));

    const canWriteTarget = isTargetOwner || ['owner', 'admin', 'editor'].includes(targetRole);
    if (!canWriteTarget) {
      throw new Error('Viewers have read-only access and cannot create diary entries.');
    }

    const fullData = {
      ...entryData,
      workspaceId: wsId,
      createdByUid: effectiveUid,
      authorName: currentUser?.displayName || 'Diary Author',
      authorAvatar: currentUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      currency: targetWs.settings?.currency || '₹'
    };
    const created = await createDiaryEntry(wsId, fullData);

    // If destination matches current active workspace, immediately update local state
    if (currentWorkspace?.id === wsId) {
      setEntries(prev => [created, ...prev.filter(e => e.id !== created.id)]);
    } else {
      // Auto-switch to destination workspace so user sees their new entry immediately
      switchWorkspace(targetWs);
    }

    // Audit Log
    const act = await logWorkspaceActivity(wsId, {
      action: ACTIVITY_ACTIONS.ENTRY_CREATED,
      details: `Added new diary note: "${created.title}".`,
      entryId: created.id,
      user: currentUser
    });
    if (act && currentWorkspace?.id === wsId) setActivityLogs(prev => [act, ...prev]);

    return created;
  };

  const editEntry = async (entryId, updates, options = {}) => {
    const wsId = options.workspaceId || updates.workspaceId || currentWorkspace?.id;
    if (!wsId) return;

    const target = entries.find(e => e.id === entryId);
    if (currentUserRole === WORKSPACE_ROLES.EDITOR && target?.createdByUid && target.createdByUid !== effectiveUid) {
      throw new Error('Editors can only edit their own entries.');
    }

    const res = await updateDiaryEntry(wsId, entryId, updates, {
      baseVersion: target?.version || 1,
      baseUpdatedAt: target?.updatedAt,
      ...options
    });

    if (res && res.conflict) {
      return res; // Propagate conflict to caller for interactive user resolution
    }

    if (currentWorkspace?.id === wsId) {
      setEntries(prev => prev.map(e => e.id === entryId ? res : e));
    }

    const act = await logWorkspaceActivity(wsId, {
      action: ACTIVITY_ACTIONS.ENTRY_EDITED,
      details: `Edited diary note: "${res.title}".`,
      entryId,
      user: currentUser
    });
    if (act && currentWorkspace?.id === wsId) setActivityLogs(prev => [act, ...prev]);

    return res;
  };

  const removeEntry = async (entryId) => {
    if (!currentWorkspace) return;
    if (!canWriteEntries) {
      throw new Error('Viewers have read-only access and cannot delete entries.');
    }

    const target = entries.find(e => e.id === entryId);
    if (currentUserRole === WORKSPACE_ROLES.EDITOR && target?.createdByUid !== effectiveUid) {
      throw new Error('Editors can only delete their own entries.');
    }

    await deleteDiaryEntry(currentWorkspace.id, entryId);
    setEntries(prev => prev.filter(e => e.id !== entryId));

    const act = await logWorkspaceActivity(currentWorkspace.id, {
      action: ACTIVITY_ACTIONS.ENTRY_DELETED,
      details: `Deleted diary note: "${target?.title || entryId}".`,
      entryId,
      user: currentUser
    });
    if (act) setActivityLogs(prev => [act, ...prev]);
  };

  // Category CRUD
  const addCategory = async (name) => {
    if (!currentWorkspace) return;
    if (!canWriteEntries) throw new Error('Permission denied.');
    const created = await addCustomCategory(currentWorkspace.id, name, effectiveUid);
    setCategories(prev => [...prev, created]);
    return created;
  };

  const editCategory = async (categoryId, newName) => {
    if (!currentWorkspace) return;
    if (!canWriteEntries) throw new Error('Permission denied.');
    const updated = await updateCustomCategory(currentWorkspace.id, categoryId, newName);
    setCategories(prev => prev.map(c => c.id === categoryId ? updated : c));
    return updated;
  };

  const removeCategory = async (categoryId) => {
    if (!currentWorkspace) return;
    if (!canWriteEntries) throw new Error('Permission denied.');
    await deleteCustomCategory(currentWorkspace.id, categoryId);
    setCategories(prev => prev.filter(c => c.id !== categoryId));
  };

  // Member Management
  const changeMemberRole = async (targetUid, newRole) => {
    if (!canManageWorkspace) throw new Error('Only owners and admins can manage roles.');
    const updated = await updateMemberRole(currentWorkspace.id, targetUid, newRole, currentUser, currentWorkspace);
    setMembers(updated);
    const logs = await getWorkspaceActivityLogs(currentWorkspace.id);
    setActivityLogs(logs);
  };

  const removeMember = async (targetUid) => {
    if (!canManageWorkspace) throw new Error('Only owners and admins can remove members.');
    const updated = await removeWorkspaceMember(currentWorkspace.id, targetUid, currentUser, currentWorkspace);
    setMembers(updated);
    const logs = await getWorkspaceActivityLogs(currentWorkspace.id);
    setActivityLogs(logs);
  };

  const leaveCurrentWs = async () => {
    const updated = await leaveWorkspace(currentWorkspace.id, currentUser || { uid: effectiveUid }, currentWorkspace);
    setMembers(updated);
    const remaining = workspaces.filter(w => w.id !== currentWorkspace.id);
    setCurrentWorkspaceState(remaining[0] || null);
  };

  // Invitations
  const generateInvitation = async ({ invitedEmail, role, relationship, expiresInHours }) => {
    if (!canManageWorkspace) throw new Error('Permission denied.');
    const res = await createWorkspaceInvitation(currentWorkspace, { invitedEmail, role, relationship, expiresInHours }, currentUser);
    setInvitations(prev => [res, ...prev]);
    const logs = await getWorkspaceActivityLogs(currentWorkspace.id);
    setActivityLogs(logs);
    return res;
  };

  const revokeExistingInvite = async (invitationId) => {
    if (!canManageWorkspace) throw new Error('Permission denied.');
    const updated = await revokeInvitation(currentWorkspace.id, invitationId, currentUser);
    setInvitations(updated);
    const logs = await getWorkspaceActivityLogs(currentWorkspace.id);
    setActivityLogs(logs);
  };

  // Direct Accept & Land in Workspace via Invitation Link
  const handleAcceptInvite = async (token) => {
    const tokenToUse = token || incomingInviteToken ||
                       sessionStorage.getItem('ninaivo_pending_invite_token') ||
                       localStorage.getItem('ninaivo_pending_invite_token');
    if (!tokenToUse) throw new Error('Missing invitation token.');

    const wsHint = sessionStorage.getItem('ninaivo_pending_invite_ws') ||
                   localStorage.getItem('ninaivo_pending_invite_ws') ||
                   new URLSearchParams(window.location.search).get('ws');

    const result = await acceptWorkspaceInvitation(tokenToUse, currentUser || { uid: effectiveUid }, wsHint);

    if (result.success) {
      // 1. Reload user workspaces from cloud Firestore
      const userWorkspaces = await getWorkspacesForUser(currentUser.uid, currentUser.displayName);
      setWorkspaces(userWorkspaces);

      // 2. Locate joined workspace and set as active
      const targetWorkspace = userWorkspaces.find(w => w.id === result.workspaceId);
      if (targetWorkspace) {
        setCurrentWorkspaceState(targetWorkspace);
        localStorage.setItem(`pdt_last_active_ws_${currentUser.uid}`, targetWorkspace.id);
        if (updateUserPreferences) {
          updateUserPreferences({ lastActiveWorkspaceId: targetWorkspace.id }).catch(() => {});
        }
      }

      // 3. Clear pending invite artifacts
      setIncomingInviteToken(null);
      setIncomingInviteData(null);
      try {
        sessionStorage.removeItem('ninaivo_pending_invite_token');
        sessionStorage.removeItem('ninaivo_pending_invite_ws');
        localStorage.removeItem('ninaivo_pending_invite_token');
        localStorage.removeItem('ninaivo_pending_invite_ws');
      } catch (e) {}
      window.history.replaceState({}, document.title, window.location.pathname);

      return { success: true, workspace: targetWorkspace };
    }

    return result;
  };

  // Join Requests
  const requestToJoinWithToken = async (token) => {
    const tokenToUse = token || incomingInviteToken ||
                       sessionStorage.getItem('ninaivo_pending_invite_token') ||
                       localStorage.getItem('ninaivo_pending_invite_token');
    if (!tokenToUse) throw new Error('Missing invitation token.');
    const req = await submitJoinRequest(tokenToUse, currentUser || { uid: effectiveUid });
    return req;
  };

  const handleProcessJoinRequest = async (requestId, action) => {
    if (!canManageWorkspace) throw new Error('Permission denied.');
    const updatedReqs = await processJoinRequest(currentWorkspace, requestId, action, currentUser);
    setJoinRequests(updatedReqs);

    // Refresh members and activity
    const [updatedMembers, updatedLogs] = await Promise.all([
      getWorkspaceMembers(currentWorkspace.id, currentWorkspace.ownerUid),
      getWorkspaceActivityLogs(currentWorkspace.id)
    ]);
    setMembers(updatedMembers);
    setActivityLogs(updatedLogs);
  };

  // Notification actions
  const readNotification = async (notifId) => {
    const updated = await markNotificationAsRead(effectiveUid, notifId);
    setNotifications(updated);
  };

  const readAllNotifications = async () => {
    const updated = await markAllNotificationsAsRead(effectiveUid);
    setNotifications(updated);
  };

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  const value = {
    workspaces,
    currentWorkspace,
    entries,
    categories,
    members,
    invitations,
    joinRequests,
    activityLogs,
    notifications,
    unreadNotificationCount,
    loading,
    currentUserRole,
    isOwner,
    canManageWorkspace,
    canWriteEntries,
    incomingInviteToken,
    incomingInviteData,
    clearIncomingInvite: () => {
      setIncomingInviteToken(null);
      setIncomingInviteData(null);
      try {
        sessionStorage.removeItem('ninaivo_pending_invite_token');
        sessionStorage.removeItem('ninaivo_pending_invite_ws');
        localStorage.removeItem('ninaivo_pending_invite_token');
        localStorage.removeItem('ninaivo_pending_invite_ws');
      } catch (e) {}
      window.history.replaceState({}, document.title, window.location.pathname);
    },
    acceptInvite: handleAcceptInvite,
    handleAcceptInvite,
    switchWorkspace,
    createNewWorkspace,
    updateCurrentWorkspace,
    removeWorkspace,
    addEntry,
    editEntry,
    removeEntry,
    addCategory,
    editCategory,
    removeCategory,
    changeMemberRole,
    removeMember,
    leaveCurrentWs,
    generateInvitation,
    revokeExistingInvite,
    requestToJoinWithToken,
    handleProcessJoinRequest,
    readNotification,
    readAllNotifications,
    calculateGroupPresence,
    refreshActivityLogs: async () => {
      if (currentWorkspace?.id) {
        const logs = await getWorkspaceActivityLogs(currentWorkspace.id);
        setActivityLogs(logs);
      }
    }
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
