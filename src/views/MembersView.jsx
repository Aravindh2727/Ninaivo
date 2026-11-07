import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Shield,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  UserX,
  Lock,
  Layers,
  Sparkles,
  Heart,
  Briefcase,
  History,
  AlertTriangle,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { WORKSPACE_MODES } from '../services/workspaceService';
import { WORKSPACE_ROLES } from '../services/memberService';
import InviteMemberModal from '../components/InviteMemberModal';
import ActivityView from './ActivityView';

export default function MembersView({ onOpenWorkspaceSwitcher, showToast }) {
  const {
    currentWorkspace,
    members,
    joinRequests,
    invitations,
    currentUserRole,
    isOwner,
    canManageWorkspace,
    changeMemberRole,
    removeMember,
    leaveCurrentWs,
    handleProcessJoinRequest,
    revokeExistingInvite
  } = useWorkspace();
  const { t } = useLanguage();

  const [activeSubTab, setActiveSubTab] = useState('members'); // 'members' | 'audit'
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [changingMemberId, setChangingMemberId] = useState(null);

  const wsType = currentWorkspace?.type || WORKSPACE_MODES.PERSONAL;

  // 1. Personal Workspace Private Gate
  if (wsType === WORKSPACE_MODES.PERSONAL) {
    return (
      <div className="screen-fade">
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'var(--chip-green-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            color: 'var(--primary)'
          }}>
            <Lock size={30} />
          </div>
          <span className="card-subtitle" style={{ fontSize: '0.74rem', textTransform: 'uppercase' }}>
            {currentWorkspace?.name || 'Personal Diary'}
          </span>
          <h2 className="card-title" style={{ fontSize: '1.2rem', margin: '6px 0 10px 0' }}>
            {t('personalPrivateTitle')}
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
            {t('personalPrivateNotice')}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={onOpenWorkspaceSwitcher}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Layers size={16} />
              <span>{t('switchWorkspace')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Activity Audit Log Tab
  if (activeSubTab === 'audit') {
    return (
      <ActivityView onBack={() => setActiveSubTab('members')} />
    );
  }

  // 3. Multi-Member Management View (Family & Business)
  const handleAcceptRequest = async (requestId) => {
    setProcessingRequestId(requestId);
    try {
      const res = await handleProcessJoinRequest(requestId, true);
      if (res.success) {
        showToast && showToast(t('actionRequestApproved'));
      } else {
        showToast && showToast(res.error || 'Failed to approve request');
      }
    } catch (err) {
      showToast && showToast(err.message);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId) => {
    setProcessingRequestId(requestId);
    try {
      const res = await handleProcessJoinRequest(requestId, false);
      if (res.success) {
        showToast && showToast(t('actionRequestRejected'));
      }
    } catch (err) {
      showToast && showToast(err.message);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    setChangingMemberId(memberId);
    try {
      const res = await changeMemberRole(memberId, newRole);
      if (res.success) {
        showToast && showToast(`Role updated to ${newRole}`);
      } else {
        showToast && showToast(res.error || 'Failed to change role');
      }
    } catch (err) {
      showToast && showToast(err.message);
    } finally {
      setChangingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (window.confirm(`${t('confirmRemoveMember')} (${memberName})`)) {
      try {
        const res = await removeMember(memberId);
        if (res.success) {
          showToast && showToast(`${memberName} removed from workspace`);
        } else {
          showToast && showToast(res.error || 'Failed to remove member');
        }
      } catch (err) {
        showToast && showToast(err.message);
      }
    }
  };

  const handleLeaveWorkspace = async () => {
    if (window.confirm(t('confirmLeaveWorkspace'))) {
      try {
        const res = await leaveCurrentWs();
        if (res.success) {
          showToast && showToast('You have left the workspace.');
        } else {
          showToast && showToast(res.error || 'Failed to leave workspace');
        }
      } catch (err) {
        showToast && showToast(err.message);
      }
    }
  };

  const getWorkspaceIcon = () => {
    if (wsType === WORKSPACE_MODES.BUSINESS) return <Briefcase size={18} style={{ color: 'var(--accent-cyan)' }} />;
    return <Heart size={18} style={{ color: 'var(--accent-rose)' }} />;
  };

  return (
    <div className="screen-fade">
      {/* Workspace Sub-Navigation / Header Card */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--bg-card-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)'
            }}>
              {getWorkspaceIcon()}
            </div>
            <div>
              <span className="card-subtitle" style={{ fontSize: '0.66rem', textTransform: 'uppercase' }}>
                {t(`mode${wsType.charAt(0).toUpperCase() + wsType.slice(1)}`)} {t('workspace')}
              </span>
              <h2 className="card-title" style={{ fontSize: '0.96rem', margin: 0 }}>
                {currentWorkspace?.name}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '5px' }}>
            {canManageWorkspace && (
              <button
                type="button"
                className="btn-primary compact-btn"
                style={{ padding: '4px 10px', fontSize: '0.74rem', height: '32px' }}
                onClick={() => setShowInviteModal(true)}
              >
                <UserPlus size={13} />
                <span>{t('inviteMemberBtn')}</span>
              </button>
            )}

            {!isOwner && (
              <button
                type="button"
                className="filter-chip"
                style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--accent-rose)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                onClick={handleLeaveWorkspace}
                title={t('leaveWorkspaceBtn')}
              >
                <LogOut size={12} style={{ marginRight: '3px' }} />
                <span>{t('leaveWorkspaceBtn')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tabs: Members vs Activity Audit Log */}
        <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
          <button
            type="button"
            className={`filter-chip ${activeSubTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('members')}
            style={{ fontSize: '0.74rem', padding: '3px 9px' }}
          >
            <Users size={13} style={{ marginRight: '3px' }} />
            {t('activeMembersTitle')} ({members.length})
          </button>
          <button
            type="button"
            className={`filter-chip ${activeSubTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('audit')}
            style={{ fontSize: '0.74rem', padding: '3px 9px' }}
          >
            <History size={13} style={{ marginRight: '3px' }} />
            {t('activityAuditTitle')}
          </button>
        </div>
      </div>

      {/* SECTION 1: Pending Join Requests (Owner / Admin view) */}
      {canManageWorkspace && joinRequests.length > 0 && (
        <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px', borderColor: 'var(--primary)', background: 'var(--chip-green-bg)' }}>
          <div className="card-header" style={{ marginBottom: '8px' }}>
            <span className="card-title" style={{ fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <UserPlus size={14} style={{ color: 'var(--primary)' }} />
              {t('pendingRequestsTitle')} ({joinRequests.length})
            </span>
            <span className="tag-pill" style={{
              fontSize: '0.62rem',
              background: 'var(--primary)',
              color: '#fff',
              borderColor: 'var(--primary)',
              padding: '1px 5px'
            }}>
              {t('requiresApproval')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {joinRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={req.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                    alt={req.userName}
                    className="compact-avatar"
                  />
                  <div>
                    <h4 style={{ fontSize: '0.80rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                      {req.userName || 'Invited User'}
                    </h4>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {req.userEmail} • {t('requestedRole')} <strong style={{ color: 'var(--primary)' }}>{req.role}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    type="button"
                    className="filter-chip"
                    style={{
                      fontSize: '0.70rem',
                      padding: '3px 7px',
                      color: 'var(--accent-rose)',
                      borderColor: 'rgba(239, 68, 68, 0.4)'
                    }}
                    onClick={() => handleRejectRequest(req.id)}
                    disabled={processingRequestId === req.id}
                  >
                    <XCircle size={12} style={{ marginRight: '3px' }} />
                    {t('rejectBtn')}
                  </button>
                  <button
                    type="button"
                    className="btn-primary compact-btn"
                    style={{ fontSize: '0.70rem', padding: '3px 8px', height: '28px' }}
                    onClick={() => handleAcceptRequest(req.id)}
                    disabled={processingRequestId === req.id}
                  >
                    {processingRequestId === req.id ? (
                      <div className="spinner-sm" />
                    ) : (
                      <>
                        <CheckCircle2 size={12} style={{ marginRight: '3px' }} />
                        {t('acceptBtn')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: Active Members List */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <div className="card-header" style={{ marginBottom: '8px' }}>
          <div>
            <span className="card-subtitle" style={{ fontSize: '0.66rem' }}>{t('teamRoster')}</span>
            <h3 className="card-title" style={{ fontSize: '0.90rem', margin: '2px 0 0 0' }}>
              <Users size={15} style={{ color: 'var(--primary)' }} />
              {t('activeMembersTitle')} ({members.length})
            </h3>
          </div>
          <span className="tag-pill" style={{ fontSize: '0.64rem', padding: '2px 6px' }}>
            {t('yourRole')} <strong style={{ textTransform: 'capitalize' }}>{currentUserRole}</strong>
          </span>
        </div>

        {members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>
            <Users size={28} style={{ opacity: 0.3, marginBottom: '4px' }} />
            <p style={{ fontSize: '0.80rem', margin: 0 }}>{t('noMembersYet')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {members.map((member) => {
              const isMemberOwner = member.role === WORKSPACE_ROLES.OWNER;
              const canEditThisMember = isOwner && !isMemberOwner;

              return (
                <div
                  key={member.id}
                  className="compact-member-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  {/* Left: Avatar & Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
                    <img
                      src={member.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                      alt={member.displayName}
                      className="compact-avatar"
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                          {member.displayName || 'Member'}
                        </h4>
                        {isMemberOwner && (
                          <span style={{
                            fontSize: '0.60rem',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: 'var(--accent-amber)',
                            padding: '1px 5px',
                            borderRadius: '8px',
                            fontWeight: 700
                          }}>
                            {t('roleOwner').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', display: 'block' }}>
                        {member.email}
                      </span>
                      <span style={{ fontSize: '0.64rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
                        <Clock size={9} /> {t('joinedOn')} {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Recently'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Role selection & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {canEditThisMember ? (
                      <select
                        className="form-input compact-input"
                        style={{ fontSize: '0.72rem', padding: '2px 6px', height: '28px', width: 'auto' }}
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        disabled={changingMemberId === member.id}
                      >
                        <option value={WORKSPACE_ROLES.ADMIN}>{t('roleAdmin')}</option>
                        <option value={WORKSPACE_ROLES.EDITOR}>{t('roleEditor')}</option>
                        <option value={WORKSPACE_ROLES.VIEWER}>{t('roleViewer')}</option>
                      </select>
                    ) : (
                      <span className="tag-pill" style={{
                        fontSize: '0.66rem',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        padding: '2px 6px',
                        background: isMemberOwner ? 'var(--chip-amber-bg)' : 'var(--chip-green-bg)',
                        color: isMemberOwner ? 'var(--chip-amber-text)' : 'var(--primary)',
                        borderColor: isMemberOwner ? 'var(--chip-amber-text)' : 'var(--primary)'
                      }}>
                        <ShieldCheck size={11} style={{ display: 'inline', marginRight: '3px' }} />
                        {member.role === WORKSPACE_ROLES.OWNER
                          ? t('roleOwner')
                          : member.role === WORKSPACE_ROLES.ADMIN
                            ? t('roleAdmin')
                            : member.role === WORKSPACE_ROLES.EDITOR
                              ? t('roleEditor')
                              : t('roleViewer')}
                      </span>
                    )}

                    {canEditThisMember && (
                      <button
                        type="button"
                        className="compact-action-btn delete"
                        onClick={() => handleRemoveMember(member.id, member.displayName)}
                        title={t('removeMemberBtn')}
                      >
                        <UserX size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: Active Invitations (for Owner / Admin) */}
      {canManageWorkspace && (
        <div className="card compact-form-card" style={{ padding: '10px 12px' }}>
          <div className="card-header" style={{ marginBottom: '8px' }}>
            <span className="card-title" style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Mail size={14} style={{ color: 'var(--primary)' }} />
              {t('activeInvitationsTitle')} ({invitations.filter(i => i.status === 'pending').length})
            </span>
            <button
              type="button"
              className="filter-chip"
              style={{ fontSize: '0.70rem', padding: '2px 7px' }}
              onClick={() => setShowInviteModal(true)}
            >
              + {t('inviteMemberBtn')}
            </button>
          </div>

          {invitations.filter(i => i.status === 'pending').length === 0 ? (
            <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', margin: 0 }}>
              {t('noActiveInvitations')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {invitations.filter(i => i.status === 'pending').map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.74rem'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)', marginRight: '5px' }}>
                      {inv.invitedEmail ? inv.invitedEmail : t('shareableLink')}
                    </span>
                    <span className="tag-pill" style={{ fontSize: '0.60rem', padding: '1px 4px', textTransform: 'uppercase' }}>
                      {inv.role}
                    </span>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-dim)', marginTop: '1px' }}>
                      {t('expiresLabel')} {new Date(inv.expiresAt).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="filter-chip"
                    style={{ fontSize: '0.66rem', color: 'var(--accent-rose)', padding: '2px 5px' }}
                    onClick={() => revokeExistingInvite(inv.id)}
                  >
                    {t('revokeBtn')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        showToast={showToast}
      />
    </div>
  );
}
