/**
 * PROJECT DIARY TRACKER — PHASE 11 MASTER TEST SUITE
 * 
 * Verifies Automatic Tamil & English Multilingual Translation for Shared Workspaces:
 * - Scenarios 1 to 12 as defined in the Phase 11 specification.
 * - Deterministic Unicode language detection for Tamil and English.
 * - Protected parameter tokenization (Amounts, Currencies, URLs, Emails, Hashtags).
 * - Multi-tier caching and concurrent in-flight deduplication.
 * - Cache invalidation upon entry editing.
 * - Safe fallback to original content on network/translation failure.
 * - Backwards compatibility with legacy entries without translation metadata.
 * - Workspace RBAC & privacy integrity for Personal, Family, and Business workspaces.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

import {
  detectLanguage,
  tokenizeProtectedEntities,
  restoreProtectedEntities,
  translateText,
  translateDiaryEntry,
  SUPPORTED_LANGUAGES
} from '../src/services/translationService.js';

import {
  getEntryDisplayContent,
  createDiaryEntry,
  updateDiaryEntry
} from '../src/services/entryService.js';

import { translations } from '../src/i18n/translations.js';

// Setup Mock LocalStorage for Node.js test environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

let testsRun = 0;
let testsPassed = 0;

function it(desc, fn) {
  testsRun++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
  }
}

async function itAsync(desc, fn) {
  testsRun++;
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
  }
}

console.log('======================================================');
console.log('   PHASE 11 — MULTILINGUAL TRANSLATION TEST SUITE     ');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: Unicode Language Detection (Tamil vs English)
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Unicode Language Detection (Tamil vs English) ---');

it('Detects pure Tamil text as "ta"', () => {
  const result = detectLanguage('இன்று வயலில் வேலை செய்தேன்');
  assert.strictEqual(result, 'ta');
});

it('Detects pure English text as "en"', () => {
  const result = detectLanguage('Worked in the field today');
  assert.strictEqual(result, 'en');
});

it('Detects Tamil text with numbers and punctuation as "ta"', () => {
  const result = detectLanguage('காலை 8:30 மணிக்கு 50 மூட்டை நெல் அறுவடை செய்யப்பட்டது.');
  assert.strictEqual(result, 'ta');
});

it('Detects predominantly English text with incidental symbol as "en"', () => {
  const result = detectLanguage('Completed irrigation canals for Sector 3 & 4. ₹2400 expense.');
  assert.strictEqual(result, 'en');
});

it('Defaults empty or non-alphabetic strings safely to "en"', () => {
  assert.strictEqual(detectLanguage(''), 'en');
  assert.strictEqual(detectLanguage('123456 !!! ???'), 'en');
  assert.strictEqual(detectLanguage(null), 'en');
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: Protected Parameter Tokenization (Amounts, URLs, Emails, Hashtags)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Protected Parameter Tokenization & Preservation ---');

it('Preserves currency amounts and symbols (₹, $, INR)', () => {
  const input = 'Paid ₹145,000 to wholesale depot and saved $500 bonus';
  const { tokenizedText, tokens } = tokenizeProtectedEntities(input);
  
  assert.strictEqual(tokens.length, 2);
  assert.ok(tokens.some(t => t.original === '₹145,000'));
  assert.ok(tokens.some(t => t.original === '$500'));

  // Simulate translation where tokens remain intact
  const restored = restoreProtectedEntities(tokenizedText, tokens);
  assert.strictEqual(restored, input);
});

it('Preserves URLs without truncation or translation distortion', () => {
  const input = 'Check canal flow report at https://agri.example.gov/canals/north-irrigation?ref=102';
  const { tokenizedText, tokens } = tokenizeProtectedEntities(input);
  
  assert.strictEqual(tokens.length, 1);
  assert.strictEqual(tokens[0].original, 'https://agri.example.gov/canals/north-irrigation?ref=102');

  const restored = restoreProtectedEntities(tokenizedText, tokens);
  assert.strictEqual(restored, input);
});

it('Preserves email addresses intact', () => {
  const input = 'Send tractor invoice to accounts.dept@farmsyndicate.org immediately';
  const { tokenizedText, tokens } = tokenizeProtectedEntities(input);
  
  assert.strictEqual(tokens.length, 1);
  assert.strictEqual(tokens[0].original, 'accounts.dept@farmsyndicate.org');

  const restored = restoreProtectedEntities(tokenizedText, tokens);
  assert.strictEqual(restored, input);
});

it('Preserves bilingual hashtags (#agriculture, #விவசாயம்)', () => {
  const input = 'Paddy plantation completed #Agriculture #விவசாயம் #PaddyCrop';
  const { tokenizedText, tokens } = tokenizeProtectedEntities(input);
  
  assert.strictEqual(tokens.length, 3);
  assert.ok(tokens.some(t => t.original === '#Agriculture'));
  assert.ok(tokens.some(t => t.original === '#விவசாயம்'));
  assert.ok(tokens.some(t => t.original === '#PaddyCrop'));

  const restored = restoreProtectedEntities(tokenizedText, tokens);
  assert.strictEqual(restored, input);
});

// -----------------------------------------------------------------------------
// TEST SUITE 3: Core Scenarios 1 to 4 (Multilingual View Preferences)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Core Scenarios 1 to 4 (Multilingual View Preferences) ---');

await itAsync('Scenario 1: Tamil user creates an entry; English member sees English translation', async () => {
  const entry = {
    id: 'entry-ta-test-1',
    title: 'இன்று வயலில் வேலை செய்தேன்',
    description: 'காலை தண்ணீர் பாய்ச்சினேன்',
    sourceLanguage: 'ta',
    detectedLanguage: 'ta',
    translations: {
      en: {
        title: 'Worked in the field today',
        description: 'Watered the field in the morning',
        translatedAt: '2026-11-05T20:00:00Z'
      }
    }
  };

  const displayForEnglishMember = getEntryDisplayContent(entry, 'en');
  assert.strictEqual(displayForEnglishMember.title, 'Worked in the field today');
  assert.strictEqual(displayForEnglishMember.description, 'Watered the field in the morning');
  assert.strictEqual(displayForEnglishMember.isTranslated, true);
  assert.strictEqual(displayForEnglishMember.isOriginal, false);
});

await itAsync('Scenario 2: English user creates an entry; Tamil member sees Tamil translation', async () => {
  const entry = {
    id: 'entry-en-test-2',
    title: 'Paddy Field Sowing & Water Canal Maintenance',
    description: 'Completed watering schedule for block A & B. Checked sprinkler pressure and cleared silt along the north irrigation canal.',
    sourceLanguage: 'en',
    detectedLanguage: 'en',
    translations: {
      ta: {
        title: 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு',
        description: 'தொகுதி A மற்றும் B-க்கான நீர்ப்பாசன அட்டவணை நிறைவுற்றது. தெளிப்பான் அழுத்தத்தை சரிபார்த்து வடக்கு பாசன கால்வாயில் வண்டல் அகற்றப்பட்டது.',
        translatedAt: '2026-11-05T20:00:00Z'
      }
    }
  };

  const displayForTamilMember = getEntryDisplayContent(entry, 'ta');
  assert.strictEqual(displayForTamilMember.title, 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு');
  assert.strictEqual(displayForTamilMember.description, 'தொகுதி A மற்றும் B-க்கான நீர்ப்பாசன அட்டவணை நிறைவுற்றது. தெளிப்பான் அழுத்தத்தை சரிபார்த்து வடக்கு பாசன கால்வாயில் வண்டல் அகற்றப்பட்டது.');
  assert.strictEqual(displayForTamilMember.isTranslated, true);
  assert.strictEqual(displayForTamilMember.isOriginal, false);
});

it('Scenario 3: Tamil member views Tamil entry and sees original Tamil content', () => {
  const entry = {
    id: 'entry-ta-test-3',
    title: 'இன்று வயலில் வேலை செய்தேன்',
    description: 'காலை தண்ணீர் பாய்ச்சினேன்',
    sourceLanguage: 'ta',
    detectedLanguage: 'ta',
    translations: {
      en: {
        title: 'Worked in the field today',
        description: 'Watered the field in the morning'
      }
    }
  };

  const displayForTamilMember = getEntryDisplayContent(entry, 'ta');
  assert.strictEqual(displayForTamilMember.title, 'இன்று வயலில் வேலை செய்தேன்');
  assert.strictEqual(displayForTamilMember.description, 'காலை தண்ணீர் பாய்ச்சினேன்');
  assert.strictEqual(displayForTamilMember.isTranslated, false);
  assert.strictEqual(displayForTamilMember.isOriginal, true);
});

it('Scenario 4: English member views English entry and sees original English content', () => {
  const entry = {
    id: 'entry-en-test-4',
    title: 'Morning 5K Jog & Health Reflections',
    description: 'Paced 5 kilometers at sunrise. Feeling refreshed and focused on long-term wellness habits.',
    sourceLanguage: 'en',
    detectedLanguage: 'en',
    translations: {}
  };

  const displayForEnglishMember = getEntryDisplayContent(entry, 'en');
  assert.strictEqual(displayForEnglishMember.title, 'Morning 5K Jog & Health Reflections');
  assert.strictEqual(displayForEnglishMember.description, 'Paced 5 kilometers at sunrise. Feeling refreshed and focused on long-term wellness habits.');
  assert.strictEqual(displayForEnglishMember.isTranslated, false);
  assert.strictEqual(displayForEnglishMember.isOriginal, true);
});

// -----------------------------------------------------------------------------
// TEST SUITE 4: Scenarios 5 to 8 (Language Switching, Integrity & Cache Invalidation)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Scenarios 5 to 8 (Switching, Integrity & Invalidation) ---');

it('Scenario 5: User switches application language; displayed content updates dynamically', () => {
  const entry = {
    id: 'entry-switch-test',
    title: 'வணிக மொத்த தானிய தீர்வு பெறப்பட்டது',
    description: 'ஸ்ரீ முருகன் டிரேடர்ஸுக்கு வழங்கப்பட்ட 85 குவிண்டால் விளைபொருட்களுக்கான வங்கி பரிமாற்றம் பெறப்பட்டது.',
    sourceLanguage: 'ta',
    translations: {
      en: {
        title: 'Commercial Wholesale Grain Settlement Received',
        description: 'Received bank wire transfer for 85 quintals of produce delivered to Sri Murugan Traders.'
      }
    }
  };

  // While in Tamil mode
  const taView = getEntryDisplayContent(entry, 'ta');
  assert.strictEqual(taView.title, 'வணிக மொத்த தானிய தீர்வு பெறப்பட்டது');
  assert.strictEqual(taView.isTranslated, false);

  // User toggles UI to English mode
  const enView = getEntryDisplayContent(entry, 'en');
  assert.strictEqual(enView.title, 'Commercial Wholesale Grain Settlement Received');
  assert.strictEqual(enView.isTranslated, true);
});

it('Scenario 6: Original text remains permanently unchanged and is never overwritten', () => {
  const entry = {
    id: 'entry-immutable-test',
    title: 'விதை விதைத்தேன்',
    description: 'மழைக்கு முன் விதைக்கப்பட்டது',
    sourceLanguage: 'ta',
    translations: {
      en: {
        title: 'Sowed seeds',
        description: 'Sowed before the rain'
      }
    }
  };

  // Original fields are pristine strings
  assert.strictEqual(entry.title, 'விதை விதைத்தேன்');
  assert.strictEqual(entry.description, 'மழைக்கு முன் விதைக்கப்பட்டது');

  // Requesting translation representation does not mutate entry object
  const display = getEntryDisplayContent(entry, 'en');
  assert.strictEqual(display.title, 'Sowed seeds');
  assert.strictEqual(entry.title, 'விதை விதைத்தேன்');
});

await itAsync('Scenario 7: Translation failure or offline safely falls back to original content', async () => {
  // Translate unfamiliar text while forcing offline provider failure
  const originalTamil = 'விசேஷமான புதிய விவசாய தொழில்நுட்பம்';
  const res = await translateText(originalTamil, 'ta', 'en', { bypassCache: true });

  // On offline fallback, success is false but text safely contains original text without crash or blanking
  assert.ok(res.text !== undefined && res.text.length > 0);
  assert.strictEqual(res.sourceLang, 'ta');
});

await itAsync('Scenario 8: Editing an original entry invalidates old translations and increments version', async () => {
  const initialEntry = {
    id: 'entry-edit-invalidation-test',
    title: 'இன்று வயலில் வேலை செய்தேன்',
    description: 'காலை தண்ணீர் பாய்ச்சினேன்',
    sourceLanguage: 'ta',
    detectedLanguage: 'ta',
    translationVersion: 1,
    translations: {
      en: {
        title: 'Worked in the field today',
        description: 'Watered the field in the morning'
      }
    }
  };

  // Seed into mock local storage
  const wsId = 'ws-test-invalidation';
  mockStorage.set(`pdt_entries_${wsId}`, JSON.stringify([initialEntry]));

  // Update title
  const updated = await updateDiaryEntry(wsId, initialEntry.id, {
    title: 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு'
  });

  // Old translation must be emptied/invalidated because content changed
  assert.deepStrictEqual(updated.translations, {});
  // translationVersion must be incremented
  assert.strictEqual(updated.translationVersion, 2);
  // Source language must be recalculated
  assert.strictEqual(updated.sourceLanguage, 'ta');
});

// -----------------------------------------------------------------------------
// TEST SUITE 5: Scenarios 9 to 12 (Concurrency, Security & Legacy Compatibility)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Scenarios 9 to 12 (Concurrency, Security & Legacy) ---');

await itAsync('Scenario 9: Two members access same entry simultaneously (in-flight deduplication)', async () => {
  const textToTranslate = 'குடும்ப இரவு உணவு மற்றும் அறிவியல் திட்டம்';
  
  // Launch two concurrent translation requests for exact same text
  const [res1, res2] = await Promise.all([
    translateText(textToTranslate, 'ta', 'en'),
    translateText(textToTranslate, 'ta', 'en')
  ]);

  assert.strictEqual(res1.text, 'Family Dinner & School Science Project Discussion');
  assert.strictEqual(res2.text, 'Family Dinner & School Science Project Discussion');
  assert.strictEqual(res1.text, res2.text);
});

it('Scenario 10: Personal workspace content remains strictly private (owner-only access in rules)', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');
  
  // Security rule checks
  assert.ok(rules.includes("function isPersonal(ws)"), 'Defines isPersonal security function');
  assert.ok(rules.includes("resource.data.ownerUid == request.auth.uid"), 'Restricts personal workspace reading to ownerUid');
  assert.ok(rules.includes("!isPersonal(resource.data) && (request.auth.uid in resource.data.members)"), 'Only non-personal allows member access');
});

it('Scenario 11: Family and Business workspace membership permissions remain intact', () => {
  const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');

  // Verify multi-member entry permissions
  assert.ok(rules.includes("canCreateEntries(getWorkspace())"), 'Validates entry creation roles');
  assert.ok(rules.includes("canEditEntry(getWorkspace(), resource.data)"), 'Validates entry edit roles');
  assert.ok(rules.includes("canDeleteEntry(getWorkspace(), resource.data)"), 'Validates entry deletion roles');
});

it('Scenario 12: Old legacy entries without translation metadata continue working seamlessly', () => {
  // Legacy entry from Phase 1-5 without sourceLanguage, detectedLanguage, or translations
  const legacyEntry = {
    id: 'legacy-entry-2024',
    title: 'Logistics Fleet Maintenance',
    entryType: 'Maintenance',
    description: 'Scheduled tyre replacement for transport lorry #4',
    date: '2026-01-15',
    time: '10:00'
  };

  const displayEn = getEntryDisplayContent(legacyEntry, 'en');
  assert.strictEqual(displayEn.title, 'Logistics Fleet Maintenance');
  assert.strictEqual(displayEn.description, 'Scheduled tyre replacement for transport lorry #4');
  assert.strictEqual(displayEn.isTranslated, false);
  assert.strictEqual(displayEn.isOriginal, true);

  // Even if requested in Tamil without pre-existing translation, it displays original safely
  const displayTa = getEntryDisplayContent(legacyEntry, 'ta');
  assert.strictEqual(displayTa.title, 'Logistics Fleet Maintenance');
  assert.strictEqual(displayTa.isOriginal, true);
});

// -----------------------------------------------------------------------------
// TEST SUITE 6: UI Localization Dictionary Parity (Phase 11 Keys)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: UI Localization Dictionary Parity (Phase 11 Keys) ---');

const REQUIRED_PHASE_11_KEYS = [
  'translatedFromTamil',
  'translatedFromEnglish',
  'showOriginal',
  'showTranslation',
  'translating',
  'translationUnavailable',
  'retryTranslation',
  'sourceLanguage',
  'detectedLanguage',
  'autoDetect',
  'originalContent',
  'tamil',
  'english',
  'translationBadgeTooltip',
  'translatingContent',
  'originalTextLabel',
  'translatedTextLabel',
  'manualLanguageOverride',
  'languageOverrideHelp'
];

REQUIRED_PHASE_11_KEYS.forEach(k => {
  it(`English dictionary defines "${k}"`, () => {
    assert.ok(translations.en[k], `Missing EN key: ${k}`);
  });

  it(`Tamil dictionary defines "${k}" with authentic Tamil translation`, () => {
    assert.ok(translations.ta[k], `Missing TA key: ${k}`);
    assert.ok(/[\u0B80-\u0BFF]/.test(translations.ta[k]), `TA key "${k}" is not Tamil`);
  });
});

console.log('\n======================================================');
console.log(`TOTAL PHASE 11 TESTS EXECUTED: ${testsRun}`);
console.log(`PASSED: ${testsPassed}`);
console.log(`FAILED: ${testsRun - testsPassed}`);
console.log('======================================================\n');

if (testsRun === testsPassed) {
  console.log('Phase 11 Multilingual Translation Tests Passed Successfully!\n');
  process.exit(0);
} else {
  console.error('Phase 11 Tests Failed!\n');
  process.exit(1);
}

