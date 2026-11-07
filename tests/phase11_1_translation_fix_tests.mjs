/**
 * PROJECT DIARY TRACKER — PHASE 11.1 REGRESSION & REPAIR TEST SUITE
 * 
 * Verifies the resolution of incomplete diary content translation:
 * 1. Existing English entry -> Tamil display
 * 2. Existing Tamil entry -> English display
 * 3. New English entry -> Tamil display
 * 4. New Tamil entry -> English display
 * 5. Switch English -> Tamil without refreshing
 * 6. Switch Tamil -> English without refreshing
 * 7. Dashboard recent entries translation
 * 8. Diary history translation
 * 9. Calendar entries translation
 * 10. Diary card & lightbox translation
 * 11. Shared workspace with two members using different languages
 * 12. Translation API failure & graceful fallback
 * 13. Missing translation metadata backfilling
 * 14. Original entry editing & cache invalidation
 * 15. Old Firestore records compatibility
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

import {
  detectLanguage,
  translateText,
  translateDiaryEntry,
  getCachedTranslationSync,
  saveEntryTranslation,
  clearAllTranslationCache
} from '../src/services/translationService.js';

import {
  getEntryDisplayContent,
  getSampleEntriesForWorkspace,
  createDiaryEntry,
  updateDiaryEntry
} from '../src/services/entryService.js';

// Setup Mock LocalStorage
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
console.log('   PHASE 11.1 — DIARY CONTENT TRANSLATION REPAIR TESTS');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: Existing Entry Translation in Default Workspaces
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Existing Sample Entries Bilingual Completeness ---');

it('Existing Personal workspace entries have full Tamil translations', () => {
  const perEntries = getSampleEntriesForWorkspace('ws-per-1', 'personal');
  assert.strictEqual(perEntries.length, 2);

  const entry1 = perEntries[0];
  assert.strictEqual(entry1.title, 'Morning 5K Jog & Health Reflections');
  assert.ok(entry1.translations?.ta?.title, 'entry-per-1 must have translations.ta.title');
  assert.strictEqual(entry1.translations.ta.title, 'காலை 5 கிமீ நடைப்பயிற்சி மற்றும் ஆரோக்கியம்');

  const entry2 = perEntries[1];
  assert.ok(entry2.translations?.ta?.title, 'entry-per-2 must have translations.ta.title');
  assert.strictEqual(entry2.translations.ta.title, '"அணு பழக்கங்கள்" வாசிப்பு — அத்தியாயம் 4 நுண்ணறிவு');
});

it('Existing Family workspace entries have full bilingual translations', () => {
  const famEntries = getSampleEntriesForWorkspace('ws-fam-1', 'family');
  assert.strictEqual(famEntries.length, 2);

  // English source entry has Tamil translation
  assert.ok(famEntries[0].translations?.ta?.title);
  assert.strictEqual(famEntries[0].translations.ta.title, 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு');

  // Tamil source entry has English translation
  assert.ok(famEntries[1].translations?.en?.title);
  assert.strictEqual(famEntries[1].translations.en.title, 'Family Dinner & School Science Project Discussion');
});

it('Existing Business workspace entries have full bilingual translations', () => {
  const bizEntries = getSampleEntriesForWorkspace('ws-biz-1', 'business');
  assert.strictEqual(bizEntries.length, 2);

  assert.ok(bizEntries[0].translations?.ta?.title);
  assert.strictEqual(bizEntries[0].translations.ta.title, 'வணிக மொத்த தானிய தீர்வு பெறப்பட்டது');

  assert.ok(bizEntries[1].translations?.ta?.title);
  assert.strictEqual(bizEntries[1].translations.ta.title, 'காலாண்டு தளவாடங்கள் மற்றும் போக்குவரத்து முன்பணம்');
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: Core Cases 1 to 4 (Existing & New Entries Translation)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Core Cases 1 to 4 (Existing & New Entries) ---');

it('Case 1: Existing English entry displays in Tamil when viewing in "ta"', () => {
  const existingEnEntry = {
    id: 'entry-en-legacy',
    title: 'Morning 5K Jog & Health Reflections',
    description: 'Paced 5 kilometers at sunrise. Feeling refreshed and focused on long-term wellness habits.',
    sourceLanguage: 'en',
    detectedLanguage: 'en',
    translations: {
      ta: {
        title: 'காலை 5 கிமீ நடைப்பயிற்சி மற்றும் ஆரோக்கியம்',
        description: 'சூரிய உதயத்தில் 5 கிலோமீட்டர் தூரம் ஓடினேன். புத்துணர்ச்சியுடனும் நீண்ட கால நலப் பழக்கங்களில் கவனம் செலுத்துவதாகவும் உணர்கிறேன்.'
      }
    }
  };

  const display = getEntryDisplayContent(existingEnEntry, 'ta');
  assert.strictEqual(display.title, 'காலை 5 கிமீ நடைப்பயிற்சி மற்றும் ஆரோக்கியம்');
  assert.strictEqual(display.isTranslated, true);
  assert.strictEqual(display.isOriginal, false);
});

it('Case 2: Existing Tamil entry displays in English when viewing in "en"', () => {
  const existingTaEntry = {
    id: 'entry-ta-legacy',
    title: 'குடும்ப இரவு உணவு மற்றும் அறிவியல் திட்டம்',
    description: 'மாலையில் அனைவருடனும் கூடினோம். குழந்தைகளின் சூரிய குடும்ப திட்ட மாதிரியை உருவாக்க உதவினேன்.',
    sourceLanguage: 'ta',
    detectedLanguage: 'ta',
    translations: {
      en: {
        title: 'Family Dinner & School Science Project Discussion',
        description: 'Gathered with everyone in the evening. Helped the kids build their solar system project model.'
      }
    }
  };

  const display = getEntryDisplayContent(existingTaEntry, 'en');
  assert.strictEqual(display.title, 'Family Dinner & School Science Project Discussion');
  assert.strictEqual(display.isTranslated, true);
  assert.strictEqual(display.isOriginal, false);
});

await itAsync('Case 3: Newly created English entry translates to Tamil on-demand', async () => {
  const newEntry = {
    id: 'entry-new-en-1',
    title: 'Commercial Wholesale Grain Settlement Received',
    description: 'Received bank wire transfer for 85 quintals of produce delivered to Sri Murugan Traders.',
    sourceLanguage: 'en',
    detectedLanguage: 'en',
    translations: {}
  };

  const res = await translateDiaryEntry(newEntry, 'ta');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.title, 'வணிக மொத்த தானிய தீர்வு பெறப்பட்டது');
  assert.strictEqual(res.description, 'ஸ்ரீ முருகன் டிரேடர்ஸுக்கு வழங்கப்பட்ட 85 குவிண்டால் விளைபொருட்களுக்கான வங்கி பரிமாற்றம் பெறப்பட்டது.');
});

await itAsync('Case 4: Newly created Tamil entry translates to English on-demand', async () => {
  const newEntry = {
    id: 'entry-new-ta-1',
    title: 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு',
    description: 'தொகுதி A மற்றும் B-க்கான நீர்ப்பாசன அட்டவணை நிறைவுற்றது. தெளிப்பான் அழுத்தத்தை சரிபார்த்து வடக்கு பாசன கால்வாயில் வண்டல் அகற்றப்பட்டது.',
    sourceLanguage: 'ta',
    detectedLanguage: 'ta',
    translations: {}
  };

  const res = await translateDiaryEntry(newEntry, 'en');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.title, 'Paddy Field Sowing & Water Canal Maintenance');
  assert.strictEqual(res.description, 'Completed watering schedule for block A & B. Checked sprinkler pressure and cleared silt along the north irrigation canal.');
});

// -----------------------------------------------------------------------------
// TEST SUITE 3: Cases 5 & 6 (Instantaneous Language Switching Without Refresh)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Cases 5 & 6 (Instantaneous Language Switching) ---');

it('Case 5: Switch English -> Tamil without refreshing displays Tamil immediately', () => {
  const entry = {
    id: 'entry-live-switch',
    title: 'Reading "Atomic Habits" — Chapter 4 Insights',
    description: 'The key takeaway: we do not rise to the level of our goals, we fall to the level of our systems.',
    sourceLanguage: 'en',
    translations: {
      ta: {
        title: '"அணு பழக்கங்கள்" வாசிப்பு — அத்தியாயம் 4 நுண்ணறிவு',
        description: 'முக்கிய கருத்து: நாம் நமது இலக்குகளின் நிலைக்கு உயர்வதில்லை, நமது அமைப்புகளின் நிலைக்கு விழுகிறோம்.'
      }
    }
  };

  // Initially on English
  const enState = getEntryDisplayContent(entry, 'en');
  assert.strictEqual(enState.title, 'Reading "Atomic Habits" — Chapter 4 Insights');
  assert.strictEqual(enState.isTranslated, false);

  // User selects Tamil in dropdown
  const taState = getEntryDisplayContent(entry, 'ta');
  assert.strictEqual(taState.title, '"அணு பழக்கங்கள்" வாசிப்பு — அத்தியாயம் 4 நுண்ணறிவு');
  assert.strictEqual(taState.isTranslated, true);
});

it('Case 6: Switch Tamil -> English without refreshing displays English immediately', () => {
  const entry = {
    id: 'entry-live-switch-2',
    title: 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு',
    description: 'தொகுதி A மற்றும் B-க்கான நீர்ப்பாசன அட்டவணை நிறைவுற்றது.',
    sourceLanguage: 'ta',
    translations: {
      en: {
        title: 'Paddy Field Sowing & Water Canal Maintenance',
        description: 'Completed watering schedule for block A & B.'
      }
    }
  };

  // Initially on Tamil
  const taState = getEntryDisplayContent(entry, 'ta');
  assert.strictEqual(taState.title, 'விதைப்பு மற்றும் பாசன கால்வாய் பராமரிப்பு');
  assert.strictEqual(taState.isTranslated, false);

  // User selects English in dropdown
  const enState = getEntryDisplayContent(entry, 'en');
  assert.strictEqual(enState.title, 'Paddy Field Sowing & Water Canal Maintenance');
  assert.strictEqual(enState.isTranslated, true);
});

// -----------------------------------------------------------------------------
// TEST SUITE 4: Cases 7 to 10 (Component Integration Verification)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Cases 7 to 10 (View Integration Verification) ---');

it('Case 7: Dashboard (HomeView) recent entries use centralized translation hook', () => {
  const homeViewCode = fs.readFileSync(path.resolve('src/views/HomeView.jsx'), 'utf-8');
  assert.ok(homeViewCode.includes('useTranslatedDiaryEntry'), 'HomeView imports useTranslatedDiaryEntry hook');
  assert.ok(homeViewCode.includes('<RecentActivityItem'), 'HomeView renders RecentActivityItem subcomponent');
  assert.ok(homeViewCode.includes('useTranslatedDiaryEntry(entry)'), 'RecentActivityItem calls useTranslatedDiaryEntry');
});

it('Case 8: Diary timeline (DiaryView) uses DiaryEntryCard with centralized hook', () => {
  const diaryCardCode = fs.readFileSync(path.resolve('src/components/DiaryEntryCard.jsx'), 'utf-8');
  assert.ok(diaryCardCode.includes('useTranslatedDiaryEntry'), 'DiaryEntryCard imports useTranslatedDiaryEntry');
  assert.ok(diaryCardCode.includes('TranslationBadge'), 'DiaryEntryCard renders TranslationBadge');
});

it('Case 9: Calendar (CalendarView) date popovers use centralized translation hook', () => {
  const calViewCode = fs.readFileSync(path.resolve('src/views/CalendarView.jsx'), 'utf-8');
  assert.ok(calViewCode.includes('useTranslatedDiaryEntry'), 'CalendarView imports useTranslatedDiaryEntry');
  assert.ok(calViewCode.includes('CalendarEntryItem'), 'CalendarView renders CalendarEntryItem');
});

it('Case 10: Analytics (AnalyticsView) uses centralized translation hook for activities', () => {
  const analyticsCode = fs.readFileSync(path.resolve('src/views/AnalyticsView.jsx'), 'utf-8');
  assert.ok(analyticsCode.includes('useTranslatedDiaryEntry'), 'AnalyticsView imports useTranslatedDiaryEntry');
  assert.ok(analyticsCode.includes('AnalyticsEntryCardItem'), 'AnalyticsView renders AnalyticsEntryCardItem');
});

// -----------------------------------------------------------------------------
// TEST SUITE 5: Cases 11 to 15 (Security, Invalidation & Compatibility)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Cases 11 to 15 (Security, Invalidation & Compatibility) ---');

it('Case 11: Shared workspace language independence (Member A vs Member B)', () => {
  const sharedEntry = {
    id: 'shared-entry-1',
    title: 'விதை விதைத்தேன்',
    description: 'மழைக்கு முன் விதைப்பு முடிந்தது',
    sourceLanguage: 'ta',
    translations: {
      en: {
        title: 'Sowed seeds',
        description: 'Sowing completed before rain'
      }
    }
  };

  // Member A (Tamil)
  const memberAView = getEntryDisplayContent(sharedEntry, 'ta');
  assert.strictEqual(memberAView.title, 'விதை விதைத்தேன்');
  assert.strictEqual(memberAView.isOriginal, true);

  // Member B (English)
  const memberBView = getEntryDisplayContent(sharedEntry, 'en');
  assert.strictEqual(memberBView.title, 'Sowed seeds');
  assert.strictEqual(memberBView.isTranslated, true);

  // Viewing by Member B never mutates original entry
  assert.strictEqual(sharedEntry.title, 'விதை விதைத்தேன்');
});

await itAsync('Case 12: Translation provider failure safely displays original content', async () => {
  const customTamil = 'முற்றிலும் புதிய தனித்துவமான சொல் தொகுதி';
  const res = await translateText(customTamil, 'ta', 'en', { bypassCache: true });

  // On offline/simulated failure, returns original content safely
  assert.ok(res.text !== undefined && res.text.length > 0);
  assert.strictEqual(res.sourceLang, 'ta');
  assert.strictEqual(res.text, customTamil);
});

it('Case 13: Missing translation metadata dynamically backfilled from dictionary or cache', () => {
  // An entry created without sourceLanguage or translations
  const entryWithoutMetadata = {
    id: 'untranslated-1',
    title: 'Worked in the field today',
    description: 'Watered the field in the morning'
  };

  const displayTa = getEntryDisplayContent(entryWithoutMetadata, 'ta');
  assert.strictEqual(displayTa.title, 'இன்று வயலில் வேலை செய்தேன்');
  assert.strictEqual(displayTa.description, 'காலை தண்ணீர் பாய்ச்சினேன்');
  assert.strictEqual(displayTa.isTranslated, true);
});

await itAsync('Case 14: Original entry editing invalidates outdated translations and increments version', async () => {
  const wsId = 'ws-test-repair';
  const entry = {
    id: 'entry-inval-test',
    title: 'Morning 5K Jog & Health Reflections',
    description: 'Paced 5 kilometers at sunrise.',
    sourceLanguage: 'en',
    detectedLanguage: 'en',
    translationVersion: 1,
    translations: {
      ta: {
        title: 'காலை 5 கிமீ நடைப்பயிற்சி மற்றும் ஆரோக்கியம்',
        description: 'சூரிய உதயத்தில் 5 கிலோமீட்டர் தூரம் ஓடினேன்.'
      }
    }
  };

  mockStorage.set(`pdt_entries_${wsId}`, JSON.stringify([entry]));

  const updated = await updateDiaryEntry(wsId, entry.id, {
    title: 'Evening 10K Cycling Workout'
  });

  assert.deepStrictEqual(updated.translations, {});
  assert.strictEqual(updated.translationVersion, 2);
  assert.strictEqual(updated.title, 'Evening 10K Cycling Workout');
});

it('Case 15: Old legacy Firestore records without translation metadata remain compatible', () => {
  const legacyRecord = {
    id: 'legacy-p1',
    title: 'Old Harvest Record 2024',
    description: 'Paddy harvest block 3',
    entryType: 'Agriculture',
    date: '2024-05-10',
    time: '09:00'
  };

  // Viewing in English
  const enRes = getEntryDisplayContent(legacyRecord, 'en');
  assert.strictEqual(enRes.title, 'Old Harvest Record 2024');
  assert.strictEqual(enRes.isOriginal, true);

  // Viewing in Tamil
  const taRes = getEntryDisplayContent(legacyRecord, 'ta');
  assert.strictEqual(taRes.title, 'Old Harvest Record 2024');
  assert.strictEqual(taRes.isOriginal, true);
});

console.log('\n======================================================');
console.log(`TOTAL PHASE 11.1 TESTS EXECUTED: ${testsRun}`);
console.log(`PASSED: ${testsPassed}`);
console.log(`FAILED: ${testsRun - testsPassed}`);
console.log('======================================================\n');

if (testsRun === testsPassed) {
  console.log('Phase 11.1 Content Translation Repair Tests Passed Successfully!\n');
  process.exit(0);
} else {
  console.error('Phase 11.1 Tests Failed!\n');
  process.exit(1);
}

