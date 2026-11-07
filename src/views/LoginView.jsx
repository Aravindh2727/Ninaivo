import React, { useState } from 'react';
import { 
  BookOpen, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle, 
  Sparkles, 
  Info,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatAuthError } from '../firebase/authService';
import NinaivoLogo from '../components/NinaivoLogo';

export default function LoginView({ onSwitchToRegister, onSwitchToForgotPassword, onExploreDemo }) {
  const { login, isConfigured } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage(t('enterEmailAndPassword'));
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper screen-fade">
      <div className="auth-card">
        {/* Brand Header with Official Ninaivo Logo */}
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
          <h1 className="auth-title">{t('welcomeBack')}</h1>
          <p className="auth-subtitle">
            {t('signInSubtitle')}
          </p>
        </div>

        {/* Configuration Notice if .env credentials pending */}
        {!isConfigured && (
          <div className="auth-alert auth-alert-info">
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '0.78rem', marginBottom: '2px' }}>
                {t('firebaseConfigPending')}
              </strong>
              <span>
                {t('firebaseConfigPendingDesc')}
              </span>
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.72rem' }}
                  onClick={onExploreDemo}
                >
                  <Sparkles size={13} style={{ color: 'var(--accent-amber)' }} />
                  {t('enterLocalDemo')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <span>{t('emailAddress')}</span>
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

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                <span>{t('password')}</span>
              </label>
              <button
                type="button"
                className="auth-switch-link"
                style={{ fontSize: '0.73rem', textDecoration: 'none' }}
                onClick={onSwitchToForgotPassword}
              >
                {t('forgotPasswordQuestion')}
              </button>
            </div>
            <div className="password-input-wrap" style={{ marginTop: '6px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder={t('enterYourPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                  <span>{t('authenticating')}</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>{t('signInToDiary')}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Switch to Register */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>{t('dontHaveAccount')}</span>{' '}
          <button
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToRegister}
          >
            {t('createAnAccount')}
          </button>
        </div>

        {/* Security badge footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', color: 'var(--text-dim)', fontSize: '0.7rem' }}>
          <ShieldCheck size={14} style={{ color: 'var(--accent-emerald)' }} />
          <span>{t('authSecuredBadge')}</span>
        </div>
      </div>
    </div>
  );
}

