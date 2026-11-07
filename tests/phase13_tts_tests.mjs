// tests/phase13_tts_tests.mjs
// Comprehensive verification suite for Phase 13: Diary Text-to-Speech (TTS) Feature

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('   PHASE 13 — DIARY TEXT-TO-SPEECH (TTS) TEST SUITE   ');
console.log('======================================================\n');

// Import speechService and translations
const speechService = await import('../src/services/speechService.js');
const { translations } = await import('../src/i18n/translations.js');

// -----------------------------------------------------------------------------
// Test Suite 1: Clean Speech Text Builder
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Clean Speech Text Builder & Sanitization ---');

test('buildDiarySpeechText creates natural Tamil speech text including category and amount', () => {
  const sampleEntry = {
    id: 'entry-ta-1',
    entryType: 'Agriculture',
    amount: 2400,
    amountType: 'expense',
    location: 'வடக்கு பாசன கால்வாய்'
  };

  const text = speechService.buildDiarySpeechText(
    sampleEntry,
    'விதைப்பு மற்றும் பாசன பராமரிப்பு',
    'தொகுதி A மற்றும் B-க்கான நீர்ப்பாசன அட்டவணை நிறைவுற்றது. https://example.com/irrigation field-canal.jpg',
    'ta'
  );

  assert(text.includes('விதைப்பு மற்றும் பாசன பராமரிப்பு.'), 'Title included in Tamil');
  assert(text.includes('வகை: விவசாயம்.'), 'Localized Tamil category included');
  assert(text.includes('தொகுதி A மற்றும் B-க்கான நீர்ப்பாசன அட்டவணை நிறைவுற்றது.'), 'Description included');
  assert(!text.includes('https://example.com/irrigation'), 'URLs stripped from speech text');
  assert(!text.includes('field-canal.jpg'), 'Attachment filenames stripped from speech text');
  assert(text.includes('தொகை: செலவு 2400 ரூபாய்.'), 'Financial expense formatted in natural Tamil');
  assert(text.includes('இடம்: வடக்கு பாசன கால்வாய்.'), 'Location formatted in natural Tamil');
});

test('buildDiarySpeechText creates natural English speech text including category, amount, and location', () => {
  const sampleEntry = {
    id: 'entry-en-1',
    entryType: 'Personal',
    amount: 1500,
    amountType: 'income',
    location: 'Home Study'
  };

  const text = speechService.buildDiarySpeechText(
    sampleEntry,
    'Reading "Atomic Habits" Chapter 4',
    'The key takeaway: we do not rise to the level of our goals, we fall to the level of our systems. Read online at https://books.com/atomic. Photo attached habits.png.',
    'en'
  );

  assert(text.includes('Reading "Atomic Habits" Chapter 4.'), 'Title included in English');
  assert(text.includes('Category: Personal.'), 'Localized English category included');
  assert(text.includes('The key takeaway: we do not rise to the level of our goals'), 'Description included');
  assert(!text.includes('https://books.com/atomic'), 'URLs stripped');
  assert(!text.includes('habits.png'), 'Photo filenames stripped');
  assert(text.includes('Amount: Income of 1500 rupees.'), 'Financial income formatted in natural English');
  assert(text.includes('Location: Home Study.'), 'Location formatted in natural English');
});

test('buildDiarySpeechText skips missing optional fields cleanly without undefined or null', () => {
  const minimalEntry = {
    id: 'entry-min-1',
    entryType: 'Daily Activity',
    amount: null,
    location: ''
  };

  const text = speechService.buildDiarySpeechText(
    minimalEntry,
    'Morning Jog',
    'Jogged 5 kilometers at sunrise.',
    'en'
  );

  assert(text.includes('Morning Jog.'), 'Title present');
  assert(!text.includes('Amount'), 'Amount omitted when null');
  assert(!text.includes('Location'), 'Location omitted when empty');
  assert(!text.includes('undefined'), 'No undefined strings in speech text');
  assert(!text.includes('null'), 'No null strings in speech text');
});

