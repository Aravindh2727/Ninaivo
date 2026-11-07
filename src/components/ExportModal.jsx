import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Printer,
  X,
  Calendar,
  Tag,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { exportToExcel, exportToPrintablePdf } from '../services/exportService';
import { getCategoryDisplayName } from '../utils/categoryTranslations';

export default function ExportModal({ isOpen, onClose, showToast }) {
  const { currentWorkspace, entries, categories } = useWorkspace();
  const { t, language } = useLanguage();

  const [presetRange, setPresetRange] = useState('all'); // 'all' | 'month' | 'year' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [includeFinancials, setIncludeFinancials] = useState(true);

  if (!isOpen) return null;

  // Compute active date range based on preset
  const today = new Date();
  let computedStart = startDate;
  let computedEnd = endDate;

  if (presetRange === 'month') {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    computedStart = `${y}-${m}-01`;
    computedEnd = today.toISOString().split('T')[0];
  } else if (presetRange === 'year') {
    computedStart = `${today.getFullYear()}-01-01`;
    computedEnd = today.toISOString().split('T')[0];
  } else if (presetRange === 'all') {
    computedStart = '';
    computedEnd = '';
  }

  // Count matching entries
  const matchingCount = entries.filter(e => {
    if (selectedCategory !== 'All' && e.entryType !== selectedCategory) return false;
    if (computedStart && e.date < computedStart) return false;
    if (computedEnd && e.date > computedEnd) return false;
    return true;
  }).length;

  const handleExportExcel = () => {
    const res = exportToExcel(entries, currentWorkspace, {
      dateRange: { start: computedStart, end: computedEnd },
      category: selectedCategory,
      includeFinancials
    });
    if (res.success) {
      showToast && showToast(t('exportSuccessToast'));
      onClose();
    }
  };

  const handleExportPdf = () => {
    const res = exportToPrintablePdf(entries, currentWorkspace, {
      dateRange: { start: computedStart, end: computedEnd },
      category: selectedCategory,
      includeFinancials,
      language
    });
    if (res.success) {
      showToast && showToast(t('exportSuccessToast'));
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-sheet" style={{ maxWidth: '480px', padding: '22px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <span className="card-subtitle" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
              {currentWorkspace?.name}
            </span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} style={{ color: 'var(--primary)' }} />
              {t('exportTitle')}
            </h3>
          </div>
          <button
            type="button"
            className="filter-chip"
            style={{ padding: '6px', borderRadius: '50%' }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.4 }}>
          {t('exportSubtitle')}
        </p>

        {/* Date Range Presets */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            {t('dateRangeLabel')}
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <button
              type="button"
              className={`filter-chip ${presetRange === 'all' ? 'active' : ''}`}
              onClick={() => setPresetRange('all')}
              style={{ fontSize: '0.74rem' }}
            >
              {t('periodAll')}
            </button>
            <button
              type="button"
              className={`filter-chip ${presetRange === 'month' ? 'active' : ''}`}
              onClick={() => setPresetRange('month')}
              style={{ fontSize: '0.74rem' }}
            >
              {t('periodMonth')}
            </button>
            <button
              type="button"
              className={`filter-chip ${presetRange === 'year' ? 'active' : ''}`}
              onClick={() => setPresetRange('year')}
              style={{ fontSize: '0.74rem' }}
            >
              {t('periodYear')}
            </button>
            <button
              type="button"
              className={`filter-chip ${presetRange === 'custom' ? 'active' : ''}`}
              onClick={() => setPresetRange('custom')}
              style={{ fontSize: '0.74rem' }}
            >
              {t('periodCustom')}
            </button>
          </div>

          {presetRange === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>
                  {t('startDateLabel')}
                </span>
                <input
                  type="date"
                  className="form-input"
                  style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>
                  {t('endDateLabel')}
                </span>
                <input
                  type="date"
                  className="form-input"
                  style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Category Filter */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            {t('categoryFilterLabel')}
          </label>
          <select
            className="form-input"
            style={{ fontSize: '0.8rem', padding: '8px' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">{t('allCategories')} ({entries.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{getCategoryDisplayName(c.name, language)}</option>
            ))}
          </select>
        </div>

        {/* Include Financials Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '18px',
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onClick={() => setIncludeFinancials(!includeFinancials)}
        >
          {includeFinancials ? (
            <CheckSquare size={16} style={{ color: 'var(--primary)' }} />
          ) : (
            <Square size={16} style={{ color: 'var(--text-dim)' }} />
          )}
          <span style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
            {t('includeFinancials')}
          </span>
        </div>

        {/* Preview Count */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('matchingRecords')}</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: matchingCount > 0 ? 'var(--accent-emerald)' : 'var(--text-dim)' }}>
            {matchingCount} {t('records')}
          </span>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn-primary"
            style={{
              flex: 1,
              background: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              justifyContent: 'center',
              padding: '10px'
            }}
            onClick={handleExportExcel}
            disabled={matchingCount === 0}
          >
            <FileSpreadsheet size={16} style={{ color: 'var(--accent-emerald)', marginRight: '6px' }} />
            <span style={{ fontSize: '0.8rem' }}>{t('excelCsv')}</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
            onClick={handleExportPdf}
            disabled={matchingCount === 0}
          >
            <Printer size={16} style={{ marginRight: '6px' }} />
            <span style={{ fontSize: '0.8rem' }}>{t('printPdf')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

