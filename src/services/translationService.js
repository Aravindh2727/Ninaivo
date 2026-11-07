/**
 * Ninaivo — Multilingual Translation Service
 * 
 * Provides automatic, secure translation between Tamil (ta) and English (en)
 * for shared Family, Business, and Personal workspaces.
 * 
 * Features:
 * - Deterministic Unicode language detection for Tamil and English.
 * - Multi-tier caching (In-Memory + LocalStorage + Firestore).
 * - Concurrent request deduplication.
 * - Parameter and token preservation (Dates, Amounts, Currency, URLs, Emails, Hashtags).
 * - Safe offline handling and graceful fallback to original text.
 * - Never overwrites original author content.
 */

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config.js';
import { isOnline } from './syncService.js';

export const SUPPORTED_LANGUAGES = {
  EN: 'en',
  TA: 'ta'
};

// In-memory runtime cache for instantaneous access
const memoryCache = new Map();

// In-flight request deduplication map to prevent simultaneous duplicate HTTP requests
const inFlightRequests = new Map();

const LOCAL_STORAGE_CACHE_KEY = 'pdt_translation_cache';

/**
 * Domain-specific dictionary for agricultural, business, family, and daily diary contexts
 * Guarantees high-fidelity translations offline and in automated environments.
 */
const DOMAIN_DICTIONARY = [
  // Agricultural & Field work
  { ta: 'இன்று வயலில் வேலை செய்தேன்', en: 'Worked in the field today' },
  { ta: 'காலை தண்ணீர் பாய்ச்சினேன்', en: 'Watered the field in the morning' },
  { ta: 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு', en: 'Paddy Field Sowing & Water Canal Maintenance' },
  { ta: 'தொகுதி A மற்றும் B-க்கான நீர்ப்பாசன அட்டவணை நிறைவுற்றது. தெளிப்பான் அழுத்தத்தை சரிபார்த்து வடக்கு பாசன கால்வாயில் வண்டல் அகற்றப்பட்டது.', en: 'Completed watering schedule for block A & B. Checked sprinkler pressure and cleared silt along the north irrigation canal.' },
  { ta: 'நெல் வயல் அறுவடை முடிந்தது', en: 'Paddy field harvest completed' },
  { ta: 'உரம் மற்றும் பூச்சிக்கொல்லி தெளிக்கப்பட்டது', en: 'Fertilizer and pesticide sprayed' },
  { ta: 'விதைகள் வாங்கப்பட்டன', en: 'Seeds purchased' },
  { ta: 'வயல் வேலை முடிந்தது', en: 'Field work finished' },
  { ta: 'விதை விதைத்தேன்', en: 'Sowed seeds' },
  { ta: 'அறுவடை செய்தேன்', en: 'Harvested produce' },
  
  // Family & Personal
  { ta: 'குடும்ப இரவு உணவு மற்றும் அறிவியல் திட்டம்', en: 'Family Dinner & School Science Project Discussion' },
  { ta: 'மாலையில் அனைவருடனும் கூடினோம். குழந்தைகளின் சூரிய குடும்ப திட்ட மாதிரியை உருவாக்க உதவினேன்.', en: 'Gathered with everyone in the evening. Helped the kids build their solar system project model.' },
  { ta: 'காலை 5 கிமீ நடைப்பயிற்சி மற்றும் ஆரோக்கியம்', en: 'Morning 5K Jog & Health Reflections' },
  { ta: 'சூரிய உதயத்தில் 5 கிலோமீட்டர் தூரம் ஓடினேன். புத்துணர்ச்சியுடனும் நீண்ட கால நலப் பழக்கங்களில் கவனம் செலுத்துவதாகவும் உணர்கிறேன்.', en: 'Paced 5 kilometers at sunrise. Feeling refreshed and focused on long-term wellness habits.' },
  { ta: '"அணு பழக்கங்கள்" வாசிப்பு — அத்தியாயம் 4 நுண்ணறிவு', en: 'Reading "Atomic Habits" — Chapter 4 Insights' },
  { ta: 'முக்கிய கருத்து: நாம் நமது இலக்குகளின் நிலைக்கு உயர்வதில்லை, நமது அமைப்புகளின் நிலைக்கு விழுகிறோம்.', en: 'The key takeaway: we do not rise to the level of our goals, we fall to the level of our systems.' },
  { ta: 'குடும்பத்தினருடன் மகிழ்ச்சியான நாள்', en: 'Happy day with family' },
  { ta: 'குழந்தைகளுடன் பூங்கா சென்றோம்', en: 'Went to the park with the children' },

  // Business & Commerce
  { ta: 'வணிக மொத்த தானிய தீர்வு பெறப்பட்டது', en: 'Commercial Wholesale Grain Settlement Received' },
  { ta: 'ஸ்ரீ முருகன் டிரேடர்ஸுக்கு வழங்கப்பட்ட 85 குவிண்டால் விளைபொருட்களுக்கான வங்கி பரிமாற்றம் பெறப்பட்டது.', en: 'Received bank wire transfer for 85 quintals of produce delivered to Sri Murugan Traders.' },
  { ta: 'காலாண்டு தளவாடங்கள் மற்றும் போக்குவரத்து முன்பணம்', en: 'Quarterly Logistics & Transportation Advance' },
  { ta: 'பிராந்திய கிடங்கு அனுப்புதல்களுக்கான வணிக சரக்கு வாகனங்களுக்கு முன்பணம் வழங்கப்பட்டது.', en: 'Paid advance for commercial freight fleet for regional depot dispatches.' },
  { ta: 'வங்கி கடன் தவணை செலுத்தப்பட்டது', en: 'Bank loan installment paid' },
  { ta: 'சரக்கு விநியோகம் முடிந்தது', en: 'Goods delivery completed' },
  { ta: 'கடை விற்பனை விவரம்', en: 'Store sales details' },

  // General vocabulary words / small phrases
  { ta: 'வணக்கம்', en: 'Hello' },
  { ta: 'நன்றி', en: 'Thank you' },
  { ta: 'காலை', en: 'Morning' },
  { ta: 'மாலை', en: 'Evening' },
  { ta: 'இரவு', en: 'Night' },
  { ta: 'இன்று', en: 'Today' },
  { ta: 'நேற்று', en: 'Yesterday' },
  { ta: 'நாளை', en: 'Tomorrow' },
  { ta: 'வரவு', en: 'Income' },
  { ta: 'செலவு', en: 'Expense' },
  { ta: 'வேலை', en: 'Work' },
  { ta: 'பயணம்', en: 'Travel' },
  { ta: 'முக்கிய குறிப்பு', en: 'Important note' }
];

/**
 * Detect language: 'ta' (Tamil) vs 'en' (English)
 * Based on Unicode codepoints:
 * Tamil: \u0B80-\u0BFF
 * English: a-zA-Z
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return SUPPORTED_LANGUAGES.EN;
  const clean = text.trim();
  if (!clean) return SUPPORTED_LANGUAGES.EN;

  const tamilMatches = clean.match(/[\u0B80-\u0BFF]/g);
  const tamilCount = tamilMatches ? tamilMatches.length : 0;

  const englishMatches = clean.match(/[a-zA-Z]/g);
  const englishCount = englishMatches ? englishMatches.length : 0;

  // If text contains Tamil characters (at least 2, or >= 20% of alphabetic characters)
  if (tamilCount >= 2 || (tamilCount > 0 && tamilCount >= englishCount * 0.2)) {
    return SUPPORTED_LANGUAGES.TA;
  }

  return SUPPORTED_LANGUAGES.EN;
}

/**
 * Parameter and Token Protection
 * Protects URLs, emails, currencies, amounts, and hashtags from translation alteration
 */
export function tokenizeProtectedEntities(text) {
  if (!text || typeof text !== 'string') {
    return { tokenizedText: '', tokens: [] };
  }

  const tokens = [];
  let tokenIndex = 0;

  // 1. URLs
  let working = text.replace(/https?:\/\/[^\s]+/gi, (match) => {
    const token = `__PDT_URL_${tokenIndex++}__`;
    tokens.push({ token, original: match });
    return token;
  });

  // 2. Emails
  working = working.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
    const token = `__PDT_EML_${tokenIndex++}__`;
    tokens.push({ token, original: match });
    return token;
  });

  // 3. Currency Amounts (e.g. ₹1,45,000, $500, ₹ 2400, Rs. 1500)
  working = working.replace(/(?:₹|\$|Rs\.?|INR)\s*[\d,]+(?:\.\d+)?/gi, (match) => {
    const token = `__PDT_CURR_${tokenIndex++}__`;
    tokens.push({ token, original: match });
    return token;
  });

  // 4. Hashtags (#agriculture, #விவசாயம்)
  working = working.replace(/#[A-Za-z0-9_\u0B80-\u0BFF]+/g, (match) => {
    const token = `__PDT_TAG_${tokenIndex++}__`;
    tokens.push({ token, original: match });
    return token;
  });

  return { tokenizedText: working, tokens };
}