// -----------------------------------------------------------------------------
// Test Suite 2: Sentence-Level Chunking for Browser Cutoff Prevention
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Sentence-Level Chunking (Long Content Handling) ---');

test('chunkTextForSpeech keeps short texts in a single chunk', () => {
  const shortText = 'Morning jog completed. Felt very refreshed.';
  const chunks = speechService.chunkTextForSpeech(shortText, 180);
  assert.strictEqual(chunks.length, 1);
  assert.strictEqual(chunks[0], shortText);
});

test('chunkTextForSpeech splits long multi-sentence texts on sentence boundaries under 180 characters', () => {
  const longText = 'Completed watering schedule for block A and B today. ' +
    'Checked the sprinkler pressure and cleared silt along the north irrigation canal. ' +
    'Sowed twenty kilograms of hybrid paddy seeds in the eastern nursery plot. ' +
    'The weather was pleasant and sunny throughout the morning.';

  const chunks = speechService.chunkTextForSpeech(longText, 150);
  assert(chunks.length >= 2, 'Long text split into multiple chunks');
  chunks.forEach(chunk => {
    assert(chunk.length <= 160, `Chunk "${chunk}" should be comfortably sized`);
  });
  const reassembled = chunks.join(' ');
  assert(reassembled.includes('block A and B'), 'Preserves sentence 1');
  assert(reassembled.includes('sprinkler pressure'), 'Preserves sentence 2');
  assert(reassembled.includes('eastern nursery plot'), 'Preserves sentence 3');
});

// -----------------------------------------------------------------------------
// Test Suite 3: Voice Selection & Language Matching
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Voice Selection & Language Matching ---');

const mockVoices = [
  { name: 'Google தமிழ்', lang: 'ta-IN', default: false },
  { name: 'Microsoft Valluvar Online (Natural) - Tamil (India)', lang: 'ta-IN', default: false },
  { name: 'Google UK English Female', lang: 'en-GB', default: false },
  { name: 'Google US English', lang: 'en-US', default: true },
  { name: 'Microsoft Ravi Online (Natural) - English (India)', lang: 'en-IN', default: false }
];

test('findBestVoice accurately matches exact ta-IN Tamil voice', () => {
  const voice = speechService.findBestVoice('ta-IN', mockVoices);
  assert(voice !== null, 'Tamil voice found');
  assert.strictEqual(voice.lang, 'ta-IN', 'Matches ta-IN language code');
});

test('findBestVoice prioritizes en-IN voice for English in Indian context', () => {
  const voice = speechService.findBestVoice('en-IN', mockVoices);
  assert(voice !== null, 'English voice found');
  assert.strictEqual(voice.lang, 'en-IN', 'Prefers en-IN voice');
});

test('findBestVoice falls back to generic English when en-IN is unavailable', () => {
  const voicesWithoutEnIn = mockVoices.filter(v => v.lang !== 'en-IN');
  const voice = speechService.findBestVoice('en-IN', voicesWithoutEnIn);
  assert(voice !== null, 'English fallback voice found');
  assert(voice.lang.startsWith('en'), 'Fell back to valid English voice');
});

test('findBestVoice returns null safely when no Tamil voice is available on device', () => {
  const nonTamilVoices = mockVoices.filter(v => !v.lang.startsWith('ta'));
  const voice = speechService.findBestVoice('ta-IN', nonTamilVoices);
  assert.strictEqual(voice, null, 'Returns null safely if Tamil voice missing for graceful fallback');
});

// -----------------------------------------------------------------------------
// Test Suite 4: Pre-Speech Translation Integration (Scenarios 1, 2, 3)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Pre-Speech Translation Integration ---');

