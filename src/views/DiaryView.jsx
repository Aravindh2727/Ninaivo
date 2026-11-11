import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  DollarSign, 
  Image as ImageIcon, 
  Edit3, 
  Trash2, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Tag, 
  X,
  ChevronDown,
  Sparkles,
  Users,
  Download,
  List,
  Calendar
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import PhotoLightboxModal from '../components/PhotoLightboxModal';
import EditEntryModal from '../components/EditEntryModal';
import CustomCategoryModal from '../components/CustomCategoryModal';
import ExportModal from '../components/ExportModal';
import ConflictModal from '../components/ConflictModal';
import AudioAttachmentPlayer from '../components/AudioAttachmentPlayer';
import DiaryEntryCard from '../components/DiaryEntryCard';
import CalendarView from './CalendarView';
import { getCategoryDisplayName } from '../utils/categoryTranslations';

export default function DiaryView({ onNavigate, showToast }) {
  const { 
    entries, 
    categories, 
    members, 
    createEntry,
    editEntry, 
    removeEntry, 
    currentWorkspace,
    canWriteEntries,
    isOwner 
  } = useWorkspace();
  const { t, language } = useLanguage();

  // View Mode: 'list' | 'calendar'
  const [viewMode, setViewMode] = useState('list');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedCreator, setSelectedCreator] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'

  // Modals state
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [conflictState, setConflictState] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Pagination state (for high performance historical browsing)
  const [pageLimit, setPageLimit] = useState(20);

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7); // "YYYY-MM"
  const currentYearStr = todayStr.substring(0, 4); // "YYYY"
  const currencySymbol = currentWorkspace?.settings?.currency || '₹';

  // Compute active date boundaries from selected period
  const dateBounds = useMemo(() => {
    let start = '';
    let end = '';

    if (selectedPeriod === 'today') {
      start = todayStr;
      end = todayStr;
    } else if (selectedPeriod === 'week') {
      start = sevenDaysAgoStr;
      end = todayStr;
    } else if (selectedPeriod === 'month') {
      start = `${currentMonthStr}-01`;
      end = todayStr;
    } else if (selectedPeriod === 'year') {
      start = `${currentYearStr}-01-01`;
      end = todayStr;
    } else if (selectedPeriod === 'custom') {
      start = customStart;
      end = customEnd;
    }

    return { start, end };
  }, [selectedPeriod, todayStr, sevenDaysAgoStr, currentMonthStr, currentYearStr, customStart, customEnd]);

  // Extract unique creators for member filter in shared workspaces
  const creatorsList = useMemo(() => {
    const map = new Map();
    entries.forEach(e => {
      const uid = e.createdByUid || 'anonymous';
      if (!map.has(uid)) {
        map.set(uid, e.authorName || 'Member');
      }
    });
    return Array.from(map.entries()).map(([uid, name]) => ({ uid, name }));
  }, [entries]);

  // Filter Logic
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 1. Category filter
      if (selectedCategory !== 'All' && entry.entryType !== selectedCategory) {
        return false;
      }

      // 2. Date period filter
      if (dateBounds.start && (!entry.date || entry.date < dateBounds.start)) {
        return false;
      }
      if (dateBounds.end && (!entry.date || entry.date > dateBounds.end)) {
        return false;
      }

      // 3. Creator filter
      if (selectedCreator !== 'all' && entry.createdByUid !== selectedCreator) {
        return false;
      }

      // 4. Search query across title, description, location, tags, entryType, and translations
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const rawTitle = typeof entry.title === 'object' ? (entry.title.original || '') : (entry.title || '');
        const rawDesc = typeof entry.description === 'object' ? (entry.description.original || '') : (entry.description || '');
        const matchTitle = rawTitle.toLowerCase().includes(q);
        const matchDesc = rawDesc.toLowerCase().includes(q);
        const matchLoc = entry.location?.toLowerCase().includes(q);
        const matchType = entry.entryType?.toLowerCase().includes(q);
        const matchTags = entry.tags?.some(tag => tag.toLowerCase().includes(q));

        // Multilingual match across cached translations
        const matchTranslations = Object.values(entry.translations || {}).some(tr => 
          (tr?.title && tr.title.toLowerCase().includes(q)) || 
          (tr?.description && tr.description.toLowerCase().includes(q))
        );

        if (!matchTitle && !matchDesc && !matchLoc && !matchType && !matchTags && !matchTranslations) return false;
      }

      return true;
    });
  }, [entries, selectedCategory, dateBounds, selectedCreator, searchQuery]);

  // Sort Logic
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const dateTimeA = new Date(`${a.date || '1970-01-01'}T${a.time || '00:00'}`);
      const dateTimeB = new Date(`${b.date || '1970-01-01'}T${b.time || '00:00'}`);
      return sortOrder === 'desc' ? dateTimeB - dateTimeA : dateTimeA - dateTimeB;
    });
  }, [filteredEntries, sortOrder]);

  // Paginated slice
  const displayedEntries = useMemo(() => {
    return sortedEntries.slice(0, pageLimit);
  }, [sortedEntries, pageLimit]);

  const handleDelete = async (entryId, title) => {
    if (window.confirm(`${t('deleteEntryConfirm')} ("${title}")`)) {
      try {
        await removeEntry(entryId);
        showToast && showToast('Diary note deleted.');
      } catch (err) {
        alert('Could not delete entry: ' + err.message);
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSelectedPeriod('all');
    setCustomStart('');
    setCustomEnd('');
    setSelectedCreator('all');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory !== 'All' || selectedPeriod !== 'all' || selectedCreator !== 'all' || searchQuery;

  // If user toggles into Calendar View
  if (viewMode === 'calendar') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button
            type="button"
            className="filter-chip active"
            style={{ fontSize: '0.74rem', padding: '6px 12px' }}
            onClick={() => setViewMode('list')}
          >
            <List size={14} style={{ marginRight: '4px' }} />
            {t('listView')}
          </button>
        </div>
        <CalendarView onNavigate={onNavigate} onBack={() => setViewMode('list')} />
      </div>
    );
  }

  return (
    <div className="screen-fade diary-view-container">
      {/* 1. Search Bar & View Mode Toggle */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search 
            size={15} 
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} 
          />
          <input 
            type="text"
            className="form-input compact-input"
            style={{ paddingLeft: '32px', height: '36px', fontSize: '0.80rem' }}
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Calendar View Toggle Button */}
        <button
          type="button"
          className="header-action-btn"
          style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px' }}
          onClick={() => setViewMode('calendar')}
          title={t('calendarView')}
        >
          <Calendar size={16} />
        </button>

        {/* Export Data Modal Trigger */}
        <button
          type="button"
          className="header-action-btn"
          style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px' }}
          onClick={() => setShowExportModal(true)}
          title={t('exportTitle')}
        >
          <Download size={16} />
        </button>
      </div>

      {/* 2. Chronological Period Tabs (Today, Week, Month, Year, All) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '6px' }}>
        <button
          type="button"
          className={`filter-chip ${selectedPeriod === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedPeriod('all')}
          style={{ fontSize: '0.68rem', padding: '3px 8px' }}
        >
          {t('periodAll')}
        </button>

        <button
          type="button"
          className={`filter-chip ${selectedPeriod === 'today' ? 'active' : ''}`}
          onClick={() => setSelectedPeriod('today')}
          style={{ fontSize: '0.68rem', padding: '3px 8px' }}
        >
          {t('periodToday')}
        </button>

        <button
          type="button"
          className={`filter-chip ${selectedPeriod === 'week' ? 'active' : ''}`}
          onClick={() => setSelectedPeriod('week')}
          style={{ fontSize: '0.68rem', padding: '3px 8px' }}
        >
          {t('periodWeek')}
        </button>

        <button
          type="button"
          className={`filter-chip ${selectedPeriod === 'month' ? 'active' : ''}`}
          onClick={() => setSelectedPeriod('month')}
          style={{ fontSize: '0.68rem', padding: '3px 8px' }}
        >
          {t('periodMonth')}
        </button>

        <button
          type="button"
          className={`filter-chip ${selectedPeriod === 'year' ? 'active' : ''}`}
          onClick={() => setSelectedPeriod('year')}
          style={{ fontSize: '0.68rem', padding: '3px 8px' }}
        >
          {t('periodYear')}
        </button>

        <button
          type="button"
          className={`filter-chip ${selectedPeriod === 'custom' ? 'active' : ''}`}
          onClick={() => setSelectedPeriod('custom')}
          style={{ fontSize: '0.68rem', padding: '3px 8px' }}
        >
          {t('periodCustom')}
        </button>

        {/* Sort Order Toggle */}
        <button
          type="button"
          className="filter-chip"
          style={{ marginLeft: 'auto', fontSize: '0.68rem', padding: '3px 8px', flexShrink: 0 }}
          onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
          title="Toggle sort order"
        >
          <ArrowUpDown size={11} style={{ display: 'inline', marginRight: '3px' }} />
          {sortOrder === 'desc' ? t('newestFirst') : t('oldestFirst')}
        </button>
      </div>

      {/* Custom Date Range Inputs (if 'custom' selected) */}
      {selectedPeriod === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px', background: 'var(--bg-card)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>
              {t('startDateLabel')}
            </span>
            <input
              type="date"
              className="form-input"
              style={{ fontSize: '0.74rem', padding: '4px 6px', height: '32px' }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </div>
          <div>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>
              {t('endDateLabel')}
            </span>
            <input
              type="date"
              className="form-input"
              style={{ fontSize: '0.74rem', padding: '4px 6px', height: '32px' }}
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 3. Category Filter Chips & Member Filter */}
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px', marginBottom: '6px' }}>
        <button
          className={`filter-chip ${selectedCategory === 'All' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('All')}
          style={{ fontSize: '0.68rem', padding: '3px 8px' }}
        >
          {t('allTypes')} ({entries.length})
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`filter-chip ${selectedCategory === cat.name ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.name)}
            style={{ fontSize: '0.68rem', padding: '3px 8px' }}
          >
            {getCategoryDisplayName(cat.name, language)}
          </button>
        ))}

        {/* Filter by Member (if shared workspace) */}
        {creatorsList.length > 1 && (
          <select
            className="filter-chip"
            style={{ fontSize: '0.68rem', padding: '3px 6px', outline: 'none' }}
            value={selectedCreator}
            onChange={(e) => setSelectedCreator(e.target.value)}
          >
            <option value="all">{t('allCreators')}</option>
            {creatorsList.map(c => (
              <option key={c.uid} value={c.uid}>{c.name}</option>
            ))}
          </select>
        )}

        <button
          className="filter-chip"
          style={{ borderStyle: 'dashed', color: 'var(--primary)', fontSize: '0.68rem', padding: '3px 8px' }}
          onClick={() => setShowCategoryModal(true)}
          title="Manage entry types"
        >
          <Tag size={11} style={{ display: 'inline', marginRight: '3px' }} />
          {t('manageTypes')}
        </button>
      </div>

      {/* 4. Active Filter Summary & Clear Button */}
      {hasActiveFilters && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.70rem', color: 'var(--text-muted)' }}>
          <span>
            {t('showing')} <strong>{sortedEntries.length}</strong> {t('of')} {entries.length} {t('records')}
          </span>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}
            onClick={handleResetFilters}
          >
            <X size={11} /> {t('clearFilters')}
          </button>
        </div>
      )}

      {/* 5. Diary Entries Feed */}
      {sortedEntries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px 14px', borderRadius: '12px' }}>
          <BookOpen size={28} style={{ color: 'var(--text-dim)', margin: '0 auto 8px auto' }} />
          <p style={{ color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 700 }}>
            {t('noEntriesFound')}
          </p>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '3px', display: 'block' }}>
            {t('noEntriesSubtitle')}
          </span>
          <div style={{ marginTop: '12px' }}>
            <button 
              type="button" 
              className="btn-primary" 
              style={{ width: 'auto', display: 'inline-flex', padding: '6px 14px', fontSize: '0.78rem', height: '34px' }}
              onClick={() => onNavigate('add')}
            >
              <Plus size={14} />
              <span>{t('logTodayEntry')}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {displayedEntries.map((entry) => (
              <DiaryEntryCard
                key={entry.id}
                entry={entry}
                currentWorkspace={currentWorkspace}
                canWriteEntries={canWriteEntries}
                currencySymbol={currencySymbol}
                onEdit={(e) => setEditingEntry(e)}
                onDelete={(id, title) => handleDelete(id, title)}
                onPhotoClick={(photoInfo) => setLightboxPhoto(photoInfo)}
              />
            ))}
          </div>

          {/* Pagination / Load More Button */}
          {sortedEntries.length > displayedEntries.length && (
            <div style={{ textAlign: 'center', marginTop: '12px', marginBottom: '6px' }}>
              <button
                type="button"
                className="filter-chip"
                style={{ padding: '6px 14px', fontSize: '0.74rem', fontWeight: 600 }}
                onClick={() => setPageLimit(prev => prev + 20)}
              >
                {t('loadMore')} ({sortedEntries.length - displayedEntries.length} {t('remaining')})
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit Entry Modal with Optimistic Conflict Handling */}
      {editingEntry && (
        <EditEntryModal
          isOpen={Boolean(editingEntry)}
          entry={editingEntry}
          showToast={showToast}
          onClose={() => setEditingEntry(null)}
          onSave={async (id, updates) => {
            const res = await editEntry(id, updates);
            if (res && res.conflict) {
              setConflictState(res);
              return false; // prevent closing until resolved
            }
            setEditingEntry(null);
            showToast && showToast('Diary note updated.');
            return true;
          }}
        />
      )}

      {/* Conflict Resolution Modal */}
      {conflictState && (
        <ConflictModal
          isOpen={Boolean(conflictState)}
          conflictData={conflictState}
          onClose={() => setConflictState(null)}
          onResolveOverwrite={async () => {
            await editEntry(conflictState.entryId, conflictState.localUpdates, { forceOverwrite: true });
            setConflictState(null);
            setEditingEntry(null);
            showToast && showToast('Changes applied over cloud version.');
          }}
          onResolveKeepCloud={() => {
            setConflictState(null);
            setEditingEntry(null);
            showToast && showToast('Retained current cloud version.');
          }}
          onResolveSaveCopy={async () => {
            const copyTitle = `[Copy] ${conflictState.localUpdates.title || 'Note'}`;
            await createEntry({
              ...conflictState.remoteData,
              ...conflictState.localUpdates,
              title: copyTitle,
              description: `[Saved as copy during conflict resolution]\n\n${conflictState.localUpdates.description || ''}`,
              tags: [...(conflictState.localUpdates.tags || []), 'ConflictCopy']
            });
            setConflictState(null);
            setEditingEntry(null);
            showToast && showToast('Saved draft as a separate copy!');
          }}
        />
      )}

      {/* Custom Categories Modal */}
      <CustomCategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        showToast={showToast}
      />

      {/* Export Data Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        showToast={showToast}
      />

      {/* Photo Lightbox */}
      <PhotoLightboxModal
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />
    </div>
  );
}
