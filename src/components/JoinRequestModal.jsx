import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  useEffect(() => {
    if (!isOpen || !incomingInviteData) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, incomingInviteData]);

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

  const modalContent = (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
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
        className="modal-sheet"
        style={{
          width: '100%',
          maxWidth: '440px',
          maxHeight: 'min(90vh, 90dvh, calc(100dvh - 24px))',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          padding: '20px',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--bg-card-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)',
              flexShrink: 0
            }}>
              {getIcon()}
            </div>
            <div style={{ minWidth: 0 }}>
              <span className="card-subtitle" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                {t('joinRequestBannerTitle')}
              </span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--text-main)', wordBreak: 'break-word' }}>
                {incomingInviteData.workspaceName || 'Diary Workspace'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="filter-chip"
            style={{ padding: '6px', borderRadius: '50%', flexShrink: 0 }}
            onClick={handleDecline}
            aria-label={t('close') || 'Close'}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('workspaceMode')}</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-main)' }}>
              {incomingInviteData.workspaceType}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('status')}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <Clock size={12} /> {t('validInvitation')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="filter-chip"
            style={{ flex: '1 1 110px', minHeight: '42px', padding: '10px', textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center' }}
            onClick={handleDecline}
            disabled={submitting}
          >
            {t('declineBtn')}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: '2 1 180px', minHeight: '42px', padding: '10px', textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center' }}
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

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}