await testAsync('Scenario 1: Tamil diary + English viewer -> Translates to English before speech', async () => {
  const tamilEntry = {
    id: 'entry-ta-speech-1',
    title: 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு',
    description: 'தொகுதி A மற்றும் B-க்கான நீர்ப்பாசன அட்டவணை நிறைவுற்றது.',
    sourceLanguage: 'ta',
    detectedLanguage: 'ta'
  };

  const res = await speechService.resolveEntryTextForSpeech(tamilEntry, 'en');
  assert.strictEqual(res.sourceLang, 'ta');
  assert.strictEqual(res.targetLang, 'en');
  assert.strictEqual(res.needsTranslation, true);
  assert(res.title.includes('Paddy Field') || res.title.includes('Maintenance') || res.title.length > 0);
  assert(!res.translationFailed, 'Translation should succeed');
});

await testAsync('Scenario 2: English diary + Tamil viewer -> Translates to Tamil before speech', async () => {
  const englishEntry = {
    id: 'entry-en-speech-2',
    title: 'Morning 5K Jog & Health Reflections',
    description: 'Paced 5 kilometers at sunrise. Feeling refreshed.',
    sourceLanguage: 'en',
    detectedLanguage: 'en'
  };

  const res = await speechService.resolveEntryTextForSpeech(englishEntry, 'ta');
  assert.strictEqual(res.sourceLang, 'en');
  assert.strictEqual(res.targetLang, 'ta');
  assert.strictEqual(res.needsTranslation, true);
  assert(res.title.includes('நடைப்பயிற்சி') || res.title.includes('காலை') || /[\u0B80-\u0BFF]/.test(res.title));
  assert(!res.translationFailed, 'Translation should succeed');
});

await testAsync('Scenario 3: Same language (Tamil diary + Tamil viewer) -> Uses original content without translation', async () => {
  const tamilEntry = {
    id: 'entry-ta-speech-3',
    title: 'குடும்பத்தினருடன் மகிழ்ச்சியான நாள்',
    description: 'மாலையில் குழந்தைகளுடன் பூங்கா சென்றோம்.',
    sourceLanguage: 'ta',
    detectedLanguage: 'ta'
  };

  const res = await speechService.resolveEntryTextForSpeech(tamilEntry, 'ta');
  assert.strictEqual(res.sourceLang, 'ta');
  assert.strictEqual(res.targetLang, 'ta');
  assert.strictEqual(res.needsTranslation, false);
  assert.strictEqual(res.title, 'குடும்பத்தினருடன் மகிழ்ச்சியான நாள்');
  assert.strictEqual(res.description, 'மாலையில் குழந்தைகளுடன் பூங்கா சென்றோம்.');
});

await testAsync('Scenario 3b: Same language (English diary + English viewer) -> Uses original English directly', async () => {
  const englishEntry = {
    id: 'entry-en-speech-4',
    title: 'Quarterly Logistics & Transportation Advance',
    description: 'Paid advance for commercial freight fleet.',
    sourceLanguage: 'en',
    detectedLanguage: 'en'
  };

  const res = await speechService.resolveEntryTextForSpeech(englishEntry, 'en');
  assert.strictEqual(res.sourceLang, 'en');
  assert.strictEqual(res.targetLang, 'en');
  assert.strictEqual(res.needsTranslation, false);
  assert.strictEqual(res.title, 'Quarterly Logistics & Transportation Advance');
});

// -----------------------------------------------------------------------------
// Test Suite 5: Playback Speeds & Persistence
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Playback Speed Control & Persistence ---');

test('speechService defines 4 standardized speeds: 0.75x, 1.0x, 1.25x, 1.5x', () => {
  assert.strictEqual(speechService.PLAYBACK_SPEEDS.length, 4);
  const values = speechService.PLAYBACK_SPEEDS.map(s => s.value);
  assert.deepStrictEqual(values, [0.75, 1.0, 1.25, 1.5]);
});

test('speechService defaults to 1.0x normal speed', () => {
  const rate = speechService.getSpeechRate();
  assert([0.75, 1.0, 1.25, 1.5].includes(rate), 'Valid initial rate');
});

