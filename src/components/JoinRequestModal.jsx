import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  Sparkles,
  Heart,
  Briefcase
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { WORKSPACE_MODES } from '../services/workspaceService';

export default function JoinRequestModal({ isOpen, onClose, showToast }) {
  const {
    incomingInviteData,
    incomingInviteToken,
    acceptInvite,
    requestToJoinWithToken,
    clearIncomingInvite
  } = useWorkspace();
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !incomingInviteData) return null;

  const handleSubmitRequest = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const result = await acceptInvite(incomingInviteToken);
      if (result.success) {
        showToast ? showToast(t('acceptAndJoinSuccess') || 'Successfully joined workspace!') : alert(t('acceptAndJoinSuccess') || 'Successfully joined workspace!');
        clearIncomingInvite();
        onClose();
      } else {
        setErrorMsg(result.error || 'Failed to accept invitation');
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = () => {
    clearIncomingInvite();
    showToast && showToast(t('joinRequestDeclinedMsg'));
    onClose();
  };

  const wsType = incomingInviteData.workspaceType || WORKSPACE_MODES.FAMILY;
  const getIcon = () => {
    if (wsType === WORKSPACE_MODES.BUSINESS) return <Briefcase size={22} style={{ color: 'var(--accent-cyan)' }} />;
    return <Heart size={22} style={{ color: 'var(--accent-rose)' }} />;
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-sheet" style={{ maxWidth: '440px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--bg-card-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)'
            }}>
              {getIcon()}
            </div>
            <div>
              <span className="card-subtitle" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                {t('joinRequestBannerTitle')}
              </span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--text-main)' }}>
                {incomingInviteData.workspaceName || 'Diary Workspace'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="filter-chip"
            style={{ padding: '4px', borderRadius: '50%' }}
            onClick={handleDecline}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
          {t('joinRequestBannerDesc')} <strong>{incomingInviteData.workspaceName}</strong>.
        </p>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--accent-rose)',
            color: 'var(--accent-rose)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('workspaceMode')}</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-main)' }}>
              {incomingInviteData.workspaceType}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('invitedAs')}</span>
            <span className="tag-pill" style={{
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              fontWeight: 700,
              background: 'var(--chip-green-bg)',
              color: 'var(--primary)',
              borderColor: 'var(--primary)'
            }}>
              <ShieldCheck size={12} style={{ display: 'inline', marginRight: '3px' }} />
              {incomingInviteData.role || 'editor'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('status')}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <Clock size={12} /> {t('validInvitation')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="filter-chip"
            style={{ flex: 1, padding: '10px', textAlign: 'center', justifyContent: 'center' }}
            onClick={handleDecline}
            disabled={submitting}
          >
            {t('declineBtn')}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 2, padding: '10px', textAlign: 'center', justifyContent: 'center' }}
            onClick={handleSubmitRequest}
            disabled={submitting}
          >
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className="spinner-sm" /> {t('submitting')}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} />
                {t('acceptAndJoinBtn') || 'Accept & Join Workspace'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

