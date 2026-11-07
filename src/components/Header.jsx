import React from 'react';
import { 
  Sparkles, 
  Moon, 
  Sun, 
  ChevronDown, 
  Globe,
  Bell
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import NinaivoLogo from './NinaivoLogo';

export default function Header({ 
  theme, 
  onToggleTheme, 
  onOpenWorkspaceSwitcher,
  onOpenNotifications,
  activePanel,
  onClosePanel,
  onTogglePanel
}) {
  const { currentWorkspace, unreadNotificationCount } = useWorkspace();
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ta' : 'en');
  };

  return (
    <header className="app-header">
      {/* Left: App Logo Icon + Title + Subtitle */}
      <div 
        className="header-left" 
        onClick={() => {
          onClosePanel?.();
          onOpenWorkspaceSwitcher();
        }}
        title="Switch Workspace / Ninaivo"
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
          flex: 1,
          overflow: 'hidden'
        }}
      >
        {/* Official Ninaivo Brand Icon (Theme-Adaptive) */}
        <NinaivoLogo 
          theme={theme}
          iconSize={34}
          showText={false}
        />

        {/* Title Container with min-width: 0 to prevent overflow */}
        <div 
          className="brand-meta" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            minWidth: 0, 
            flex: 1, 
            overflow: 'hidden' 
          }}
        >
          <h1 style={{
            fontSize: 'clamp(0.84rem, 3.2vw, 0.98rem)',
            fontWeight: 800,
            color: 'var(--text-main)',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0
          }}>
            {t('appTitle') || 'Ninaivo'}
          </h1>
          <span style={{
            fontSize: 'clamp(0.58rem, 2vw, 0.66rem)',
            color: 'var(--text-muted)',
            fontWeight: 500,
            marginTop: '1px',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0
          }}>
            {t('appSubtitleTagline') || 'Your Life • Your Memories • Your Story'}
          </span>
        </div>
      </div>

      {/* Right: Notifications, Theme & Language in a single stable row */}
      <div 
        className="header-right" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          flexShrink: 0 
        }}
      >
        {/* Notifications Bell Button */}
        <button
          type="button"
          className={`header-action-btn ${activePanel === 'notifications' ? 'active' : ''}`}
          onClick={onOpenNotifications}
          title={t('notificationsTitle')}
          aria-label="Notifications"
          aria-expanded={activePanel === 'notifications'}
          style={{ 
            position: 'relative',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            flexShrink: 0,
            padding: 0
          }}
        >
          <Bell size={16} />
          {unreadNotificationCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              minWidth: '12px',
              height: '12px',
              borderRadius: '10px',
              background: 'var(--accent-rose)',
              color: '#ffffff',
              fontSize: '0.55rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 2px',
              lineHeight: 1
            }}>
              {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
            </span>
          )}
        </button>

        {/* Theme Toggle (Nature Fresh Light vs Forest Night Dark) */}
        <button
          type="button"
          className="header-action-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? t('natureFresh') : t('forestNight')}
          aria-label={theme === 'dark' ? t('natureFresh') : t('forestNight')}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            flexShrink: 0,
            padding: 0
          }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Language Selector Pill: Displays target language (Switch to other language) */}
        <button
          type="button"
          onClick={toggleLanguage}
          title={language === 'en' ? "தமிழுக்கு மாற்றவும் (Switch to Tamil)" : "Switch to English"}
          aria-label={language === 'en' ? "Switch to Tamil" : "Switch to English"}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            height: '32px',
            borderRadius: '9999px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all var(--transition-fast)'
          }}
        >
          <Globe size={14} style={{ color: 'var(--text-muted)' }} />
          <span>{language === 'en' ? 'தமிழ்' : 'EN'}</span>
          <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </header>
  );
}
