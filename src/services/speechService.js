/**
 * Ninaivo — Text-to-Speech (TTS) Service
 * 
 * Provides accessible multilingual Text-to-Speech playback for diary entries
 * in the viewer's preferred language (Tamil ta-IN vs English en-IN).
 * 
 * Core Features:
 * - Native browser Web Speech API (window.speechSynthesis & SpeechSynthesisUtterance).
 * - Automatic pre-speech translation integration with existing Phase 11 translation service.
 * - Respects per-member independent language preference from LanguageContext.
 * - Clean speech text builder (Title, Category, Description, Amount, Location - strips URLs and raw metadata).
 * - Sentence-level text chunking to bypass browser-specific character limit cutoffs.
 * - Global single-session playback controller (never plays multiple entries simultaneously).
 * - Playback speed controls (0.75x, 1.0x normal default, 1.25x, 1.5x).
 * - Delayed asynchronous voice loading handling (onvoiceschanged).
 * - Graceful fallback to original content if translation is unavailable.
 * - Safe auto-cancellation on navigation or view unmount.
 */

import { detectLanguage, translateDiaryEntry, getCachedTranslationSync, saveEntryTranslation } from './translationService.js';
import { getCategoryDisplayName } from '../utils/categoryTranslations.js';

export const SPEECH_LANGUAGES = {
  TA: 'ta-IN',
  EN: 'en-IN'
};

export const SPEECH_STATES = {
  IDLE: 'idle',
  PREPARING: 'preparing',       // Translating content
  LOADING_VOICE: 'loading_voice',
  PLAYING: 'playing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export const PLAYBACK_SPEEDS = [
  { value: 0.75, labelKey: 'speedSlow', label: '0.75x' },
  { value: 1.0, labelKey: 'speedNormal', label: '1.0x' },
  { value: 1.25, labelKey: 'speedFast', label: '1.25x' },
  { value: 1.5, labelKey: 'speedFaster', label: '1.5x' }
];

const TTS_SPEED_STORAGE_KEY = 'ninaivo_tts_speed';
const LEGACY_TTS_SPEED_STORAGE_KEY = 'pdt_tts_speed';

// Global Singleton Speech Session State
let activeSession = {
  entryId: null,
  entry: null,
  targetLang: 'en',
  status: SPEECH_STATES.IDLE,
  chunks: [],
  currentChunkIndex: 0,
  rate: 1.0,
  error: null,
  keepAliveTimer: null
};

// Subscriber listeners for reactive UI updates across all cards
const stateSubscribers = new Set();

/**
 * Check if the browser supports SpeechSynthesis
 */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

/**
 * Get current persisted playback rate (0.75, 1.0, 1.25, 1.5)
 */
export function getSpeechRate() {
  if (activeSession && typeof activeSession.rate === 'number') {
    return activeSession.rate;
  }
  if (typeof window === 'undefined') return 1.0;
  try {
    const saved = localStorage.getItem(TTS_SPEED_STORAGE_KEY) || localStorage.getItem(LEGACY_TTS_SPEED_STORAGE_KEY);
    const parsed = parseFloat(saved);
    return [0.75, 1.0, 1.25, 1.5].includes(parsed) ? parsed : 1.0;
  } catch {
    return 1.0;
  }
}

/**
 * Set and persist playback rate
 */
export function setSpeechRate(rate) {
  const validRate = [0.75, 1.0, 1.25, 1.5].includes(rate) ? rate : 1.0;
  activeSession.rate = validRate;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TTS_SPEED_STORAGE_KEY, String(validRate));
    } catch {
      // Ignore storage errors
    }
  }
  notifySubscribers();
  return validRate;
}

/**
 * Initialize session rate from localStorage
 */
activeSession.rate = getSpeechRate();

/**
 * Retrieve current available speech synthesis voices
 */
export function getAvailableVoices() {
  if (!isSpeechSupported()) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

/**
 * Wait for voices to populate asynchronously (handles Chromium/Firefox delayed loading)
 */
export async function waitForVoices(timeoutMs = 1200) {
  if (!isSpeechSupported()) return [];

  const immediate = getAvailableVoices();
  if (immediate && immediate.length > 0) return immediate;

  return new Promise((resolve) => {
    let finished = false;

    const onVoicesChanged = () => {
      if (finished) return;
      finished = true;
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
      resolve(getAvailableVoices());
    };

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
    }

    setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve(getAvailableVoices());
      }
    }, timeoutMs);
  });
}

