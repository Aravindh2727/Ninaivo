import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  detectLanguage, 
  translateDiaryEntry, 
  getCachedTranslationSync, 
  saveEntryTranslation 
} from '../services/translationService';

/**
 * Reusable Centralized Translation Hook (Phase 11.1)
 * 
 * Provides unified, reactive multilingual translation for diary entries across
 * all application screens (Timeline, Dashboard, Calendar, Analytics, Lightbox).
 * 
 * Guarantees:
 * 1. Synchronous instantaneous retrieval when cached in memory, localStorage, or Firestore.
 * 2. Automatic on-demand translation for existing and new entries when language changes.
 * 3. Never mutates or overwrites original author text.
 * 4. Automatic update when member changes language preference in LanguageContext.
 * 5. Safe fallback to original text with status indication and retry control on failure.
 */
export function useTranslatedDiaryEntry(entry) {
  const { language } = useLanguage();
  let currentWorkspace = null;
  try {
    const wsContext = useWorkspace();
    currentWorkspace = wsContext?.currentWorkspace;
  } catch (e) {
    // Graceful fallback if invoked outside WorkspaceContext (e.g. standalone test)
  }

  const originalTitle = typeof entry?.title === 'object' ? (entry?.title?.original || '') : (entry?.title || '');
  const originalDescription = typeof entry?.description === 'object' ? (entry?.description?.original || '') : (entry?.description || '');

  // 1. Detect content source language
  const combinedSample = `${originalTitle} ${originalDescription}`.trim();
  const sourceLanguage = entry?.sourceLanguage || entry?.detectedLanguage || detectLanguage(combinedSample);

  // 2. Determine if translation is required for this viewer
  const needsTranslation = Boolean(entry && sourceLanguage !== language);

  // 3. Synchronous cache resolution
  const docCached = entry?.translations?.[language];
  const syncCachedTitle = docCached?.title || getCachedTranslationSync(originalTitle, sourceLanguage, language);
  const syncCachedDesc = docCached?.description !== undefined 
    ? docCached.description 
    : (originalDescription ? getCachedTranslationSync(originalDescription, sourceLanguage, language) : '');

  const hasImmediateTranslation = Boolean(syncCachedTitle);

  // 4. Reactive State
  const [translatedData, setTranslatedData] = useState(() => {
    if (!needsTranslation) return null;
    if (hasImmediateTranslation) {
      return {
        title: syncCachedTitle,
        description: syncCachedDesc || originalDescription
      };
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);

  // 5. Reactive translation lifecycle
  useEffect(() => {
    let isMounted = true;

    if (!needsTranslation) {
      setTranslatedData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check synchronous cache
    const currentDocCached = entry?.translations?.[language];
    const immTitle = currentDocCached?.title || getCachedTranslationSync(originalTitle, sourceLanguage, language);
    const immDesc = currentDocCached?.description !== undefined 
      ? currentDocCached.description 
      : (originalDescription ? getCachedTranslationSync(originalDescription, sourceLanguage, language) : '');

    if (immTitle) {
      setTranslatedData({
        title: immTitle,
        description: immDesc || originalDescription
      });
      setIsLoading(false);
      setError(null);
      return;
    }

    // Missing translation -> Dispatch translation provider
    setIsLoading(true);
    setError(null);

    translateDiaryEntry(entry, language)
      .then((res) => {
        if (!isMounted) return;
        setIsLoading(false);
        if (res && res.success) {
          const newTrans = {
            title: res.title,
            description: res.description,
            translatedAt: new Date().toISOString()
          };
          setTranslatedData(newTrans);
          if (currentWorkspace?.id && entry?.id) {
            saveEntryTranslation(currentWorkspace.id, entry.id, language, newTrans);
          }
        } else {
          setError(res?.error || 'Translation unavailable');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsLoading(false);
        setError(err.message || 'Translation failed');
      });

    return () => {
      isMounted = false;
    };
  }, [
    entry?.id, 
    entry?.version, 
    entry?.translationVersion, 
    language, 
    needsTranslation, 
    originalTitle, 
    originalDescription, 
    sourceLanguage
  ]);

  const toggleOriginal = () => {
    setIsShowingOriginal(prev => !prev);
  };

  const retry = () => {
    setIsLoading(true);
    setError(null);
    translateDiaryEntry(entry, language, { bypassCache: true, forceRefresh: true })
      .then((res) => {
        setIsLoading(false);
        if (res && res.success) {
          const newTrans = {
            title: res.title,
            description: res.description,
            translatedAt: new Date().toISOString()
          };
          setTranslatedData(newTrans);
          if (currentWorkspace?.id && entry?.id) {
            saveEntryTranslation(currentWorkspace.id, entry.id, language, newTrans);
          }
        } else {
          setError(res?.error || 'Translation unavailable');
        }
      })
      .catch((err) => {
        setIsLoading(false);
        setError(err.message || 'Translation failed');
      });
  };

  // 6. Compute resolved display fields
  const title = (!needsTranslation || isShowingOriginal || !translatedData?.title)
    ? originalTitle
    : translatedData.title;

  const description = (!needsTranslation || isShowingOriginal || !translatedData?.description)
    ? originalDescription
    : translatedData.description;

  const isTranslated = Boolean(needsTranslation && !isShowingOriginal && translatedData?.title);

  return {
    title,
    description,
    originalTitle,
    originalDescription,
    sourceLanguage,
    targetLanguage: language,
    needsTranslation,
    isTranslated,
    isOriginal: !isTranslated,
    isShowingOriginal,
    isLoading,
    error,
    toggleOriginal,
    retry
  };
}

