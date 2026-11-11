import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Share2,
  Check,
  Mail,
  Link as LinkIcon,
  Clock,
  ShieldCheck,
  Trash2,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { WORKSPACE_ROLES } from '../services/memberService';

export default function InviteMemberModal({ isOpen, onClose, showToast }) {
  const {
    currentWorkspace,
    invitations,
    generateInvitation,
    revokeExistingInvite
  } = useWorkspace();
  const { t } = useLanguage();

  const [inviteType, setInviteType] = useState('link'); // 'link' | 'email'
  const [invitedEmail, setInvitedEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState(WORKSPACE_ROLES.EDITOR);
  const [relationship, setRelationship] = useState('family');
  const [expiresInHours, setExpiresInHours] = useState('48');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Body scroll lock while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isPersonal = currentWorkspace?.type === 'personal';

  const handleGenerate = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (inviteType === 'email' && !invitedEmail.trim()) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await generateInvitation({
        invitedEmail: inviteType === 'email' ? invitedEmail.trim() : '',
        role: selectedRole,
        relationship,
        expiresInHours: expiresInHours === 'never' ? 'never' : Number(expiresInHours)
      });

      setGeneratedLink(res.inviteLink);
      showToast('Invitation created with secure cryptographic token!');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    showToast(t('linkCopiedToast'));
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!generatedLink) return;
    const text = `Join my diary workspace "${currentWorkspace?.name}" on Ninaivo:\n${generatedLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleRevoke = async (invId) => {
    if (window.confirm('Revoke this invitation? It will immediately stop working.')) {
      try {
        await revokeExistingInvite(invId);
        showToast('Invitation revoked.');
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          maxHeight: 'min(90vh, 90dvh, calc(100dvh - 24px))',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg, 18px)',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxSizing: 'border-box'
        }}
      >
        {/* Pinned Header */}
        <div
          className="modal-header compact-modal-header"
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'var(--chip-green-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0
              }}
            >
              <UserPlus size={16} />
            </div>
            <h2 className="modal-title compact-modal-title" style={{ fontSize: '0.96rem', margin: 0 }}>
              {t('inviteModalTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="compact-action-btn"
            style={{ color: 'var(--text-dim)', padding: '6px', borderRadius: '8px' }}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            padding: '14px 16px'
          }}
        >
          {/* Personal Workspace Guard */}
          {isPersonal ? (
            <div className="auth-alert auth-alert-error" style={{ margin: '10px 0' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{t('personalPrivateNotice')}</span>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="auth-alert auth-alert-error" style={{ marginBottom: '8px' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Invite Form */}
              <form onSubmit={handleGenerate} style={{ marginBottom: '12px' }}>
                {/* Type Switcher */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    className={`category-pill ${inviteType === 'link' ? 'selected' : ''}`}
                    style={{ flex: 1, padding: '7px 8px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setInviteType('link')}
                  >
                    <LinkIcon size={13} style={{ display: 'inline', marginRight: '4px' }} />
                    {t('inviteViaLink')}
                  </button>
                  <button
                    type="button"
                    className={`category-pill ${inviteType === 'email' ? 'selected' : ''}`}
                    style={{ flex: 1, padding: '7px 8px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setInviteType('email')}
                  >
                    <Mail size={13} style={{ display: 'inline', marginRight: '4px' }} />
                    {t('inviteViaEmail')}
                  </button>
                </div>

                {inviteType === 'email' && (
                  <div className="form-group compact-form-group">
                    <label className="form-label compact-form-label">{t('inviteeEmail')} *</label>
                    <input
                      type="email"
                      className="form-input compact-input"
                      placeholder="family.member@example.com"
                      value={invitedEmail}
                      onChange={(e) => setInvitedEmail(e.target.value)}
                      required
                    />
                  </div>
                )}

                {/* Relationship Selection */}
                <div className="form-group compact-form-group">
                  <label className="form-label compact-form-label">{t('relationshipLabel')}</label>
                  <select
                    className="form-select compact-input"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="family">{t('relFamily')}</option>
                    <option value="friend">{t('relFriend')}</option>
                    <option value="colleague">{t('relColleague')}</option>
                    <option value="partner">{t('relPartner')}</option>
                    <option value="other">{t('relOther')}</option>
                  </select>
                </div>

                {/* Role Selection */}
                <div className="form-group compact-form-group">
                  <label className="form-label compact-form-label">{t('assignedRoleLabel')}</label>
                  <select
                    className="form-select compact-input"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value={WORKSPACE_ROLES.EDITOR}>{t('roleEditor')}</option>
                    <option value={WORKSPACE_ROLES.ADMIN}>{t('roleAdmin')}</option>
                    <option value={WORKSPACE_ROLES.VIEWER}>{t('roleViewer')}</option>
                  </select>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block', lineHeight: 1.35 }}>
                    {selectedRole === WORKSPACE_ROLES.ADMIN
                      ? t('roleAdminDesc')
                      : selectedRole === WORKSPACE_ROLES.VIEWER
                        ? t('roleViewerDesc')
                        : t('roleEditorDesc')}
                  </span>
                </div>

                {/* Expiration Selection */}
                <div className="form-group compact-form-group">
                  <label className="form-label compact-form-label">
                    <span>{t('linkExpirationLabel')}</span>
                    <Clock size={11} />
                  </label>
                  <select
                    className="form-select compact-input"
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="24">{t('hours24')}</option>
                    <option value="48">{t('hours48')}</option>
                    <option value="168">{t('days7')}</option>
                    <option value="never">{t('never')}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-primary compact-btn"
                  disabled={loading}
                  style={{ width: '100%', marginTop: '6px', height: '36px' }}
                >
                  <UserPlus size={14} />
                  <span>{t('generateInviteBtn')}</span>
                </button>
              </form>

              {/* Generated Link Display */}
              {generatedLink && (
                <div className="card compact-form-card" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--accent-emerald)', padding: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.76rem', marginBottom: '4px' }}>
                    <ShieldCheck size={14} />
                    <span>{t('secureInviteReady')}</span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    className="form-input compact-input"
                    style={{ fontSize: '0.72rem', height: '32px', marginBottom: '6px', color: 'var(--text-muted)' }}
                    value={generatedLink}
                  />
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="filter-chip active"
                      style={{ flex: '1 1 120px', textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px', fontSize: '0.74rem', minHeight: '36px' }}
                      onClick={handleCopy}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? t('copied') : t('copyLinkBtn')}</span>
                    </button>
                    <button
                      type="button"
                      className="filter-chip"
                      style={{ flex: '1 1 120px', textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#25D366', color: '#25D366', padding: '6px 8px', fontSize: '0.74rem', minHeight: '36px' }}
                      onClick={handleShareWhatsApp}
                    >
                      <Share2 size={13} />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Active Invitations List */}
              {invitations.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <span style={{ fontSize: '0.70rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                    {t('activeInvitationsTitle')} ({invitations.length})
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                    {invitations.map((inv) => (
                      <div
                        key={inv.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: 'var(--bg-card-subtle)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.72rem',
                          gap: '8px'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                              {inv.invitedEmail || t('shareableLink')}
                            </span>
                            <span className="tag-pill" style={{ textTransform: 'capitalize', fontSize: '0.60rem', padding: '1px 4px', flexShrink: 0 }}>
                              {inv.role}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.64rem', color: 'var(--text-dim)', display: 'block', marginTop: '2px' }}>
                            {t('expiresLabel')} {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : t('never')} • {t('statusLabel')} <strong style={{ textTransform: 'capitalize' }}>{inv.status}</strong>
                          </span>
                        </div>

                        {inv.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(inv.id)}
                            className="compact-action-btn delete"
                            style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', flexShrink: 0 }}
                            aria-label={t('revokeBtn') || 'Revoke'}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pinned Footer */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-color)',
            flexShrink: 0,
            background: 'var(--bg-card-subtle)'
          }}
        >
          <button
            type="button"
            className="btn-secondary compact-btn"
            style={{ width: '100%', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}
            onClick={onClose}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
