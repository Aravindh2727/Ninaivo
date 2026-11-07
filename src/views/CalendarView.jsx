import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Plus, 
  Image as ImageIcon,
  BookOpen,
  ArrowLeft,
  Sparkles,
  Languages
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { useTranslatedDiaryEntry } from '../hooks/useTranslatedDiaryEntry';
import { getCategoryDisplayName } from '../utils/categoryTranslations';
import PhotoLightboxModal from '../components/PhotoLightboxModal';
import DiarySpeechButton from '../components/DiarySpeechButton';

/**
 * Individual Calendar Date Entry with Centralized Multilingual Translation
 */
function CalendarEntryItem({ entry, currencySymbol, onSelectPhoto }) {
  const { t, language } = useLanguage();
  const { title, description, isTranslated, sourceLanguage } = useTranslatedDiaryEntry(entry);

  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span className="compact-category-pill" style={{ color: 'var(--primary)', background: 'var(--chip-green-bg)' }}>
            {getCategoryDisplayName(entry.entryType, language)}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Clock size={10} /> {entry.time}
          </span>
          {isTranslated && (
            <span style={{ 
              fontSize: '0.60rem', 
              color: 'var(--primary)', 
              background: 'var(--chip-green-bg)', 
              padding: '1px 4px', 
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }} title={t('translationBadgeTooltip')}>
              <Languages size={9} />
              <span>{sourceLanguage === 'ta' ? 'EN' : 'TA'}</span>
            </span>
          )}
        </div>

        {entry.amount !== null && entry.amount !== undefined && !isNaN(entry.amount) && (
          <span style={{ 
            fontSize: '0.74rem', 
            fontWeight: 700, 
            color: entry.amountType === 'income' ? 'var(--accent-emerald)' : 'var(--accent-rose)' 
          }}>
            {entry.amountType === 'income' ? '+' : '-'}{currencySymbol}{Number(entry.amount).toLocaleString()}
          </span>
        )}
      </div>

      <h4 style={{ fontSize: '0.84rem', fontWeight: 700, margin: '1px 0 0 0', color: 'var(--text-main)' }}>
        {title}
      </h4>

      {description && (
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>
          {description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
        <div>
          {entry.location && (
            <span style={{ marginRight: '6px', color: 'var(--accent-cyan)' }}>
              📍 {entry.location}
            </span>
          )}
          <span>👤 {entry.authorName || 'Member'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(entry.attachments || []).length > 0 && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}
              onClick={() => onSelectPhoto(entry.attachments[0])}
            >
              <ImageIcon size={11} />
              {entry.attachments.length} {entry.attachments.length > 1 ? t('photosCount') : t('photo')}
            </button>
          )}

          {/* Phase 13: Multilingual Text-to-Speech (TTS) Speaker Button */}
          <DiarySpeechButton entry={entry} />
        </div>
      </div>
    </div>
  );
}

