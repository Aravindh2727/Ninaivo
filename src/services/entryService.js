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
 * Seed initial sample diary entries for a newly created workspace
 */
export function getSampleEntriesForWorkspace(workspaceId, workspaceType) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  if (workspaceType === 'family') {
    return [
      {
        id: `entry-fam-1-${workspaceId}`,
        workspaceId,
        createdByUid: 'demo-owner',
        authorName: 'Aravindh V',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Paddy Field Sowing & Water Canal Maintenance',
        entryType: 'Agriculture',
        description: 'Completed watering schedule for block A & B. Checked sprinkler pressure and cleared silt along the north irrigation canal.',
        sourceLanguage: 'en',
        detectedLanguage: 'en',
        translationVersion: 1,
        translations: {
          ta: {
            title: 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு',
            description: 'தொகுதி A மற்றும் B-க்கான நீர்ப்பாசன அட்டவணை நிறைவுற்றது. தெளிப்பான் அழுத்தத்தை சரிபார்த்து வடக்கு பாசன கால்வாயில் வண்டல் அகற்றப்பட்டது.',
            translatedAt: new Date().toISOString()
          }
        },
        date: today,
        time: '08:30',
        amount: 2400,
        amountType: 'expense',
        currency: '₹',
        location: 'North Agriculture Field (Acre 3)',
        attachments: [
          {
            id: 'att-sample-1',
            url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
            name: 'field-water-canal.jpg',
            provider: 'sample'
          }
        ],
        tags: ['Agriculture', 'PaddyField', 'Irrigation'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `entry-fam-2-${workspaceId}`,
        workspaceId,
        createdByUid: 'demo-owner',
        authorName: 'Aravindh V',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'குடும்ப இரவு உணவு மற்றும் அறிவியல் திட்டம்',
        entryType: 'Family',
        description: 'மாலையில் அனைவருடனும் கூடினோம். குழந்தைகளின் சூரிய குடும்ப திட்ட மாதிரியை உருவாக்க உதவினேன்.',
        sourceLanguage: 'ta',
        detectedLanguage: 'ta',
        translationVersion: 1,
        translations: {
          en: {
            title: 'Family Dinner & School Science Project Discussion',
            description: 'Gathered with everyone in the evening. Helped the kids build their solar system project model.',
            translatedAt: new Date().toISOString()
          }
        },
        date: yesterday,
        time: '19:45',
        amount: 1200,
        amountType: 'expense',
        currency: '₹',
        location: 'Home',
        attachments: [],
        tags: ['Family', 'Kids', 'Dinner'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  if (workspaceType === 'business') {
    return [
      {
        id: `entry-biz-1-${workspaceId}`,
        workspaceId,
        createdByUid: 'demo-owner',
        authorName: 'Aravindh V',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Commercial Wholesale Grain Settlement Received',
        entryType: 'Income',
        description: 'Received bank wire transfer for 85 quintals of produce delivered to Sri Murugan Traders.',
        sourceLanguage: 'en',
        detectedLanguage: 'en',
        translationVersion: 1,
        translations: {
          ta: {
            title: 'வணிக மொத்த தானிய தீர்வு பெறப்பட்டது',
            description: 'ஸ்ரீ முருகன் டிரேடர்ஸுக்கு வழங்கப்பட்ட 85 குவிண்டால் விளைபொருட்களுக்கான வங்கி பரிமாற்றம் பெறப்பட்டது.',
            translatedAt: new Date().toISOString()
          }
        },
        date: today,
        time: '14:15',
        amount: 145000,
        amountType: 'income',
        currency: '₹',
        location: 'Commercial Market Yard',
        attachments: [],
        tags: ['Trade', 'Wholesale', 'Settlement'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `entry-biz-2-${workspaceId}`,
        workspaceId,
        createdByUid: 'demo-owner',
        authorName: 'Aravindh V',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        title: 'Quarterly Logistics & Transportation Advance',
        entryType: 'Expense',
        description: 'Paid advance for commercial freight fleet for regional depot dispatches.',
        sourceLanguage: 'en',
        detectedLanguage: 'en',
        translationVersion: 1,
        translations: {
          ta: {
            title: 'காலாண்டு தளவாடங்கள் மற்றும் போக்குவரத்து முன்பணம்',
            description: 'பிராந்திய கிடங்கு அனுப்புதல்களுக்கான வணிக சரக்கு வாகனங்களுக்கு முன்பணம் வழங்கப்பட்டது.',
            translatedAt: new Date().toISOString()
          }
        },
        date: lastWeek,
        time: '11:00',
        amount: 18500,
        amountType: 'expense',
        currency: '₹',
        location: 'Logistics Hub',
        attachments: [],
        tags: ['Logistics', 'Fleet', 'Expense'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  // Personal Default
  return [
    {
      id: `entry-per-1-${workspaceId}`,
      workspaceId,
      createdByUid: 'demo-owner',
      authorName: 'Aravindh V',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      title: 'Morning 5K Jog & Health Reflections',
      entryType: 'Daily Activity',
      description: 'Paced 5 kilometers at sunrise. Feeling refreshed and focused on long-term wellness habits.',
      sourceLanguage: 'en',
      detectedLanguage: 'en',
      translationVersion: 1,
      translations: {
        ta: {
          title: 'காலை 5 கிமீ நடைப்பயிற்சி மற்றும் ஆரோக்கியம்',
          description: 'சூரிய உதயத்தில் 5 கிலோமீட்டர் தூரம் ஓடினேன். புத்துணர்ச்சியுடனும் நீண்ட கால நலப் பழக்கங்களில் கவனம் செலுத்துவதாகவும் உணர்கிறேன்.',
          translatedAt: new Date().toISOString()
        }
      },
      date: today,
      time: '06:45',
      amount: null,
      amountType: null,
      currency: '₹',
      location: 'Lake Promenade',
      attachments: [
        {
          id: 'att-sample-per-1',
          url: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&auto=format&fit=crop&q=80',
          name: 'morning-run.jpg',
          provider: 'sample'
        }
      ],
      tags: ['Health', 'Fitness', 'MorningHabits'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: `entry-per-2-${workspaceId}`,
      workspaceId,
      createdByUid: 'demo-owner',
      authorName: 'Aravindh V',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      title: 'Reading "Atomic Habits" — Chapter 4 Insights',
      entryType: 'Personal',
      description: 'The key takeaway: we do not rise to the level of our goals, we fall to the level of our systems.',
      sourceLanguage: 'en',
      detectedLanguage: 'en',
      translationVersion: 1,
      translations: {
        ta: {
          title: '"அணு பழக்கங்கள்" வாசிப்பு — அத்தியாயம் 4 நுண்ணறிவு',
          description: 'முக்கிய கருத்து: நாம் நமது இலக்குகளின் நிலைக்கு உயர்வதில்லை, நமது அமைப்புகளின் நிலைக்கு விழுகிறோம்.',
          translatedAt: new Date().toISOString()
        }
      },
      date: yesterday,
      time: '21:30',
      amount: null,
      amountType: null,
      currency: '₹',
      location: 'Home Study',
      attachments: [],
      tags: ['Books', 'Learning', 'Mindset'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

/**
 * Fetch all entries for a specific workspace
 */
export async function getWorkspaceEntries(workspaceId, workspaceType = 'personal') {
  if (!workspaceId) return [];

  const localCacheKey = `pdt_entries_${workspaceId}`;
  const cached = localStorage.getItem(localCacheKey);
  let entries = cached ? JSON.parse(cached) : null;

  if (entries !== null && Array.isArray(entries)) {
    let modified = false;
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
        modified = true;
      }
      return updatedEntry;
    });
    if (modified) {
      localStorage.setItem(localCacheKey, JSON.stringify(entries));
    }
  }

  if (entries === null && isFirebaseConfigured && auth?.currentUser) {
    try {
      const entriesRef = collection(db, 'workspaces', workspaceId, 'entries');
      const q = query(entriesRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        entries = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        localStorage.setItem(localCacheKey, JSON.stringify(entries));
        return entries;
      }
    } catch (err) {
      if (err?.code !== 'permission-denied') {
        console.warn('Could not fetch entries from Firestore:', err.message);
      }
    }
  }

  // If still empty, seed sample entries for this workspace
  if (!entries || entries.length === 0) {
    entries = getSampleEntriesForWorkspace(workspaceId, workspaceType);
    localStorage.setItem(localCacheKey, JSON.stringify(entries));

    // Seed to Firestore only if authenticated
    if (isFirebaseConfigured && auth?.currentUser) {
      for (const entry of entries) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'entries', entry.id);
          await setDoc(docRef, {
            ...entry,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          // ignore seed errors
        }
      }
    }
  }

  return entries;
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
        if (err?.code !== 'permission-denied') {
          console.warn('Firestore createDiaryEntry network warning (queued offline):', err.message);
        }
        queueOfflineMutation({ type: 'create', workspaceId, entryId, data: newEntry });
      }
    }
  } else if (!auth?.currentUser) {
    // In demo or local session, storage is local; record sync immediately
    recordLastSyncTime();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pdt-sync-status', { 
        detail: { pendingCount: 0, isOnline: isOnline(), lastSync: new Date().toISOString() } 
      }));
    }
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
        if (err?.code !== 'permission-denied') {
          console.warn('Firestore updateDiaryEntry network warning (queued offline):', err.message);
        }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pdt-sync-status', { 
        detail: { pendingCount: 0, isOnline: isOnline(), lastSync: new Date().toISOString() } 
      }));
    }
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
        if (err?.code !== 'permission-denied') {
          console.warn('Firestore deleteDiaryEntry network warning (queued offline):', err.message);
        }
        queueOfflineMutation({ type: 'delete', workspaceId, entryId });
      }
    }
  } else if (!auth?.currentUser) {
    recordLastSyncTime();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pdt-sync-status', { 
        detail: { pendingCount: 0, isOnline: isOnline(), lastSync: new Date().toISOString() } 
      }));
    }
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


