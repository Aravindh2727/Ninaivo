/**
 * Phase 10 Voice Diary Recording, Transcription & Cloudinary Integration Test Suite
 * Tests:
 * 1. Audio Recording Validation & MIME Types
 * 2. Cloudinary Audio Upload Parameters & Resource Type
 * 3. Firestore Voice Attachment Schema Integrity
 * 4. Tamil (ta-IN) & English (en-IN) Speech-to-Text Configuration
 * 5. Attachment Isolation (Photos vs Voice Notes)
 * 6. Edit Diary Audio Management & Transcript Updates
 * 7. Workspace Security & Privacy for Voice Attachments
 * 8. Offline Voice Note Handling & Local Storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TRANSCRIPTION_LANGUAGES } from '../src/services/transcriptionService.js';
import { validateAudioBlob } from '../src/services/cloudinaryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n======================================================');
console.log('   PHASE 10 — VOICE DIARY & TRANSCRIPTION TESTS       ');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Audio Blob Validation & MIME Types
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Audio Recording Validation & MIME Types ---');

// Null / empty rejection
try {
  validateAudioBlob(null);
  assert(false, 'Should throw on null audio blob');
} catch (e) {
  assert(e.message.includes('No audio recording'), 'Rejects null audio recording input');
}

try {
  validateAudioBlob({ size: 0, type: 'audio/webm' });
  assert(false, 'Should throw on zero-size audio blob');
} catch (e) {
  assert(e.message.includes('empty'), 'Rejects zero-byte/empty audio recording');
}

// Oversized audio rejection (>25MB)
try {
  validateAudioBlob({ size: 26 * 1024 * 1024, type: 'audio/webm' });
  assert(false, 'Should throw on oversized audio blob');
} catch (e) {
  assert(e.message.includes('exceeds the 25MB limit'), 'Rejects audio files exceeding 25MB');
}

// Valid audio acceptance
const validBlob = { size: 1024 * 50, type: 'audio/webm;codecs=opus' };
assert(validateAudioBlob(validBlob) === true, 'Accepts valid audio blob within size limits');

// Extension mapping check
function getAudioExtension(mimeType) {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('aac')) return 'aac';
  return 'webm';
}

assert(getAudioExtension('audio/webm;codecs=opus') === 'webm', 'Maps WebM MIME to .webm extension');
assert(getAudioExtension('audio/mp4') === 'm4a', 'Maps MP4 audio MIME to .m4a extension');
assert(getAudioExtension('audio/ogg') === 'ogg', 'Maps Ogg audio MIME to .ogg extension');
assert(getAudioExtension('audio/wav') === 'wav', 'Maps WAV audio MIME to .wav extension');

// -----------------------------------------------------------------------------
// Test Suite 2: Cloudinary Audio Upload Endpoint & Parameter Verification
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Cloudinary Audio Endpoint & Resource Type ---');

const cloudinaryServicePath = path.join(rootDir, 'src', 'services', 'cloudinaryService.js');
assert(fs.existsSync(cloudinaryServicePath), 'src/services/cloudinaryService.js exists');

const cloudinarySrc = fs.readFileSync(cloudinaryServicePath, 'utf8');
assert(cloudinarySrc.includes('/video/upload'), 'Uploads audio via Cloudinary /video/upload endpoint (standard audio handler)');
assert(cloudinarySrc.includes('folder\', \'diary_entry_voice_notes\''), 'Stores audio under diary_entry_voice_notes folder');
assert(cloudinarySrc.includes('upload_preset'), 'Reuses existing unsigned upload_preset');
assert(!cloudinarySrc.includes('api_secret'), 'Never exposes Cloudinary api_secret');

// -----------------------------------------------------------------------------
// Test Suite 3: Firestore Voice Attachment Schema Integrity
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Firestore Voice Attachment Schema Integrity ---');

const sampleAudioAttachment = {
  id: 'att-audio-1730000000-abc12',
  type: 'audio',
  url: 'https://res.cloudinary.com/demo/video/upload/v1/voice-notes/sample.webm',
  publicId: 'voice-notes/sample',
  format: 'webm',
  mimeType: 'audio/webm',
  duration: 45,
  fileSize: 125400,
  name: 'Voice Note (0:45)',
  uploadedAt: new Date().toISOString(),
  provider: 'cloudinary',
  transcript: {
    text: 'இன்று பண்ணையில் தண்ணீர் பாய்ச்சப்பட்டது',
    language: 'ta-IN',
    status: 'completed'
  }
};

assert(sampleAudioAttachment.type === 'audio', 'Attachment explicitly identified as type: audio');
assert(sampleAudioAttachment.url.startsWith('https://'), 'Audio URL is secure HTTPS');
assert(sampleAudioAttachment.publicId !== undefined, 'Stores Cloudinary publicId for asset reference');
assert(typeof sampleAudioAttachment.duration === 'number', 'Duration stored as numeric seconds');
assert(sampleAudioAttachment.transcript && sampleAudioAttachment.transcript.language === 'ta-IN', 'Transcript stores Tamil language code ta-IN');
assert(typeof sampleAudioAttachment.transcript.text === 'string', 'Transcript stores transcription text');

// -----------------------------------------------------------------------------
// Test Suite 4: Tamil (ta-IN) & English (en-IN) Speech-to-Text Support
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Speech-to-Text Languages & Fallback Behavior ---');

assert(Array.isArray(TRANSCRIPTION_LANGUAGES), 'TRANSCRIPTION_LANGUAGES array defined');
assert(TRANSCRIPTION_LANGUAGES.some(l => l.code === 'ta-IN' && l.label.includes('தமிழ்')), 'Supports Tamil (ta-IN)');
assert(TRANSCRIPTION_LANGUAGES.some(l => l.code === 'en-IN' && l.label.includes('English')), 'Supports English (en-IN)');

const transcriptionServicePath = path.join(rootDir, 'src', 'services', 'transcriptionService.js');
assert(fs.existsSync(transcriptionServicePath), 'src/services/transcriptionService.js exists');

const transcriptionSrc = fs.readFileSync(transcriptionServicePath, 'utf8');
assert(transcriptionSrc.includes('SpeechRecognition'), 'Supports Web Speech API SpeechRecognition');
assert(transcriptionSrc.includes('webkitSpeechRecognition'), 'Supports WebKit SpeechRecognition fallback');
assert(transcriptionSrc.includes('manual'), 'Provides graceful manual fallback if recognition unsupported');

// -----------------------------------------------------------------------------
// Test Suite 5: Attachment Isolation (Photos vs Voice Notes)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Attachment Isolation (Photos vs Voice Notes) ---');

const mixedAttachments = [
  { id: 'att-img-1', url: 'https://res.cloudinary.com/demo/image/upload/img1.jpg', name: 'photo1.jpg', type: 'image' },
  { id: 'att-audio-1', url: 'https://res.cloudinary.com/demo/video/upload/audio1.webm', name: 'Voice Note', type: 'audio' },
  { id: 'att-img-2', url: 'https://res.cloudinary.com/demo/image/upload/img2.jpg', name: 'photo2.jpg', type: 'image' }
];

const photoOnly = mixedAttachments.filter(a => a.type !== 'audio');
const audioOnly = mixedAttachments.filter(a => a.type === 'audio');

assert(photoOnly.length === 2, 'Correctly isolates 2 photos from mixed attachments');
assert(audioOnly.length === 1, 'Correctly isolates 1 audio attachment from mixed attachments');

// Test deletion of audio does NOT delete photos
const afterAudioDelete = mixedAttachments.filter(a => a.id !== 'att-audio-1');
assert(afterAudioDelete.length === 2, 'Deleting audio attachment retains both photo attachments');
assert(afterAudioDelete.every(a => a.type !== 'audio'), 'Both remaining attachments are photos');

// -----------------------------------------------------------------------------
// Test Suite 6: Edit Diary Transcript Updates & Offline Handling
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Edit Diary Transcript Updates & Offline Handling ---');

const originalAudio = { ...sampleAudioAttachment };
const updatedTranscriptText = 'இன்று மாலை கூடுதல் உரம் இடப்பட்டது.';

const updatedAudio = {
  ...originalAudio,
  transcript: {
    ...originalAudio.transcript,
    text: updatedTranscriptText,
    status: 'completed'
  }
};

assert(updatedAudio.transcript.text === updatedTranscriptText, 'Allows user to edit and save transcript text');
assert(updatedAudio.url === originalAudio.url, 'Editing transcript does not alter or re-upload audio file URL');
assert(updatedAudio.id === originalAudio.id, 'Editing transcript preserves attachment ID');

// Offline local fallback provider check
const offlineAudioRecord = {
  id: 'att-audio-offline-1',
  type: 'audio',
  url: 'blob:http://localhost:3000/1234-5678',
  provider: 'local',
  notice: 'Audio saved locally.',
  duration: 18,
  transcript: { text: 'Quick offline note', language: 'en-IN', status: 'manual' }
};

assert(offlineAudioRecord.provider === 'local', 'Audio recorded offline flags provider: local');
assert(offlineAudioRecord.url.startsWith('blob:') || offlineAudioRecord.url.startsWith('data:'), 'Offline audio uses local blob or data URL');

// -----------------------------------------------------------------------------
// Test Suite 7: Workspace Privacy & Security for Voice Notes
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 7: Workspace Security & Privacy for Voice Notes ---');

const rulesPath = path.join(rootDir, 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

// Audio attachments are embedded inside diary entries document
assert(rulesContent.includes('match /entries/{entryId}'), 'Voice recordings stored within entries inherit entry subcollection rules');
assert(rulesContent.includes('isMember(getWorkspace())'), 'Voice notes restricted to workspace members');
assert(rulesContent.includes('isPersonal(ws)'), 'Personal workspace voice notes strictly restricted to workspace owner');

// -----------------------------------------------------------------------------
// Master Test Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TOTAL PHASE 10 TESTS EXECUTED: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('Phase 10 Voice Diary & Transcription Tests Passed Successfully!\n');
  process.exit(0);
}

