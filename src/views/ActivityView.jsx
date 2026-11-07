import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Shield, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  UserPlus, 
  UserMinus, 
  ShieldCheck, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  Lock,
  ArrowLeft,
  X
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { ACTIVITY_ACTIONS } from '../services/activityService';

export default function ActivityView({ onBack }) {
  const { activityLogs, members, currentWorkspace } = useWorkspace();
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');

  // Extract unique members from logs for filtering
  const logUsers = useMemo(() => {
    const map = new Map();
    activityLogs.forEach(log => {
      if (log.userUid && !map.has(log.userUid)) {
        map.set(log.userUid, log.userName || 'User');
      }
    });
    return Array.from(map.entries()).map(([uid, name]) => ({ uid, name }));
  }, [activityLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDetails = (log.details || '').toLowerCase().includes(q);
        const matchesUser = (log.userName || '').toLowerCase().includes(q);
        const matchesAction = (log.action || '').toLowerCase().includes(q);
        if (!matchesDetails && !matchesUser && !matchesAction) return false;
      }

      // Member filter
      if (selectedMember !== 'all' && log.userUid !== selectedMember) {
        return false;
      }

      // Action type filter
      if (selectedAction !== 'all' && log.action !== selectedAction) {
        return false;
      }

      // Date filter (YYYY-MM-DD)
      if (selectedDate) {
        const logDate = (log.timestamp || '').split('T')[0];
        if (logDate !== selectedDate) return false;
      }

      return true;
    });
  }, [activityLogs, searchQuery, selectedMember, selectedAction, selectedDate]);

  const getActionMeta = (action) => {
    switch (action) {
      case ACTIVITY_ACTIONS.ENTRY_CREATED:
        return {
          label: t('actionEntryCreated'),
          icon: PlusCircle,
          color: 'var(--accent-emerald)',
          bg: 'rgba(16, 185, 129, 0.12)'
        };
      case ACTIVITY_ACTIONS.ENTRY_EDITED:
        return {
          label: t('actionEntryEdited'),
          icon: Edit3,
          color: 'var(--primary)',
          bg: 'var(--chip-green-bg)'
        };
      case ACTIVITY_ACTIONS.ENTRY_DELETED:
        return {
          label: t('actionEntryDeleted'),
          icon: Trash2,
          color: 'var(--accent-rose)',
          bg: 'rgba(239, 68, 68, 0.12)'
        };
      case ACTIVITY_ACTIONS.MEMBER_JOINED:
        return {
          label: t('actionMemberJoined'),
          icon: UserPlus,
          color: 'var(--accent-cyan)',
          bg: 'rgba(6, 182, 212, 0.12)'
        };
      case ACTIVITY_ACTIONS.MEMBER_REMOVED:
        return {
          label: t('actionMemberRemoved'),
          icon: UserMinus,
          color: 'var(--accent-rose)',
          bg: 'rgba(239, 68, 68, 0.12)'
        };
      case ACTIVITY_ACTIONS.ROLE_CHANGED:
        return {
          label: t('actionRoleChanged'),
          icon: ShieldCheck,
          color: 'var(--accent-amber)',
          bg: 'rgba(245, 158, 11, 0.12)'
        };
      case ACTIVITY_ACTIONS.INVITE_CREATED:
        return {
          label: t('actionInviteCreated'),
          icon: Mail,
          color: 'var(--primary)',
          bg: 'var(--chip-green-bg)'
        };
      case ACTIVITY_ACTIONS.REQUEST_APPROVED:
        return {
          label: t('actionRequestApproved'),
          icon: CheckCircle2,
          color: 'var(--accent-emerald)',
          bg: 'rgba(16, 185, 129, 0.12)'
        };
      case ACTIVITY_ACTIONS.REQUEST_REJECTED:
        return {
          label: t('actionRequestRejected'),
          icon: XCircle,
          color: 'var(--accent-rose)',
          bg: 'rgba(239, 68, 68, 0.12)'
        };
      default:
        return {
          label: action ? action.replace(/_/g, ' ') : 'Activity',
          icon: Sparkles,
          color: 'var(--text-muted)',
          bg: 'var(--bg-card-subtle)'
        };
    }
  };

  const formatTimestamp = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="screen-fade">
      {/* Header Banner */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onBack && (
              <button 
                type="button" 
                className="filter-chip" 
                style={{ padding: '6px' }} 
                onClick={onBack}
                title="Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <span className="card-subtitle" style={{ fontSize: '0.72rem' }}>
                {currentWorkspace?.name}
              </span>
              <h2 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                <History size={18} style={{ color: 'var(--primary)' }} />
                {t('activityAuditTitle')}
              </h2>
            </div>
          </div>
          <span className="tag-pill" style={{ 
            fontSize: '0.68rem', 
            background: 'rgba(16, 185, 129, 0.12)', 
            color: 'var(--accent-emerald)', 
            borderColor: 'var(--accent-emerald)' 
          }}>
            <Lock size={10} style={{ display: 'inline', marginRight: '3px' }} />
            Immutable Audit Log
          </span>
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
          {t('tamperResistantNotice')}
        </p>
      </div>

      {/* Filter Controls Card */}
      <div className="card" style={{ marginBottom: '16px', padding: '14px' }}>
        {/* Search */}
        <div className="search-wrap" style={{ marginBottom: '10px' }}>
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            style={{ fontSize: '0.82rem', padding: '8px 10px 8px 34px' }}
            placeholder="Search audit events by keyword or member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              type="button"
              className="search-clear-btn" 
              onClick={() => setSearchQuery('')}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
          {/* Member Filter */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
              {t('filterByMember')}
            </label>
            <select
              className="form-input"
              style={{ fontSize: '0.76rem', padding: '6px 8px' }}
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
            >
              <option value="all">{t('allMembers')}</option>
              {logUsers.map(u => (
                <option key={u.uid} value={u.uid}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
              {t('filterByAction')}
            </label>
            <select
              className="form-input"
              style={{ fontSize: '0.76rem', padding: '6px 8px' }}
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
            >
              <option value="all">{t('allActions')}</option>
              <option value={ACTIVITY_ACTIONS.ENTRY_CREATED}>{t('actionEntryCreated')}</option>
              <option value={ACTIVITY_ACTIONS.ENTRY_EDITED}>{t('actionEntryEdited')}</option>
              <option value={ACTIVITY_ACTIONS.ENTRY_DELETED}>{t('actionEntryDeleted')}</option>
              <option value={ACTIVITY_ACTIONS.MEMBER_JOINED}>{t('actionMemberJoined')}</option>
              <option value={ACTIVITY_ACTIONS.MEMBER_REMOVED}>{t('actionMemberRemoved')}</option>
              <option value={ACTIVITY_ACTIONS.ROLE_CHANGED}>{t('actionRoleChanged')}</option>
              <option value={ACTIVITY_ACTIONS.INVITE_CREATED}>{t('actionInviteCreated')}</option>
              <option value={ACTIVITY_ACTIONS.REQUEST_APPROVED}>{t('actionRequestApproved')}</option>
              <option value={ACTIVITY_ACTIONS.REQUEST_REJECTED}>{t('actionRequestRejected')}</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
              {t('selectDate')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                className="form-input"
                style={{ fontSize: '0.76rem', padding: '6px 8px' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              {selectedDate && (
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                  onClick={() => setSelectedDate('')}
                  title="Clear Date"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Reset */}
        {(selectedMember !== 'all' || selectedAction !== 'all' || selectedDate || searchQuery) && (
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="filter-chip"
              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
              onClick={() => {
                setSelectedMember('all');
                setSelectedAction('all');
                setSelectedDate('');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span className="card-subtitle" style={{ fontSize: '0.72rem' }}>Audit Timeline</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {filteredLogs.length} event{filteredLogs.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)' }}>
            <History size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
            <p style={{ fontSize: '0.84rem', margin: 0 }}>{t('noActivityLogs')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredLogs.map((log) => {
              const meta = getActionMeta(log.action);
              const ActionIcon = meta.icon;

              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px'
                  }}
                >
                  {/* Action Icon Badge */}
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: meta.bg,
                    color: meta.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <ActionIcon size={16} />
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {log.userName || 'Member'}
                        </span>
                        <span className="tag-pill" style={{ 
                          fontSize: '0.64rem', 
                          padding: '1px 6px',
                          background: meta.bg, 
                          color: meta.color,
                          borderColor: meta.color
                        }}>
                          {meta.label}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>

                    {log.details && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

