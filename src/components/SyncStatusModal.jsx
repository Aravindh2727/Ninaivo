import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Database
} from 'lucide-react';
import {
  isOnline,
  getPendingCount,
  getLastSyncTime,
  syncPendingMutations
} from '../services/syncService';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';

export default function SyncStatusModal({ isOpen, onClose, showToast }) {
  const { entries } = useWorkspace();
  const { t } = useLanguage();
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(getPendingCount());
  const [lastSync, setLastSync] = useState(getLastSyncTime());
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleStatus = (e) => {
      setOnline(e.detail.isOnline);
      setPending(e.detail.pendingCount);
      if (e.detail.lastSync) setLastSync(e.detail.lastSync);
    };

    window.addEventListener('pdt-sync-status', handleStatus);
    return () => window.removeEventListener('pdt-sync-status', handleStatus);
  }, []);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    if (!online) {
      alert('Cannot sync while offline. Please connect to the internet.');
      return;
    }

    setSyncing(true);
    setSyncFeedback(null);

    try {
      const res = await syncPendingMutations();
      setPending(getPendingCount());
      setLastSync(getLastSyncTime());
      setSyncFeedback(res);
      if (res.synced > 0 || res.isDemo) {
        showToast && showToast(res.isDemo ? (t('demoStorageSynced') || 'Device storage synchronized!') : `Synchronized ${res.synced} pending changes!`);
      }
    } catch (err) {
      setSyncFeedback({ failed: 1, message: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const formatLastSync = (iso) => {
    if (!iso) return t('neverInSession') || 'Never in this session';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
    } catch {
      return iso;
    }
  };

  const cachedCount = entries ? entries.length : 0;

  return (
    <div
      className="header-panel-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('networkAndStorage')}
    >
      <div
        className="header-panel-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: online ? 'var(--chip-green-bg)' : 'var(--chip-amber-bg)',
              color: online ? 'var(--primary)' : 'var(--accent-amber)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
            </div>
            <div>
              <span className="card-subtitle" style={{ fontSize: '0.66rem' }}>{t('networkAndStorage')}</span>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {online ? t('connected') : t('offlineModeActive')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            className="compact-action-btn"
            onClick={onClose}
            title={t('close')}
            aria-label={t('close')}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {/* Sync & Storage Stats Card */}
          <div style={{
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '10px 12px',
            marginBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('connection')}</span>
              <span style={{ fontWeight: 700, color: online ? 'var(--accent-emerald)' : 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: online ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
                {online ? t('connected') : t('deviceStorageOnly')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('pendingSync')}</span>
              <span style={{ fontWeight: 700, color: pending > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                {pending} {t('changesQueued')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('offlineStorage')}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <HardDrive size={12} style={{ color: 'var(--primary)' }} />
                {cachedCount} {t('entriesCount') || t('entriesCountText') || 'notes'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('lastSynced')}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.70rem' }}>
                {formatLastSync(lastSync)}
              </span>
            </div>
          </div>

          {/* Pending === 0 reassurance banner */}
          {pending === 0 && (
            <div style={{
              background: 'var(--chip-green-bg)',
              border: '1px solid var(--primary)',
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '10px',
              fontSize: '0.74rem',
              color: 'var(--text-main)'
            }}>
              <CheckCircle2 size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span>{t('allSynced')}</span>
            </div>
          )}

          {/* Sync Feedback Message if any */}
          {syncFeedback && (
            <div style={{
              background: syncFeedback.failed > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              border: `1px solid ${syncFeedback.failed > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'}`,
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '0.72rem',
              color: 'var(--text-main)',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              {syncFeedback.failed > 0 ? (
                <AlertCircle size={13} style={{ color: 'var(--accent-rose)' }} />
              ) : (
                <CheckCircle2 size={13} style={{ color: 'var(--accent-emerald)' }} />
              )}
              <span>
                {syncFeedback.failed > 0
                  ? `Sync error: ${syncFeedback.message || 'Some operations failed'}`
                  : (syncFeedback.isDemo ? (syncFeedback.message || t('demoStorageSynced') || 'Device storage synchronized!') : `Successfully synced ${syncFeedback.synced} operations!`)}
              </span>
            </div>
          )}

          {/* Action Buttons: Retry / Manual Sync */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {syncFeedback && syncFeedback.failed > 0 && (
              <button
                type="button"
                className="btn-secondary compact-btn"
                style={{ width: '100%', justifyContent: 'center', height: '34px' }}
                onClick={handleManualSync}
                disabled={syncing || !online}
              >
                <RefreshCw size={13} style={{ marginRight: '5px' }} />
                {t('retrySync')}
              </button>
            )}

            <button
              type="button"
              className="btn-primary compact-btn"
              style={{ width: '100%', justifyContent: 'center', height: '34px' }}
              onClick={handleManualSync}
              disabled={syncing || !online}
            >
              {syncing ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div className="spinner-sm" /> {t('synchronizing')}
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <RefreshCw size={13} />
                  {t('synchronizeNow')}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
