import { 
  collection, 
  doc, 
  updateDoc, 
  deleteField,
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase/config.js';

// Active session tracking across browser tabs
const SESSION_STORAGE_KEY = 'pdt_presence_session_id';

function getOrCreateSessionId() {
  if (typeof window === 'undefined') return 'session_ssr';
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

let activePresenceCleanup = null;
let currentActiveUid = null;
let currentActiveWsId = null;

/**
 * Initialize presence tracking for the authenticated user session.
 * Handles connect, disconnect, tab closure, and visibility changes.
 */
export function initUserPresence(currentUser, activeWorkspaceId) {
  if (typeof window === 'undefined' || !currentUser?.uid) return () => {};

  const uid = currentUser.uid;
  const sessionId = getOrCreateSessionId();
  currentActiveUid = uid;
  currentActiveWsId = activeWorkspaceId;

  // Clean up any existing presence listeners
  if (activePresenceCleanup) {
    activePresenceCleanup();
    activePresenceCleanup = null;
  }

  // Update member presence in Firestore when workspace is non-personal
  const updatePresenceStatus = async (isOnline) => {
    if (!isFirebaseConfigured || !auth?.currentUser || !currentActiveWsId) return;

    try {
      const memberRef = doc(db, 'workspaces', currentActiveWsId, 'members', uid);
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      if (isOnline) {
        await updateDoc(memberRef, {
          isOnline: true,
          lastSeen: nowIso,
          lastSessionId: sessionId,
          [`activeSessions.${sessionId}`]: nowMs
        });
      } else {
        await updateDoc(memberRef, {
          [`activeSessions.${sessionId}`]: deleteField()
        });
      }
    } catch {
      // Ignored for personal workspaces or if member document does not exist yet
    }
  };

  // Mark online on session start
  updatePresenceStatus(true);

  // Tab unload / page hide handlers
  const handleUnload = () => {
    updatePresenceStatus(false);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      updatePresenceStatus(false);
    } else {
      updatePresenceStatus(true);
    }
  };

  window.addEventListener('beforeunload', handleUnload);
  window.addEventListener('pagehide', handleUnload);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Periodic lightweight heartbeat (every 2.5 minutes) while tab is visible
  const heartbeatInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      updatePresenceStatus(true);
    }
  }, 150000);

  activePresenceCleanup = () => {
    clearInterval(heartbeatInterval);
    window.removeEventListener('beforeunload', handleUnload);
    window.removeEventListener('pagehide', handleUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    updatePresenceStatus(false);
  };

  return activePresenceCleanup;
}

/**
 * Clean up presence tracking
 */
export function cleanupUserPresence() {
  if (activePresenceCleanup) {
    activePresenceCleanup();
    activePresenceCleanup = null;
  }
}

/**
 * Calculate genuine presence statistics for a workspace.
 * Accepts only genuine active accepted members (excludes pending and removed).
 * Automatically marks the current active user as online.
 * Evaluates multi-session activeSessions to prevent premature offline marking when closing one of multiple tabs.
 */
export function calculateGroupPresence(members = [], currentUserId = null) {
  // Only accepted, active members or owner
  const acceptedMembers = (members || []).filter(m => 
    m && (m.status === 'active' || m.role === 'owner')
  );

  const now = Date.now();
  let onlineCount = 0;

  const memberPresenceList = acceptedMembers.map(member => {
    const isSelf = Boolean(currentUserId && member.uid === currentUserId);
    
    // Parse lastSeen timestamp
    let lastSeenMs = 0;
    if (member.lastSeen) {
      if (typeof member.lastSeen?.toMillis === 'function') {
        lastSeenMs = member.lastSeen.toMillis();
      } else if (typeof member.lastSeen?.toDate === 'function') {
        lastSeenMs = member.lastSeen.toDate().getTime();
      } else if (typeof member.lastSeen === 'number') {
        lastSeenMs = member.lastSeen;
      } else {
        const parsed = new Date(member.lastSeen).getTime();
        lastSeenMs = isNaN(parsed) ? 0 : parsed;
      }
    }

    // Check multi-session active sessions
    let hasValidSession = false;
    if (member.activeSessions && typeof member.activeSessions === 'object') {
      const timestamps = Object.values(member.activeSessions);
      hasValidSession = timestamps.some(ts => {
        let tsMs = 0;
        if (typeof ts === 'number') tsMs = ts;
        else if (typeof ts?.toMillis === 'function') tsMs = ts.toMillis();
        else {
          const p = new Date(ts).getTime();
          tsMs = isNaN(p) ? 0 : p;
        }
        return tsMs > 0 && (now - tsMs < 300000); // within 5 minutes
      });
    }

    // A member is genuinely online if:
    // 1. It is the authenticated user in this session.
    // 2. Or they have at least one active valid session in activeSessions (< 5 min).
    // 3. Or (backward compatibility) isOnline flag is true AND lastSeen was within the last 5 minutes.
    const isOnline = isSelf || hasValidSession || (Boolean(member.isOnline) && (now - lastSeenMs < 300000));
    if (isOnline) onlineCount++;

    return {
      ...member,
      isOnline,
      lastSeenFormatted: isOnline ? 'Online' : (lastSeenMs ? new Date(lastSeenMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Offline')
    };
  });

  const totalMembers = acceptedMembers.length;
  const offlineCount = Math.max(0, totalMembers - onlineCount);

  return {
    totalMembers,
    onlineCount,
    offlineCount,
    membersWithPresence: memberPresenceList
  };
}
