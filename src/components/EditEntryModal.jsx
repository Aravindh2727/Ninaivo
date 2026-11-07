import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Calendar, 
  Clock, 
  MapPin, 
  DollarSign, 
  Image as ImageIcon, 
  Trash2, 
  UploadCloud, 
  Tag,
  Languages 
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { uploadMultipleDiaryPhotos } from '../services/cloudinaryService';
import { detectLanguage } from '../services/translationService';
import VoiceRecorder from './VoiceRecorder';
import AudioAttachmentPlayer from './AudioAttachmentPlayer';
import { getCategoryDisplayName } from '../utils/categoryTranslations';

export default function EditEntryModal({ entry, isOpen, onClose, onSave, showToast }) {
  const { categories, currentWorkspace } = useWorkspace();
  const { t, language } = useLanguage();

  const [title, setTitle] = useState('');
  const [entryType, setEntryType] = useState('Daily Activity');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [hasAmount, setHasAmount] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountType, setAmountType] = useState('expense');
  const [location, setLocation] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entry) {
      const origTitle = typeof entry.title === 'object' ? (entry.title.original || '') : (entry.title || '');
      const origDesc = typeof entry.description === 'object' ? (entry.description.original || '') : (entry.description || '');

      setTitle(origTitle);
      setEntryType(entry.entryType || 'Daily Activity');
      setDate(entry.date || new Date().toISOString().split('T')[0]);
      setTime(entry.time || '12:00');
      setDescription(origDesc);
      setSourceLanguage(entry.sourceLanguage || 'auto');
      setHasAmount(Boolean(entry.amount !== null && entry.amount !== undefined && entry.amount !== ''));
      setAmount(entry.amount ? String(entry.amount) : '');
      setAmountType(entry.amountType || 'expense');
      setLocation(entry.location || '');
      setTagsInput(Array.isArray(entry.tags) ? entry.tags.join(', ') : '');
      setAttachments(entry.attachments || []);
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await uploadMultipleDiaryPhotos(files);
      setAttachments(prev => [...prev, ...uploaded]);
      showToast(`Uploaded ${uploaded.length} photo(s).`);
    } catch (err) {
      alert('Photo upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = (attId) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const photoAttachments = attachments.filter(a => a.type !== 'audio');
  const audioAttachments = attachments.filter(a => a.type === 'audio');

  const handleAddAudio = (newAudio) => {
    setAttachments(prev => [...prev, newAudio]);
  };

  const handleUpdateAudioTranscript = (audioId, newText) => {
    setAttachments(prev => prev.map(a => {
      if (a.id === audioId) {
        return {
          ...a,
          transcript: {
            ...(a.transcript || {}),
            text: newText,
            status: newText ? 'completed' : 'manual'
          }
        };
      }
      return a;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Title is required');
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

      const updates = {
        title: title.trim(),
        entryType,
        date,
        time,
        description: description.trim(),
        sourceLanguage: finalSourceLang,
        amount: hasAmount && amount !== '' ? parseFloat(amount) : null,
        amountType: hasAmount ? amountType : null,
        location: location.trim(),
        tags: parsedTags,
        attachments
      };
      const saved = await onSave(entry.id, updates);
      if (saved !== false) {
        showToast && showToast('Diary note updated successfully!');
        onClose();
      }
    } catch (err) {
      alert('Failed to update entry: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog compact-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', padding: '14px 16px' }}>
        <div className="modal-header compact-modal-header" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
          <h2 className="modal-title compact-modal-title" style={{ fontSize: '0.96rem' }}>{t('editDiaryEntry')}</h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="compact-action-btn"
            style={{ color: 'var(--text-dim)' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title & Language */}
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
                      className="form-select compact-input"
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Type */}
          <div className="form-group compact-form-group">
            <label className="form-label compact-form-label">{t('entryType')}</label>
            <select
              className="form-select compact-input"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {getCategoryDisplayName(c.name, language)} {c.isCustom ? '(Custom)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
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

          {/* Description */}
          <div className="form-group compact-form-group">
            <label className="form-label compact-form-label">{t('description')}</label>
            <textarea
              className="form-textarea compact-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Optional Amount */}
          <div className="form-group compact-form-group" style={{ background: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={hasAmount}
                onChange={(e) => setHasAmount(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
              />
              <span>{t('addFinancial')}</span>
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
                  placeholder="Amount in ₹"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required={hasAmount}
                />
              </div>
            )}
          </div>

          {/* Location & Tags Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="form-group compact-form-group">
              <label className="form-label compact-form-label">
                <span>{t('location')}</span>
                <MapPin size={11} />
              </label>
              <input
                type="text"
                className="form-input compact-input"
                placeholder="e.g. Farm Field / Home"
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
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </div>

          {/* Photos */}
          <div className="form-group compact-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label compact-form-label" style={{ marginBottom: 0 }}>
                <span>{t('photos')} ({photoAttachments.length})</span>
                <ImageIcon size={11} />
              </label>
              <label 
                htmlFor="edit-modal-photo-input" 
                className="tag-pill" 
                style={{ cursor: 'pointer', color: 'var(--primary)', borderColor: 'var(--primary)', fontSize: '0.68rem', padding: '2px 8px' }}
              >
                <UploadCloud size={11} style={{ display: 'inline', marginRight: '3px' }} />
                {uploading ? t('uploadingPhotos') : t('uploadPhotos')}
              </label>
              <input
                id="edit-modal-photo-input"
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
            </div>

            {photoAttachments.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 0' }}>
                {photoAttachments.map((att) => (
                  <div key={att.id} style={{ position: 'relative', width: '50px', height: '50px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <img src={att.url} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: '#fff', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice Notes */}
          <div className="form-group compact-form-group">
            <label className="form-label compact-form-label">
              <span>{t('voiceNotes') || 'Voice Notes'} ({audioAttachments.length})</span>
            </label>
            <VoiceRecorder onAddAudio={handleAddAudio} showToast={showToast} />

            {/* List of existing audio attachments */}
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

          <div className="modal-actions" style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn-secondary compact-btn" onClick={onClose} disabled={loading}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary compact-btn" disabled={loading || uploading}>
              <Check size={14} />
              <span>{t('updateEntry')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

