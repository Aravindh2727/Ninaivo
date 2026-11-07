import React, { useState, useRef } from 'react';
import {
  User,
  Mail,
  Camera,
  Lock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ShieldCheck,
  Trash2,
  LogOut,
  Sparkles,
  Heart,
  Briefcase,
  Phone,
  FileText,
  UploadCloud,
  Eye,
  EyeOff,
  Clock,
  Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { uploadProfilePhoto } from '../services/cloudinaryService';
import { formatAuthError } from '../firebase/authService';
import NinaivoLogo from '../components/NinaivoLogo';

export default function ProfileView({ onBack, onTriggerLogout, onTriggerDeleteAccount, showToast }) {
  const { t } = useLanguage();
  const {
    currentUser,
    userProfile,
    updateUserProfileData,
    updateUserEmail,
    updateUserPassword
  } = useAuth();

  const fileInputRef = useRef(null);

  // Profile fields state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || currentUser?.displayName || 'Diary Creator');
  const [diaryMode, setDiaryMode] = useState(userProfile?.diaryMode || 'personal');
  const [bio, setBio] = useState(userProfile?.bio || 'Organizing my thoughts, milestones, and reflections.');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || currentUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  // Email update state
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // General profile save state
  const [profileSaving, setProfileSaving] = useState(false);

  // Handle Photo Upload using Cloudinary service
  const handlePhotoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const uploadResult = await uploadProfilePhoto(file);
      setPhotoURL(uploadResult.url);
      await updateUserProfileData({ photoURL: uploadResult.url });
      showToast(uploadResult.notice || 'Profile photo uploaded successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Direct Photo URL apply
  const handleApplyCustomUrl = async (e) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    try {
      setPhotoURL(customUrlInput.trim());
      await updateUserProfileData({ photoURL: customUrlInput.trim() });
      setShowUrlInput(false);
      setCustomUrlInput('');
      showToast('Profile photo URL updated!');
    } catch (err) {
      showToast('Could not update photo URL: ' + err.message);
    }
  };

  // Save General Profile Info
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await updateUserProfileData({
        displayName: displayName.trim(),
        diaryMode,
        bio: bio.trim(),
        phone: phone.trim(),
        photoURL
      });
      showToast('Profile information saved successfully!');
    } catch (err) {
      showToast('Error saving profile: ' + formatAuthError(err));
    } finally {
      setProfileSaving(false);
    }
  };

  // Change Email
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    if (!newEmail.trim()) {
      setEmailError('Please enter a new email address.');
      return;
    }
    if (!emailCurrentPassword) {
      setEmailError('Current password is required to verify email update.');
      return;
    }

    setEmailLoading(true);
    try {
      await updateUserEmail(newEmail.trim(), emailCurrentPassword);
      setEmailSuccess('Email updated! Verification message sent if required.');
      setNewEmail('');
      setEmailCurrentPassword('');
      showToast('Email address updated!');
    } catch (err) {
      setEmailError(formatAuthError(err));
    } finally {
      setEmailLoading(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast('Password changed successfully!');
    } catch (err) {
      setPasswordError(formatAuthError(err));
    } finally {
      setPasswordLoading(false);
    }
  };

  // Creation & last login dates
  const creationTime = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    : 'Recently';

  const lastSignInTime = currentUser?.metadata?.lastSignInTime
    ? new Date(currentUser.metadata.lastSignInTime).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    : 'Active now';

  return (
    <div className="screen-fade" style={{ paddingBottom: '30px' }}>
      {/* 1. Profile Avatar Header Card */}
      <div className="card compact-form-card" style={{ textAlign: 'center', padding: '14px 12px', marginBottom: '10px' }}>
        <div className="profile-avatar-container">
          <div className="profile-avatar-wrapper" style={{ width: '56px', height: '56px', margin: '0 auto', position: 'relative' }}>
            <img
              src={photoURL}
              alt={displayName}
              className="profile-avatar-img"
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
              onError={() => setPhotoURL('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80')}
            />
            <label
              htmlFor="avatar-file-input"
              className="avatar-upload-overlay"
              style={{ width: '20px', height: '20px', bottom: 0, right: 0 }}
              title="Upload profile photo via Cloudinary"
            >
              {uploadingPhoto ? <div className="spinner-sm" /> : <Camera size={11} />}
            </label>
            <input
              id="avatar-file-input"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoFileChange}
              disabled={uploadingPhoto}
            />
          </div>

          <div style={{ marginTop: '6px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
            <button
              type="button"
              className="tag-pill"
              style={{ cursor: 'pointer', background: 'var(--bg-card)', color: 'var(--primary)', borderColor: 'var(--primary)', fontSize: '0.66rem', padding: '1px 6px' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              <UploadCloud size={10} style={{ display: 'inline', marginRight: '3px' }} />
              {uploadingPhoto ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              className="tag-pill"
              style={{ cursor: 'pointer', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.66rem', padding: '1px 6px' }}
              onClick={() => setShowUrlInput(!showUrlInput)}
            >
              URL
            </button>
          </div>

          {/* Optional Direct URL Input */}
          {showUrlInput && (
            <form onSubmit={handleApplyCustomUrl} style={{ width: '100%', maxWidth: '280px', margin: '6px auto 0 auto', display: 'flex', gap: '4px' }}>
              <input
                type="url"
                className="form-input compact-input"
                style={{ height: '28px', fontSize: '0.70rem' }}
                placeholder="https://... image link"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
              />
              <button type="submit" className="filter-chip active" style={{ padding: '0 8px', fontSize: '0.68rem' }}>
                Set
              </button>
            </form>
          )}
        </div>

        <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: '4px 0 1px 0' }}>
          {displayName}
        </h2>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
          {currentUser?.email}
        </span>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="badge badge-progress" style={{ textTransform: 'capitalize', fontSize: '0.62rem', padding: '1px 5px' }}>
            {diaryMode === 'personal' && <Sparkles size={10} />}
            {diaryMode === 'family' && <Heart size={10} />}
            {diaryMode === 'business' && <Briefcase size={10} />}
            {diaryMode}
          </span>
          <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
            <ShieldCheck size={10} /> Authenticated
          </span>
        </div>
      </div>

      {/* 2. Personal Information Card */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <div className="card-header" style={{ marginBottom: '8px' }}>
          <div>
            <span className="card-subtitle" style={{ fontSize: '0.66rem' }}>{t('identityPurpose')}</span>
            <h3 className="card-title" style={{ marginTop: '1px', fontSize: '0.90rem' }}>
              <User size={15} style={{ color: 'var(--primary)' }} />
              {t('personalInfo')}
            </h3>
          </div>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div className="form-group compact-form-group">
            <label className="form-label compact-form-label">{t('fullName')}</label>
            <input
              type="text"
              className="form-input compact-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="form-group compact-form-group">
            <label className="form-label compact-form-label">{t('primaryDiaryPurpose')}</label>
            <div className="mode-selector-grid">
              <button
                type="button"
                className={`mode-pill-btn ${diaryMode === 'personal' ? 'active' : ''}`}
                style={{ padding: '6px 8px' }}
                onClick={() => setDiaryMode('personal')}
              >
                <Sparkles size={13} style={{ color: diaryMode === 'personal' ? 'var(--primary)' : 'var(--text-dim)' }} />
                <span className="mode-pill-title" style={{ fontSize: '0.74rem' }}>{t('modePersonal')}</span>
              </button>
              <button
                type="button"
                className={`mode-pill-btn ${diaryMode === 'family' ? 'active' : ''}`}
                style={{ padding: '6px 8px' }}
                onClick={() => setDiaryMode('family')}
              >
                <Heart size={13} style={{ color: diaryMode === 'family' ? 'var(--accent-rose)' : 'var(--text-dim)' }} />
                <span className="mode-pill-title" style={{ fontSize: '0.74rem' }}>{t('modeFamily')}</span>
              </button>
              <button
                type="button"
                className={`mode-pill-btn ${diaryMode === 'business' ? 'active' : ''}`}
                style={{ padding: '6px 8px' }}
                onClick={() => setDiaryMode('business')}
              >
                <Briefcase size={13} style={{ color: diaryMode === 'business' ? 'var(--accent-cyan)' : 'var(--text-dim)' }} />
                <span className="mode-pill-title" style={{ fontSize: '0.74rem' }}>{t('modeBusiness')}</span>
              </button>
            </div>
          </div>

          <div className="form-group compact-form-group">
            <label className="form-label compact-form-label">
              <span>{t('bioStatement')}</span>
              <FileText size={11} />
            </label>
            <textarea
              className="form-textarea compact-textarea"
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('bioPlaceholder')}
            />
          </div>

          <div className="form-group compact-form-group">
            <label className="form-label compact-form-label">
              <span>{t('phoneOptional')}</span>
              <Phone size={11} />
            </label>
            <input
              type="tel"
              className="form-input compact-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div style={{ marginTop: '10px' }}>
            <button
              type="submit"
              className="btn-primary compact-btn"
              disabled={profileSaving}
              style={{ width: '100%', opacity: profileSaving ? 0.7 : 1 }}
            >
              {profileSaving ? (
                <>
                  <div className="spinner-sm" />
                  <span>{t('savingChanges')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>{t('savePersonalDetails')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Account Details & Metadata Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Clock size={16} style={{ color: 'var(--accent-cyan)' }} />
            {t('accountDetailsMeta')}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('accountUid')}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-main)' }}>
              {currentUser?.uid ? `${currentUser.uid.slice(0, 16)}...` : 'demo-user-id'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('memberSince')}</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{creationTime}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('lastActiveSignIn')}</span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{lastSignInTime}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('securityProvider')}</span>
            <span className="tag-pill" style={{ color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              Firebase Auth (Encrypted)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Update Email Address Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-subtitle">{t('credentialUpdates')}</span>
            <h3 className="card-title" style={{ marginTop: '2px' }}>
              <Mail size={16} style={{ color: 'var(--primary)' }} />
              {t('updateEmailAddress')}
            </h3>
          </div>
        </div>

        {emailSuccess && (
          <div className="auth-alert auth-alert-success">
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span>{emailSuccess}</span>
          </div>
        )}

        {emailError && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{emailError}</span>
          </div>
        )}

        <form onSubmit={handleUpdateEmail}>
          <div className="form-group">
            <label className="form-label">{t('newEmailAddress')}</label>
            <input
              type="email"
              className="form-input"
              placeholder="new-address@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>{t('currentPasswordVerification')}</span>
              <Lock size={12} />
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter current password"
              value={emailCurrentPassword}
              onChange={(e) => setEmailCurrentPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-secondary"
            disabled={emailLoading}
            style={{ marginTop: '6px' }}
          >
            {emailLoading ? <div className="spinner-sm" /> : <Mail size={15} />}
            <span>{t('updateEmailAddress')}</span>
          </button>
        </form>
      </div>

      {/* 5. Change Password Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-subtitle">{t('securityKey')}</span>
            <h3 className="card-title" style={{ marginTop: '2px' }}>
              <Key size={16} style={{ color: 'var(--accent-amber)' }} />
              {t('changePassword')}
            </h3>
          </div>
        </div>

        {passwordSuccess && (
          <div className="auth-alert auth-alert-success">
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label className="form-label">{t('currentPasswordVerification')}</label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder={t('enterPasswordToConfirm')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>{t('newPassword')}</label>
              <button
                type="button"
                className="auth-switch-link"
                style={{ fontSize: '0.7rem', textDecoration: 'none' }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              style={{ marginTop: '6px' }}
              placeholder={t('newPassword')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('confirmNewPassword')}</label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder={t('confirmNewPassword')}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-secondary"
            disabled={passwordLoading}
            style={{ marginTop: '6px' }}
          >
            {passwordLoading ? <div className="spinner-sm" /> : <Lock size={15} />}
            <span>{t('changePassword')}</span>
          </button>
        </form>
      </div>

      {/* 6. Account Actions & Danger Zone Card */}
      <div className="card" style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}>
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--accent-rose)' }}>
            <ShieldCheck size={16} />
            Session & Account Control
          </span>
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.4' }}>
          Safely sign out of your authenticated device session or permanently delete your account.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onTriggerLogout}
          >
            <LogOut size={15} style={{ color: 'var(--text-muted)' }} />
            <span>{t('signOutConfirmTitle') || 'Sign Out of Ninaivo'}</span>
          </button>

          <button
            type="button"
            className="btn-danger"
            onClick={onTriggerDeleteAccount}
          >
            <Trash2 size={15} />
            <span>{t('deleteAccountTitle') || 'Delete Account & Data'}</span>
          </button>
        </div>
      </div>

      {/* Official Ninaivo Brand Badge */}
      <div style={{ textAlign: 'center', padding: '16px 0 10px 0', opacity: 0.85 }}>
        <NinaivoLogo 
          iconSize={26} 
          showText={true} 
          showTagline={true} 
          layout="vertical" 
          taglineText={t('tagline') || 'Your Life. Your Memories. Your Story.'}
        />
      </div>
    </div>
  );
}

