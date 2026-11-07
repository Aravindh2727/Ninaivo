import React from 'react';
import { AlertTriangle, Copy, Check, ArrowRight, RefreshCw, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ConflictModal({ 
  isOpen, 
  conflictData, 
  onResolveOverwrite, 
  onResolveKeepCloud, 
  onResolveSaveCopy, 
  onClose 
}) {
  const { t } = useLanguage();

  if (!isOpen || !conflictData) return null;

  const { remoteData, localUpdates } = conflictData;

  const remoteTitle = remoteData?.title || 'Untitled';
  const remoteDate = remoteData?.date || '';
  const remoteTime = remoteData?.time || '';
  const remoteDesc = remoteData?.description || 'No description';
  const remoteAuthor = remoteData?.authorName || 'Another member';

  const localTitle = localUpdates?.title || 'Untitled';
  const localDesc = localUpdates?.description || 'No description';

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-dialog" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', border: '1px solid var(--accent-amber)' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-amber)' }}>
            <AlertTriangle size={20} />
            <h2 className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
              {t('editConflictDetected')}
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice text */}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '14px 0', lineHeight: 1.5 }}>
          {t('conflictNotice')}
        </p>

        {/* Side-by-side or stacked diff summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
          {/* Cloud Version Card */}
          <div style={{
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
                {t('cloudVersionLabel')}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                {t('byAuthor')} {remoteAuthor} {remoteDate && `• ${remoteDate} ${remoteTime}`}
              </span>
            </div>
            <h4 style={{ fontSize: '0.88rem', margin: '0 0 4px 0', color: 'var(--text-main)' }}>
              {remoteTitle}
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, maxHeight: '60px', overflowY: 'auto', lineHeight: 1.4 }}>
              {remoteDesc}
            </p>
          </div>

          {/* Your Local Draft Card */}
          <div style={{
            background: 'var(--chip-green-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                {t('localVersionLabel')}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                {t('draftInEditor')}
              </span>
            </div>
            <h4 style={{ fontSize: '0.88rem', margin: '0 0 4px 0', color: 'var(--text-main)' }}>
              {localTitle}
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, maxHeight: '60px', overflowY: 'auto', lineHeight: 1.4 }}>
              {localDesc}
            </p>
          </div>
        </div>

        {/* 3 Resolution Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Option 1: Save as Copy (Recommended) */}
          <button
            type="button"
            className="btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              padding: '10px 14px', 
              fontSize: '0.84rem' 
            }}
            onClick={onResolveSaveCopy}
          >
            <Copy size={16} />
            <span>{t('saveAsCopyRecommended')}</span>
          </button>

          {/* Option 2: Overwrite Cloud */}
          <button
            type="button"
            className="filter-chip"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              padding: '9px 14px', 
              fontSize: '0.82rem',
              color: 'var(--accent-amber)',
              borderColor: 'rgba(245, 158, 11, 0.4)'
            }}
            onClick={onResolveOverwrite}
          >
            <RefreshCw size={15} />
            <span>{t('overwriteCloudChanges')}</span>
          </button>

          {/* Option 3: Keep Cloud Version */}
          <button
            type="button"
            className="filter-chip"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              padding: '9px 14px', 
              fontSize: '0.82rem'
            }}
            onClick={onResolveKeepCloud}
          >
            <Check size={15} />
            <span>{t('discardMyChanges')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

