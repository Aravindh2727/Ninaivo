import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  History,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  FileText,
  Sparkles,
  Trash2,
  Layers,
  X,
  Bell,
  Lock,
  UserCheck
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  createWorkspaceBackup,
  validateBackupFile,
  restoreIntoExistingWorkspace,
  restoreIntoNewWorkspace,
  parseCsvForImport,
  importCsvEntries,
  getBackupHistory,
  deleteBackupRecord,
  getBackupReminderSettings,
  saveBackupReminderSettings,
  isBackupOverdue,
  exportAccountPersonalData
} from '../services/backupService';
import { exportToExcel } from '../services/exportService';

export default function BackupRestoreView({ onBack, showToast }) {
  const {
    currentWorkspace,
    workspaces,
    entries,
    categories,
    currentUserRole,
    canManageWorkspace,
    switchWorkspace
  } = useWorkspace();
  const { currentUser, userProfile } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState('backup'); // 'backup' | 'restore' | 'import' | 'history' | 'settings'

  // Backup State
  const [backingUp, setBackingUp] = useState(false);
  const [backupHistory, setBackupHistory] = useState(() => getBackupHistory());

  // Restore State
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreValidation, setRestoreValidation] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState('existing'); // 'existing' | 'new'
  const [duplicateStrategy, setDuplicateStrategy] = useState('skip'); // 'skip' | 'as_new' | 'overwrite'
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);

  // CSV Import State
  const [csvFile, setCsvFile] = useState(null);
  const [csvParsed, setCsvParsed] = useState(null);
  const [csvDuplicateStrategy, setCsvDuplicateStrategy] = useState('skip'); // 'skip' | 'as_new'
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Reminder Settings State
  const [reminderSettings, setReminderSettings] = useState(() => getBackupReminderSettings());
  const overdueNotice = isBackupOverdue();

  // Refresh history when tab opens
  useEffect(() => {
    setBackupHistory(getBackupHistory());
  }, [activeTab]);

  // Handle Full JSON Backup Creation
  const handleCreateJsonBackup = async () => {
    setBackingUp(true);
    try {
      const res = await createWorkspaceBackup(
        currentWorkspace,
        entries,
        categories,
        currentUser
      );
      if (res.success) {
        showToast && showToast('Full JSON backup downloaded successfully!');
        setBackupHistory(getBackupHistory());
      }
    } catch (err) {
      alert('Error creating backup: ' + err.message);
    } finally {
      setBackingUp(false);
    }
  };

  // Handle CSV Export
  const handleCreateCsvBackup = () => {
    exportToExcel(entries, currentWorkspace, {
      category: 'All',
      includeFinancials: true
    });
    showToast && showToast('CSV spreadsheet downloaded!');
  };

  // Handle File Input for Restore
  const handleRestoreFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      const validation = await validateBackupFile(content, currentWorkspace?.id, entries);
      setRestoreValidation(validation);
    };
    reader.readAsText(file);
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!restoreValidation || !restoreValidation.isValid) return;

    if (!window.confirm(`Are you sure you want to restore ${restoreValidation.totalEntries} entries into ${restoreTarget === 'new' ? 'a NEW workspace' : currentWorkspace.name}?`)) {
      return;
    }

    setRestoring(true);
    setRestoreProgress(0);

    try {
      let result;
      if (restoreTarget === 'new') {
        result = await restoreIntoNewWorkspace(
          restoreValidation.parsedData,
          currentUser,
          (pct) => setRestoreProgress(pct)
        );
        if (result.success && result.newWorkspace) {
          switchWorkspace(result.newWorkspace.id);
        }
      } else {
        result = await restoreIntoExistingWorkspace(
          currentWorkspace.id,
          restoreValidation.parsedData,
          { duplicateStrategy },
          currentUser,
          (pct) => setRestoreProgress(pct)
        );
      }

      setRestoreResult(result);
      showToast && showToast(t('restoreSuccessMsg'));
    } catch (err) {
      alert('Restore failed: ' + err.message);
    } finally {
      setRestoring(false);
    }
  };

  // Handle CSV File Select for Import
  const handleCsvFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCsvFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const parsed = parseCsvForImport(content, entries);
      setCsvParsed(parsed);
    };
    reader.readAsText(file);
  };

  // Execute CSV Import
  const handleExecuteCsvImport = async () => {
    if (!csvParsed || !csvParsed.isValid) return;

    const toImport = [
      ...csvParsed.validRows,
      ...(csvDuplicateStrategy === 'as_new' ? csvParsed.duplicateRows : [])
    ];

    if (toImport.length === 0) {
      alert('No entries to import based on duplicate settings.');
      return;
    }

    setImporting(true);
    try {
      const res = await importCsvEntries(
        currentWorkspace.id,
        toImport,
        currentUser
      );
      setImportResult(res);
      showToast && showToast(`${res.count} ${t('importSuccessMsg')}`);
      setCsvParsed(null);
      setCsvFile(null);
    } catch (err) {
      alert('CSV Import error: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Save Reminder Settings
  const handleToggleReminders = (enabled) => {
    const updated = { ...reminderSettings, enabled };
    setReminderSettings(updated);
    saveBackupReminderSettings(updated);
    showToast && showToast('Backup reminder preferences saved.');
  };

  const handleReminderFrequency = (days) => {
    const updated = { ...reminderSettings, frequencyDays: days };
    setReminderSettings(updated);
    saveBackupReminderSettings(updated);
    showToast && showToast(`Reminder set to every ${days} days.`);
  };

  // Personal Account Data Portability Download
  const handleDownloadPersonalData = () => {
    const allEntriesMap = { [currentWorkspace.id]: entries };
    exportAccountPersonalData(
      currentUser,
      userProfile,
      workspaces,
      allEntriesMap
    );
    showToast && showToast('Personal account data package downloaded.');
  };

  const handleDeleteHistoryItem = (backupId) => {
    const updated = deleteBackupRecord(backupId);
    setBackupHistory(updated);
  };

  return (
    <div className="screen-fade">
      {/* Header Banner */}
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
                <Database size={16} style={{ color: 'var(--primary)' }} />
                {t('backupRestoreTitle')}
              </h2>
            </div>
          </div>

          <span className="tag-pill" style={{ fontSize: '0.64rem', textTransform: 'uppercase', padding: '2px 6px' }}>
            {currentWorkspace?.type} Workspace
          </span>
        </div>

        {/* Overdue Backup Notice */}
        {overdueNotice && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid var(--accent-amber)',
            color: 'var(--text-main)',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Bell size={13} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
            <span>{t('backupOverdueNotice')}</span>
          </div>
        )}

        {/* Sub-Tabs */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
          <button
            type="button"
            className={`filter-chip ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveTab('backup')}
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            <Download size={12} style={{ marginRight: '3px' }} />
            {t('backupTab')}
          </button>

          <button
            type="button"
            className={`filter-chip ${activeTab === 'restore' ? 'active' : ''}`}
            onClick={() => setActiveTab('restore')}
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            <Upload size={12} style={{ marginRight: '3px' }} />
            {t('restoreTab')}
          </button>

          <button
            type="button"
            className={`filter-chip ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            <FileSpreadsheet size={12} style={{ marginRight: '3px' }} />
            {t('importCsvTab')}
          </button>

          <button
            type="button"
            className={`filter-chip ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            <History size={12} style={{ marginRight: '3px' }} />
            {t('backupHistoryTab')}
          </button>

          <button
            type="button"
            className={`filter-chip ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            <Bell size={12} style={{ marginRight: '3px' }} />
            {t('remindersTab')}
          </button>

          <button
            type="button"
            className={`filter-chip ${activeTab === 'portability' ? 'active' : ''}`}
            onClick={() => setActiveTab('portability')}
            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
          >
            <ShieldCheck size={12} style={{ marginRight: '3px' }} />
            {t('portabilityTab')}
          </button>
        </div>
      </div>

      {/* TAB 1: CREATE BACKUP */}
      {activeTab === 'backup' && (
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-header" style={{ marginBottom: '10px' }}>
            <span className="card-title" style={{ fontSize: '0.94rem' }}>
              <Download size={16} style={{ color: 'var(--primary)' }} />
              Workspace Snapshot & Archive
            </span>
            <span className="tag-pill" style={{ fontSize: '0.66rem' }}>
              Schema v1.0.0
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
            {t('fullBackupDesc')}
          </p>

          {/* Attachment Disclosure Alert */}
          <div style={{
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '0.76rem',
            color: 'var(--text-dim)',
            lineHeight: 1.4
          }}>
            {t('attachmentNoticeText')}
          </div>

          {/* Current Workspace Stats */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            textAlign: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'block' }}>Diary Notes</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{entries.length}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'block' }}>Categories</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{categories.length}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'block' }}>Photo Attachments</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                {entries.reduce((sum, e) => sum + (e.attachments || []).length, 0)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ justifyContent: 'center', padding: '12px' }}
              onClick={handleCreateJsonBackup}
              disabled={backingUp}
            >
              {backingUp ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className="spinner-sm" /> Packaging Backup...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={16} />
                  {t('createJsonBackupBtn')}
                </span>
              )}
            </button>

            <button
              type="button"
              className="filter-chip"
              style={{ justifyContent: 'center', padding: '10px', fontSize: '0.8rem' }}
              onClick={handleCreateCsvBackup}
            >
              <FileSpreadsheet size={15} style={{ marginRight: '6px', color: 'var(--accent-emerald)' }} />
              {t('createCsvBackupBtn')}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: RESTORE WORKSPACE */}
      {activeTab === 'restore' && (
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-header" style={{ marginBottom: '12px' }}>
            <span className="card-title" style={{ fontSize: '0.94rem' }}>
              <Upload size={16} style={{ color: 'var(--primary)' }} />
              {t('restoreTab')}
            </span>
          </div>

          {/* Step 1: File Upload */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              {t('restoreFileLabel')}
            </label>
            <input
              type="file"
              accept=".json,application/json"
              className="form-input"
              style={{ fontSize: '0.78rem', padding: '8px' }}
              onChange={handleRestoreFileSelect}
            />
          </div>

          {/* Step 2: Validation & Preview */}
          {restoreValidation && (
            <div style={{
              background: restoreValidation.isValid ? 'var(--bg-card-subtle)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${restoreValidation.isValid ? 'var(--border-color)' : 'var(--accent-rose)'}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              {!restoreValidation.isValid ? (
                <div style={{ color: 'var(--accent-rose)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{restoreValidation.error}</span>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Valid Backup: {restoreValidation.workspaceName}
                    </span>
                    <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>
                      Schema v{restoreValidation.schemaVersion}
                    </span>
                  </div>

                  {/* SHA-256 Checksum Verification Status */}
                  <div style={{
                    fontSize: '0.72rem',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: restoreValidation.checksumVerified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: restoreValidation.checksumVerified ? 'var(--accent-emerald)' : 'var(--accent-amber)'
                  }}>
                    <ShieldCheck size={13} style={{ flexShrink: 0 }} />
                    <span>
                      {restoreValidation.checksumVerified
                        ? 'SHA-256 Cryptographic Checksum Verified (Tamper-Resistant)'
                        : (restoreValidation.checksumWarning || 'Checksum verification pending')}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '6px' }}>
                    <span>{t('totalEntries')}: <strong>{restoreValidation.totalEntries}</strong></span>
                    <span>{t('photosAttached')}: <strong>{restoreValidation.attachmentsCount}</strong></span>
                    <span>{t('statusActive')}: <strong style={{ color: 'var(--accent-emerald)' }}>{restoreValidation.newEntriesCount}</strong></span>
                    <span>{t('duplicates')}: <strong style={{ color: 'var(--accent-amber)' }}>{restoreValidation.duplicatesCount}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Target & Duplicate Configuration (if valid) */}
          {restoreValidation && restoreValidation.isValid && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
              {/* Target Workspace Selector */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  {t('restoreTargetWorkspace')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`filter-chip ${restoreTarget === 'existing' ? 'active' : ''}`}
                    onClick={() => setRestoreTarget('existing')}
                    style={{ flex: 1, padding: '8px', fontSize: '0.74rem' }}
                  >
                    Current Workspace ({currentWorkspace.name})
                  </button>
                  <button
                    type="button"
                    className={`filter-chip ${restoreTarget === 'new' ? 'active' : ''}`}
                    onClick={() => setRestoreTarget('new')}
                    style={{ flex: 1, padding: '8px', fontSize: '0.74rem' }}
                  >
                    + Create New Workspace
                  </button>
                </div>
              </div>

              {/* Duplicate Strategy Selector (if existing workspace) */}
              {restoreTarget === 'existing' && (
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    {t('duplicateStrategyLabel')}
                  </label>
                  <select
                    className="form-input"
                    style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                    value={duplicateStrategy}
                    onChange={(e) => setDuplicateStrategy(e.target.value)}
                  >
                    <option value="skip">{t('strategySkip')}</option>
                    <option value="as_new">{t('strategyAsNew')}</option>
                    <option value="overwrite">{t('strategyOverwrite')}</option>
                  </select>
                </div>
              )}

              {/* Restore Progress Bar */}
              {restoring && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>{t('restoringChunk')}</span>
                    <span>{restoreProgress}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-card-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${restoreProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 100ms ease' }} />
                  </div>
                </div>
              )}

              {/* Confirm Restore Button */}
              <button
                type="button"
                className="btn-primary"
                style={{ justifyContent: 'center', padding: '10px' }}
                onClick={handleExecuteRestore}
                disabled={restoring}
              >
                {restoring ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="spinner-sm" /> Restoring...
                  </span>
                ) : (
                  <span>{t('confirmRestoreBtn')}</span>
                )}
              </button>
            </div>
          )}

          {/* Restore Success Summary */}
          {restoreResult && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid var(--accent-emerald)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.78rem',
              color: 'var(--text-main)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontWeight: 700, marginBottom: '4px' }}>
                <CheckCircle2 size={16} />
                <span>{t('restoreSuccessMsg')}</span>
              </div>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                Successfully committed {restoreResult.restoredCount} entries to the workspace.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: IMPORT CSV */}
      {activeTab === 'import' && (
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-header" style={{ marginBottom: '10px' }}>
            <span className="card-title" style={{ fontSize: '0.94rem' }}>
              <FileSpreadsheet size={16} style={{ color: 'var(--accent-emerald)' }} />
              {t('importCsvTitle')}
            </span>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
            {t('importCsvDesc')} Supports UTF-8 Tamil and English characters.
          </p>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              {t('selectCsvFile')}
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              className="form-input"
              style={{ fontSize: '0.78rem', padding: '8px' }}
              onChange={handleCsvFileSelect}
            />
          </div>

          {csvParsed && (
            <div style={{
              background: csvParsed.isValid ? 'var(--bg-card-subtle)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${csvParsed.isValid ? 'var(--border-color)' : 'var(--accent-rose)'}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              {!csvParsed.isValid ? (
                <div style={{ color: 'var(--accent-rose)', fontSize: '0.78rem' }}>
                  {csvParsed.error}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    CSV Analysis: {csvParsed.totalRows} data rows detected
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    <span>{t('valid')}: <strong style={{ color: 'var(--accent-emerald)' }}>{csvParsed.validCount}</strong></span>
                    <span>{t('duplicates')}: <strong style={{ color: 'var(--accent-amber)' }}>{csvParsed.duplicateCount}</strong></span>
                    <span>{t('invalid')}: <strong style={{ color: 'var(--accent-rose)' }}>{csvParsed.invalidCount}</strong></span>
                  </div>

                  {csvParsed.duplicateCount > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                        Duplicate Strategy:
                      </label>
                      <select
                        className="form-input"
                        style={{ fontSize: '0.74rem', padding: '4px 6px' }}
                        value={csvDuplicateStrategy}
                        onChange={(e) => setCsvDuplicateStrategy(e.target.value)}
                      >
                        <option value="skip">Skip {csvParsed.duplicateCount} duplicate entries</option>
                        <option value="as_new">Import duplicates as new entries</option>
                      </select>
                    </div>
                  )}

                  <div style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ padding: '8px 14px', fontSize: '0.78rem', width: 'auto' }}
                      onClick={handleExecuteCsvImport}
                      disabled={importing}
                    >
                      {importing ? 'Importing...' : t('importBtn')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {importResult && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid var(--accent-emerald)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.78rem',
              color: 'var(--accent-emerald)',
              fontWeight: 600
            }}>
              ✓ Successfully imported {importResult.count} entries from spreadsheet!
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BACKUP HISTORY */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-header" style={{ marginBottom: '12px' }}>
            <span className="card-title" style={{ fontSize: '0.94rem' }}>
              <History size={16} style={{ color: 'var(--primary)' }} />
              Recent Local Backups ({backupHistory.length})
            </span>
          </div>

          {backupHistory.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0, textAlign: 'center', padding: '24px 0' }}>
              No recent backups recorded on this device yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {backupHistory.map((bkp) => (
                <div
                  key={bkp.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>
                      {bkp.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      {bkp.workspaceName} &bull; {new Date(bkp.createdAt).toLocaleDateString()} &bull; {bkp.entriesCount} entries
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="tag-pill" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                      {bkp.format}
                    </span>
                    <button
                      type="button"
                      className="filter-chip"
                      style={{ padding: '4px 6px', color: 'var(--accent-rose)' }}
                      onClick={() => handleDeleteHistoryItem(bkp.id)}
                      title="Remove from history"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: REMINDER & PORTABILITY SETTINGS */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Automatic Backup Reminders Card */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="card-header" style={{ marginBottom: '10px' }}>
              <span className="card-title" style={{ fontSize: '0.94rem' }}>
                <Bell size={16} style={{ color: 'var(--accent-amber)' }} />
                {t('backupReminderSettings')}
              </span>
              <input
                type="checkbox"
                checked={reminderSettings.enabled}
                onChange={(e) => handleToggleReminders(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Receive an in-app banner reminder when your workspace hasn't been backed up recently.
            </p>

            {reminderSettings.enabled && (
              <div style={{ display: 'flex', gap: '6px' }}>
                {[7, 14, 30].map(days => (
                  <button
                    key={days}
                    type="button"
                    className={`filter-chip ${reminderSettings.frequencyDays === days ? 'active' : ''}`}
                    onClick={() => handleReminderFrequency(days)}
                    style={{ fontSize: '0.74rem' }}
                  >
                    Every {days} Days
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Account Data Portability Card */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="card-header" style={{ marginBottom: '10px' }}>
              <span className="card-title" style={{ fontSize: '0.94rem' }}>
                <UserCheck size={16} style={{ color: 'var(--accent-emerald)' }} />
                Account Data Portability
              </span>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
              {t('portabilityDesc')}
            </p>

            <button
              type="button"
              className="btn-primary"
              style={{ padding: '10px 16px', fontSize: '0.8rem', width: 'auto' }}
              onClick={handleDownloadPersonalData}
            >
              <Download size={15} style={{ marginRight: '6px' }} />
              {t('downloadPersonalBundleBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

