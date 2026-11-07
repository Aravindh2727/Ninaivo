import React, { useState } from 'react';
import { 
  KeyRound, 
  Mail, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Send,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatAuthError } from '../firebase/authService';
import NinaivoLogo from '../components/NinaivoLogo';

export default function ForgotPasswordView({ onSwitchToLogin }) {
  const { resetPassword } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successSent, setSuccessSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage(t('enterRegisteredEmail'));
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccessSent(true);
    } catch (err) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper screen-fade">
      <div className="auth-card">
        {/* Header with Official Ninaivo Logo */}
        <div className="auth-header">
          <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
            <NinaivoLogo 
              iconSize={52} 
              showText={true} 
              showTagline={true} 
              layout="vertical"
              taglineText={t('tagline') || 'Your Life. Your Memories. Your Story.'}
            />
          </div>
          <h1 className="auth-title">{t('resetPasswordTitle')}</h1>
          <p className="auth-subtitle">
            {t('resetPasswordSubtitle')}
          </p>
        </div>

        {/* Success Banner */}
        {successSent ? (
          <div className="auth-alert auth-alert-success" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '18px' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--accent-emerald)', marginBottom: '8px' }} />
            <strong style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{t('resetEmailSentTitle')}</strong>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              {t('resetEmailSentDesc')}
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '16px', width: 'auto', padding: '8px 18px' }}
              onClick={onSwitchToLogin}
            >
              {t('backToSignIn')}
            </button>
          </div>
        ) : (
          <>
            {/* Error Banner */}
            {errorMessage && (
              <div className="auth-alert auth-alert-error">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">
                  <span>{t('registeredEmail')}</span>
                  <Mail size={13} />
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div style={{ marginTop: '18px' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? (
                    <>
                      <div className="spinner-sm" />
                      <span>{t('sendingLink')}</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>{t('sendResetLink')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Back to Login */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            className="auth-switch-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={onSwitchToLogin}
          >
            <ArrowLeft size={14} />
            <span>{t('returnToSignIn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

