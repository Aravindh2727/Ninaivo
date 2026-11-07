import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './config';

const USERS_COLLECTION = 'users';

/**
 * Creates or synchronizes a user profile in Firestore and local storage.
 * Never overwrites existing user preferences with initial defaults.
 */
export async function createUserProfileDocument(user, additionalData = {}) {
  if (!user) return null;

  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const localCacheKey = `pdt_user_profile_${user.uid}`;
  const existingCacheRaw = localStorage.getItem(localCacheKey);
  const existingCache = existingCacheRaw ? JSON.parse(existingCacheRaw) : null;

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
      theme: 'light',
      language: 'en',
      compactView: false,
      emailNotifications: true,
      autoSave: true,
      ...(existingCache?.preferences || {}),
      ...(additionalData.preferences || {})
    },
    authProvider: user.providerData?.[0]?.providerId || 'password',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    ...additionalData
  };

  // If Firebase is available and authenticated, sync with Cloud Firestore
  if (isFirebaseConfigured && auth.currentUser && auth.currentUser.uid === user.uid) {
    try {
      const snapshot = await getDoc(userRef);
      if (!snapshot.exists()) {
        await setDoc(userRef, {
          ...baseProfile,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        }, { merge: true });
        localStorage.setItem(localCacheKey, JSON.stringify(baseProfile));
        return baseProfile;
      } else {
        const remoteData = snapshot.data();
        // Server profile takes precedence, preserving user's cloud-saved preferences
        const merged = {
          ...baseProfile,
          ...remoteData,
          preferences: {
            ...baseProfile.preferences,
            ...(remoteData.preferences || {})
          },
          lastLoginAt: new Date().toISOString()
        };
        await setDoc(userRef, {
          lastLoginAt: serverTimestamp()
        }, { merge: true });
        localStorage.setItem(localCacheKey, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore profile sync note (using cached profile):', err.message);
      }
    }
  }

  // Fallback to local cache or freshly initialized base profile
  const finalProfile = existingCache ? { ...baseProfile, ...existingCache } : baseProfile;
  localStorage.setItem(localCacheKey, JSON.stringify(finalProfile));
  return finalProfile;
}

/**
 * Retrieves the user profile from Cloud Firestore (authoritative) or local cache fallback
 */
export async function getUserProfile(userId) {
  if (!userId) return null;

  const localCacheKey = `pdt_user_profile_${userId}`;
  const cached = localStorage.getItem(localCacheKey);
  const parsedCached = cached ? JSON.parse(cached) : null;

  // Always attempt authoritative Firestore read if online & authenticated
  if (isFirebaseConfigured && auth.currentUser && auth.currentUser.uid === userId) {
    try {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        localStorage.setItem(localCacheKey, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Error fetching Firestore user profile (falling back to cache):', err.message);
      }
    }
  }

  return parsedCached;
}

/**
 * Updates user profile fields in Firestore and local cache using merge setDoc
 */
export async function updateUserProfileDocument(userId, updates = {}) {
  if (!userId) throw new Error('Missing user ID');

  const localCacheKey = `pdt_user_profile_${userId}`;
  const existing = await getUserProfile(userId) || {};
  
  const merged = { 
    ...existing, 
    ...updates, 
    preferences: {
      ...(existing.preferences || {}),
      ...(updates.preferences || {})
    },
    updatedAt: new Date().toISOString() 
  };

  localStorage.setItem(localCacheKey, JSON.stringify(merged));

  // Sync preference keys to localStorage for instant UI consistency
  if (updates.preferences?.theme) {
    localStorage.setItem('ninaivo_theme', updates.preferences.theme);
    localStorage.setItem('pdt_theme', updates.preferences.theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', updates.preferences.theme);
    }
  }
  if (updates.preferences?.language) {
    localStorage.setItem('pdt_language', updates.preferences.language);
  }

  if (!isFirebaseConfigured || !auth.currentUser || auth.currentUser.uid !== userId) {
    return merged;
  }

  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return merged;
  } catch (err) {
    if (err?.code !== 'permission-denied') {
      console.warn('Firestore updateUserProfileDocument network warning:', err.message);
    }
    return merged;
  }
}
