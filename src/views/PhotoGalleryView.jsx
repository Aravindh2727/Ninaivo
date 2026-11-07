import React, { useState, useMemo } from 'react';
import { 
  Image as ImageIcon, 
  Search, 
  Calendar, 
  Tag, 
  ArrowLeft, 
  X, 
  Sparkles, 
  ExternalLink 
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryDisplayName } from '../utils/categoryTranslations';
import PhotoLightboxModal from '../components/PhotoLightboxModal';

export default function PhotoGalleryView({ onBack }) {
  const { entries, categories, currentWorkspace } = useWorkspace();
  const { t, language } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [activePhotoIndex, setActivePhotoIndex] = useState(-1);

  // Extract all photos with parent entry metadata
  const allPhotos = useMemo(() => {
    const list = [];
    entries.forEach(entry => {
      const displayTitle = (language === 'ta' && entry.translations?.ta?.title)
        ? entry.translations.ta.title
        : ((language === 'en' && entry.translations?.en?.title) ? entry.translations.en.title : (entry.title || ''));

      (entry.attachments || []).forEach(att => {
        if (att && att.url && att.type !== 'audio') {
          list.push({
            ...att,
            entryId: entry.id,
            entryTitle: displayTitle,
            entryDate: entry.date,
            entryType: entry.entryType,
            location: entry.location,
            uploaderName: entry.authorName || 'Member',
            uploaderAvatar: entry.authorAvatar
          });
        }
      });
    });

    // Sort newest first
    list.sort((a, b) => new Date(b.entryDate || '1970-01-01') - new Date(a.entryDate || '1970-01-01'));
    return list;
  }, [entries, language]);

  // Extract unique months for month filter
  const monthsList = useMemo(() => {
    const set = new Set();
    allPhotos.forEach(p => {
      if (p.entryDate) {
        set.add(p.entryDate.substring(0, 7)); // "YYYY-MM"
      }
    });
    return Array.from(set).sort().reverse();
  }, [allPhotos]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return allPhotos.filter(p => {
      if (selectedCategory !== 'All' && p.entryType !== selectedCategory) return false;
      if (selectedMonth !== 'all' && (!p.entryDate || !p.entryDate.startsWith(selectedMonth))) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (p.entryTitle || '').toLowerCase().includes(q);
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchLocation = (p.location || '').toLowerCase().includes(q);
        if (!matchTitle && !matchName && !matchLocation) return false;
      }
      return true;
    });
  }, [allPhotos, selectedCategory, selectedMonth, searchQuery]);

  return (
    <div className="screen-fade">
      {/* Header Card */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBack && (
              <button
                type="button"
                className="filter-chip"
                style={{ padding: '4px' }}
                onClick={onBack}
                title="Back"
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <span className="card-subtitle" style={{ fontSize: '0.66rem' }}>
                {currentWorkspace?.name}
              </span>
              <h2 className="card-title" style={{ fontSize: '0.96rem', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ImageIcon size={16} style={{ color: 'var(--accent-rose)' }} />
                {t('photoGalleryTitle')}
              </h2>
            </div>
          </div>

          <span className="tag-pill" style={{ fontSize: '0.66rem', padding: '2px 6px' }}>
            {filteredPhotos.length} {t('photosCount')}
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '8px 10px' }}>
        {/* Search */}
        <div className="search-wrap" style={{ marginBottom: '6px' }}>
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input compact-input"
            style={{ fontSize: '0.78rem', padding: '6px 10px 6px 30px', height: '34px' }}
            placeholder="Search photos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {/* Category Filter */}
          <select
            className="form-input compact-input"
            style={{ fontSize: '0.74rem', padding: '4px 6px', height: '32px', width: 'auto', flex: 1, minWidth: '120px' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">{t('allTypes')} ({allPhotos.length})</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{getCategoryDisplayName(c.name, language)}</option>
            ))}
          </select>

          {/* Month Filter */}
          <select
            className="form-input compact-input"
            style={{ fontSize: '0.74rem', padding: '4px 6px', height: '32px', width: 'auto', flex: 1, minWidth: '110px' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="all">{t('allMonths')}</option>
            {monthsList.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {(selectedCategory !== 'All' || selectedMonth !== 'all' || searchQuery) && (
            <button
              type="button"
              className="filter-chip"
              style={{ fontSize: '0.70rem', padding: '4px 8px' }}
              onClick={() => {
                setSelectedCategory('All');
                setSelectedMonth('all');
                setSearchQuery('');
              }}
            >
              {t('reset')}
            </button>
          )}
        </div>
      </div>

      {/* Photos Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="card compact-form-card" style={{ textAlign: 'center', padding: '30px 14px', color: 'var(--text-muted)' }}>
          <ImageIcon size={28} style={{ opacity: 0.3, marginBottom: '6px' }} />
          <p style={{ fontSize: '0.82rem', margin: 0, fontWeight: 600 }}>{t('noPhotosFound')}</p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
          gap: '8px' 
        }}>
          {filteredPhotos.map((item, idx) => (
            <div
              key={item.id || idx}
              onClick={() => setActivePhotoIndex(idx)}
              style={{
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 120ms ease, box-shadow 120ms ease'
              }}
            >
              <div style={{ position: 'relative', width: '100%', paddingBottom: '75%', overflow: 'hidden', background: '#0f172a' }}>
                <img
                  src={item.url}
                  alt={item.entryTitle}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  loading="lazy"
                />
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(0, 0, 0, 0.65)',
                  color: '#ffffff',
                  fontSize: '0.58rem',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontWeight: 600
                }}>
                  {item.entryType}
                </span>
              </div>

              <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ 
                  fontSize: '0.74rem', 
                  fontWeight: 600, 
                  color: 'var(--text-main)', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis' 
                }}>
                  {item.entryTitle}
                </span>
                <span style={{ fontSize: '0.64rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Calendar size={9} /> {item.entryDate}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enhanced Photo Lightbox */}
      {activePhotoIndex >= 0 && (
        <PhotoLightboxModal
          photo={filteredPhotos[activePhotoIndex]}
          onClose={() => setActivePhotoIndex(-1)}
          photosList={filteredPhotos}
          currentIndex={activePhotoIndex}
          onSelectIndex={(newIdx) => setActivePhotoIndex(newIdx)}
        />
      )}
    </div>
  );
}

