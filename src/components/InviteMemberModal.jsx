import React, { useState } from 'react';
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
  const [expiresInHours, setExpiresInHours] = useState('48');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
        expiresInHours: Number(expiresInHours)
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog compact-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', padding: '14px 16px' }}>
        <div className="modal-header compact-modal-header" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--chip-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <UserPlus size={15} />
            </div>
            <h2 className="modal-title compact-modal-title" style={{ fontSize: '0.96rem' }}>{t('inviteModalTitle')}</h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="compact-action-btn"
            style={{ color: 'var(--text-dim)' }}
          >
            <X size={16} />
          </button>
        </div>

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
              <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                <button
                  type="button"
                  className={`category-pill ${inviteType === 'link' ? 'selected' : ''}`}
                  style={{ flex: 1, padding: '5px 8px', fontSize: '0.74rem' }}
                  onClick={() => setInviteType('link')}
                >
                  <LinkIcon size={12} style={{ display: 'inline', marginRight: '3px' }} />
                  {t('inviteViaLink')}
                </button>
                <button
                  type="button"
                  className={`category-pill ${inviteType === 'email' ? 'selected' : ''}`}
                  style={{ flex: 1, padding: '5px 8px', fontSize: '0.74rem' }}
                  onClick={() => setInviteType('email')}
                >
                  <Mail size={12} style={{ display: 'inline', marginRight: '3px' }} />
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

              {/* Role Selection */}
              <div className="form-group compact-form-group">
                <label className="form-label compact-form-label">{t('assignedRoleLabel')}</label>
                <select
                  className="form-select compact-input"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value={WORKSPACE_ROLES.EDITOR}>{t('roleEditor')} — {t('roleEditorDesc')}</option>
                  <option value={WORKSPACE_ROLES.ADMIN}>{t('roleAdmin')} — {t('roleAdminDesc')}</option>
                  <option value={WORKSPACE_ROLES.VIEWER}>{t('roleViewer')} — {t('roleViewerDesc')}</option>
                </select>
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
                >
                  <option value="24">{t('hours24')}</option>
                  <option value="48">{t('hours48')}</option>
                  <option value="168">{t('days7')}</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn-primary compact-btn"
                disabled={loading}
                style={{ width: '100%', marginTop: '6px' }}
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
                  style={{ fontSize: '0.72rem', height: '30px', marginBottom: '6px', color: 'var(--text-muted)' }}
                  value={generatedLink}
                />
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    type="button"
                    className="filter-chip active"
                    style={{ flex: 1, textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.72rem' }}
                    onClick={handleCopy}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? t('copied') : t('copyLinkBtn')}</span>
                  </button>
                  <button
                    type="button"
                    className="filter-chip"
                    style={{ flex: 1, textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#25D366', color: '#25D366', padding: '4px 8px', fontSize: '0.72rem' }}
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
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                  {t('activeInvitationsTitle')} ({invitations.length})
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        background: 'var(--bg-card-subtle)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.72rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {inv.invitedEmail || t('shareableLink')}
                          </span>
                          <span className="tag-pill" style={{ textTransform: 'capitalize', fontSize: '0.60rem', padding: '1px 4px' }}>
                            {inv.role}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-dim)' }}>
                          {t('expiresLabel')} {new Date(inv.expiresAt).toLocaleDateString()} • {t('statusLabel')} <strong style={{ textTransform: 'capitalize' }}>{inv.status}</strong>
                        </span>
                      </div>

                      {inv.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(inv.id)}
                          className="compact-action-btn delete"
                          style={{ width: '22px', height: '22px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: '10px', textAlign: 'right' }}>
          <button 
            type="button" 
            className="btn-secondary compact-btn" 
            style={{ width: 'auto', padding: '4px 12px', display: 'inline-flex', height: '30px' }} 
            onClick={onClose}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

