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
import { DEFAULT_PREDEFINED_CATEGORIES } from './workspaceService';

/**
 * Get categories for a specific workspace (predefined + custom)
 */
export async function getWorkspaceCategories(workspaceId) {
  if (!workspaceId) return DEFAULT_PREDEFINED_CATEGORIES.map(name => ({ id: name, name, isCustom: false }));

  const localCacheKey = `pdt_categories_${workspaceId}`;
  const cached = localStorage.getItem(localCacheKey);
  let customCategories = cached ? JSON.parse(cached) : null;

  if (customCategories === null && isFirebaseConfigured && auth?.currentUser) {
    try {
      const catRef = collection(db, 'workspaces', workspaceId, 'categories');
      const snapshot = await getDocs(catRef);
      if (!snapshot.empty) {
        customCategories = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        localStorage.setItem(localCacheKey, JSON.stringify(customCategories));
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Could not fetch custom categories from Firestore:', err.message);
      }
    }
  }

  if (!customCategories) {
    customCategories = [];
    localStorage.setItem(localCacheKey, JSON.stringify(customCategories));
  }

  // Predefined default categories
  const predefinedList = DEFAULT_PREDEFINED_CATEGORIES.map(name => ({
    id: `predefined-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    isCustom: false
  }));

  // Combine predefined with user's custom categories
  return [...predefinedList, ...customCategories];
}

/**
 * Add a new custom category to the workspace
 */
export async function addCustomCategory(workspaceId, name, uid) {
  if (!workspaceId || !name || !name.trim()) {
    throw new Error('Valid category name required.');
  }

  const trimmed = name.trim();
  const categoryId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newCat = {
    id: categoryId,
    workspaceId,
    name: trimmed,
    isCustom: true,
    createdByUid: uid || 'anonymous',
    createdAt: new Date().toISOString()
  };

  const localCacheKey = `pdt_categories_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  
  // Avoid duplicates
  if (existing.some(c => c.name.toLowerCase() === trimmed.toLowerCase()) || 
      DEFAULT_PREDEFINED_CATEGORIES.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`Category "${trimmed}" already exists.`);
  }

  const updated = [...existing, newCat];
  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const docRef = doc(db, 'workspaces', workspaceId, 'categories', categoryId);
      await setDoc(docRef, {
        ...newCat,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore add category warning:', err.message);
      }
    }
  }

  return newCat;
}

/**
 * Rename an existing custom category
 */
export async function updateCustomCategory(workspaceId, categoryId, newName) {
  if (!workspaceId || !categoryId || !newName || !newName.trim()) return null;

  const localCacheKey = `pdt_categories_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const updated = existing.map(cat => {
    if (cat.id === categoryId) {
      return { ...cat, name: newName.trim(), updatedAt: new Date().toISOString() };
    }
    return cat;
  });

  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const docRef = doc(db, 'workspaces', workspaceId, 'categories', categoryId);
      await updateDoc(docRef, {
        name: newName.trim(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore update category warning:', err.message);
      }
    }
  }

  return updated.find(c => c.id === categoryId);
}

/**
 * Delete a custom category from the workspace
 */
export async function deleteCustomCategory(workspaceId, categoryId) {
  if (!workspaceId || !categoryId) return [];

  const localCacheKey = `pdt_categories_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const updated = existing.filter(cat => cat.id !== categoryId);

  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const docRef = doc(db, 'workspaces', workspaceId, 'categories', categoryId);
      await deleteDoc(docRef);
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore delete category warning:', err.message);
      }
    }
  }

  return updated;
}