/**
 * Find the best compatible voice for target language ('ta' or 'en')
 */
export function findBestVoice(targetLangCode, voicesList = null) {
  const voices = voicesList || getAvailableVoices();
  if (!voices || voices.length === 0) return null;

  const isTa = (targetLangCode || '').toLowerCase().startsWith('ta');

  if (isTa) {
    // 1. Exact ta-IN
    const taIn = voices.find(v => (v.lang || '').toLowerCase().replace('_', '-') === 'ta-in');
    if (taIn) return taIn;

    // 2. Any Tamil language code (ta, ta-LK, ta-SG)
    const anyTa = voices.find(v => (v.lang || '').toLowerCase().startsWith('ta'));
    if (anyTa) return anyTa;

    // 3. Name contains Tamil
    const nameTa = voices.find(v => (v.name || '').toLowerCase().includes('tamil'));
    if (nameTa) return nameTa;

    // Return null if no Tamil voice exists so we can handle graceful voice fallback
    return null;
  }

  // English Target
  // 1. Indian English voice (en-IN)
  const enIn = voices.find(v => (v.lang || '').toLowerCase().replace('_', '-') === 'en-in');
  if (enIn) return enIn;

  // 2. Common English voices (en-US, en-GB)
  const enCommon = voices.find(v => {
    const l = (v.lang || '').toLowerCase().replace('_', '-');
    return l === 'en-us' || l === 'en-gb';
  });
  if (enCommon) return enCommon;

  // 3. Any English prefix
  const anyEn = voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
  if (anyEn) return anyEn;

  // 4. Default voice
  const def = voices.find(v => v.default);
  if (def) return def;

  return voices[0] || null;
}

/**
 * Builds clean, natural reading text for speech synthesis
 * Strips URLs, raw IDs, metadata, and attachment filenames.
 * Includes Title, Category, Description, and Financial/Location details.
 */
