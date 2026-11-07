import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config.js';
import { isOnline, queueOfflineMutation, recordLastSyncTime } from './syncService.js';
import { detectLanguage, getCachedTranslationSync } from './translationService.js';

/**
 * Fetch all entries for a specific workspace.
 * Uses Authoritative Cloud-First fetch when online with offline local cache fallback.
 * Never seeds fake demo or sample records in production.
 */
export async function getWorkspaceEntries(workspaceId, workspaceType = 'personal') {
  if (!workspaceId) return [];

  const localCacheKey = `pdt_entries_${workspaceId}`;

  // 1. Authoritative Cloud Firestore read when online and authenticated
  if (isOnline() && isFirebaseConfigured && auth?.currentUser) {
    try {
      const entriesRef = collection(db, 'workspaces', workspaceId, 'entries');
      const q = query(entriesRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);

      let entries = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      // Ensure multilingual detection fields exist
      entries = entries.map(e => {
        let updatedEntry = e;
        if (!updatedEntry.sourceLanguage || !updatedEntry.detectedLanguage) {
          const detected = detectLanguage(`${updatedEntry.title || ''} ${updatedEntry.description || ''}`.trim());
          updatedEntry = {
            ...updatedEntry,
            sourceLanguage: updatedEntry.sourceLanguage || detected,
            detectedLanguage: updatedEntry.detectedLanguage || detected,
            translations: updatedEntry.translations || {}
          };
        }
        return updatedEntry;
      });

      localStorage.setItem(localCacheKey, JSON.stringify(entries));
      return entries;
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Firestore getWorkspaceEntries fetch error (falling back to cache):', err.message);
      }
    }
  }

  // 2. Offline fallback: Return locally cached entries
  const cached = localStorage.getItem(localCacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return [];
    }
  }

  // 3. Clean empty state (genuine 0 records)
  return [];
}

/**
 * Create a new diary entry in the workspace
 */