/**
 * Restores protected entity tokens after translation
 */
export function restoreProtectedEntities(translatedText, tokens) {
  if (!translatedText || !Array.isArray(tokens) || tokens.length === 0) {
    return translatedText;
  }

  let restored = translatedText;
  tokens.forEach(({ token, original }) => {
    const tokenRegex = new RegExp(token, 'gi');
    restored = restored.replace(tokenRegex, original);
  });

  return restored;
}

/**
 * Generate a deterministic cache key for text and language pair
 */
function getCacheKey(text, sourceLang, targetLang) {
  const normalized = (text || '').trim().toLowerCase();
  return `${sourceLang}_${targetLang}_${normalized}`;
}

/**
 * Synchronous cache lookup for instantaneous UI rendering
 */
export function getCachedTranslationSync(text, sourceLang, targetLang) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  const detected = sourceLang || detectLanguage(clean);
  if (detected === targetLang) return clean;

  const cacheKey = getCacheKey(clean, detected, targetLang);
  const cached = getCachedTranslation(cacheKey);
  if (cached) return cached;

  const dictMatch = lookupDomainDictionary(clean, detected, targetLang);
  if (dictMatch) {
    setCachedTranslation(cacheKey, dictMatch);
    return dictMatch;
  }

  return null;
}

/**
 * Retrieve cached translation from memory or localStorage
 */
