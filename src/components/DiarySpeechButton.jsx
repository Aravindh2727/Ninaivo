import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Loader2,
  AlertCircle,
  Gauge,
  RotateCcw
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  isSpeechSupported,
  speakDiaryEntry,
  pauseSpeech,
  resumeSpeech,
  stopSpeech,
  subscribeToSpeechState,
  getSpeechRate,
  setSpeechRate,
  PLAYBACK_SPEEDS,
  SPEECH_STATES
} from '../services/speechService';

export default function DiarySpeechButton({
  entry,
  className = '',
  style = {}
}) {
  const { t, language } = useLanguage();
  let currentWorkspace = null;
  try {
    const ws = useWorkspace();
    currentWorkspace = ws?.currentWorkspace;
  } catch {
    // Graceful fallback outside WorkspaceContext
  }

  const [speechState, setSpeechState] = useState({
    entryId: null,
    status: SPEECH_STATES.IDLE,
    rate: getSpeechRate(),
    error: null
  });

  const [showPopover, setShowPopover] = useState(false);
  const [translationFailure, setTranslationFailure] = useState(null);
  const popoverRef = useRef(null);

  // Subscribe to global singleton speech session updates
  useEffect(() => {
    const unsubscribe = subscribeToSpeechState((state) => {
      setSpeechState(state);
      if (state.entryId !== entry?.id && state.status !== SPEECH_STATES.IDLE) {
        setShowPopover(false);
      }
    });
    return () => unsubscribe();
  }, [entry?.id]);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [showPopover]);

  const isCurrentEntry = speechState.entryId === entry?.id;
  const isPlaying = isCurrentEntry && speechState.status === SPEECH_STATES.PLAYING;
  const isPaused = isCurrentEntry && speechState.status === SPEECH_STATES.PAUSED;
  const isPreparing = isCurrentEntry && (speechState.status === SPEECH_STATES.PREPARING || speechState.status === SPEECH_STATES.LOADING_VOICE);
  const isError = isCurrentEntry && speechState.status === SPEECH_STATES.ERROR;

  // Handle speaker button click
  const handleClick = async (e) => {
    e.stopPropagation();

    if (!isSpeechSupported()) {
      alert(t('speechUnavailable') || 'Speech synthesis is not supported on this browser.');
      return;
    }

    // Toggle pause/resume if this entry is actively speaking
    if (isPlaying) {
      pauseSpeech();
      return;
    }

    if (isPaused) {
      resumeSpeech();
      return;
    }

    // Start reading aloud
    setTranslationFailure(null);
    const res = await speakDiaryEntry({
      entry,
      targetLang: language, // Reader's preferred language from LanguageContext
      workspaceId: currentWorkspace?.id,
      rate: speechState.rate
    });

    if (res && res.translationFailed) {
      setTranslationFailure(res);
      setShowPopover(true);
    }
  };

  const handleStop = (e) => {
    e?.stopPropagation();
    stopSpeech();
    setShowPopover(false);
    setTranslationFailure(null);
  };

  const handleRateChange = (speedVal, e) => {
    e?.stopPropagation();
    setSpeechRate(speedVal);
  };

  const handleListenOriginal = async (e) => {
    e?.stopPropagation();
    setShowPopover(false);
    setTranslationFailure(null);

    await speakDiaryEntry({
      entry,
      targetLang: translationFailure?.sourceLang || 'ta',
      workspaceId: currentWorkspace?.id,
      forceOriginal: true,
      rate: speechState.rate
    });
  };

  const handleRetryTranslation = async (e) => {
    e?.stopPropagation();
    setShowPopover(false);
    setTranslationFailure(null);

    const res = await speakDiaryEntry({
      entry,
      targetLang: language,
      workspaceId: currentWorkspace?.id,
      forceOriginal: false,
      rate: speechState.rate
    });

    if (res && res.translationFailed) {
      setTranslationFailure(res);
      setShowPopover(true);
    }
  };

  // Determine tooltip and accessible label
  let buttonLabel = t('readDiaryAloud') || 'Read diary aloud';
  if (isPlaying) buttonLabel = t('pauseReading') || 'Pause reading';
  else if (isPaused) buttonLabel = t('resumeReading') || 'Resume reading';
  else if (isPreparing) buttonLabel = t('translatingBeforeSpeech') || 'Translating...';
  else if (isError) buttonLabel = speechState.error || (t('speechUnavailable') || 'Speech error');

  return (
    <div
      ref={popoverRef}
      className={`diary-speech-wrapper ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 'auto',
        flexShrink: 0,
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Speaker Button: Accessible 44x44 touch wrapper with ~34px visual circular button */}
      <button
        type="button"
        className={`diary-speech-btn ${isPlaying ? 'playing' : ''} ${isPaused ? 'paused' : ''} ${isPreparing ? 'preparing' : ''}`}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowPopover(prev => !prev);
        }}
        title={buttonLabel}
        aria-label={buttonLabel}
        aria-pressed={isPlaying}
        style={{
          width: '34px',
          height: '34px',
          minWidth: '34px',
          minHeight: '34px',
          borderRadius: '50%',
          border: isPlaying ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
          background: isPlaying
            ? 'var(--primary)'
            : (isPaused ? 'var(--chip-amber-bg)' : 'var(--chip-green-bg)'),
          color: isPlaying ? '#FFFFFF' : 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.18s ease-in-out',
          boxShadow: isPlaying ? '0 0 10px var(--primary-glow)' : 'var(--shadow-sm)'
        }}
      >
        {isPreparing ? (
          <Loader2 size={16} className="spinner-icon" style={{ animation: 'spin 1s linear infinite' }} />
        ) : isPlaying ? (
          <Pause size={15} strokeWidth={2.6} />
        ) : isPaused ? (
          <Play size={15} strokeWidth={2.6} style={{ marginLeft: '1px' }} />
        ) : isError ? (
          <AlertCircle size={15} style={{ color: 'var(--accent-rose)' }} />
        ) : (
          <Volume2 size={16} strokeWidth={2.2} />
        )}
      </button>

      {/* Mini Controls Popover (Speed Selector, Stop, or Translation Fallback) */}
      {(isPlaying || isPaused || showPopover) && (
        <div
          className="speech-popover-sheet"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            zIndex: 80,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-md)',
            padding: '8px 10px',
            minWidth: '150px',
            maxWidth: '220px',
            fontSize: '0.72rem',
            boxSizing: 'border-box'
          }}
        >
          {/* Translation Failure Notice & Fallback */}
          {translationFailure && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: 'var(--accent-rose)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <AlertCircle size={13} />
                <span>{t('translationFailedForSpeech') || 'Translation unavailable.'}</span>
              </div>
              <button
                type="button"
                className="btn-primary compact-btn"
                onClick={handleListenOriginal}
                style={{ width: '100%', fontSize: '0.68rem', padding: '4px 6px', marginBottom: '4px', justifyContent: 'center' }}
              >
                {t('listenOriginalLanguage') || 'Listen in Original Language'}
              </button>
              <button
                type="button"
                className="btn-secondary compact-btn"
                onClick={handleRetryTranslation}
                style={{ width: '100%', fontSize: '0.68rem', padding: '4px 6px', justifyContent: 'center' }}
              >
                <RotateCcw size={11} style={{ marginRight: '3px' }} />
                {t('retryTranslation') || 'Retry Translation'}
              </button>
            </div>
          )}

          {/* Normal Playback Controls & Speed Selector */}
          {!translationFailure && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Gauge size={12} style={{ color: 'var(--primary)' }} />
                  {t('playbackSpeed') || 'Speed'}
                </span>
                {(isPlaying || isPaused) && (
                  <button
                    type="button"
                    onClick={handleStop}
                    title={t('stopReading') || 'Stop'}
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'var(--accent-rose)',
                      padding: '2px 5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.66rem',
                      fontWeight: 700
                    }}
                  >
                    <Square size={10} fill="currentColor" /> {t('stopReading') || 'Stop'}
                  </button>
                )}
              </div>

              {/* Speed Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                {PLAYBACK_SPEEDS.map((sp) => {
                  const isSelected = speechState.rate === sp.value;
                  return (
                    <button
                      key={sp.value}
                      type="button"
                      onClick={(e) => handleRateChange(sp.value, e)}
                      style={{
                        padding: '3px 0',
                        fontSize: '0.66rem',
                        fontWeight: isSelected ? 800 : 500,
                        borderRadius: '6px',
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        background: isSelected ? 'var(--chip-green-bg)' : 'transparent',
                        color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      {sp.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

