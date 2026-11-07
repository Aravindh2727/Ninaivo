import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Incoming invite link token detected from URL
  const [incomingInviteToken, setIncomingInviteToken] = useState(null);
  const [incomingInviteData, setIncomingInviteData] = useState(null);

  // Detect ?invite=TOKEN in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (token) {
      setIncomingInviteToken(token);
      validateInvitationToken(token).then(res => {
        if (res.valid) {
          setIncomingInviteData(res.invitation);
        }
      });
    }
  }, []);

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

        // Retrieve last active workspace preference (cloud profile preference first, then local cache)
        const preferredWsId = userProfile?.preferences?.lastActiveWorkspaceId;
        const cachedWsId = localStorage.getItem(`pdt_last_active_ws_${currentUser.uid}`);
        const targetId = preferredWsId || cachedWsId;
        const found = list.find(w => w.id === targetId) || list[0];
        setCurrentWorkspaceState(found || null);
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
  }, [currentUser?.uid, currentUser?.displayName, authLoading, userProfile?.preferences?.lastActiveWorkspaceId]);

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

    async function loadWorkspaceData() {
      try {
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
          currentWorkspace.type !== 'personal' ? getWorkspaceInvitations(currentWorkspace.id) : [],
          currentWorkspace.type !== 'personal' ? getWorkspaceJoinRequests(currentWorkspace.id) : [],
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
      } catch (err) {
        if (err?.code !== 'permission-denied') {
          console.error('Error loading workspace data:', err);
        }
      }
    }

    loadWorkspaceData();
    return () => { isMounted = false; };
  }, [currentWorkspace?.id, currentWorkspace?.type, currentWorkspace?.ownerUid, effectiveUid, currentUser]);

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

  const switchWorkspace = (workspace) => {
    if (workspace && workspace.id !== currentWorkspace?.id) {
      setCurrentWorkspaceState(workspace);
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
  const addEntry = async (entryData) => {
    if (!currentWorkspace) throw new Error('No active workspace selected.');
    if (!canWriteEntries) {
      throw new Error('Viewers have read-only access and cannot create diary entries.');
    }

    const fullData = {
      ...entryData,
      createdByUid: effectiveUid,
      authorName: currentUser?.displayName || 'Diary Author',
      authorAvatar: currentUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      currency: currentWorkspace.settings?.currency || '₹'
    };
    const created = await createDiaryEntry(currentWorkspace.id, fullData);
    setEntries(prev => [created, ...prev]);

    // Audit Log
    const act = await logWorkspaceActivity(currentWorkspace.id, {
      action: ACTIVITY_ACTIONS.ENTRY_CREATED,
      details: `Added new diary note: "${created.title}".`,
      entryId: created.id,
      user: currentUser
    });
    if (act) setActivityLogs(prev => [act, ...prev]);

    return created;
  };

  const editEntry = async (entryId, updates, options = {}) => {
    if (!currentWorkspace) return;
    if (!canWriteEntries) {
      throw new Error('Viewers have read-only access and cannot edit entries.');
    }

    const target = entries.find(e => e.id === entryId);
    if (currentUserRole === WORKSPACE_ROLES.EDITOR && target?.createdByUid !== effectiveUid) {
      throw new Error('Editors can only edit their own entries.');
    }

    const res = await updateDiaryEntry(currentWorkspace.id, entryId, updates, {
      baseVersion: target?.version || 1,
      baseUpdatedAt: target?.updatedAt,
      ...options
    });

    if (res && res.conflict) {
      return res; // Propagate conflict to caller for interactive user resolution
    }

    setEntries(prev => prev.map(e => e.id === entryId ? res : e));

    const act = await logWorkspaceActivity(currentWorkspace.id, {
      action: ACTIVITY_ACTIONS.ENTRY_EDITED,
      details: `Edited diary note: "${res.title}".`,
      entryId,
      user: currentUser
    });
    if (act) setActivityLogs(prev => [act, ...prev]);

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
  const generateInvitation = async ({ invitedEmail, role, expiresInHours }) => {
    if (!canManageWorkspace) throw new Error('Permission denied.');
    const res = await createWorkspaceInvitation(currentWorkspace, { invitedEmail, role, expiresInHours }, currentUser);
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

  // Join Requests
  const requestToJoinWithToken = async (token) => {
    const req = await submitJoinRequest(token, currentUser || { uid: effectiveUid });
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
      window.history.replaceState({}, document.title, window.location.pathname);
    },
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
