import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Moon, 
  Sun, 
  Smartphone, 
  Navigation, 
  Database, 
  Download, 
  RotateCcw, 
  Layers, 
  Info, 
  CheckCircle2, 
  User, 
  ShieldCheck, 
  ChevronRight, 
  LogOut, 
  Globe, 
  Tag,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { isOnline, getPendingCount } from '../services/syncService';
import NinaivoLogo from '../components/NinaivoLogo';

export default function SettingsView({ 
  theme, 
  onToggleTheme, 
  onExportData, 
  onOpenExportModal,
  onNavigate,
  onOpenProfile, 
  onTriggerLogout,
  onOpenWorkspaceSwitcher,
  onOpenSyncStatus
}) {
  const { currentUser, userProfile } = useAuth();
  const { currentWorkspace, workspaces, entries } = useWorkspace();
  const { language, setLanguage, t } = useLanguage();

  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(getPendingCount());

  useEffect(() => {
    const handleStatus = (e) => {
      setOnline(e.detail.isOnline);
      setPendingCount(e.detail.pendingCount);
    };
    window.addEventListener('pdt-sync-status', handleStatus);
    return () => window.removeEventListener('pdt-sync-status', handleStatus);
  }, []);

  const displayName = userProfile?.displayName || currentUser?.displayName || 'Diary Creator';
  const email = currentUser?.email || 'user@example.com';
  const photoURL = userProfile?.photoURL || currentUser?.photoURL;

  return (
    <div className="screen-fade">
      {/* 1. User Profile & Account Card */}
      <div 
        className="card compact-form-card" 
        onClick={onOpenProfile} 
        style={{ cursor: 'pointer', borderColor: 'var(--primary)', background: 'var(--bg-card)', padding: '10px 12px', marginBottom: '8px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <img 
              src={photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'} 
              alt={displayName} 
              className="avatar" 
              style={{ border: '2px solid var(--primary)', width: '38px', height: '38px' }}
            />
            <span className="member-status-dot status-online" style={{ width: '8px', height: '8px' }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {displayName}
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.60rem', padding: '1px 4px' }}>
                <ShieldCheck size={9} /> {t('active')}
              </span>
            </div>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {email}
            </span>
          </div>

          <ChevronRight size={16} style={{ color: 'var(--text-dim)' }} />
        </div>
      </div>

      {/* 2. Display, Theme & Language */}
      <div className="settings-group" style={{ marginBottom: '8px' }}>
        <h3 className="settings-group-title" style={{ fontSize: '0.72rem', margin: '6px 0 4px 0' }}>{t('displayExperience')}</h3>
        <div className="card settings-card compact-settings-card" style={{ padding: 0 }}>
          {/* Language Selector */}
          <div className="settings-row compact-settings-row">
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                <Globe size={14} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{t('language')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={`tag-pill ${language === 'en' ? 'active' : ''}`}
                style={{ cursor: 'pointer', padding: '2px 8px', fontSize: '0.70rem', background: language === 'en' ? 'var(--primary)' : 'var(--bg-input)', color: language === 'en' ? '#fff' : 'var(--text-muted)' }}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`tag-pill ${language === 'ta' ? 'active' : ''}`}
                style={{ cursor: 'pointer', padding: '2px 8px', fontSize: '0.70rem', background: language === 'ta' ? 'var(--primary)' : 'var(--bg-input)', color: language === 'ta' ? '#fff' : 'var(--text-muted)' }}
                onClick={() => setLanguage('ta')}
              >
                தமிழ்
              </button>
            </div>
          </div>

          {/* Theme Row */}
          <div className="settings-row compact-settings-row">
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{t('darkTheme')}</div>
              </div>
            </div>
            <label className="toggle-switch" style={{ transform: 'scale(0.85)' }}>
              <input 
                type="checkbox" 
                checked={theme === 'dark'} 
                onChange={onToggleTheme}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Navigation Architecture */}
          <div className="settings-row compact-settings-row">
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                <Navigation size={14} style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{t('mobileFirstDock')}</div>
              </div>
            </div>
            <span className="badge badge-progress" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>{t('active')}</span>
          </div>
        </div>
      </div>

      {/* 3. Workspace Context */}
      <div className="settings-group" style={{ marginBottom: '8px' }}>
        <h3 className="settings-group-title" style={{ fontSize: '0.72rem', margin: '6px 0 4px 0' }}>{t('activeWorkspaceContext')}</h3>
        <div className="card settings-card compact-settings-card" style={{ padding: 0 }}>
          <div className="settings-row compact-settings-row" onClick={onOpenWorkspaceSwitcher} style={{ cursor: 'pointer' }}>
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                <Layers size={14} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{currentWorkspace?.name}</div>
                <div className="settings-text-desc" style={{ fontSize: '0.66rem' }}>{t('mode')}: {currentWorkspace?.type} • {t('clickToSwitch')}</div>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
          </div>

          <div className="settings-row compact-settings-row">
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                <Database size={14} style={{ color: 'var(--text-dim)' }} />
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{t('entriesInWorkspace')}</div>
              </div>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>{entries.length}</span>
          </div>
        </div>
      </div>

      {/* 4. Security & Account */}
      <div className="settings-group" style={{ marginBottom: '8px' }}>
        <h3 className="settings-group-title" style={{ fontSize: '0.72rem', margin: '6px 0 4px 0' }}>{t('securityAccount')}</h3>
        <div className="card settings-card compact-settings-card" style={{ padding: 0 }}>
          <div className="settings-row compact-settings-row" onClick={onOpenProfile} style={{ cursor: 'pointer' }}>
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                <ShieldCheck size={14} style={{ color: 'var(--accent-amber)' }} />
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{t('changePasswordEmail')}</div>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
          </div>

          <div className="settings-row compact-settings-row" onClick={onTriggerLogout} style={{ cursor: 'pointer' }}>
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                <LogOut size={14} style={{ color: 'var(--accent-rose)' }} />
              </div>
              <div>
                <div className="settings-text-title" style={{ color: 'var(--accent-rose)', fontSize: '0.80rem' }}>{t('signOut')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Data Actions & Network Storage */}
      <div className="settings-group" style={{ marginBottom: '8px' }}>
        <h3 className="settings-group-title" style={{ fontSize: '0.72rem', margin: '6px 0 4px 0' }}>{t('dataManagement')}</h3>
        <div className="card settings-card compact-settings-card" style={{ padding: 0 }}>
          {/* Network & Storage */}
          <div className="settings-row compact-settings-row" onClick={onOpenSyncStatus} style={{ cursor: 'pointer' }}>
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                {online ? (
                  <Wifi size={14} style={{ color: pendingCount > 0 ? 'var(--accent-amber)' : 'var(--primary)' }} />
                ) : (
                  <WifiOff size={14} style={{ color: 'var(--accent-amber)' }} />
                )}
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{t('networkAndStorage')}</div>
                <div className="settings-text-desc" style={{ fontSize: '0.66rem' }}>
                  {online 
                    ? (pendingCount > 0 ? `${pendingCount} ${t('changesQueued')}` : t('connectedToCloud'))
                    : t('deviceStorageOnly')
                  }
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {pendingCount > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                  {pendingCount}
                </span>
              )}
              <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
            </div>
          </div>

          <div className="settings-row compact-settings-row" onClick={() => onNavigate('backup_restore')} style={{ cursor: 'pointer' }}>
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                <Database size={14} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{t('backupRestoreTitle')}</div>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
          </div>

          <div className="settings-row compact-settings-row" onClick={onOpenExportModal} style={{ cursor: 'pointer' }}>
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                <Download size={14} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{t('exportTitle')}</div>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
          </div>

          <div className="settings-row compact-settings-row" onClick={onExportData} style={{ cursor: 'pointer' }}>
            <div className="settings-row-left">
              <div className="settings-icon-wrap compact-settings-icon">
                <Download size={14} style={{ color: 'var(--accent-emerald)' }} />
              </div>
              <div>
                <div className="settings-text-title" style={{ fontSize: '0.80rem' }}>{t('exportDiaryJson')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Official Ninaivo Brand Badge */}
      <div style={{ textAlign: 'center', padding: '16px 0 10px 0', opacity: 0.85 }}>
        <NinaivoLogo 
          theme={theme}
          iconSize={26} 
          showText={true} 
          showTagline={true} 
          layout="vertical" 
          taglineText={t('tagline') || 'Your Life. Your Memories. Your Story.'}
        />
      </div>
    </div>
  );
}
