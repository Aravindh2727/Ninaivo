import React, { useState } from 'react';
import { 
  Volume2, 
  Trash2, 
  FileText, 
  Globe, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  Check, 
  X,
  Radio
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function AudioAttachmentPlayer({ 
  attachment, 
  onDelete, 
  onUpdateTranscript,
  canEdit = false 
}) {
  const { t } = useLanguage();
  const [showTranscript, setShowTranscript] = useState(true);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState(attachment?.transcript?.text || '');

  if (!attachment || attachment.type !== 'audio') return null;

  const durationSecs = attachment.duration || 0;
  const mins = Math.floor(durationSecs / 60);
  const secs = durationSecs % 60;
  const timeFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  const langCode = attachment?.transcript?.language || 'ta-IN';
  const langLabel = langCode === 'ta-IN' ? 'தமிழ்' : 'English';

  const handleSaveTranscript = () => {
    if (onUpdateTranscript) {
      onUpdateTranscript(attachment.id, transcriptDraft.trim());
    }
    setIsEditingTranscript(false);
  };

  const handleCancelTranscript = () => {
    setTranscriptDraft(attachment?.transcript?.text || '');
    setIsEditingTranscript(false);
  };

  const handleDelete = () => {
    if (window.confirm(t('deleteAudioConfirm') || 'Are you sure you want to delete this voice recording?')) {
      onDelete && onDelete(attachment.id);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card-subtle)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '10px 12px',
      marginBottom: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      {/* Header Row: Title, Duration, Delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--chip-green-bg)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Volume2 size={13} />
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
              {attachment.name || 'Voice Note'}
            </span>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-dim)' }}>
              {timeFormatted} • {(attachment.format || 'webm').toUpperCase()}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Language Pill */}
          <span style={{
            fontSize: '0.64rem',
            padding: '2px 6px',
            borderRadius: '10px',
            background: 'var(--chip-green-bg)',
            color: 'var(--primary)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            <Globe size={10} />
            <span>{langLabel}</span>
          </span>

          {/* Delete Button (in edit mode) */}
          {canEdit && onDelete && (
            <button
              type="button"
              className="filter-chip"
              onClick={handleDelete}
              title={t('deleteVoiceNote') || 'Delete voice note'}
              style={{ padding: '4px', color: 'var(--accent-rose)' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* HTML5 Audio Player */}
      <audio 
        src={attachment.url} 
        controls 
        preload="metadata"
        style={{ width: '100%', height: '34px', outline: 'none' }} 
      />

      {/* Transcript Accordion / Card */}
      {(attachment.transcript?.text || canEdit) && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '8px 10px',
          marginTop: '2px'
        }}>
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer' 
            }}
            onClick={() => setShowTranscript(prev => !prev)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={12} style={{ color: 'var(--text-dim)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                {t('transcript') || 'Transcript'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {canEdit && onUpdateTranscript && !isEditingTranscript && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingTranscript(true);
                    setShowTranscript(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontSize: '0.68rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '2px 4px'
                  }}
                >
                  <Edit3 size={11} />
                  <span>{t('editTranscript') || 'Edit'}</span>
                </button>
              )}
              {showTranscript ? <ChevronUp size={13} style={{ color: 'var(--text-dim)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-dim)' }} />}
            </div>
          </div>

          {showTranscript && (
            <div style={{ marginTop: '6px' }}>
              {isEditingTranscript ? (
                <div>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={transcriptDraft}
                    onChange={(e) => setTranscriptDraft(e.target.value)}
                    style={{ fontSize: '0.76rem', lineHeight: 1.4, marginBottom: '6px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      className="filter-chip"
                      style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                      onClick={handleCancelTranscript}
                    >
                      <X size={11} style={{ marginRight: '2px' }} />
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ fontSize: '0.68rem', padding: '3px 10px' }}
                      onClick={handleSaveTranscript}
                    >
                      <Check size={11} style={{ marginRight: '2px' }} />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.4,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontStyle: attachment.transcript?.text ? 'normal' : 'italic'
                }}>
                  {attachment.transcript?.text || 'No transcription available.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