export async function createDiaryEntry(workspaceId, entryData) {
  if (!workspaceId) throw new Error('Missing workspaceId');
  if (!entryData.title || !entryData.title.trim()) throw new Error('Diary note title is required.');

  const entryId = `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date();
  const dateStr = entryData.date || now.toISOString().split('T')[0];
  const timeStr = entryData.time || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  // Auto-detect content language (Tamil vs English)
  const combinedText = `${entryData.title || ''} ${entryData.description || ''}`.trim();
  const detected = detectLanguage(combinedText);
  const sourceLang = entryData.sourceLanguage || detected;

  const newEntry = {
    id: entryId,
    workspaceId,
    createdByUid: entryData.createdByUid || 'anonymous',
    authorName: entryData.authorName || 'Diary Creator',
    authorAvatar: entryData.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    title: entryData.title.trim(),
    entryType: entryData.entryType || 'Daily Activity',
    description: (entryData.description || '').trim(),
    sourceLanguage: sourceLang,
    detectedLanguage: detected,
    translationVersion: 1,
    translations: entryData.translations || {},
    titleMetadata: {
      original: entryData.title.trim(),
      sourceLanguage: sourceLang,
      translations: {}
    },
    descriptionMetadata: {
      original: (entryData.description || '').trim(),
      sourceLanguage: sourceLang,
      translations: {}
    },
    date: dateStr,
    time: timeStr,
    amount: entryData.amount !== undefined && entryData.amount !== null && entryData.amount !== '' 
      ? parseFloat(entryData.amount) 
      : null,
    amountType: entryData.amountType || null, // 'income' | 'expense' | null
    currency: entryData.currency || '₹',
    location: (entryData.location || '').trim(),
    attachments: entryData.attachments || [],
    tags: Array.isArray(entryData.tags) ? entryData.tags : [],
    version: 1,
    clientUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Update local cache
  const localCacheKey = `pdt_entries_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const updated = [newEntry, ...existing];
  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  // Sync to Firestore or Queue if offline
  if (isFirebaseConfigured && auth?.currentUser) {
    if (!isOnline()) {
      queueOfflineMutation({ type: 'create', workspaceId, entryId, data: newEntry });
    } else {
      try {
        const docRef = doc(db, 'workspaces', workspaceId, 'entries', entryId);
        await setDoc(docRef, {
          ...newEntry,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        recordLastSyncTime();
      } catch (err) {
        if (err?.code === 'permission-denied') {
          throw new Error('Permission denied: You do not have permission to add entries to this workspace.');
        }
        console.warn('Firestore createDiaryEntry network warning (queued offline):', err.message);
        queueOfflineMutation({ type: 'create', workspaceId, entryId, data: newEntry });
      }
    }
  } else if (!auth?.currentUser) {
    recordLastSyncTime();
  }

  return newEntry;
}

/**
 * Update an existing diary entry with optimistic conflict detection
 */
export async function updateDiaryEntry(workspaceId, entryId, updates, options = {}) {
  if (!workspaceId || !entryId) throw new Error('Missing workspaceId or entryId');

  const localCacheKey = `pdt_entries_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const currentEntry = existing.find(e => e.id === entryId);

  // 1. Conflict Detection against remote Firestore document
  if (isFirebaseConfigured && isOnline() && !options.forceOverwrite) {
    try {
      const docRef = doc(db, 'workspaces', workspaceId, 'entries', entryId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        const remoteVersion = remoteData.version || 1;
        const baseVersion = options.baseVersion || currentEntry?.version || 1;
        const remoteUpdated = remoteData.updatedAt?.toDate ? remoteData.updatedAt.toDate().toISOString() : remoteData.updatedAt;
        const baseUpdated = options.baseUpdatedAt || currentEntry?.updatedAt;

        const hasVersionConflict = remoteVersion > baseVersion;
        const hasTimeConflict = remoteUpdated && baseUpdated && (new Date(remoteUpdated).getTime() - new Date(baseUpdated).getTime() > 2000);

        if (hasVersionConflict || hasTimeConflict) {
          return {
            conflict: true,
            remoteData: { id: docSnap.id, ...remoteData },
            localUpdates: updates,
            baseVersion,
            baseUpdatedAt: baseUpdated,
            entryId
          };
        }
      }
    } catch (checkErr) {
      console.warn('Conflict check non-blocking warning:', checkErr.message);
    }
  }

  const nextVersion = (currentEntry?.version || 1) + 1;
  const clientNow = new Date().toISOString();

  // Content change detection for cache invalidation
  const titleChanged = updates.title !== undefined && updates.title.trim() !== currentEntry?.title;
  const descChanged = updates.description !== undefined && (updates.description || '').trim() !== (currentEntry?.description || '');

  let translationFields = {};
  if (titleChanged || descChanged) {
    const newTitle = updates.title !== undefined ? updates.title.trim() : (currentEntry?.title || '');
    const newDesc = updates.description !== undefined ? (updates.description || '').trim() : (currentEntry?.description || '');
    const newDetected = detectLanguage(`${newTitle} ${newDesc}`.trim());
    const newSource = updates.sourceLanguage || newDetected;

    translationFields = {
      sourceLanguage: newSource,
      detectedLanguage: newDetected,
      translations: {}, // Invalidate previous translations
      translationVersion: (currentEntry?.translationVersion || 1) + 1,
      titleMetadata: {
        original: newTitle,
        sourceLanguage: newSource,
        translations: {}
      },
      descriptionMetadata: {
        original: newDesc,
        sourceLanguage: newSource,
        translations: {}
      }
    };
  } else if (updates.sourceLanguage && updates.sourceLanguage !== currentEntry?.sourceLanguage) {
    translationFields = {
      sourceLanguage: updates.sourceLanguage,
      translations: {},
      translationVersion: (currentEntry?.translationVersion || 1) + 1
    };
  }

  const formattedUpdates = {
    ...updates,
    ...translationFields,
    version: nextVersion,
    clientUpdatedAt: clientNow,
    amount: updates.amount !== undefined && updates.amount !== null && updates.amount !== ''
      ? parseFloat(updates.amount)
      : (updates.amount === null || updates.amount === '' ? null : (currentEntry ? currentEntry.amount : null))
  };

  const updated = existing.map(e => {
    if (e.id === entryId) {
      return {
        ...e,
        ...formattedUpdates,
        updatedAt: clientNow
      };
    }
    return e;
  });

  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser) {
    if (!isOnline()) {
      queueOfflineMutation({ 
        type: 'update', 
        workspaceId, 
        entryId, 
        data: formattedUpdates,
        baseVersion: options.baseVersion || currentEntry?.version || 1,
        baseUpdatedAt: currentEntry?.updatedAt || clientNow
      });
    } else {
      try {
        const docRef = doc(db, 'workspaces', workspaceId, 'entries', entryId);
        await updateDoc(docRef, {
          ...formattedUpdates,
          updatedAt: serverTimestamp()
        });
        recordLastSyncTime();
      } catch (err) {
        if (err?.code === 'permission-denied') {
          throw new Error('Permission denied: You do not have permission to edit this entry.');
        }
        console.warn('Firestore updateDiaryEntry network warning (queued offline):', err.message);
        queueOfflineMutation({ 
          type: 'update', 
          workspaceId, 
          entryId, 
          data: formattedUpdates,
          baseVersion: options.baseVersion || currentEntry?.version || 1,
          baseUpdatedAt: currentEntry?.updatedAt || clientNow
        });
      }
    }
  } else if (!auth?.currentUser) {
    recordLastSyncTime();
  }

  return updated.find(e => e.id === entryId);
}

/**
 * Delete a diary entry from a workspace
 */
export async function deleteDiaryEntry(workspaceId, entryId) {
  if (!workspaceId || !entryId) throw new Error('Missing workspaceId or entryId');

  const localCacheKey = `pdt_entries_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const updated = existing.filter(e => e.id !== entryId);
  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  if (isFirebaseConfigured && auth?.currentUser) {
    if (!isOnline()) {
      queueOfflineMutation({ type: 'delete', workspaceId, entryId });
    } else {
      try {
        const docRef = doc(db, 'workspaces', workspaceId, 'entries', entryId);
        await deleteDoc(docRef);
        recordLastSyncTime();
      } catch (err) {
        if (err?.code === 'permission-denied') {
          throw new Error('Permission denied: You do not have permission to delete this entry.');
        }
        console.warn('Firestore deleteDiaryEntry network warning (queued offline):', err.message);
        queueOfflineMutation({ type: 'delete', workspaceId, entryId });
      }
    }
  } else if (!auth?.currentUser) {
    recordLastSyncTime();
  }

  return updated;
}

/**
 * Safely extracts display title and description for an entry, accommodating both
 * legacy plain string entries and structured multilingual schemas.
 */
export function getEntryDisplayContent(entry, userLanguage) {
  if (!entry) return { title: '', description: '', isTranslated: false, isOriginal: true };

  const rawTitle = typeof entry.title === 'object' ? (entry.title.original || '') : (entry.title || '');
  const rawDesc = typeof entry.description === 'object' ? (entry.description.original || '') : (entry.description || '');

  const sourceLang = entry.sourceLanguage || entry.detectedLanguage || detectLanguage(`${rawTitle} ${rawDesc}`.trim());

  // If user language matches source language or is not provided, return original
  if (!userLanguage || userLanguage === sourceLang) {
    return {
      title: rawTitle,
      description: rawDesc,
      sourceLanguage: sourceLang,
      detectedLanguage: entry.detectedLanguage || sourceLang,
      isTranslated: false,
      isOriginal: true,
      hasTranslation: false
    };
  }

  // Check if translation exists in Firestore document or entry translations map
  const targetTranslation = entry.translations?.[userLanguage];
  if (targetTranslation && targetTranslation.title) {
    return {
      title: targetTranslation.title,
      description: targetTranslation.description !== undefined ? targetTranslation.description : rawDesc,
      sourceLanguage: sourceLang,
      detectedLanguage: entry.detectedLanguage || sourceLang,
      isTranslated: true,
      isOriginal: false,
      hasTranslation: true,
      translatedAt: targetTranslation.translatedAt
    };
  }

  // Check synchronous cache (memory, localStorage, domain dictionary)
  const syncTitle = getCachedTranslationSync(rawTitle, sourceLang, userLanguage);
  if (syncTitle) {
    const syncDesc = rawDesc ? (getCachedTranslationSync(rawDesc, sourceLang, userLanguage) || rawDesc) : '';
    return {
      title: syncTitle,
      description: syncDesc,
      sourceLanguage: sourceLang,
      detectedLanguage: entry.detectedLanguage || sourceLang,
      isTranslated: true,
      isOriginal: false,
      hasTranslation: true
    };
  }

  // Default fallback to original
  return {
    title: rawTitle,
    description: rawDesc,
    sourceLanguage: sourceLang,
    detectedLanguage: entry.detectedLanguage || sourceLang,
    isTranslated: false,
    isOriginal: true,
    hasTranslation: false
  };
}


