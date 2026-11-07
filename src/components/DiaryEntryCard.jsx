import React from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  DollarSign,
  Edit3,
  Trash2,
  Users,
  Image as ImageIcon,
  Mic
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTranslatedDiaryEntry } from '../hooks/useTranslatedDiaryEntry';
import { getCategoryDisplayName, getCategoryChipClass } from '../utils/categoryTranslations';
import TranslationBadge from './TranslationBadge';
import AudioAttachmentPlayer from './AudioAttachmentPlayer';
import DiarySpeechButton from './DiarySpeechButton';

export default function DiaryEntryCard({
  entry,
  currentWorkspace,
  canWriteEntries,
  currencySymbol = '₹',
  onEdit,
  onDelete,
  onPhotoClick
}) {
  const { t, language } = useLanguage();

  const {
    title,
    description,
    originalTitle,
    sourceLanguage,
    needsTranslation,
    isTranslated,
    isShowingOriginal,
    isLoading,
    error,
    toggleOriginal,
    retry
  } = useTranslatedDiaryEntry(entry);

  const entryPhotos = (entry.attachments || []).filter(a => a.type !== 'audio');
  const entryAudios = (entry.attachments || []).filter(a => a.type === 'audio');

  return (
    <article className="card diary-card compact-entry" style={{ padding: '10px 12px', marginBottom: '8px', borderRadius: '12px' }}>
      {/* 1. Header: [Category Pill] ... [Edit] [Delete] */}
      <div className="compact-entry-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span 
            className={`tag-pill compact-category-pill ${getCategoryChipClass(entry.entryType)}`} 
            style={{ fontWeight: 700, fontSize: '0.66rem', padding: '2px 7px', borderRadius: '6px' }}
          >
            {getCategoryDisplayName(entry.entryType, language)}
          </span>

          {/* Amount pill if present */}
          {entry.amount !== null && entry.amount !== undefined && !isNaN(entry.amount) && (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                color: entry.amountType === 'income' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                background: entry.amountType === 'income' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <DollarSign size={10} />
              {entry.amountType === 'income' ? '+' : '-'}{currencySymbol}{Number(entry.amount).toLocaleString()}
            </span>
          )}
        </div>

        {/* Action buttons (Edit & Delete) if authorized */}
        {canWriteEntries && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="compact-action-btn"
              onClick={() => onEdit && onEdit(entry)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={t('editEntry')}
              aria-label={t('editEntry')}
            >
              <Edit3 size={14} />
            </button>
            <button
              type="button"
              className="compact-action-btn delete"
              onClick={() => onDelete && onDelete(entry.id, originalTitle)}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '3px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={t('deleteEntry')}
              aria-label={t('deleteEntry')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Multilingual Translation Indicator & Toggle Badge */}
      {needsTranslation && (
        <TranslationBadge
          sourceLanguage={sourceLanguage}
          isTranslated={isTranslated}
          isShowingOriginal={isShowingOriginal}
          isLoading={isLoading}
          error={error}
          onToggleOriginal={toggleOriginal}
          onRetry={retry}
        />
      )}

      {/* 2. Title */}
      <h3 
        className="diary-title compact-entry-title" 
        style={{ fontSize: '0.88rem', fontWeight: 700, margin: '2px 0 3px 0', lineHeight: 1.25 }}
      >
        {title}
      </h3>

      {/* 3. Short description (Max 1-2 lines with clean ellipsis) */}
      {description && (
        <p 
          className="diary-summary compact-entry-summary" 
          style={{ 
            fontSize: '0.76rem', 
            marginBottom: '6px', 
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'var(--text-muted)'
          }}
        >
          {description}
        </p>
      )}

      {/* 4. Single Compact Metadata Row: [Date] [Time] [Photos] [Voice] [Location] [Creator] */}
      <div 
        className="compact-meta-row" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '8px', 
          fontSize: '0.68rem', 
          color: 'var(--text-dim)', 
          marginTop: '2px' 
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          <CalendarIcon size={11} /> {entry.date}
        </span>

        {entry.time && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Clock size={11} /> {entry.time}
          </span>
        )}

        {entryPhotos.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--accent-amber)' }}>
            <ImageIcon size={11} /> {entryPhotos.length}
          </span>
        )}

        {entryAudios.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--primary)' }}>
            <Mic size={11} /> {entryAudios.length}
          </span>
        )}

        {entry.location && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <MapPin size={11} style={{ color: 'var(--accent-cyan)' }} />
            {entry.location}
          </span>
        )}

        {/* Creator in shared workspaces */}
        {entry.authorName && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Users size={11} /> {entry.authorName}
          </span>
        )}

        {/* Phase 13: Multilingual Text-to-Speech (TTS) Speaker Button */}
        <DiarySpeechButton 
          entry={entry} 
          style={{ marginLeft: entry.authorName ? '6px' : 'auto' }} 
        />
      </div>

      {/* 5. Attached Photo Thumbnails (Compact 42px) */}
      {entryPhotos.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingTop: '5px', marginTop: '5px', borderTop: '1px solid var(--border-color)' }}>
          {entryPhotos.map((photo, pIdx) => (
            <div
              key={photo.id || pIdx}
              onClick={() => onPhotoClick && onPhotoClick({
                ...photo,
                entryTitle: title,
                entryDate: entry.date,
                uploaderName: entry.authorName
              })}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '6px',
                overflow: 'hidden',
                flexShrink: 0,
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                position: 'relative'
              }}
            >
              <img
                src={photo.url}
                alt={photo.name || 'Attachment'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* 6. Attached Voice Notes (Compact Audio Player) */}
      {entryAudios.length > 0 && (
        <div style={{ marginTop: '6px', paddingTop: '5px', borderTop: entryPhotos.length === 0 ? '1px solid var(--border-color)' : 'none' }}>
          {entryAudios.map((audio) => (
            <AudioAttachmentPlayer
              key={audio.id}
              attachment={audio}
              canEdit={false}
            />
          ))}
        </div>
      )}
    </article>
  );
}
