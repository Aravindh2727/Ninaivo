import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart, 
  Sprout, 
  Users, 
  Calendar, 
  ArrowLeft, 
  Filter, 
  Plus, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  FileText,
  Clock
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { WORKSPACE_MODES } from '../services/workspaceService';
import { useTranslatedDiaryEntry } from '../hooks/useTranslatedDiaryEntry';
import { getCategoryDisplayName } from '../utils/categoryTranslations';

/**
 * Individual Transaction / Activity Item with Centralized Multilingual Translation
 */
function AnalyticsEntryCardItem({ entry, currencySymbol }) {
  const { language } = useLanguage();
  const { title, description } = useTranslatedDiaryEntry(entry);

  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="compact-category-pill" style={{ color: 'var(--primary)', background: 'var(--chip-green-bg)' }}>
          {getCategoryDisplayName(entry.entryType, language)}
        </span>

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
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
          {description}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem', color: 'var(--text-dim)', marginTop: '2px' }}>
        <span>📍 {entry.location || 'Farm Field'}</span>
        <span>👤 {entry.authorName || 'Member'}</span>
      </div>
    </div>
  );
}

export default function AnalyticsView({ onBack, onNavigate }) {
  const { entries, currentWorkspace, members, categories, activityLogs } = useWorkspace();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState('financial'); // 'financial' | 'agriculture' | 'team'
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // 'all' | 'month' | 'quarter' | 'year' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [agriCropFilter, setAgriCropFilter] = useState('all');

  const currencySymbol = currentWorkspace?.settings?.currency || '₹';

  // Compute active date boundaries
  const today = new Date();
  const dateBounds = useMemo(() => {
    let start = '';
    let end = today.toISOString().split('T')[0];

    if (dateRangeFilter === 'month') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      start = `${y}-${m}-01`;
    } else if (dateRangeFilter === 'quarter') {
      const d = new Date(Date.now() - 90 * 86400000);
      start = d.toISOString().split('T')[0];
    } else if (dateRangeFilter === 'year') {
      start = `${today.getFullYear()}-01-01`;
    } else if (dateRangeFilter === 'custom') {
      start = customStart;
      end = customEnd || end;
    }

    return { start, end };
  }, [dateRangeFilter, customStart, customEnd]);

  // Filter entries within date boundaries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (dateBounds.start && e.date < dateBounds.start) return false;
      if (dateBounds.end && e.date > dateBounds.end) return false;
      return true;
    });
  }, [entries, dateBounds]);

  // 1. FINANCIAL CALCULATIONS
  const financialEntries = useMemo(() => {
    return filteredEntries.filter(e => e.amount !== null && e.amount !== undefined && !isNaN(e.amount));
  }, [filteredEntries]);

  const hasFinancialData = financialEntries.length > 0;

  const totalIncome = useMemo(() => {
    return financialEntries
      .filter(e => e.amountType === 'income')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [financialEntries]);

  const totalExpense = useMemo(() => {
    return financialEntries
      .filter(e => e.amountType === 'expense' || !e.amountType)
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [financialEntries]);

  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  // Monthly breakdown for Income vs Expense Bar Chart
  const monthlyData = useMemo(() => {
    const map = {};
    financialEntries.forEach(e => {
      if (e.date) {
        const monthKey = e.date.substring(0, 7); // "YYYY-MM"
        if (!map[monthKey]) {
          map[monthKey] = { month: monthKey, income: 0, expense: 0 };
        }
        if (e.amountType === 'income') {
          map[monthKey].income += Number(e.amount);
        } else {
          map[monthKey].expense += Number(e.amount);
        }
      }
    });

    const list = Object.values(map);
    list.sort((a, b) => a.month.localeCompare(b.month));
    return list;
  }, [financialEntries]);

  // Max value for bar scaling
  const maxMonthValue = useMemo(() => {
    let max = 0;
    monthlyData.forEach(d => {
      if (d.income > max) max = d.income;
      if (d.expense > max) max = d.expense;
    });
    return max > 0 ? max : 1;
  }, [monthlyData]);

  // Category-wise Expense Breakdown
  const expensesByCategory = useMemo(() => {
    const map = {};
    financialEntries
      .filter(e => e.amountType === 'expense' || !e.amountType)
      .forEach(e => {
        const cat = e.entryType || 'General';
        map[cat] = (map[cat] || 0) + Number(e.amount);
      });

    return Object.entries(map)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [financialEntries, totalExpense]);

  // Income by Source
  const incomeBySource = useMemo(() => {
    const map = {};
    financialEntries
      .filter(e => e.amountType === 'income')
      .forEach(e => {
        const cat = e.entryType || 'Income';
        map[cat] = (map[cat] || 0) + Number(e.amount);
      });

    return Object.entries(map)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [financialEntries, totalIncome]);

  // 2. AGRICULTURE CALCULATIONS
  const agriKeywords = ['agriculture', 'paddy', 'crop', 'harvest', 'farming', 'fertilizer', 'pesticide', 'seed', 'irrigation', 'water canal', 'land', 'tractor', 'farm'];
  
  const agriEntries = useMemo(() => {
    return filteredEntries.filter(e => {
      const typeLower = (e.entryType || '').toLowerCase();
      const titleLower = (e.title || '').toLowerCase();
      const descLower = (e.description || '').toLowerCase();
      const tagsStr = (e.tags || []).join(' ').toLowerCase();

      const isAgriType = typeLower === 'agriculture';
      const matchesKeyword = agriKeywords.some(kw => 
        typeLower.includes(kw) || titleLower.includes(kw) || descLower.includes(kw) || tagsStr.includes(kw)
      );

      if (!isAgriType && !matchesKeyword) return false;

      if (agriCropFilter !== 'all') {
        const filterLower = agriCropFilter.toLowerCase();
        return titleLower.includes(filterLower) || descLower.includes(filterLower) || tagsStr.includes(filterLower);
      }

      return true;
    });
  }, [filteredEntries, agriCropFilter]);

  const hasAgriData = agriEntries.length > 0;

  const agriFinancials = useMemo(() => {
    let income = 0;
    let expense = 0;
    agriEntries.forEach(e => {
      if (e.amount && !isNaN(e.amount)) {
        if (e.amountType === 'income') income += Number(e.amount);
        if (e.amountType === 'expense' || !e.amountType) expense += Number(e.amount);
      }
    });
    return { income, expense, profit: income - expense };
  }, [agriEntries]);

  // Extract unique crops from tags for crop filter
  const cropTags = useMemo(() => {
    const set = new Set();
    entries.forEach(e => {
      (e.tags || []).forEach(t => {
        const tLower = t.toLowerCase();
        if (agriKeywords.some(kw => tLower.includes(kw)) || ['paddy', 'wheat', 'cotton', 'sugarcane', 'vegetables', 'banana', 'coconut', 'turmeric'].includes(tLower)) {
          set.add(t);
        }
      });
    });
    return Array.from(set);
  }, [entries]);

  // 3. TEAM & MEMBER CONTRIBUTIONS
  const memberContributions = useMemo(() => {
    const map = {};
    filteredEntries.forEach(e => {
      const uid = e.createdByUid || 'anonymous';
      const name = e.authorName || 'Member';
      const avatar = e.authorAvatar;
      if (!map[uid]) {
        map[uid] = { uid, name, avatar, count: 0 };
      }
      map[uid].count += 1;
    });

    const total = filteredEntries.length;
    return Object.values(map)
      .map(m => ({
        ...m,
        percentage: total > 0 ? Math.round((m.count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEntries]);

  return (
    <div className="screen-fade">
      {/* Header */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
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
                <BarChart3 size={16} style={{ color: 'var(--primary)' }} />
                {t('analyticsTitle')}
              </h2>
            </div>
          </div>

          <span className="tag-pill" style={{ fontSize: '0.64rem', textTransform: 'uppercase', padding: '2px 6px' }}>
            {currentWorkspace?.type} Workspace
          </span>
        </div>

        {/* Analytics Sub-Tabs */}
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
          <button
            type="button"
            className={`filter-chip ${activeTab === 'financial' ? 'active' : ''}`}
            onClick={() => setActiveTab('financial')}
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            <DollarSign size={12} style={{ marginRight: '3px' }} />
            {t('financialAnalytics')}
          </button>

          <button
            type="button"
            className={`filter-chip ${activeTab === 'agriculture' ? 'active' : ''}`}
            onClick={() => setActiveTab('agriculture')}
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            <Sprout size={12} style={{ marginRight: '3px' }} />
            {t('agricultureTracking')}
          </button>

          {currentWorkspace?.type !== WORKSPACE_MODES.PERSONAL && (
            <button
              type="button"
              className={`filter-chip ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => setActiveTab('team')}
              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
            >
              <Users size={12} style={{ marginRight: '3px' }} />
              {t('memberContributions')}
            </button>
          )}
        </div>
      </div>

      {/* Date Range Selector Toolbar */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '0.70rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {t('historyPeriod')}:
          </span>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`filter-chip ${dateRangeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDateRangeFilter('all')}
              style={{ fontSize: '0.68rem', padding: '3px 7px' }}
            >
              {t('periodAll')}
            </button>
            <button
              type="button"
              className={`filter-chip ${dateRangeFilter === 'month' ? 'active' : ''}`}
              onClick={() => setDateRangeFilter('month')}
              style={{ fontSize: '0.68rem', padding: '3px 7px' }}
            >
              {t('periodMonth')}
            </button>
            <button
              type="button"
              className={`filter-chip ${dateRangeFilter === 'quarter' ? 'active' : ''}`}
              onClick={() => setDateRangeFilter('quarter')}
              style={{ fontSize: '0.68rem', padding: '3px 7px' }}
            >
              90 Days
            </button>
            <button
              type="button"
              className={`filter-chip ${dateRangeFilter === 'year' ? 'active' : ''}`}
              onClick={() => setDateRangeFilter('year')}
              style={{ fontSize: '0.68rem', padding: '3px 7px' }}
            >
              {t('periodYear')}
            </button>
            <button
              type="button"
              className={`filter-chip ${dateRangeFilter === 'custom' ? 'active' : ''}`}
              onClick={() => setDateRangeFilter('custom')}
              style={{ fontSize: '0.68rem', padding: '3px 7px' }}
            >
              Custom
            </button>
          </div>
        </div>

        {dateRangeFilter === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
            <div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>
                {t('startDateLabel')}
              </span>
              <input
                type="date"
                className="form-input compact-input"
                style={{ fontSize: '0.72rem', padding: '4px 6px', height: '30px' }}
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>
                {t('endDateLabel')}
              </span>
              <input
                type="date"
                className="form-input compact-input"
                style={{ fontSize: '0.72rem', padding: '4px 6px', height: '30px' }}
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: FINANCIAL ANALYTICS */}
      {activeTab === 'financial' && (
        <>
          {!hasFinancialData ? (
            <div className="card compact-form-card" style={{ textAlign: 'center', padding: '30px 14px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                background: 'rgba(16, 185, 129, 0.12)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 8px auto',
                color: 'var(--accent-emerald)'
              }}>
                <DollarSign size={22} />
              </div>
              <h3 style={{ fontSize: '0.94rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-main)' }}>
                {t('noFinancialData')}
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 14px auto', lineHeight: 1.4 }}>
                {t('noFinancialDataDesc')}
              </p>
              <button
                type="button"
                className="btn-primary compact-btn"
                style={{ width: 'auto', display: 'inline-flex', padding: '6px 14px', fontSize: '0.76rem' }}
                onClick={() => onNavigate && onNavigate('add')}
              >
                <Plus size={14} />
                <span>Log an Entry with Amount</span>
              </button>
            </div>
          ) : (
            <>
              {/* Financial Metrics Cards */}
              <div className="compact-metric-grid" style={{ marginBottom: '10px' }}>
                <div className="metric-card compact-metric-card">
                  <div className="metric-label" style={{ fontSize: '0.70rem' }}>
                    <span>{t('totalIncome')}</span>
                    <TrendingUp size={13} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <div className="compact-metric-val" style={{ color: 'var(--accent-emerald)' }}>
                    +{currencySymbol}{totalIncome.toLocaleString()}
                  </div>
                  <div className="metric-subtext" style={{ fontSize: '0.62rem' }}>{t('received')}</div>
                </div>

                <div className="metric-card compact-metric-card">
                  <div className="metric-label" style={{ fontSize: '0.70rem' }}>
                    <span>{t('totalExpense')}</span>
                    <TrendingDown size={13} style={{ color: 'var(--accent-rose)' }} />
                  </div>
                  <div className="compact-metric-val" style={{ color: 'var(--accent-rose)' }}>
                    -{currencySymbol}{totalExpense.toLocaleString()}
                  </div>
                  <div className="metric-subtext" style={{ fontSize: '0.62rem' }}>{t('spent')}</div>
                </div>

                <div className="metric-card compact-metric-card">
                  <div className="metric-label" style={{ fontSize: '0.70rem' }}>
                    <span>{t('netBalance')}</span>
                    <DollarSign size={13} style={{ color: netBalance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }} />
                  </div>
                  <div className="compact-metric-val" style={{ color: netBalance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {netBalance >= 0 ? '+' : ''}{currencySymbol}{netBalance.toLocaleString()}
                  </div>
                  <div className="metric-subtext" style={{ fontSize: '0.62rem' }}>{netBalance >= 0 ? 'Surplus' : 'Deficit'}</div>
                </div>

                <div className="metric-card compact-metric-card">
                  <div className="metric-label" style={{ fontSize: '0.70rem' }}>
                    <span>{t('savingsRate')}</span>
                    <Sparkles size={13} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div className="compact-metric-val" style={{ color: savingsRate >= 0 ? 'var(--primary)' : 'var(--accent-rose)' }}>
                    {savingsRate}%
                  </div>
                  <div className="metric-subtext" style={{ fontSize: '0.62rem' }}>{t('margin')}</div>
                </div>
              </div>

              {/* Monthly Income vs Expense Bar Chart */}
              {monthlyData.length > 0 && (
                <div className="card compact-form-card" style={{ padding: '10px 12px', marginBottom: '10px' }}>
                  <div className="card-header" style={{ marginBottom: '8px' }}>
                    <div>
                      <span className="card-subtitle" style={{ fontSize: '0.66rem' }}>{t('timelineComparison')}</span>
                      <h3 className="card-title" style={{ fontSize: '0.88rem', margin: 0 }}>
                        {t('monthlyComparison')}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.66rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--accent-emerald)' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: 'var(--accent-emerald)' }} /> Inc
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--accent-rose)' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: 'var(--accent-rose)' }} /> Exp
                      </span>
                    </div>
                  </div>

                  {/* Compact Responsive Bar Chart */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '125px', padding: '6px 2px 22px 2px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
                    {monthlyData.map((d, idx) => {
                      const incomeH = Math.max(Math.round((d.income / maxMonthValue) * 90), 3);
                      const expenseH = Math.max(Math.round((d.expense / maxMonthValue) * 90), 3);

                      return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', justifyContent: 'center' }}>
                            {/* Income Bar */}
                            <div
                              style={{
                                width: '42%',
                                maxWidth: '18px',
                                height: `${incomeH}px`,
                                background: 'var(--accent-emerald)',
                                borderRadius: '3px 3px 0 0',
                                transition: 'height 200ms ease'
                              }}
                              title={`Income: ${currencySymbol}${d.income.toLocaleString()}`}
                            />
                            {/* Expense Bar */}
                            <div
                              style={{
                                width: '42%',
                                maxWidth: '18px',
                                height: `${expenseH}px`,
                                background: 'var(--accent-rose)',
                                borderRadius: '3px 3px 0 0',
                                transition: 'height 200ms ease'
                              }}
                              title={`Expense: ${currencySymbol}${d.expense.toLocaleString()}`}
                            />
                          </div>

                          {/* Month Label */}
                          <span style={{
                            position: 'absolute',
                            bottom: '-18px',
                            fontSize: '0.60rem',
                            color: 'var(--text-dim)',
                            whiteSpace: 'nowrap'
                          }}>
                            {d.month.substring(5)}/{d.month.substring(2, 4)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expense by Category Breakdown */}
              {expensesByCategory.length > 0 && (
                <div className="card" style={{ padding: '16px', marginBottom: '14px' }}>
                  <div className="card-header" style={{ marginBottom: '12px' }}>
                    <span className="card-title" style={{ fontSize: '0.92rem' }}>
                      <PieChart size={16} style={{ color: 'var(--accent-rose)' }} />
                      {t('expenseByCategory')}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      Total: -{currencySymbol}{totalExpense.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {expensesByCategory.map((cat, idx) => (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{getCategoryDisplayName(cat.name, language)}</span>
                          <span style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>
                            -{currencySymbol}{cat.amount.toLocaleString()} ({cat.percentage}%)
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-card-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${cat.percentage}%`,
                              height: '100%',
                              background: 'var(--accent-rose)',
                              borderRadius: '3px'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Income by Source Breakdown */}
              {incomeBySource.length > 0 && (
                <div className="card" style={{ padding: '16px' }}>
                  <div className="card-header" style={{ marginBottom: '12px' }}>
                    <span className="card-title" style={{ fontSize: '0.92rem' }}>
                      <TrendingUp size={16} style={{ color: 'var(--accent-emerald)' }} />
                      {t('incomeBySource')}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      Total: +{currencySymbol}{totalIncome.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {incomeBySource.map((cat, idx) => (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{getCategoryDisplayName(cat.name, language)}</span>
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
                            +{currencySymbol}{cat.amount.toLocaleString()} ({cat.percentage}%)
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-card-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${cat.percentage}%`,
                              height: '100%',
                              background: 'var(--accent-emerald)',
                              borderRadius: '3px'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* TAB 2: AGRICULTURE & FARMING TRACKING */}
      {activeTab === 'agriculture' && (
        <>
          {/* Crop Filter Bar */}
          {cropTags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                className={`filter-chip ${agriCropFilter === 'all' ? 'active' : ''}`}
                onClick={() => setAgriCropFilter('all')}
                style={{ fontSize: '0.72rem' }}
              >
                {t('allCrops')}
              </button>
              {cropTags.map((crop, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`filter-chip ${agriCropFilter === crop ? 'active' : ''}`}
                  onClick={() => setAgriCropFilter(crop)}
                  style={{ fontSize: '0.72rem' }}
                >
                  #{crop}
                </button>
              ))}
            </div>
          )}

          {!hasAgriData ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 16px' }}>
              <Sprout size={36} style={{ color: 'var(--accent-emerald)', margin: '0 auto 10px auto' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                {t('noAgriEntries')}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 18px auto', lineHeight: 1.5 }}>
                {t('agriDescPrompt')}
              </p>
              <button
                type="button"
                className="btn-primary"
                style={{ width: 'auto', display: 'inline-flex', padding: '8px 16px', fontSize: '0.8rem' }}
                onClick={() => onNavigate && onNavigate('add')}
              >
                <Plus size={15} />
                <span>{t('logForThisDate')}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Agri Financial Metrics */}
              <div className="metrics-grid" style={{ marginBottom: '14px' }}>
                <div className="metric-card">
                  <div className="metric-label">
                    <span>{t('agriIncome')}</span>
                    <TrendingUp size={14} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <div className="metric-value" style={{ color: 'var(--accent-emerald)' }}>
                    +{currencySymbol}{agriFinancials.income.toLocaleString()}
                  </div>
                  <div className="metric-subtext">{t('harvestSales')}</div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">
                    <span>{t('agriExpenses')}</span>
                    <TrendingDown size={14} style={{ color: 'var(--accent-rose)' }} />
                  </div>
                  <div className="metric-value" style={{ color: 'var(--accent-rose)' }}>
                    -{currencySymbol}{agriFinancials.expense.toLocaleString()}
                  </div>
                  <div className="metric-subtext">{t('catExpense')}</div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">
                    <span>{t('agriNetProfit')}</span>
                    <DollarSign size={14} style={{ color: agriFinancials.profit >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }} />
                  </div>
                  <div className="metric-value" style={{ color: agriFinancials.profit >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {agriFinancials.profit >= 0 ? '+' : ''}{currencySymbol}{agriFinancials.profit.toLocaleString()}
                  </div>
                  <div className="metric-subtext">{t('farmProfit')}</div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">
                    <span>Activities</span>
                    <Sprout size={14} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <div className="metric-value" style={{ color: 'var(--accent-emerald)' }}>
                    {agriEntries.length}
                  </div>
                  <div className="metric-subtext">Recorded Events</div>
                </div>
              </div>

              {/* Agriculture Activity Timeline */}
              <div className="card" style={{ padding: '16px' }}>
                <div className="card-header" style={{ marginBottom: '12px' }}>
                  <span className="card-title" style={{ fontSize: '0.94rem' }}>
                    <Sprout size={16} style={{ color: 'var(--accent-emerald)' }} />
                    {t('agriActivityTimeline')} ({agriEntries.length})
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {agriEntries.map((entry) => (
                    <AnalyticsEntryCardItem
                      key={entry.id}
                      entry={entry}
                      currencySymbol={currencySymbol}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* TAB 3: TEAM & MEMBER CONTRIBUTIONS */}
      {activeTab === 'team' && currentWorkspace?.type !== WORKSPACE_MODES.PERSONAL && (
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <div>
              <span className="card-subtitle" style={{ fontSize: '0.7rem' }}>Workspace Participation</span>
              <h3 className="card-title" style={{ fontSize: '0.94rem', margin: 0 }}>
                <Users size={16} style={{ color: 'var(--primary)' }} />
                {t('memberContributions')}
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              {filteredEntries.length} total entries
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {memberContributions.map((member) => (
              <div 
                key={member.uid}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={member.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                      alt={member.name}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <h4 style={{ fontSize: '0.84rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                        {member.name}
                      </h4>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {member.count} {t('entriesLogged')}
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {member.percentage}%
                  </span>
                </div>

                {/* Contribution Progress Bar */}
                <div style={{ height: '6px', background: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${member.percentage}%`,
                      height: '100%',
                      background: 'var(--primary)',
                      borderRadius: '3px'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

