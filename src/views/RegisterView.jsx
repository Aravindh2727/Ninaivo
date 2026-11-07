import React, { useState } from 'react';
import { 
  BookOpen, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  UserPlus, 
  AlertCircle, 
  Heart, 
  Briefcase, 
  Sparkles,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatAuthError } from '../firebase/authService';
import NinaivoLogo from '../components/NinaivoLogo';

export default function RegisterView({ onSwitchToLogin }) {
  const { register, isConfigured } = useAuth();
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [diaryMode, setDiaryMode] = useState('personal'); // 'personal' | 'family' | 'business'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const diaryModes = [
    {
      id: 'personal',
      title: t('modePersonal'),
      desc: t('thoughtsAndLife'),
      icon: Sparkles
    },
    {
      id: 'family',
      title: t('modeFamily'),
      desc: t('memoriesAndEvents'),
      icon: Heart
    },
    {
      id: 'business',
      title: t('modeBusiness'),
      desc: t('workAndRevenue'),
      icon: Briefcase
    }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!displayName.trim()) {
      setErrorMessage(t('enterFullName'));
      return;
    }

    if (!email.trim()) {
      setErrorMessage(t('enterValidEmail'));
      return;
    }

    if (password.length < 6) {
      setErrorMessage(t('passwordMin6Error'));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, displayName.trim(), diaryMode);
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
          <h1 className="auth-title">{t('createAccountTitle')}</h1>
          <p className="auth-subtitle">
            {t('createAccountSubtitle')}
          </p>
        </div>

        {/* Configuration Notice if .env credentials pending */}
        {!isConfigured && (
          <div className="auth-alert auth-alert-info">
            <div>
              <strong style={{ display: 'block', fontSize: '0.78rem', marginBottom: '2px' }}>
                {t('firebaseConfigPending')}
              </strong>
              <span>
                {t('firebaseConfigPendingDesc')}
              </span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label">
              <span>{t('fullName')}</span>
              <User size={13} />
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={t('fullNamePlaceholder')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>

          {/* Primary Diary Mode Selection */}
          <div className="form-group">
            <label className="form-label">
              <span>{t('primaryDiaryPurpose')}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{t('switchAnytime')}</span>
            </label>
            <div className="mode-selector-grid">
              {diaryModes.map((m) => {
                const Icon = m.icon;
                const isSelected = diaryMode === m.id;
                return (
                  <button
                    type="button"
                    key={m.id}
                    className={`mode-pill-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => setDiaryMode(m.id)}
                  >
                    <Icon size={16} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }} />
                    <span className="mode-pill-title">{m.title}</span>
                    <span className="mode-pill-desc">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email */}
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

          {/* Password */}
          <div className="form-group">
            <label className="form-label">
              <span>{t('passwordMin6')}</span>
              <Lock size={13} />
            </label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder={t('strongPasswordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label">
              <span>{t('confirmPassword')}</span>
              {confirmPassword && password === confirmPassword && (
                <CheckCircle2 size={13} style={{ color: 'var(--accent-emerald)' }} />
              )}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder={t('reenterPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <div className="spinner-sm" />
                  <span>{t('creatingAccount')}</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>{t('registerAndOpen')}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Switch to Login */}
        <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>{t('alreadyHaveAccount')}</span>{' '}
          <button
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToLogin}
          >
            {t('signInHere')}
          </button>
        </div>

        {/* Security badge footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', color: 'var(--text-dim)', fontSize: '0.7rem' }}>
          <ShieldCheck size={14} style={{ color: 'var(--accent-emerald)' }} />
          <span>{t('passwordsEncryptedNotice')}</span>
        </div>
      </div>
    </div>
  );
}

