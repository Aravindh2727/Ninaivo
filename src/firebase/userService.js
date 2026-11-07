import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './config';

const USERS_COLLECTION = 'users';

/**
 * Creates or synchronizes a user profile in Firestore
 */
export async function createUserProfileDocument(user, additionalData = {}) {
  if (!user) return null;

  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const localCacheKey = `pdt_user_profile_${user.uid}`;

  const baseProfile = {
    uid: user.uid,
    email: user.email,
    displayName: additionalData.displayName || user.displayName || 'Diary Creator',
    photoURL: additionalData.photoURL || user.photoURL || '',
    diaryMode: additionalData.diaryMode || 'personal', // 'personal' | 'family' | 'business'
    bio: additionalData.bio || 'Organizing my thoughts, milestones, and reflections.',
    phone: additionalData.phone || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    preferences: {
      theme: 'dark',
      compactView: false,
      emailNotifications: true,
      autoSave: true,
      ...(additionalData.preferences || {})
    },
    authProvider: user.providerData?.[0]?.providerId || 'password',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    ...additionalData
  };

  // Cache locally
  localStorage.setItem(localCacheKey, JSON.stringify(baseProfile));

  if (!isFirebaseConfigured || !auth.currentUser || auth.currentUser.uid !== user.uid) {
    return baseProfile;
  }

  try {
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      await setDoc(userRef, {
        ...baseProfile,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
      return baseProfile;
    } else {
      // Update last login
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp()
      });
      return { ...snapshot.data(), ...baseProfile, ...snapshot.data() };
    }
  } catch (err) {
    if (err?.code !== 'permission-denied') {
      console.warn('Firestore profile sync fallback (using local cache):', err.message);
    }
    return baseProfile;
  }
}

/**
 * Retrieves the user profile from Firestore or local cache
 */
export async function getUserProfile(userId) {
  if (!userId) return null;

  const localCacheKey = `pdt_user_profile_${userId}`;
  const cached = localStorage.getItem(localCacheKey);
  const parsedCached = cached ? JSON.parse(cached) : null;

  if (!isFirebaseConfigured || !auth.currentUser || auth.currentUser.uid !== userId) {
    return parsedCached;
  }

  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      localStorage.setItem(localCacheKey, JSON.stringify(data));
      return data;
    }
    return parsedCached;
  } catch (err) {
    if (err?.code !== 'permission-denied') {
      console.warn('Error fetching Firestore user profile:', err.message);
    }
    return parsedCached;
  }
}

/**
 * Updates user profile fields in Firestore and local cache
 */
export async function updateUserProfileDocument(userId, updates = {}) {
  if (!userId) throw new Error('Missing user ID');

  const localCacheKey = `pdt_user_profile_${userId}`;
  const existing = await getUserProfile(userId) || {};
  const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };

  localStorage.setItem(localCacheKey, JSON.stringify(merged));

  if (!isFirebaseConfigured || !auth.currentUser || auth.currentUser.uid !== userId) {
    return merged;
  }

  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return merged;
  } catch (err) {
    if (err?.code !== 'permission-denied') {
      console.warn('Firestore updateDoc warning (persisted locally):', err.message);
    }
    return merged;
  }
}