export default function CalendarView({ onNavigate, onBack }) {
  const { entries, currentWorkspace } = useWorkspace();
  const { t, language } = useLanguage();

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    return today.toISOString().split('T')[0];
  });
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11

  // Month and Day labels in English and Tamil
  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNamesTa = [
    'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
    'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'
  ];

  const dayHeadersEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayHeadersTa = ['ஞா', 'தி', 'செ', 'பு', 'வி', 'வெ', 'ச'];

  const monthName = language === 'ta' ? monthNamesTa[month] : monthNamesEn[month];
  const dayHeaders = language === 'ta' ? dayHeadersTa : dayHeadersEn;

  // Group entries by date string "YYYY-MM-DD"
  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      if (e.date) {
        if (!map[e.date]) map[e.date] = [];
        map[e.date].push(e);
      }
    });
    return map;
  }, [entries]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = prevDate.toISOString().split('T')[0];
      days.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
        entries: entriesByDate[dateStr] || []
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        entries: entriesByDate[dateStr] || []
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(year, month + 1, i);
        const dateStr = nextDate.toISOString().split('T')[0];
        days.push({
          dayNum: i,
          dateStr,
          isCurrentMonth: false,
          entries: entriesByDate[dateStr] || []
        });
      }
    }

    return days;
  }, [year, month, entriesByDate]);

  // Entries for the currently selected date
  const selectedDateEntries = entriesByDate[selectedDateStr] || [];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handlePrevYear = () => {
    setCurrentDate(new Date(year - 1, month, 1));
  };

  const handleNextYear = () => {
    setCurrentDate(new Date(year + 1, month, 1));
  };

  const handleJumpToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(now.toISOString().split('T')[0]);
  };

  const todayStr = today.toISOString().split('T')[0];
  const currencySymbol = currentWorkspace?.settings?.currency || '₹';

  return (
    <div className="screen-fade">
      {/* Calendar Header Card */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onBack && (
              <button
                type="button"
                className="filter-chip"
                style={{ padding: '4px' }}
                onClick={onBack}
                title={t('back')}
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <span className="card-subtitle" style={{ fontSize: '0.66rem' }}>
                {currentWorkspace?.name}
              </span>
              <h2 className="card-title" style={{ fontSize: '0.96rem', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CalendarIcon size={16} style={{ color: 'var(--primary)' }} />
                {t('calendarView')}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="filter-chip active"
            style={{ fontSize: '0.70rem', padding: '3px 8px', fontWeight: 700 }}
            onClick={handleJumpToday}
          >
            {t('todayBtn')}
          </button>
        </div>

        {/* Month & Year Navigation Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-subtle)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '3px' }}>
            <button
              type="button"
              className="filter-chip compact-calendar-btn"
              style={{ padding: '3px 5px' }}
              onClick={handlePrevYear}
              title={t('prevYear')}
            >
              <ChevronsLeft size={13} />
            </button>
            <button
              type="button"
              className="filter-chip compact-calendar-btn"
              style={{ padding: '3px 5px' }}
              onClick={handlePrevMonth}
              title={t('prevMonth')}
            >
              <ChevronLeft size={13} />
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {monthName} {year}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '3px' }}>
            <button
              type="button"
              className="filter-chip compact-calendar-btn"
              style={{ padding: '3px 5px' }}
              onClick={handleNextMonth}
              title={t('nextMonth')}
            >
              <ChevronRight size={13} />
            </button>
            <button
              type="button"
              className="filter-chip compact-calendar-btn"
              style={{ padding: '3px 5px' }}
              onClick={handleNextYear}
              title={t('nextYear')}
            >
              <ChevronsRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid Card */}
      <div className="card compact-form-card" style={{ padding: '8px 8px', marginBottom: '10px' }}>
        {/* Day of Week Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '4px' }}>
          {dayHeaders.map((header, idx) => (
            <div key={idx} style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 0' }}>
              {header}
            </div>
          ))}
        </div>

        {/* Calendar Days Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
          {calendarDays.map((cell, idx) => {
            const isSelected = cell.dateStr === selectedDateStr;
            const isToday = cell.dateStr === todayStr;
            const hasEntries = cell.entries.length > 0;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDateStr(cell.dateStr)}
                style={{
                  minHeight: '36px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 1px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: isSelected 
                    ? '2px solid var(--primary)' 
                    : isToday 
                    ? '1px dashed var(--primary)' 
                    : '1px solid transparent',
                  background: isSelected 
                    ? 'var(--chip-green-bg)' 
                    : hasEntries 
                    ? 'var(--bg-card-subtle)' 
                    : 'transparent',
                  color: !cell.isCurrentMonth 
                    ? 'var(--text-dim)' 
                    : isSelected 
                    ? 'var(--primary)' 
                    : 'var(--text-main)',
                  position: 'relative',
                  transition: 'all 120ms ease'
                }}
              >
                <span style={{ 
                  fontSize: '0.78rem', 
                  fontWeight: isToday || isSelected ? 800 : cell.isCurrentMonth ? 600 : 400 
                }}>
                  {cell.dayNum}
                </span>

                {/* Entry Dot / Badge */}
                {hasEntries && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: '1px' }}>
                    <span style={{
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      background: isSelected ? 'var(--primary)' : 'var(--chip-green-bg)',
                      color: isSelected ? '#ffffff' : 'var(--primary)',
                      borderRadius: '6px',
                      padding: '0 3px',
                      lineHeight: 1.1
                    }}>
                      {cell.entries.length}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Entries List */}
      <div className="card compact-form-card" style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
          <div>
            <span className="card-subtitle" style={{ fontSize: '0.66rem' }}>
              {t('viewDateEntries')}
            </span>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '1px 0 0 0', color: 'var(--text-main)' }}>
              {selectedDateStr}
            </h3>
          </div>

          <button
            type="button"
            className="btn-primary compact-btn"
            style={{ padding: '4px 10px', fontSize: '0.72rem', height: '30px', width: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}
            onClick={() => onNavigate && onNavigate('add')}
          >
            <Plus size={13} />
            <span>{t('logForThisDate')}</span>
          </button>
        </div>

        {selectedDateEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>
            <CalendarIcon size={24} style={{ opacity: 0.3, marginBottom: '4px' }} />
            <p style={{ fontSize: '0.80rem', margin: 0 }}>{t('noEntriesForDate')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selectedDateEntries.map((entry) => (
              <CalendarEntryItem
                key={entry.id}
                entry={entry}
                currencySymbol={currencySymbol}
                onSelectPhoto={(photo) => setSelectedPhoto(photo)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Photo Lightbox */}
      <PhotoLightboxModal
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </div>
  );
}

