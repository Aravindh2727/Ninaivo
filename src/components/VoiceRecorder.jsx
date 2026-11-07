import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Pause, 
  Play, 
  RotateCcw, 
  Trash2, 
  UploadCloud, 
  Volume2, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Globe,
  Radio
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { uploadAudioRecording } from '../services/cloudinaryService';
import { 
  TRANSCRIPTION_LANGUAGES, 
  isSpeechRecognitionSupported, 
  createSpeechRecognizer 
} from '../services/transcriptionService';

export default function VoiceRecorder({ onAddAudio, showToast }) {
  const { t } = useLanguage();

  // Recording State: 'idle' | 'recording' | 'paused' | 'stopped'
  const [recordState, setRecordState] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcriptionLang, setTranscriptionLang] = useState('ta-IN'); // Default Tamil
  const [transcriptText, setTranscriptText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognizerRef = useRef(null);
  const streamRef = useRef(null);

  // Clean up object URLs and active mic streams on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognizerRef.current) recognizerRef.current.abort();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // 1. Start Recording
  const handleStartRecording = async () => {
    setErrorMessage(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setTranscriptText('');

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setErrorMessage(t('browserNotSupported') || 'Your browser does not support audio recording.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select supported MIME type
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          options = { mimeType: 'audio/ogg' };
        } else {
          options = {};
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          setAudioBlob(blob);
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        } else {
          setErrorMessage('Recording is empty. Please try speaking into the microphone.');
        }

        // Stop mic hardware track
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      setRecordState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Start Web Speech API transcription session concurrently if supported
      if (isSpeechRecognitionSupported()) {
        try {
          recognizerRef.current = createSpeechRecognizer({
            language: transcriptionLang,
            onTranscript: (liveText) => {
              setTranscriptText(liveText);
            },
            onError: (err) => {
              console.warn('Speech recognition warning:', err.message);
            }
          });
          recognizerRef.current.start();
        } catch (e) {
          console.warn('Could not start live speech recognition:', e);
        }
      }
    } catch (err) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(t('micPermissionDenied') || 'Microphone access denied. Please grant permission in your browser.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage(t('noMicDetected') || 'No microphone detected on your device.');
      } else {
        setErrorMessage(err.message || 'Failed to start recording.');
      }
    }
  };

  // 2. Pause Recording
  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && recordState === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognizerRef.current) recognizerRef.current.stop();
      setRecordState('paused');
    }
  };

  // 3. Resume Recording
  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && recordState === 'paused') {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      if (recognizerRef.current) recognizerRef.current.start();
      setRecordState('recording');
    }
  };

  // 4. Stop Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && (recordState === 'recording' || recordState === 'paused')) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognizerRef.current) recognizerRef.current.stop();
      setRecordState('stopped');
    }
  };

  // 5. Delete / Reset Recording
  const handleDeleteRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognizerRef.current) recognizerRef.current.abort();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setRecordState('idle');
    setDuration(0);
    setTranscriptText('');
    setErrorMessage(null);
  };

  // 6. Upload & Attach Audio
  const handleAttachVoiceNote = async () => {
    if (!audioBlob) {
      setErrorMessage('No valid recording to attach.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);
    setUploadProgress(10);

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const uploadRes = await uploadAudioRecording(
        audioBlob, 
        { 
          fileName: `voice-note-${dateStr}-${Date.now()}.webm`,
          duration 
        }, 
        ({ progress }) => {
          setUploadProgress(progress);
        }
      );

      const attachmentRecord = {
        id: `att-audio-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: 'audio',
        url: uploadRes.url,
        publicId: uploadRes.publicId,
        format: uploadRes.format || 'webm',
        mimeType: uploadRes.mimeType || 'audio/webm',
        duration: uploadRes.duration || duration || 0,
        fileSize: uploadRes.fileSize || audioBlob.size,
        name: `Voice Note (${formatTime(duration)})`,
        uploadedAt: new Date().toISOString(),
        provider: uploadRes.provider,
        transcript: {
          text: transcriptText.trim(),
          language: transcriptionLang,
          status: transcriptText.trim() ? 'completed' : 'manual'
        }
      };

      onAddAudio(attachmentRecord);
      showToast && showToast(t('voiceNoteAttached') || 'Voice note attached successfully!');
      handleDeleteRecording(); // reset for next recording
    } catch (err) {
      console.error('Audio upload error:', err);
      setErrorMessage('Audio upload failed: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card-subtle)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '8px 10px',
      marginBottom: '10px'
    }}>
      {/* Header & Language Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: recordState === 'recording' ? 'var(--chip-green-bg)' : 'var(--bg-card-subtle)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Mic size={13} />
          </div>
          <h4 style={{ fontSize: '0.80rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            {t('voiceRecordingTitle') || 'Voice Diary Recording'}
          </h4>
        </div>

        {/* Language Pill Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Globe size={11} style={{ color: 'var(--text-dim)' }} />
          <select
            className="form-input compact-input"
            style={{ fontSize: '0.68rem', padding: '1px 5px', height: '24px', width: 'auto' }}
            value={transcriptionLang}
            onChange={(e) => {
              setTranscriptionLang(e.target.value);
              if (recognizerRef.current) recognizerRef.current.setLanguage(e.target.value);
            }}
            disabled={recordState === 'recording'}
            title="Transcription Language"
          >
            {TRANSCRIPTION_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error / Alert notice */}
      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          padding: '8px 10px',
          fontSize: '0.74rem',
          color: 'var(--accent-rose)',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Recording State Banner with Green Indicator */}
      {recordState === 'recording' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--chip-green-bg)',
          border: '1px solid var(--primary)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'var(--primary)',
              boxShadow: '0 0 10px var(--primary)',
              animation: 'pulse 1.2s infinite'
            }} />
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--primary)' }}>
              {t('recordingInProgress') || 'Recording...'}
            </span>
          </div>
          <span style={{ fontSize: '0.94rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-main)' }}>
            {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Paused State Banner */}
      {recordState === 'paused' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
            {t('recordingPaused') || 'Recording Paused'}
          </span>
          <span style={{ fontSize: '0.94rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-main)' }}>
            {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Stopped / Preview State */}
      {recordState === 'stopped' && audioUrl && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px'
          }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Volume2 size={13} />
              <span>{t('previewRecording') || 'Preview Recording'} ({formatTime(duration)})</span>
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
              ✓ Ready to attach
            </span>
          </div>
          <audio 
            src={audioUrl} 
            controls 
            style={{ width: '100%', height: '36px', outline: 'none' }} 
          />
        </div>
      )}

      {/* Transcription Preview & Edit Box */}
      {(recordState === 'recording' || recordState === 'paused' || recordState === 'stopped') && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={12} />
              <span>{t('transcript') || 'Transcript'} ({transcriptionLang === 'ta-IN' ? 'தமிழ்' : 'English'})</span>
            </label>
            {!isSpeechRecognitionSupported() && (
              <span style={{ fontSize: '0.68rem', color: 'var(--accent-amber)' }}>
                {t('manualTranscriptOnly') || 'Manual transcript mode'}
              </span>
            )}
          </div>
          <textarea
            className="form-input"
            rows={3}
            placeholder={
              isSpeechRecognitionSupported() 
                ? (t('speechWillAppearHere') || 'Spoken thoughts will transcribe automatically here. You can edit this text at any time.')
                : (t('typeTranscriptHere') || 'Type your notes or transcript here...')
            }
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            style={{ fontSize: '0.8rem', lineHeight: 1.4 }}
          />
        </div>
      )}

      {/* Primary Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {recordState === 'idle' && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleStartRecording}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '0.8rem',
              padding: '8px 14px' 
            }}
          >
            <Mic size={15} />
            <span>{t('startRecording') || 'Start Recording'}</span>
          </button>
        )}

        {recordState === 'recording' && (
          <>
            <button
              type="button"
              className="filter-chip"
              onClick={handlePauseRecording}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
            >
              <Pause size={14} />
              <span>{t('pause') || 'Pause'}</span>
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleStopRecording}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '0.78rem', 
                background: 'var(--accent-rose)',
                borderColor: 'var(--accent-rose)'
              }}
            >
              <Square size={14} />
              <span>{t('stopRecording') || 'Stop'}</span>
            </button>
          </>
        )}

        {recordState === 'paused' && (
          <>
            <button
              type="button"
              className="filter-chip"
              onClick={handleResumeRecording}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
            >
              <Play size={14} />
              <span>{t('resume') || 'Resume'}</span>
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleStopRecording}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '0.78rem',
                background: 'var(--accent-rose)',
                borderColor: 'var(--accent-rose)'
              }}
            >
              <Square size={14} />
              <span>{t('stopRecording') || 'Stop'}</span>
            </button>
          </>
        )}

        {recordState === 'stopped' && (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={handleAttachVoiceNote}
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            >
              {uploading ? (
                <>
                  <div className="spinner-sm" />
                  <span>{uploadProgress > 0 ? `Uploading (${uploadProgress}%)...` : 'Uploading Audio...'}</span>
                </>
              ) : (
                <>
                  <UploadCloud size={15} />
                  <span>{t('attachVoiceNote') || 'Attach Voice Note'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="filter-chip"
              onClick={handleStartRecording}
              disabled={uploading}
              title="Re-record"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem' }}
            >
              <RotateCcw size={13} />
              <span>{t('reRecord') || 'Re-record'}</span>
            </button>

            <button
              type="button"
              className="filter-chip"
              onClick={handleDeleteRecording}
              disabled={uploading}
              title="Discard recording"
              style={{ color: 'var(--accent-rose)', padding: '6px 8px' }}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

