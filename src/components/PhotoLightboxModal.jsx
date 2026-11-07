import React, { useEffect } from 'react';
import { X, ExternalLink, Download, ChevronLeft, ChevronRight, Calendar, User, MapPin } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function PhotoLightboxModal({
  photo,
  onClose,
  photosList = [],
  currentIndex = -1,
  onSelectIndex
}) {
  const { t } = useLanguage();
  // Keyboard navigation
  useEffect(() => {
    if (!photo) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (photosList.length > 1 && currentIndex > 0) {
          onSelectIndex && onSelectIndex(currentIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (photosList.length > 1 && currentIndex < photosList.length - 1) {
          onSelectIndex && onSelectIndex(currentIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, currentIndex, photosList, onClose, onSelectIndex]);

  if (!photo) return null;

  const hasMultiple = photosList.length > 1 && currentIndex >= 0;
  const canGoPrev = hasMultiple && currentIndex > 0;
  const canGoNext = hasMultiple && currentIndex < photosList.length - 1;

  const handlePrev = (e) => {
    e.stopPropagation();
    if (canGoPrev) onSelectIndex(currentIndex - 1);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (canGoNext) onSelectIndex(currentIndex + 1);
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 1200, padding: '12px', background: 'rgba(0, 0, 0, 0.92)' }}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: '92vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '-40px',
            right: 0,
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            color: '#ffffff',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
          title="Close (Esc)"
        >
          <X size={18} />
        </button>

        {/* Previous Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={handlePrev}
            disabled={!canGoPrev}
            style={{
              position: 'absolute',
              left: '-20px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              color: canGoPrev ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canGoPrev ? 'pointer' : 'default',
              zIndex: 10
            }}
            title="Previous Photo (Left Arrow)"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Next Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext}
            style={{
              position: 'absolute',
              right: '-20px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              color: canGoNext ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canGoNext ? 'pointer' : 'default',
              zIndex: 10
            }}
            title="Next Photo (Right Arrow)"
          >
            <ChevronRight size={22} />
          </button>
        )}

        {/* Main Image */}
        <img
          src={photo.url}
          alt={photo.name || photo.entryTitle || 'Diary attachment'}
          style={{
            maxWidth: '100%',
            maxHeight: '75vh',
            objectFit: 'contain',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.85)'
          }}
        />

        {/* Image Caption & Diary Metadata */}
        <div style={{
          marginTop: '12px',
          color: '#ffffff',
          fontSize: '0.82rem',
          textAlign: 'center',
          maxWidth: '550px',
          background: 'rgba(15, 23, 42, 0.75)',
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          {photo.entryTitle && (
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px', color: '#f8fafc' }}>
              {photo.entryTitle}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.74rem', color: '#cbd5e1' }}>
            {photo.entryDate && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Calendar size={12} /> {photo.entryDate}
              </span>
            )}

            {photo.uploaderName && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <User size={12} /> {photo.uploaderName}
              </span>
            )}

            {photo.location && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <MapPin size={12} /> {photo.location}
              </span>
            )}

            {hasMultiple && (
              <span style={{ opacity: 0.8 }}>
                ({currentIndex + 1} / {photosList.length})
              </span>
            )}

            {photo.url.startsWith('http') && (
              <a
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#818cf8', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                title="Open original high-res image"
              >
                <ExternalLink size={12} /> {t('fullSize')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
