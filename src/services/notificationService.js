import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../firebase/config.js';

export const NOTIFICATION_TYPES = {
  JOIN_REQUEST: 'join_request',
  REQUEST_ACCEPTED: 'request_accepted',
  REQUEST_REJECTED: 'request_rejected',
  MEMBER_REMOVED: 'member_removed',
  MEMBER_JOINED: 'member_joined',
  WORKSPACE_ACTIVITY: 'workspace_activity'
};

/**
 * Create an in-app notification for a user
 */
export async function createUserNotification(recipientUid, notificationData) {
  if (!recipientUid) return null;

  const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const record = {
    id: notifId,
    type: notificationData.type || NOTIFICATION_TYPES.WORKSPACE_ACTIVITY,
    title: notificationData.title || 'Workspace Update',
    message: notificationData.message || '',
    workspaceId: notificationData.workspaceId || null,
    workspaceName: notificationData.workspaceName || '',
    read: false,
    createdAt: new Date().toISOString()
  };

  const localKey = `pdt_notifications_${recipientUid}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const updated = [record, ...existing];
  localStorage.setItem(localKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const notifRef = doc(db, 'users', recipientUid, 'notifications', notifId);
      await setDoc(notifRef, {
        ...record,
        serverCreatedAt: serverTimestamp()
      });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore notification save warning:', err.message);
      }
    }
  }

  return record;
}

/**
 * Fetch all notifications for a user
 */
export async function getUserNotifications(uid) {
  if (!uid) return [];

  const localKey = `pdt_notifications_${uid}`;
  let notifs = null;

  // 1. Authoritative Cloud Firestore read when online & authenticated
  if (isFirebaseConfigured && auth?.currentUser && auth.currentUser.uid === uid) {
    try {
      const notifsRef = collection(db, 'users', uid, 'notifications');
      const q = query(notifsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        notifs = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        localStorage.setItem(localKey, JSON.stringify(notifs));
        return notifs;
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Could not fetch notifications from Firestore:', err.message);
      }
    }
  }

  // 2. Local fallback
  const cached = localStorage.getItem(localKey);
  notifs = cached ? JSON.parse(cached) : [];
  return notifs;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(uid, notificationId) {
  if (!uid || !notificationId) return;

  const localKey = `pdt_notifications_${uid}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const updated = existing.map(n => n.id === notificationId ? { ...n, read: true } : n);
  localStorage.setItem(localKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser && auth.currentUser.uid === uid) {
    try {
      const notifRef = doc(db, 'users', uid, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore update notification warning:', err.message);
      }
    }
  }

  return updated;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(uid) {
  if (!uid) return [];

  const localKey = `pdt_notifications_${uid}`;
  const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
  const updated = existing.map(n => ({ ...n, read: true }));
  localStorage.setItem(localKey, JSON.stringify(updated));

  if (isFirebaseConfigured) {
    for (const notif of existing.filter(n => !n.read)) {
      try {
        const notifRef = doc(db, 'users', uid, 'notifications', notif.id);
        await updateDoc(notifRef, { read: true });
      } catch (e) {
        // ignore individual fail
      }
    }
  }

  return updated;
}

