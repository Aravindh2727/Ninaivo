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
  ChevronDown,
  ArrowLeft,
  Plus
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { WORKSPACE_MODES } from '../services/workspaceService';
import { WORKSPACE_ROLES } from '../services/memberService';
import InviteMemberModal from '../components/InviteMemberModal';
import ActivityView from './ActivityView';

export default function MembersView({ onOpenWorkspaceSwitcher, showToast }) {
  const {
    currentWorkspace,
    workspaces,
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
    revokeExistingInvite,
    switchWorkspace,
    createNewWorkspace,
    calculateGroupPresence
  } = useWorkspace();
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  const sharedGroups = (workspaces || []).filter(w => w.type !== WORKSPACE_MODES.PERSONAL);
  const isCurrentPersonal = !currentWorkspace || currentWorkspace.type === WORKSPACE_MODES.PERSONAL;

  // View mode: 'groups' overview vs 'details' of specific active shared group
  const [viewMode, setViewMode] = useState(isCurrentPersonal ? 'groups' : 'details');
  const [activeSubTab, setActiveSubTab] = useState('members'); // 'members' | 'audit'
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [changingMemberId, setChangingMemberId] = useState(null);

  // Create Group Modal State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('family');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Presence stats for active workspace
  const presenceStats = calculateGroupPresence
    ? calculateGroupPresence(members, currentUser?.uid)
    : {
        totalMembers: members.filter(m => m.status === 'active' || m.role === 'owner').length,
        onlineCount: 1,
        offlineCount: Math.max(0, members.length - 1),
        membersWithPresence: members
      };

  const wsType = currentWorkspace?.type || WORKSPACE_MODES.PERSONAL;

  const handleOpenGroup = (ws) => {
    switchWorkspace(ws);
    setViewMode('details');
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setCreatingGroup(true);
    try {
      const created = await createNewWorkspace({
        name: newGroupName.trim(),
        type: newGroupType,
        description: newGroupDesc.trim()
      });
      showToast && showToast(`Group "${newGroupName}" created!`);
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      if (created) {
        switchWorkspace(created);
        setViewMode('details');
      }
    } catch (err) {
      alert('Failed to create group: ' + err.message);
    } finally {
      setCreatingGroup(false);
    }
  };

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
          setViewMode('groups');
        } else {
          showToast && showToast(res.error || 'Failed to leave workspace');
        }
      } catch (err) {
        showToast && showToast(err.message);
      }
    }
  };

  const getWorkspaceIcon = (type) => {
    if (type === WORKSPACE_MODES.BUSINESS) return <Briefcase size={18} style={{ color: 'var(--accent-cyan)' }} />;
    return <Heart size={18} style={{ color: 'var(--accent-rose)' }} />;
  };

  // Activity Audit Log Tab (within Group Details)
  if (viewMode === 'details' && activeSubTab === 'audit') {
    return (
      <ActivityView onBack={() => setActiveSubTab('members')} />
    );
  }

  // =========================================================================
  // VIEW 1: Groups Dashboard (Family & Business Groups Overview)
  // =========================================================================
  if (viewMode === 'groups' || isCurrentPersonal) {
    return (
      <div className="screen-fade">
        {/* Groups Dashboard Header */}
        <div className="card compact-form-card" style={{ marginBottom: '12px', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              <span className="card-subtitle" style={{ fontSize: '0.66rem', textTransform: 'uppercase' }}>
                {t('appTitle')}
              </span>
              <h2 className="card-title" style={{ fontSize: '1rem', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} style={{ color: 'var(--primary)' }} />
                <span>{t('groupsTitle')}</span>
              </h2>
            </div>
            <button
              type="button"
              className="btn-primary compact-btn"
              style={{ padding: '5px 10px', fontSize: '0.74rem', height: '32px' }}
              onClick={() => setShowCreateGroupModal(true)}
            >
              <Plus size={13} />
              <span>{t('createGroupBtn')}</span>
            </button>
          </div>
        </div>

        {/* Groups List */}
        {sharedGroups.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 18px', marginBottom: '12px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'var(--chip-green-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
              color: 'var(--primary)'
            }}>
              <Heart size={26} />
            </div>
            <h3 style={{ fontSize: '1rem', margin: '0 0 6px 0', color: 'var(--text-main)' }}>
              {t('noGroupsYet')}
            </h3>
            <p style={{ fontSize: '0.80rem', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 16px auto', lineHeight: 1.4 }}>
              {t('noGroupsYetDesc')}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCreateGroupModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', padding: '8px 16px' }}
            >
              <Plus size={14} />
              <span>{t('createGroupBtn')}</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {sharedGroups.map((group) => {
              const isSelected = currentWorkspace?.id === group.id;
              const isUserOwner = group.ownerUid === currentUser?.uid;
              const groupMemberCount = Array.isArray(group.members) ? group.members.length : (group.memberRoles ? Object.keys(group.memberRoles).length : 1);

              return (
                <div
                  key={group.id}
                  className="card compact-form-card"
                  style={{
                    padding: '12px 14px',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                    background: isSelected ? 'var(--bg-card)' : 'var(--bg-card-subtle)',
                    cursor: 'pointer',
                    transition: 'border-color 150ms ease'
                  }}
                  onClick={() => handleOpenGroup(group)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-color)',
                        flexShrink: 0
                      }}>
                        {getWorkspaceIcon(group.type)}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                          {group.name}
                        </h3>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                          {group.type === WORKSPACE_MODES.FAMILY ? t('modeFamily') : t('modeBusiness')}
                        </span>
                      </div>
                    </div>

                    <span className="tag-pill" style={{
                      fontSize: '0.62rem',
                      padding: '2px 6px',
                      textTransform: 'uppercase',
                      background: isUserOwner ? 'var(--chip-amber-bg)' : 'var(--chip-green-bg)',
                      color: isUserOwner ? 'var(--chip-amber-text)' : 'var(--primary)',
                      borderColor: isUserOwner ? 'var(--chip-amber-text)' : 'var(--primary)'
                    }}>
                      {isUserOwner ? t('roleOwner') : (group.memberRoles?.[currentUser?.uid] || 'Member')}
                    </span>
                  </div>

                  {group.settings?.description && (
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                      {group.settings.description}
                    </p>
                  )}

                  {/* Presence & Members Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '0.70rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        {groupMemberCount} {t('membersCount')}
                      </span>
                      {isSelected ? (
                        <>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                            {presenceStats.onlineCount} {t('onlineCountLabel')}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                            {presenceStats.offlineCount} {t('offlineCountLabel')}
                          </span>
                        </>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                          {t('online')}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="filter-chip active"
                      style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenGroup(group);
                      }}
                    >
                      {t('viewMembers')} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateGroupModal && (
          <div className="modal-overlay" onClick={() => setShowCreateGroupModal(false)} style={{ padding: '12px' }}>
            <div
              className="modal-dialog compact-modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '380px', padding: '14px 16px', boxSizing: 'border-box' }}
            >
              <div className="modal-header compact-modal-header" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 className="modal-title compact-modal-title" style={{ fontSize: '0.96rem' }}>
                  {t('newGroupModalTitle')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="compact-action-btn"
                  style={{ color: 'var(--text-dim)' }}
                >
                  <XCircle size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateGroupSubmit}>
                <div className="form-group compact-form-group">
                  <label className="form-label compact-form-label">{t('groupName')} *</label>
                  <input
                    type="text"
                    className="form-input compact-input"
                    placeholder={t('enterGroupName')}
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group compact-form-group">
                  <label className="form-label compact-form-label">{t('groupType')}</label>
                  <select
                    className="form-select compact-input"
                    value={newGroupType}
                    onChange={(e) => setNewGroupType(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value={WORKSPACE_MODES.FAMILY}>{t('modeFamily')}</option>
                    <option value={WORKSPACE_MODES.BUSINESS}>{t('modeBusiness')}</option>
                  </select>
                </div>

                <div className="form-group compact-form-group">
                  <label className="form-label compact-form-label">{t('groupDescription')}</label>
                  <textarea
                    className="form-input compact-input"
                    rows="2"
                    placeholder={t('groupDescPlaceholder')}
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    style={{ resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn-secondary compact-btn"
                    style={{ flex: 1 }}
                    onClick={() => setShowCreateGroupModal(false)}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn-primary compact-btn"
                    style={{ flex: 1 }}
                    disabled={creatingGroup || !newGroupName.trim()}
                  >
                    {creatingGroup ? '...' : t('createGroupBtn')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: Group Details (Active Shared Workspace View)
  // =========================================================================
  return (
    <div className="screen-fade">
      {/* Top Navigation & Group Header Card */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="compact-action-btn"
              onClick={() => setViewMode('groups')}
              title={t('backToGroups')}
              style={{ color: 'var(--text-dim)', padding: '4px' }}
            >
              <ArrowLeft size={16} />
            </button>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--bg-card-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)',
              flexShrink: 0
            }}>
              {getWorkspaceIcon(wsType)}
            </div>
            <div style={{ minWidth: 0 }}>
              <span className="card-subtitle" style={{ fontSize: '0.64rem', textTransform: 'uppercase' }}>
                {t(`mode${wsType.charAt(0).toUpperCase() + wsType.slice(1)}`)} {t('workspace')}
              </span>
              <h2 className="card-title" style={{ fontSize: '0.94rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentWorkspace?.name}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
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

        {/* Presence Summary Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
          margin: '8px 0',
          background: 'var(--bg-card-subtle)',
          padding: '6px 8px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', display: 'block' }}>
              {t('totalMembers')}
            </span>
            <span style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {presenceStats.totalMembers}
            </span>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e' }} />
              {t('onlineCountLabel')}
            </span>
            <span style={{ fontSize: '0.96rem', fontWeight: 700, color: '#16a34a' }}>
              {presenceStats.onlineCount}
            </span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#94a3b8' }} />
              {t('offlineCountLabel')}
            </span>
            <span style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {presenceStats.offlineCount}
            </span>
          </div>
        </div>

        {/* Sub-Tabs: Members vs Activity Audit Log */}
        <div style={{
          display: 'flex',
          gap: '6px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch'
        }}>
          <button
            type="button"
            className={`filter-chip ${activeSubTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('members')}
            style={{ fontSize: '0.72rem', padding: '4px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <Users size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {t('activeMembersTitle')} ({presenceStats.totalMembers})
          </button>
          <button
            type="button"
            className={`filter-chip ${activeSubTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('audit')}
            style={{ fontSize: '0.72rem', padding: '4px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <History size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {t('activityAuditTitle')}
          </button>
        </div>
      </div>

      {/* SECTION 1: Pending Join Requests */}
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

      {/* SECTION 2: Active Members List with Genuine Presence Indicators */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <div className="card-header" style={{ marginBottom: '8px' }}>
          <div>
            <span className="card-subtitle" style={{ fontSize: '0.64rem' }}>{t('teamRoster')}</span>
            <h3 className="card-title" style={{ fontSize: '0.88rem', margin: '2px 0 0 0' }}>
              <Users size={14} style={{ color: 'var(--primary)' }} />
              {t('groupMembers')} ({presenceStats.totalMembers})
            </h3>
          </div>
          <span className="tag-pill" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
            {t('yourRole')} <strong style={{ textTransform: 'capitalize' }}>{currentUserRole}</strong>
          </span>
        </div>

        {presenceStats.membersWithPresence.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>
            <Users size={28} style={{ opacity: 0.3, marginBottom: '4px' }} />
            <p style={{ fontSize: '0.80rem', margin: 0 }}>{t('noMembersYet')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {presenceStats.membersWithPresence.map((member) => {
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
                    gap: '8px'
                  }}
                >
                  {/* Left: Avatar with Online Dot & Member Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={member.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                        alt={member.displayName}
                        className="compact-avatar"
                        style={{ display: 'block' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '-1px',
                          right: '-1px',
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          background: member.isOnline ? '#22c55e' : '#94a3b8',
                          border: '2px solid var(--bg-card)',
                          boxSizing: 'content-box'
                        }}
                        title={member.isOnline ? t('online') : t('offline')}
                      />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {member.displayName || 'Member'}
                        </h4>
                        <span style={{ fontSize: '0.62rem', color: member.isOnline ? '#16a34a' : 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: member.isOnline ? '#22c55e' : '#94a3b8' }} />
                          {member.isOnline ? t('online') : t('offline')}
                        </span>
                      </div>

                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.email}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {member.relationship && (
                          <span className="tag-pill" style={{ fontSize: '0.58rem', padding: '1px 5px', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                            {member.relationship === 'friend' ? t('relFriend')
                              : member.relationship === 'colleague' ? t('relColleague')
                              : member.relationship === 'partner' ? t('relPartner')
                              : member.relationship === 'other' ? t('relOther')
                              : t('relFamily')}
                          </span>
                        )}
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={9} /> {t('joinedOn')} {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Recently'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Role selection & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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
                        fontSize: '0.64rem',
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
                    fontSize: '0.74rem',
                    gap: '8px'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                        {inv.invitedEmail ? inv.invitedEmail : t('shareableLink')}
                      </span>
                      <span className="tag-pill" style={{ fontSize: '0.60rem', padding: '1px 4px', textTransform: 'uppercase', flexShrink: 0 }}>
                        {inv.role}
                      </span>
                      {inv.relationship && (
                        <span className="tag-pill" style={{ fontSize: '0.58rem', padding: '1px 4px', flexShrink: 0 }}>
                          {inv.relationship === 'friend' ? t('relFriend')
                            : inv.relationship === 'colleague' ? t('relColleague')
                            : inv.relationship === 'partner' ? t('relPartner')
                            : inv.relationship === 'other' ? t('relOther')
                            : t('relFamily')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-dim)', marginTop: '1px' }}>
                      {t('expiresLabel')} {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : t('never')}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="filter-chip"
                    style={{ fontSize: '0.66rem', color: 'var(--accent-rose)', padding: '2px 5px', flexShrink: 0 }}
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
