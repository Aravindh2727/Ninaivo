import React, { useState } from 'react';
import {
  PlusCircle,
  Send,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Image as ImageIcon,
  X,
  UploadCloud,
  Camera,
  Tag,
  Sparkles,
  Tag as TagIcon,
  Languages,
  Layers
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { uploadMultipleDiaryPhotos } from '../services/cloudinaryService';
import { detectLanguage } from '../services/translationService';
import CustomCategoryModal from '../components/CustomCategoryModal';
import VoiceRecorder from '../components/VoiceRecorder';
import AudioAttachmentPlayer from '../components/AudioAttachmentPlayer';
import { getCategoryDisplayName } from '../utils/categoryTranslations';

export default function AddEntryView({ onDone, showToast }) {
  const { categories, addEntry, currentWorkspace, workspaces } = useWorkspace();
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(currentWorkspace?.id || workspaces?.[0]?.id);
  const selectedWorkspace = (workspaces || []).find(w => w.id === selectedWorkspaceId) || currentWorkspace;

  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  const defaultTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  // Form State
  const [title, setTitle] = useState('');
  const [entryType, setEntryType] = useState(categories[0]?.name || 'Daily Activity');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [description, setDescription] = useState('');
  const [hasAmount, setHasAmount] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountType, setAmountType] = useState('expense');
  const [location, setLocation] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);

  const currencySymbol = currentWorkspace?.settings?.currency || '₹';

  const photoAttachments = attachments.filter(a => a.type !== 'audio');
  const audioAttachments = attachments.filter(a => a.type === 'audio');

  const handleAddAudioAttachment = (newAudio) => {
    setAttachments(prev => [...prev, newAudio]);
  };

  const handleUpdateAudioTranscript = (audioId, newTranscript) => {
    setAttachments(prev => prev.map(a => {
      if (a.id === audioId) {
        return {
          ...a,
          transcript: {
            ...(a.transcript || {}),
            text: newTranscript,
            status: newTranscript ? 'completed' : 'manual'
          }
        };
      }
      return a;
    }));
  };

  const handlePhotoFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgressText(`Uploading ${files.length} photo(s)...`);
    try {
      const uploaded = await uploadMultipleDiaryPhotos(files, ({ current, total, fileName }) => {
        setUploadProgressText(`Uploading ${current} of ${total}: ${fileName}`);
      });
      setAttachments(prev => [...prev, ...uploaded]);
      showToast(`Attached ${uploaded.length} photo(s)!`);
    } catch (err) {
      alert('Photo upload failed: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgressText('');
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (attId) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter an entry title.');
      return;
    }

    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    setLoading(true);
    try {
      const autoDetected = detectLanguage(`${title} ${description}`.trim());
      const finalSourceLang = sourceLanguage === 'auto' ? autoDetected : sourceLanguage;

      const newEntryData = {
        title: title.trim(),
        entryType,
        date,
        time,
        description: description.trim(),
        sourceLanguage: finalSourceLang,
        detectedLanguage: autoDetected,
        amount: hasAmount && amount !== '' ? parseFloat(amount) : null,
        amountType: hasAmount ? amountType : null,
        currency: currencySymbol,
        location: location.trim(),
        tags: parsedTags,
        attachments
      };

      await addEntry(newEntryData, selectedWorkspaceId);
      showToast('Diary note published successfully!');
      onDone();
    } catch (err) {
      alert('Failed to publish entry: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-fade">
      <div className="card compact-form-card" style={{ marginBottom: '14px' }}>
        <div className="card-header" style={{ marginBottom: '10px' }}>
          <div>
            <span className="card-subtitle" style={{ fontSize: '0.68rem' }}>{currentWorkspace?.name}</span>
            <h2 className="card-title" style={{ marginTop: '2px', fontSize: '1rem' }}>
              <PlusCircle size={16} style={{ color: 'var(--primary)' }} />
              {t('newDiaryEntry')}
            </h2>
          </div>
          <span className="tag-pill" style={{ textTransform: 'capitalize', fontSize: '0.66rem', padding: '2px 7px' }}>
            {currentWorkspace?.type}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 0. Destination Workspace Selector */}
          <div className="form-group compact-form-group" style={{ background: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label compact-form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                <Layers size={12} style={{ color: 'var(--primary)' }} />
                <span>{t('destinationWorkspace')}</span>
              </label>
              <span className="tag-pill" style={{ fontSize: '0.62rem', padding: '1px 6px', textTransform: 'capitalize' }}>
                {selectedWorkspace?.type === 'personal' ? t('modePersonal') : (selectedWorkspace?.type === 'family' ? t('modeFamily') : t('modeBusiness'))}
              </span>
            </div>
            <select
              className="form-select compact-input"
              style={{ height: '34px', fontSize: '0.78rem', fontWeight: 500, width: '100%', boxSizing: 'border-box' }}
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            >
              {(workspaces || []).map((ws) => {
                const isShared = ws.ownerUid && ws.ownerUid !== currentUser?.uid && ws.type !== 'personal';
                const typeLabel = ws.type === 'personal' ? t('modePersonal') : (ws.type === 'family' ? t('modeFamily') : t('modeBusiness'));
                const label = isShared
                  ? `${ws.name} (${typeLabel} • ${t('sharedDiaryBadge')})`
                  : `${ws.name} (${typeLabel})`;
                return (
                  <option key={ws.id} value={ws.id}>
                    {label}
                  </option>
                );
              })}
            </select>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-dim)', marginTop: '3px', display: 'block' }}>
              {selectedWorkspace?.type === 'personal'
                ? t('personalDesc')
                : (selectedWorkspace?.type === 'family' ? t('familyDesc') : t('businessDesc'))}
            </span>
          </div>

          {/* 1. Category / Entry Type Selector */}
          <div className="form-group compact-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label compact-form-label" style={{ marginBottom: 0 }}>{t('entryType')}</label>
              <button
                type="button"
                className="auth-switch-link"
                style={{ fontSize: '0.70rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                onClick={() => setShowCatModal(true)}
              >
                <TagIcon size={11} />
                {t('manageTypes')}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', padding: '4px 0' }}>
              {categories.slice(0, 8).map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  className={`category-pill ${entryType === cat.name ? 'selected' : ''}`}
                  onClick={() => setEntryType(cat.name)}
                  style={{ whiteSpace: 'nowrap', padding: '4px 8px', fontSize: '0.70rem' }}
                >
                  {getCategoryDisplayName(cat.name, language)}
                </button>
              ))}
            </div>

            {/* Dropdown for remaining categories if many */}
            {categories.length > 8 && (
              <select
                className="form-select compact-input"
                style={{ marginTop: '4px', height: '32px', fontSize: '0.76rem' }}
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {getCategoryDisplayName(c.name, language)} {c.isCustom ? '(Custom)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Title & Language Detection */}
          <div className="form-group compact-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label compact-form-label" style={{ marginBottom: 0 }}>{t('entryTitle')} *</label>
              {(() => {
                const autoDetected = detectLanguage(`${title} ${description}`.trim());
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.66rem', color: 'var(--text-dim)' }}>
                    <Languages size={10} style={{ color: 'var(--primary)' }} />
                    <span>{t('sourceLanguage')}:</span>
                    <select
                      className="form-select"
                      style={{ padding: '0 4px', height: '22px', fontSize: '0.66rem', width: 'auto', display: 'inline-block' }}
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      title={t('languageOverrideHelp')}
                    >
                      <option value="auto">
                        {t('autoDetect')} ({autoDetected === 'ta' ? t('tamil') : t('english')})
                      </option>
                      <option value="ta">{t('tamil')}</option>
                      <option value="en">{t('english')}</option>
                    </select>
                  </div>
                );
              })()}
            </div>
            <input
              type="text"
              className="form-input compact-input"
              placeholder={t('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* 3. Date & Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="form-group compact-form-group">
              <label className="form-label compact-form-label">
                <span>{t('dateLabel')}</span>
                <Calendar size={11} />
              </label>
              <input
                type="date"
                className="form-input compact-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group compact-form-group">
              <label className="form-label compact-form-label">
                <span>{t('timeLabel')}</span>
                <Clock size={11} />
              </label>
              <input
                type="time"
                className="form-input compact-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 4. Description */}
          <div className="form-group compact-form-group">
            <label className="form-label compact-form-label">{t('description')}</label>
            <textarea
              className="form-textarea compact-textarea"
              placeholder={t('descPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* 5. Optional Financial Details */}
          <div className="form-group compact-form-group" style={{ background: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={hasAmount}
                onChange={(e) => setHasAmount(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <DollarSign size={13} style={{ color: 'var(--accent-emerald)' }} />
                {t('addFinancial')}
              </span>
            </label>

            {hasAmount && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '6px', marginTop: '6px' }}>
                <select
                  className="form-select compact-input"
                  value={amountType}
                  onChange={(e) => setAmountType(e.target.value)}
                >
                  <option value="expense">{t('expense')} (-)</option>
                  <option value="income">{t('income')} (+)</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  className="form-input compact-input"
                  placeholder={`Amount in ${currencySymbol}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required={hasAmount}
                />
              </div>
            )}
          </div>

          {/* 6. Location & Tags Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="form-group compact-form-group">
              <label className="form-label compact-form-label">
                <span>{t('location')}</span>
                <MapPin size={11} />
              </label>
              <input
                type="text"
                className="form-input compact-input"
                placeholder={t('locationPlaceholder')}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="form-group compact-form-group">
              <label className="form-label compact-form-label">
                <span>{t('tags')}</span>
                <Tag size={11} />
              </label>
              <input
                type="text"
                className="form-input compact-input"
                placeholder={t('tagsPlaceholder')}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </div>

          {/* 7. Multiple Cloudinary Photo Uploads */}
          <div className="form-group compact-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label compact-form-label" style={{ marginBottom: 0 }}>
                <span>{t('photos')} ({photoAttachments.length})</span>
                <ImageIcon size={11} />
              </label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <label
                  htmlFor="new-entry-photo-input"
                  className="tag-pill"
                  title={uploading ? t('uploadingPhotos') : t('uploadPhotos')}
                  aria-label={uploading ? t('uploadingPhotos') : t('uploadPhotos')}
                  style={{
                    cursor: uploading ? 'wait' : 'pointer',
                    color: 'var(--primary)',
                    borderColor: 'var(--primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    padding: 0,
                    borderRadius: '8px',
                    background: 'var(--chip-green-bg)',
                    boxSizing: 'border-box'
                  }}
                >
                  <UploadCloud size={13} />
                </label>
                <input
                  id="new-entry-photo-input"
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoFiles}
                  disabled={uploading}
                />

                <label
                  htmlFor="new-entry-camera-input"
                  className="tag-pill"
                  title={t('takePhoto')}
                  aria-label={t('takePhoto')}
                  style={{
                    cursor: uploading ? 'wait' : 'pointer',
                    color: 'var(--primary)',
                    borderColor: 'var(--primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    padding: 0,
                    borderRadius: '8px',
                    background: 'var(--chip-green-bg)',
                    boxSizing: 'border-box'
                  }}
                >
                  <Camera size={13} />
                </label>
                <input
                  id="new-entry-camera-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handlePhotoFiles}
                  disabled={uploading}
                />
              </div>
            </div>

            {uploadProgressText && (
              <span style={{ fontSize: '0.68rem', color: 'var(--primary)', display: 'block', marginTop: '3px' }}>
                {uploadProgressText}
              </span>
            )}

            {photoAttachments.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 0' }}>
                {photoAttachments.map((att) => (
                  <div key={att.id} style={{ position: 'relative', width: '52px', height: '52px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <img src={att.url} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', color: '#fff', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 8. Voice Diary Recording & Transcription */}
          <div className="form-group compact-form-group">
            <label className="form-label compact-form-label">
              <span>{t('voiceNotes') || 'Voice Notes'} ({audioAttachments.length})</span>
            </label>
            <VoiceRecorder onAddAudio={handleAddAudioAttachment} showToast={showToast} />

            {/* List of attached voice notes */}
            {audioAttachments.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                {audioAttachments.map((audioAtt) => (
                  <AudioAttachmentPlayer
                    key={audioAtt.id}
                    attachment={audioAtt}
                    onDelete={handleRemoveAttachment}
                    onUpdateTranscript={handleUpdateAudioTranscript}
                    canEdit={true}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: '12px' }}>
            <button
              type="submit"
              className="btn-primary compact-btn"
              disabled={loading || uploading}
              style={{ width: '100%', opacity: loading || uploading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <div className="spinner-sm" />
                  <span>{t('publishingEntry')}</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>{t('saveEntry')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Category Manager Modal */}
      <CustomCategoryModal
        isOpen={showCatModal}
        onClose={() => setShowCatModal(false)}
        showToast={showToast}
      />
    </div>
  );
}
