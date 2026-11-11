import React from 'react';
import { Home, CalendarDays, Plus, Users, Settings } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';

export default function BottomNav({ activeTab, onSelectTab }) {
  const { t } = useLanguage();
  const { joinRequests, canManageWorkspace } = useWorkspace();
  const pendingCount = canManageWorkspace ? (joinRequests || []).length : 0;

  const tabs = [
    { id: 'home', label: t('navHome') || 'Home', icon: Home },
    { id: 'calendar', label: t('navCalendar') || 'Calendar', icon: CalendarDays },
    { id: 'add', label: t('navAdd') || 'Add', icon: Plus, isAdd: true },
    { id: 'members', label: t('navMembers') || 'Members', icon: Users, badge: pendingCount },
    { id: 'settings', label: t('navSettings') || 'Settings', icon: Settings }
  ];

  return (
    <nav className="bottom-nav bottom-navigation" aria-label="Bottom Navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        if (tab.isAdd) {
          return (
            <button
              key={tab.id}
              type="button"
              className={`nav-item bottom-navigation-item add-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              aria-label={tab.label}
              style={{
                gridColumn: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
                transform: 'translateY(-12px)',
                width: '100%',
                minWidth: 0,
                minHeight: '48px',
                height: '100%',
                boxSizing: 'border-box',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none'
              }}
            >
              <div 
                className="add-btn-circle"
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  boxShadow: '0 6px 18px var(--primary-glow)',
                  border: '3px solid var(--bg-card)',
                  transition: 'transform var(--transition-fast)'
                }}
              >
                <Icon size={26} strokeWidth={2.8} />
              </div>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            className={`nav-item bottom-navigation-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            aria-label={tab.label}
            style={{
              minWidth: 0,
              width: '100%',
              minHeight: '48px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 2px',
              position: 'relative',
              boxSizing: 'border-box',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)'
            }}
          >
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon 
                size={20} 
                strokeWidth={isActive ? 2.4 : 1.8} 
                className="nav-icon"
                style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}
              />
              {tab.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-6px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--accent-rose)',
                  boxShadow: '0 0 0 2px var(--bg-card)'
                }} />
              )}
            </div>

            <span 
              className="nav-label"
              style={{
                fontSize: 'clamp(0.56rem, 2vw, 0.67rem)',
                fontWeight: isActive ? 700 : 500,
                marginTop: '2px',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                letterSpacing: '-0.01em',
                maxWidth: '100%',
                whiteSpace: 'normal',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                lineHeight: 1.15,
                textAlign: 'center'
              }}
            >
              {tab.label}
            </span>

            {/* Active Navigation Indicator Pill (Reference Mockup) */}
            {isActive && (
              <div 
                className="nav-active-pill"
                style={{
                  width: '22px',
                  height: '3px',
                  borderRadius: '2px',
                  background: 'var(--primary)',
                  marginTop: '2px'
                }} 
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