export function buildDiarySpeechText(entry, resolvedTitle, resolvedDescription, targetLang, options = {}) {
  const isTa = (targetLang || 'en').startsWith('ta');
  const parts = [];

  // 1. Title
  const cleanTitle = (resolvedTitle || '').replace(/[*_#`[\]]/g, '').trim();
  if (cleanTitle) {
    parts.push(cleanTitle.endsWith('.') ? cleanTitle : cleanTitle + '.');
  }

  // 2. Category
  if (entry?.entryType && !options.skipCategory) {
    const catName = getCategoryDisplayName(entry.entryType, isTa ? 'ta' : 'en');
    parts.push(isTa ? `வகை: ${catName}.` : `Category: ${catName}.`);
  }

  // 3. Description (stripping URLs, image file extensions, and markdown formatting)
  if (resolvedDescription) {
    let cleanDesc = resolvedDescription
      .replace(/https?:\/\/[^\s]+/g, '') // Strip links
      .replace(/\b[\w-]+\.(jpg|jpeg|png|webp|mp3|m4a|wav|aac)\b/gi, '') // Strip photo filenames
      .replace(/[*_#`~[\]]/g, '') // Strip markdown formatting
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanDesc) {
      parts.push(cleanDesc.endsWith('.') ? cleanDesc : cleanDesc + '.');
    }
  }

  // 4. Amount / Expense / Income details
  if (entry?.amount !== null && entry?.amount !== undefined && !isNaN(entry.amount)) {
    const num = Math.round(Number(entry.amount));
    const isIncome = entry.amountType === 'income';
    if (isTa) {
      const typeLabel = isIncome ? 'வரவு' : 'செலவு';
      parts.push(`தொகை: ${typeLabel} ${num} ரூபாய்.`);
    } else {
      const typeLabel = isIncome ? 'Income' : 'Expense';
      parts.push(`Amount: ${typeLabel} of ${num} rupees.`);
    }
  }

  // 5. Location
  if (entry?.location && typeof entry.location === 'string' && entry.location.trim()) {
    const cleanLoc = entry.location.replace(/[*_#`[\]]/g, '').trim();
    if (cleanLoc) {
      parts.push(isTa ? `இடம்: ${cleanLoc}.` : `Location: ${cleanLoc}.`);
    }
  }

  return parts.join(' ').trim();
}

/**
 * Splits text into manageable sentence chunks (<= 180 chars)
 * Prevents SpeechSynthesis cut-off bugs in Chromium / Android WebViews.
 */
export function chunkTextForSpeech(text, maxChunkLen = 180) {
  if (!text || text.length <= maxChunkLen) return [text || ''];

  // Split on sentence boundaries
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if ((current + ' ' + trimmed).trim().length <= maxChunkLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);

      if (trimmed.length > maxChunkLen) {
        // Split extra long sentence by clauses or words
        const words = trimmed.split(/\s+/);
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxChunkLen) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      } else {
        current = trimmed;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Automatically resolves and translates entry content to the viewer's target language
 * Guarantees that:
 * 1. If viewer language matches entry language, original text is used directly.
 * 2. If viewer language differs, existing cached translation is retrieved synchronously.
 * 3. If translation is missing, translateDiaryEntry() is dispatched on-demand.
 * 4. Original diary content is NEVER mutated or overwritten.
 */
export async function resolveEntryTextForSpeech(entry, targetLang, workspaceId = null) {
  const normTarget = (targetLang || 'en').startsWith('ta') ? 'ta' : 'en';

  const origTitle = typeof entry?.title === 'object' ? (entry?.title?.original || '') : (entry?.title || '');
  const origDesc = typeof entry?.description === 'object' ? (entry?.description?.original || '') : (entry?.description || '');

  const combinedSample = `${origTitle} ${origDesc}`.trim();
  const sourceLang = entry?.sourceLanguage || entry?.detectedLanguage || detectLanguage(combinedSample);
  const normSource = (sourceLang || 'en').startsWith('ta') ? 'ta' : 'en';

  // Scenario 3: Same language -> Read original without translation
  if (normSource === normTarget) {
    return {
      title: origTitle,
      description: origDesc,
      sourceLang: normSource,
      targetLang: normTarget,
      needsTranslation: false,
      isTranslated: false
    };
  }

  // Scenario 1 & 2: Different language -> Check translation cache first
  const docCached = entry?.translations?.[normTarget];
  const syncCachedTitle = docCached?.title || getCachedTranslationSync(origTitle, normSource, normTarget);
  const syncCachedDesc = docCached?.description !== undefined 
    ? docCached.description 
    : (origDesc ? getCachedTranslationSync(origDesc, normSource, normTarget) : '');

  if (syncCachedTitle) {
    return {
      title: syncCachedTitle,
      description: syncCachedDesc || origDesc,
      sourceLang: normSource,
      targetLang: normTarget,
      needsTranslation: true,
      isTranslated: true
    };
  }

  // No cache match -> Request automatic translation
  try {
    const res = await translateDiaryEntry(entry, normTarget);
    if (res && res.success) {
      const translationRecord = {
        title: res.title,
        description: res.description,
        translatedAt: new Date().toISOString()
      };

      if (workspaceId && entry?.id) {
        saveEntryTranslation(workspaceId, entry.id, normTarget, translationRecord);
      }

      return {
        title: res.title,
        description: res.description || origDesc,
        sourceLang: normSource,
        targetLang: normTarget,
        needsTranslation: true,
        isTranslated: true
      };
    } else {
      throw new Error(res?.error || 'Translation service unavailable');
    }
  } catch (err) {
    // Return translation error details so caller can offer fallback to original
    return {
      title: origTitle,
      description: origDesc,
      sourceLang: normSource,
      targetLang: normTarget,
      needsTranslation: true,
      isTranslated: false,
      translationFailed: true,
      errorMessage: err.message
    };
  }
}

/**
 * Global subscriber subscription
 */
export function subscribeToSpeechState(listener) {
  stateSubscribers.add(listener);
  // Send immediate current state
  try {
    listener({ ...activeSession });
  } catch (e) {
    // Ignore listener error
  }
  return () => stateSubscribers.delete(listener);
}

function notifySubscribers() {
  const snapshot = { ...activeSession };
  stateSubscribers.forEach(listener => {
    try {
      listener(snapshot);
    } catch (e) {
      console.warn('Error in speech state subscriber:', e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pdt-speech-state', { detail: snapshot }));
  }
}

/**
 * Stop active speech immediately
 */
export function stopSpeech() {
  if (activeSession.keepAliveTimer) {
    clearInterval(activeSession.keepAliveTimer);
    activeSession.keepAliveTimer = null;
  }

  if (isSpeechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }

  activeSession.status = SPEECH_STATES.IDLE;
  activeSession.entryId = null;
  activeSession.entry = null;
  activeSession.chunks = [];
  activeSession.currentChunkIndex = 0;
  activeSession.error = null;

  notifySubscribers();
}

/**
 * Pause active speech
 */
export function pauseSpeech() {
  if (!isSpeechSupported() || activeSession.status !== SPEECH_STATES.PLAYING) return;
  try {
    window.speechSynthesis.pause();
    activeSession.status = SPEECH_STATES.PAUSED;
    notifySubscribers();
  } catch (err) {
    console.warn('pauseSpeech error:', err);
  }
}

/**
 * Resume paused speech
 */
export function resumeSpeech() {
  if (!isSpeechSupported() || activeSession.status !== SPEECH_STATES.PAUSED) return;
  try {
    window.speechSynthesis.resume();
    activeSession.status = SPEECH_STATES.PLAYING;
    notifySubscribers();
  } catch (err) {
    console.warn('resumeSpeech error:', err);
  }
}

/**
 * Returns current playing entry ID or null
 */
export function getCurrentPlayingId() {
  return activeSession.entryId;
}

/**
 * Returns current session state object
 */
export function getCurrentSpeechState() {
  return { ...activeSession };
}

/**
 * Speaks an array of sentence chunks sequentially
 */
function playNextChunk(voice, langCode, onComplete, onError) {
  if (activeSession.status !== SPEECH_STATES.PLAYING) return;

  if (activeSession.currentChunkIndex >= activeSession.chunks.length) {
    // Playback finished cleanly
    stopSpeech();
    onComplete && onComplete();
    return;
  }

  const chunkText = activeSession.chunks[activeSession.currentChunkIndex];
  if (!chunkText || !chunkText.trim()) {
    activeSession.currentChunkIndex++;
    playNextChunk(voice, langCode, onComplete, onError);
    return;
  }

  try {
    const utterance = new window.SpeechSynthesisUtterance(chunkText);
    utterance.rate = activeSession.rate || 1.0;
    utterance.pitch = 1.0;
    utterance.lang = langCode;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      activeSession.currentChunkIndex++;
      playNextChunk(voice, langCode, onComplete, onError);
    };

    utterance.onerror = (e) => {
      // In Chromium, 'canceled' event fires when manually stopped; treat gracefully
      if (e.error === 'canceled' || e.error === 'interrupted') {
        return;
      }
      console.warn('SpeechSynthesisUtterance error:', e.error);
      activeSession.status = SPEECH_STATES.ERROR;
      activeSession.error = e.error || 'Speech synthesis error';
      notifySubscribers();
      onError && onError(e);
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Failed to create or speak utterance:', err);
    activeSession.status = SPEECH_STATES.ERROR;
    activeSession.error = err.message;
    notifySubscribers();
    onError && onError(err);
  }
}

/**
 * Main public entry point: Reads a diary entry aloud
 * 
 * Handles:
 * 1. Stopping any prior playback.
 * 2. Translation to the viewer's target language (Tamil ta-IN vs English en-IN).
 * 3. Building clean speech text.
 * 4. Finding or waiting for the best compatible voice.
 * 5. Sentence chunking and sequential playback with pause/resume support.
 */
export async function speakDiaryEntry({
  entry,
  targetLang = 'en',
  workspaceId = null,
  forceOriginal = false,
  rate = null,
  onStart = null,
  onEnd = null,
  onError = null
}) {
  if (!entry || !entry.id) {
    throw new Error('Valid diary entry is required for speech playback.');
  }

  if (!isSpeechSupported()) {
    const notSupportedErr = new Error('Speech synthesis is not supported on this browser.');
    onError && onError(notSupportedErr);
    return { success: false, error: notSupportedErr.message, unsupported: true };
  }

  // 1. If this exact entry is already playing, toggle pause/resume
  if (activeSession.entryId === entry.id) {
    if (activeSession.status === SPEECH_STATES.PLAYING) {
      pauseSpeech();
      return { success: true, status: SPEECH_STATES.PAUSED };
    } else if (activeSession.status === SPEECH_STATES.PAUSED) {
      resumeSpeech();
      return { success: true, status: SPEECH_STATES.PLAYING };
    }
  }

  // 2. Stop any previous speech session cleanly
  stopSpeech();

  // Initialize new session
  const normTarget = (targetLang || 'en').startsWith('ta') ? 'ta' : 'en';
  activeSession.entryId = entry.id;
  activeSession.entry = entry;
  activeSession.targetLang = normTarget;
  activeSession.status = SPEECH_STATES.PREPARING;
  activeSession.rate = rate || getSpeechRate();
  activeSession.error = null;
  notifySubscribers();

  try {
    // 3. Resolve Content & Perform Translation if needed
    let resolvedContent;
    if (forceOriginal) {
      const origTitle = typeof entry?.title === 'object' ? (entry?.title?.original || '') : (entry?.title || '');
      const origDesc = typeof entry?.description === 'object' ? (entry?.description?.original || '') : (entry?.description || '');
      const combined = `${origTitle} ${origDesc}`.trim();
      const detected = detectLanguage(combined);
      resolvedContent = {
        title: origTitle,
        description: origDesc,
        sourceLang: detected,
        targetLang: detected,
        needsTranslation: false,
        isTranslated: false
      };
    } else {
      resolvedContent = await resolveEntryTextForSpeech(entry, normTarget, workspaceId);
    }

    // Check if translation failed
    if (resolvedContent.translationFailed) {
      activeSession.status = SPEECH_STATES.ERROR;
      activeSession.error = resolvedContent.errorMessage || 'Translation failed';
      notifySubscribers();
      return {
        success: false,
        translationFailed: true,
        sourceLang: resolvedContent.sourceLang,
        targetLang: normTarget,
        originalContent: {
          title: resolvedContent.title,
          description: resolvedContent.description
        }
      };
    }

    // Language code to speak
    const speechLang = forceOriginal
      ? (resolvedContent.sourceLang === 'ta' ? SPEECH_LANGUAGES.TA : SPEECH_LANGUAGES.EN)
      : (normTarget === 'ta' ? SPEECH_LANGUAGES.TA : SPEECH_LANGUAGES.EN);

    // 4. Build clean speech text
    const speechText = buildDiarySpeechText(
      entry,
      resolvedContent.title,
      resolvedContent.description,
      forceOriginal ? resolvedContent.sourceLang : normTarget
    );

    if (!speechText || !speechText.trim()) {
      stopSpeech();
      return { success: false, empty: true, message: 'No content to read.' };
    }

    // 5. Select Voice
    activeSession.status = SPEECH_STATES.LOADING_VOICE;
    notifySubscribers();

    const voices = await waitForVoices();
    const voice = findBestVoice(speechLang, voices);

    // If target is Tamil but no Tamil voice exists on browser
    if (speechLang === SPEECH_LANGUAGES.TA && !voice) {
      activeSession.status = SPEECH_STATES.ERROR;
      activeSession.error = 'No Tamil voice installed on this device/browser.';
      notifySubscribers();
      return {
        success: false,
        missingVoice: true,
        language: 'ta-IN',
        message: 'No Tamil voice installed on this browser.'
      };
    }

    // 6. Chunk text and start playback
    const chunks = chunkTextForSpeech(speechText, 180);
    activeSession.chunks = chunks;
    activeSession.currentChunkIndex = 0;
    activeSession.status = SPEECH_STATES.PLAYING;
    notifySubscribers();
    onStart && onStart();

    // Workaround for Chrome 15s pause bug: gentle keepalive
    activeSession.keepAliveTimer = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis && activeSession.status === SPEECH_STATES.PLAYING) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    playNextChunk(voice, speechLang, onEnd, onError);

    return {
      success: true,
      status: SPEECH_STATES.PLAYING,
      speechText,
      chunksCount: chunks.length,
      voice: voice ? voice.name : 'System Default',
      language: speechLang
    };

  } catch (err) {
    console.error('Error starting diary speech:', err);
    activeSession.status = SPEECH_STATES.ERROR;
    activeSession.error = err.message;
    notifySubscribers();
    onError && onError(err);
    return { success: false, error: err.message };
  }
}

// Global safety listener: auto-cancel speech on page navigation or unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => stopSpeech());
  window.addEventListener('pagehide', () => stopSpeech());
}