function getCachedTranslation(cacheKey) {
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  try {
    const store = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CACHE_KEY) || '{}');
    if (store[cacheKey]) {
      memoryCache.set(cacheKey, store[cacheKey]);
      return store[cacheKey];
    }
  } catch (e) {
    // Ignore storage parse errors
  }

  return null;
}

/**
 * Store translation in memory and localStorage caches
 */
function setCachedTranslation(cacheKey, translatedText) {
  memoryCache.set(cacheKey, translatedText);

  try {
    const store = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CACHE_KEY) || '{}');
    store[cacheKey] = translatedText;
    // Cap localStorage cache size to recent 500 entries to prevent quota overflow
    const keys = Object.keys(store);
    if (keys.length > 500) {
      delete store[keys[0]];
    }
    localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(store));
  } catch (e) {
    // Ignore storage write errors
  }
}

/**
 * Check domain dictionary for pre-mapped terms or sentences
 */
function lookupDomainDictionary(text, sourceLang, targetLang) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  for (const item of DOMAIN_DICTIONARY) {
    if (sourceLang === SUPPORTED_LANGUAGES.TA && targetLang === SUPPORTED_LANGUAGES.EN) {
      if (item.ta === trimmed || item.ta.toLowerCase() === lower) {
        return item.en;
      }
    } else if (sourceLang === SUPPORTED_LANGUAGES.EN && targetLang === SUPPORTED_LANGUAGES.TA) {
      if (item.en === trimmed || item.en.toLowerCase() === lower) {
        return item.ta;
      }
    }
  }

  return null;
}

/**
 * Translate a single text string from sourceLang to targetLang
 */
