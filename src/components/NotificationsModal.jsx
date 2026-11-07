import React, { useEffect } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  X, 
  UserPlus, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Sparkles,
  Clock
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';

export default function NotificationsModal({ isOpen, onClose }) {
  const { notifications, readNotification, readAllNotifications, unreadNotificationCount } = useWorkspace();
  const { t } = useLanguage();

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

  if (!isOpen) return null;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'join_request':
        return <UserPlus size={16} style={{ color: 'var(--primary)' }} />;
      case 'join_approved':
        return <UserCheck size={16} style={{ color: 'var(--accent-emerald)' }} />;
      case 'join_rejected':
      case 'member_removed':
        return <UserX size={16} style={{ color: 'var(--accent-rose)' }} />;
      case 'role_changed':
        return <ShieldAlert size={16} style={{ color: 'var(--accent-amber)' }} />;
      default:
        return <Sparkles size={16} style={{ color: 'var(--primary)' }} />;
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <div 
      className="header-panel-backdrop" 
      onClick={onClose} 
      role="dialog" 
      aria-modal="true" 
      aria-label={t('notificationsTitle')}
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
              background: 'var(--chip-green-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Bell size={15} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {t('notificationsTitle')}
                {unreadNotificationCount > 0 && (
                  <span style={{ 
                    fontSize: '0.62rem', 
                    background: 'var(--accent-rose)', 
                    color: '#fff', 
                    padding: '1px 5px', 
                    borderRadius: '8px',
                    fontWeight: 700
                  }}>
                    {unreadNotificationCount}
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {notifications.length > 0 && unreadNotificationCount > 0 && (
              <button
                type="button"
                className="filter-chip"
                style={{ fontSize: '0.68rem', padding: '3px 7px' }}
                onClick={readAllNotifications}
                title={t('markAllRead')}
              >
                <CheckCheck size={12} style={{ marginRight: '2px' }} />
                {t('markAllRead')}
              </button>
            )}
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
        </div>

        {/* List of Notifications */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
              <Bell size={30} style={{ opacity: 0.3, marginBottom: '6px' }} />
              <p style={{ fontSize: '0.80rem', margin: 0 }}>{t('noNotifications')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.read && readNotification(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: item.read ? 'var(--bg-card)' : 'var(--chip-green-bg)',
                    border: `1px solid ${item.read ? 'var(--border-color)' : 'var(--primary)'}`,
                    cursor: item.read ? 'default' : 'pointer',
                    position: 'relative',
                    transition: 'all 120ms ease'
                  }}
                >
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    background: 'var(--bg-card-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '1px'
                  }}>
                    {getNotificationIcon(item.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ 
                        fontSize: '0.78rem', 
                        fontWeight: item.read ? 600 : 700, 
                        color: 'var(--text-main)' 
                      }}>
                        {item.title}
                      </span>
                      {!item.read && (
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'var(--primary)',
                          flexShrink: 0
                        }} />
                      )}
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 4px 0', lineHeight: 1.35 }}>
                      {item.message}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.64rem', color: 'var(--text-dim)' }}>
                      <Clock size={10} />
                      <span>{formatTime(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

