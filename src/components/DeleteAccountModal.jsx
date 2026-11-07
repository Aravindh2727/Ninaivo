import React, { useState } from 'react';
import { Trash2, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatAuthError } from '../firebase/authService';

export default function DeleteAccountModal({ isOpen, onCancel, onConfirmDelete }) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError(t('deletePasswordRequired') || 'Please provide your current password to authorize account deletion.');
      return;
    }

    setLoading(true);
    try {
      await onConfirmDelete(currentPassword);
    } catch (err) {
      setError(formatAuthError(err));
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-rose)' }}>
            <Trash2 size={18} />
          </div>
          <h2 className="modal-title">{t('deleteAccountTitle')}</h2>
        </div>

        <p className="modal-body">
          <strong style={{ color: 'var(--accent-rose)', display: 'block', marginBottom: '6px' }}>
            {t('deleteAccountWarning')}
          </strong>
          {t('deleteAccountDesc')}
        </p>

        {error && (
          <div className="auth-alert auth-alert-error" style={{ marginBottom: '14px' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <span>{t('confirmCurrentPassword')}</span>
              <Lock size={13} />
            </label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder={t('enterPasswordToConfirm')}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="btn-danger"
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <div className="spinner-sm" />
                  <span>{t('deletingAccount')}</span>
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  <span>{t('permanentlyDelete')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