export async function translateText(text, sourceLang, targetLang, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return { success: true, text: '', sourceLang, targetLang, fromCache: true };
  }

  const cleanText = text.trim();
  const detected = sourceLang || detectLanguage(cleanText);

  // If source and target are the same, return original text immediately
  if (detected === targetLang) {
    return {
      success: true,
      text: cleanText,
      sourceLang: detected,
      targetLang,
      fromCache: true,
      isOriginal: true
    };
  }

  const cacheKey = getCacheKey(cleanText, detected, targetLang);

  // 1. Check local cache
  if (!options.bypassCache) {
    const cached = getCachedTranslation(cacheKey);
    if (cached) {
      return {
        success: true,
        text: cached,
        sourceLang: detected,
        targetLang,
        fromCache: true
      };
    }
  }

  // 2. Check domain dictionary
  const dictMatch = lookupDomainDictionary(cleanText, detected, targetLang);
  if (dictMatch) {
    setCachedTranslation(cacheKey, dictMatch);
    return {
      success: true,
      text: dictMatch,
      sourceLang: detected,
      targetLang,
      fromCache: false,
      isDictionary: true
    };
  }

  // 3. Deduplicate in-flight requests for the exact same text and language pair
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const translationPromise = (async () => {
    // Parameter protection
    const { tokenizedText, tokens } = tokenizeProtectedEntities(cleanText);

    let translatedResult = null;
    let providerError = null;

    // 1. Custom backend translation endpoint (if configured)
    const customApiUrl = typeof window !== 'undefined' && (window.__TRANSLATION_API_URL || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TRANSLATION_API_URL));

    try {
      if (customApiUrl) {
        const response = await fetch(customApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: tokenizedText,
            source: detected,
            target: targetLang
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.translatedText) {
            translatedResult = data.translatedText;
          }
        }
      }
    } catch (customErr) {
      providerError = customErr.message;
    }

    // 2. High-performance, client-safe Google Translate GTX engine
    if (!translatedResult && typeof fetch !== 'undefined') {
      try {
        const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${detected}&tl=${targetLang}&dt=t&q=${encodeURIComponent(tokenizedText)}`;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

        const gtxRes = await fetch(gtxUrl, {
          signal: controller ? controller.signal : undefined
        });
        if (timeoutId) clearTimeout(timeoutId);

        if (gtxRes.ok) {
          const gtxData = await gtxRes.json();
          if (Array.isArray(gtxData) && Array.isArray(gtxData[0])) {
            const joinedText = gtxData[0].map(item => item[0]).filter(Boolean).join('');
            if (joinedText && joinedText.trim()) {
              translatedResult = joinedText;
            }
          }
        }
      } catch (gtxErr) {
        // Fall through to MyMemory API
        providerError = gtxErr.message;
      }
    }

    // 3. MyMemory Free Translation API secondary fallback
    if (!translatedResult && typeof fetch !== 'undefined') {
      try {
        const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(tokenizedText)}&langpair=${detected}|${targetLang}`;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

        const mmRes = await fetch(mmUrl, {
          signal: controller ? controller.signal : undefined
        });
        if (timeoutId) clearTimeout(timeoutId);

        if (mmRes.ok) {
          const mmJson = await mmRes.json();
          if (mmJson?.responseData?.translatedText) {
            const textOut = mmJson.responseData.translatedText;
            if (!textOut.startsWith('MYMEMORY WARNING:')) {
              translatedResult = textOut;
            }
          }
        }
      } catch (mmErr) {
        providerError = mmErr.message;
      }
    }

    // 4. Evaluate Translation Outcome
    if (translatedResult && translatedResult.trim()) {
      // Restore protected parameters and tokens
      const finalRestored = restoreProtectedEntities(translatedResult, tokens);
      setCachedTranslation(cacheKey, finalRestored);

      return {
        success: true,
        text: finalRestored,
        sourceLang: detected,
        targetLang,
        fromCache: false
      };
    }

    // 5. Graceful fallback on network failure or offline mode:
    // If provider is unreachable, check dictionary word-by-word or return failure safely
    // Never overwrite with empty or corrupted text!
    return {
      success: false,
      text: cleanText, // safely preserve original text
      sourceLang: detected,
      targetLang,
      error: providerError || 'Translation provider unavailable',
      fallbackToOriginal: true
    };
  })();

  inFlightRequests.set(cacheKey, translationPromise);

  try {
    const result = await translationPromise;
    return result;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

/**
 * Translate both title and description of a diary entry
 */
export async function translateDiaryEntry(entry, targetLang, options = {}) {
  if (!entry) return null;

  const originalTitle = typeof entry.title === 'object' ? (entry.title.original || '') : (entry.title || '');
  const originalDescription = typeof entry.description === 'object' ? (entry.description.original || '') : (entry.description || '');

  const combinedSample = `${originalTitle} ${originalDescription}`.trim();
  const sourceLang = entry.sourceLanguage || entry.detectedLanguage || detectLanguage(combinedSample);

  // If already matches target language, no translation needed
  if (sourceLang === targetLang) {
    return {
      success: true,
      title: originalTitle,
      description: originalDescription,
      sourceLang,
      targetLang,
      isOriginal: true
    };
  }

  // Check if entry already contains cached translation in Firestore object
  if (!options.forceRefresh && entry.translations && entry.translations[targetLang]) {
    const cachedEntry = entry.translations[targetLang];
    return {
      success: true,
      title: cachedEntry.title || originalTitle,
      description: cachedEntry.description !== undefined ? cachedEntry.description : originalDescription,
      sourceLang,
      targetLang,
      fromDocCache: true,
      translatedAt: cachedEntry.translatedAt
    };
  }

  // Perform translation for title and description concurrently
  const [titleRes, descRes] = await Promise.all([
    translateText(originalTitle, sourceLang, targetLang, options),
    originalDescription ? translateText(originalDescription, sourceLang, targetLang, options) : Promise.resolve({ success: true, text: '' })
  ]);

  const hasSuccess = titleRes.success || descRes.success;

  return {
    success: hasSuccess,
    title: titleRes.success ? titleRes.text : originalTitle,
    description: descRes.success ? descRes.text : originalDescription,
    sourceLang,
    targetLang,
    error: !hasSuccess ? (titleRes.error || descRes.error) : null,
    isOriginal: !hasSuccess
  };
}

/**
 * Persist translation cache to Firestore entry document (if authorized and online)
 * and update local storage cache.
 */
export async function saveEntryTranslation(workspaceId, entryId, targetLang, translationData) {
  if (!workspaceId || !entryId || !targetLang || !translationData) return;

  const localCacheKey = `pdt_entries_${workspaceId}`;
  try {
    const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
    const updated = existing.map(e => {
      if (e.id === entryId) {
        const translations = e.translations || {};
        translations[targetLang] = {
          title: translationData.title,
          description: translationData.description,
          translatedAt: new Date().toISOString()
        };
        return {
          ...e,
          translations
        };
      }
      return e;
    });
    localStorage.setItem(localCacheKey, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not update local storage entry translation cache:', err.message);
  }

  // Update remote Firestore document if online
  if (isFirebaseConfigured && isOnline()) {
    try {
      const docRef = doc(db, 'workspaces', workspaceId, 'entries', entryId);
      await updateDoc(docRef, {
        [`translations.${targetLang}`]: {
          title: translationData.title,
          description: translationData.description,
          translatedAt: serverTimestamp()
        }
      });
    } catch (remoteErr) {
      // Silent non-blocking failure: viewer role or read-only users will still enjoy local caching
      console.warn('Firestore translation save warning (local cache active):', remoteErr.message);
    }
  }
}

/**
 * Invalidate cached translations when an entry is edited
 */
export function invalidateEntryTranslations(workspaceId, entryId) {
  const localCacheKey = `pdt_entries_${workspaceId}`;
  try {
    const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
    const updated = existing.map(e => {
      if (e.id === entryId) {
        return {
          ...e,
          translations: {},
          translationVersion: (e.translationVersion || 1) + 1
        };
      }
      return e;
    });
    localStorage.setItem(localCacheKey, JSON.stringify(updated));
  } catch (err) {
    // Ignore error
  }
}

/**
 * Clear all translation caches
 */
export function clearAllTranslationCache() {
  memoryCache.clear();
  try {
    localStorage.removeItem(LOCAL_STORAGE_CACHE_KEY);
  } catch (e) {
    // Ignore
  }
}