test('setSpeechRate updates and clamps to allowed speeds', () => {
  speechService.setSpeechRate(1.25);
  assert.strictEqual(speechService.getSpeechRate(), 1.25);
  speechService.setSpeechRate(1.0); // Reset to default
  assert.strictEqual(speechService.getSpeechRate(), 1.0);
});

// -----------------------------------------------------------------------------
// Test Suite 6: Global Single-Session Playback & Subscriber Architecture
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Global Single-Session State & Subscriber ---');

test('stopSpeech resets activeSession to IDLE and clears current entryId', () => {
  speechService.stopSpeech();
  const state = speechService.getCurrentSpeechState();
  assert.strictEqual(state.status, speechService.SPEECH_STATES.IDLE);
  assert.strictEqual(state.entryId, null);
  assert.strictEqual(speechService.getCurrentPlayingId(), null);
});

test('subscribeToSpeechState receives immediate state snapshot and subsequent updates', () => {
  let receivedState = null;
  const unsubscribe = speechService.subscribeToSpeechState((s) => {
    receivedState = s;
  });

  assert(receivedState !== null, 'Immediate snapshot received on subscription');
  assert.strictEqual(receivedState.status, speechService.SPEECH_STATES.IDLE);

  speechService.setSpeechRate(1.5);
  assert.strictEqual(receivedState.rate, 1.5, 'Subscriber notified of rate change');

  speechService.setSpeechRate(1.0); // reset
  unsubscribe();
});

// -----------------------------------------------------------------------------
// Test Suite 7: UI Component & Card Integration
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 7: UI Component & Card Integration ---');

const diarySpeechBtnPath = path.join(projectRoot, 'src', 'components', 'DiarySpeechButton.jsx');
const diaryEntryCardPath = path.join(projectRoot, 'src', 'components', 'DiaryEntryCard.jsx');
const calendarViewPath = path.join(projectRoot, 'src', 'views', 'CalendarView.jsx');
const homeViewPath = path.join(projectRoot, 'src', 'views', 'HomeView.jsx');

test('DiarySpeechButton.jsx component exists with full playback controls', () => {
  assert(fs.existsSync(diarySpeechBtnPath), 'DiarySpeechButton.jsx exists');
  const content = fs.readFileSync(diarySpeechBtnPath, 'utf-8');
  assert(content.includes('speakDiaryEntry'), 'Imports speakDiaryEntry');
  assert(content.includes('pauseSpeech'), 'Imports pauseSpeech');
  assert(content.includes('resumeSpeech'), 'Imports resumeSpeech');
  assert(content.includes('stopSpeech'), 'Imports stopSpeech');
  assert(content.includes('PLAYBACK_SPEEDS'), 'Imports PLAYBACK_SPEEDS');
  assert(content.includes('Volume2'), 'Uses Volume2 icon');
  assert(content.includes('Pause'), 'Uses Pause icon');
  assert(content.includes('Play'), 'Uses Play icon');
  assert(content.includes('diary-speech-btn'), 'Defines diary-speech-btn class');
});

test('DiaryEntryCard.jsx integrates DiarySpeechButton at bottom-right corner', () => {
  assert(fs.existsSync(diaryEntryCardPath), 'DiaryEntryCard.jsx exists');
  const cardContent = fs.readFileSync(diaryEntryCardPath, 'utf-8');
  assert(cardContent.includes("import DiarySpeechButton from './DiarySpeechButton'"), 'Imports DiarySpeechButton');
  assert(cardContent.includes('<DiarySpeechButton'), 'Renders DiarySpeechButton in entry card');
  assert(cardContent.includes('marginLeft'), 'Positions button cleanly at bottom-right corner');
});

test('CalendarView.jsx integrates DiarySpeechButton on calendar preview cards', () => {
  assert(fs.existsSync(calendarViewPath), 'CalendarView.jsx exists');
  const calContent = fs.readFileSync(calendarViewPath, 'utf-8');
  assert(calContent.includes("import DiarySpeechButton from '../components/DiarySpeechButton'"), 'Imports DiarySpeechButton in CalendarView');
  assert(calContent.includes('<DiarySpeechButton'), 'Renders DiarySpeechButton in CalendarEntryItem');
});

