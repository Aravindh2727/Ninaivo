import React from 'react';
import { Languages, RotateCcw, Loader2, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function TranslationBadge({
  sourceLanguage,
  isTranslated,
  isShowingOriginal,
  isLoading,
  error,
  onToggleOriginal,
  onRetry
}) {
  const { t } = useLanguage();

  const isTamilSource = sourceLanguage === 'ta';
  const labelText = isTamilSource 
    ? t('translatedFromTamil') || 'Translated from Tamil'
    : t('translatedFromEnglish') || 'Translated from English';

  return (
    <div 
      className="translation-badge-container"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '6px',
        background: 'var(--chip-green-bg)',
        border: '1px solid var(--border-color)',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        marginTop: '4px',
        marginBottom: '6px',
        flexWrap: 'wrap'
      }}
    >
      <Languages size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />

      {isLoading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}>
          <Loader2 size={11} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span>{t('translating') || 'Translating...'}</span>
        </span>
      ) : error ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-rose)' }}>
          <span>{t('translationUnavailable') || 'Translation unavailable'}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                padding: 0
              }}
            >
              <RotateCcw size={10} />
              <span>{t('retryTranslation') || 'Retry'}</span>
            </button>
          )}
        </span>
      ) : (
        <>
          <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>
            {isShowingOriginal 
              ? `${t('originalContent') || 'Original'} (${isTamilSource ? t('tamil') || 'Tamil' : t('english') || 'English'})`
              : labelText
            }
          </span>

          <span style={{ color: 'var(--text-dim)' }}>&bull;</span>

          <button
            type="button"
            onClick={onToggleOriginal}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 600,
              fontSize: '0.7rem',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            {isShowingOriginal 
              ? (t('showTranslation') || 'Show Translation')
              : (t('showOriginal') || 'Show Original')
            }
          </button>
        </>
      )}
    </div>
  );
}