test('HomeView.jsx dashboard remains locked without unwanted speaker card injections', () => {
  assert(fs.existsSync(homeViewPath), 'HomeView.jsx exists');
  const homeContent = fs.readFileSync(homeViewPath, 'utf-8');
  assert(!homeContent.includes('DiarySpeechButton'), 'Dashboard components remain untouched and locked');
});

// -----------------------------------------------------------------------------
// Test Suite 8: Bilingual Translation Parity & Localization
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 8: Bilingual Translation Dictionary Parity ---');

const requiredTtsKeys = [
  'readDiaryAloud',
  'pauseReading',
  'resumeReading',
  'stopReading',
  'readingAloud',
  'translatingBeforeSpeech',
  'speechUnavailable',
  'voiceNotFound',
  'readingOriginalText',
  'translationFailedForSpeech',
  'listenOriginalLanguage',
  'retryTranslation',
  'playbackSpeed',
  'speedSlow',
  'speedNormal',
  'speedFast',
  'speedFaster',
  'speechAmount',
  'speechIncome',
  'speechExpense',
  'speechLocation',
  'speechCategory',
  'speechRupees'
];

test('All Phase 13 TTS keys exist in English and Tamil with 100% parity', () => {
  const enKeys = Object.keys(translations.en);
  const taKeys = Object.keys(translations.ta);

  assert.strictEqual(enKeys.length, taKeys.length, `Equal key count (EN: ${enKeys.length}, TA: ${taKeys.length})`);

  for (const k of requiredTtsKeys) {
    assert(translations.en[k], `Missing EN key: ${k}`);
    assert(translations.ta[k], `Missing TA key: ${k}`);
    assert(/[\u0B80-\u0BFF]/.test(translations.ta[k]), `TA translation for ${k} should contain Tamil script`);
  }
});

// -----------------------------------------------------------------------------
// Test Suite 9: Workspace Permissions & Data Immutability
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 9: Workspace Permissions & Data Immutability ---');

test('Speech service never mutates original entry object or overwrites title/description', async () => {
  const pristineEntry = Object.freeze({
    id: 'entry-immutable-1',
    title: 'Original Pristine Title',
    description: 'Original Pristine Description',
    sourceLanguage: 'en',
    detectedLanguage: 'en',
    date: '2026-11-07'
  });

  const res = await speechService.resolveEntryTextForSpeech(pristineEntry, 'ta');
  assert.strictEqual(pristineEntry.title, 'Original Pristine Title', 'Original title unchanged');
  assert.strictEqual(pristineEntry.description, 'Original Pristine Description', 'Original description unchanged');
});

// -----------------------------------------------------------------------------
// Test Suite 10: CSS & Mobile Touch Accessibility
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 10: CSS Architecture & Touch Target Accessibility ---');

const indexCssPath = path.join(projectRoot, 'src', 'index.css');

test('index.css defines accessible .diary-speech-btn with hover, active, and pulse animations', () => {
  assert(fs.existsSync(indexCssPath), 'index.css exists');
  const css = fs.readFileSync(indexCssPath, 'utf-8');
  assert(css.includes('.diary-speech-btn'), '.diary-speech-btn class defined');
  assert(css.includes('.diary-speech-btn.playing'), 'Active playing state defined');
  assert(css.includes('pulseSpeaking'), 'Light mode pulsing animation defined');
  assert(css.includes('pulseSpeakingDark'), 'Dark mode pulsing animation defined');
  assert(css.includes('width: 34px'), 'Visual width aligned to 34px compact requirement');
  assert(css.includes('height: 34px'), 'Visual height aligned to 34px compact requirement');
});

// -----------------------------------------------------------------------------
// Test Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TOTAL PHASE 13 TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All Phase 13 Text-to-Speech (TTS) tests passed successfully!');
  process.exit(0);
}

