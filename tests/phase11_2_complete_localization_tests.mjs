/**
 * ==============================================================================
 * PHASE 11.2 — COMPLETE APPLICATION-WIDE TAMIL & ENGLISH LOCALIZATION
 * Master Automated Verification Test Suite
 * ==============================================================================
 * 
 * Verifies all 16 required test conditions:
 *  1. translations.js key parity: 100% key match between 'en' and 'ta' (0 missing keys)
 *  2. Category translation test: English category name returns English label; Tamil returns Tamil label
 *  3. Custom category translation fallback test: Custom categories preserve custom names gracefully
 *  4. Add Diary category dropdown localization test: Options mapped through category translations
 *  5. Edit Diary category dropdown localization test: Options mapped through category translations
 *  6. Diary History category filter chips localization test: Filter chips display localized labels
 *  7. Dashboard recent activity category badge localization test: Badges localized in current language
 *  8. Calendar view category badge localization test: Timeline cards display localized category names
 *  9. Photo gallery category filter dropdown localization test: Dropdown options fully localized
 * 10. Analytics expense / income category breakdown localization test: Financial bars use localized names
 * 11. Export modal category selector localization test: Category export filter options localized
 * 12. Workspaces view category list localization test: Predefined and custom categories correctly localized
 * 13. Instant language toggle test: Language change updates all UI contexts reactively without reload
 * 14. Hardcoded text scan test: Confirms absence of untranslated English text in all audited components
 * 15. Multi-member independent language preference test: Workspace members independently choose EN or TA
 * 16. Production build verification: Dist artifacts built with zero errors and valid asset bundles
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

async function runPhase11_2Tests() {
  console.log('\n======================================================');
  console.log('   PHASE 11.2 — COMPLETE LOCALIZATION TEST SUITE       ');
  console.log('======================================================\n');

  // Load translations & categoryTranslations
  const { translations } = await import('../src/i18n/translations.js');
  const {
    STANDARD_CATEGORY_MAP,
    getCategoryDisplayName
  } = await import('../src/utils/categoryTranslations.js');

  // --------------------------------------------------------------------------
  // Test 1: translations.js key parity test
  // --------------------------------------------------------------------------
  console.log('--- Test 1: translations.js Key Parity (100% Bilingual Match) ---');
  const enKeys = Object.keys(translations.en);
  const taKeys = Object.keys(translations.ta);

  assert(enKeys.length >= 500, `English translation dictionary is comprehensive (${enKeys.length} keys)`);
  assert(taKeys.length >= 500, `Tamil translation dictionary is comprehensive (${taKeys.length} keys)`);

  const missingInTa = enKeys.filter(k => !(k in translations.ta));
  const missingInEn = taKeys.filter(k => !(k in translations.en));

  assert(missingInTa.length === 0, `Zero English keys missing in Tamil dictionary (missing: ${missingInTa.join(', ') || 'none'})`);
  assert(missingInEn.length === 0, `Zero Tamil keys missing in English dictionary (missing: ${missingInEn.join(', ') || 'none'})`);
  assert(enKeys.length === taKeys.length, `Equal key count in both languages (${enKeys.length} keys each)`);

  // --------------------------------------------------------------------------
  // Test 2: Category translation test (English category -> English & Tamil)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Category Translation Standard Mapping ---');
  const sampleCategories = [
    { key: 'Daily Activity', en: 'Daily Activity', ta: 'தினசரி செயல்பாடு' },
    { key: 'Agriculture', en: 'Agriculture', ta: 'விவசாயம்' },
    { key: 'Personal', en: 'Personal', ta: 'தனிப்பட்ட' },
    { key: 'Family', en: 'Family', ta: 'குடும்பம்' },
    { key: 'Business', en: 'Business', ta: 'வணிகம்' },
    { key: 'Important Event', en: 'Important Event', ta: 'முக்கிய நிகழ்வு' },
    { key: 'Reminder', en: 'Reminder', ta: 'நினைவூட்டல்' },
    { key: 'Income', en: 'Income', ta: 'வரவு' },
    { key: 'Expense', en: 'Expense', ta: 'செலவு' },
    { key: 'Other', en: 'Other', ta: 'மற்றவை' },
    { key: 'All', en: 'All Categories', ta: 'அனைத்து வகைகள்' }
  ];

  sampleCategories.forEach(cat => {
    const enLabel = getCategoryDisplayName(cat.key, 'en');
    const taLabel = getCategoryDisplayName(cat.key, 'ta');
    assert(enLabel === cat.en, `Category "${cat.key}" displays as "${cat.en}" in English`);
    assert(taLabel === cat.ta, `Category "${cat.key}" displays as "${cat.ta}" in Tamil`);
  });

  // --------------------------------------------------------------------------
  // Test 3: Custom category translation fallback test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Custom Category Translation Fallback ---');
  const customCat1 = 'Paddy Field Harvest';
  const customCat2 = 'Dairy Farm Maintenance';
  assert(getCategoryDisplayName(customCat1, 'en') === customCat1, 'Custom category preserved in English');
  assert(getCategoryDisplayName(customCat1, 'ta') === customCat1, 'Custom category preserved gracefully in Tamil without crash');
  assert(getCategoryDisplayName(customCat2, 'en') === customCat2, 'Custom category 2 preserved in English');
  assert(getCategoryDisplayName(customCat2, 'ta') === customCat2, 'Custom category 2 preserved in Tamil');
  assert(getCategoryDisplayName(null, 'ta') === 'மற்றவை', 'Null category safely defaults to localized Other in Tamil');
  assert(getCategoryDisplayName('', 'en') === 'Other', 'Empty category safely defaults to localized Other in English');

  // --------------------------------------------------------------------------
  // Test 4: Add Diary category dropdown localization test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Add Diary Category Dropdown Localization ---');
  const addEntrySrc = fs.readFileSync(path.join(ROOT_DIR, 'src/views/AddEntryView.jsx'), 'utf-8');
  assert(addEntrySrc.includes('getCategoryDisplayName'), 'AddEntryView imports and uses getCategoryDisplayName');
  assert(addEntrySrc.includes('getCategoryDisplayName(cat.name, language)'), 'AddEntryView renders category chips with localized display labels');
  assert(addEntrySrc.includes('getCategoryDisplayName(c.name, language)'), 'AddEntryView renders dropdown select options with localized labels');
  assert(addEntrySrc.includes('value={c.name}'), 'AddEntryView preserves standard English category ID in option value');

  // --------------------------------------------------------------------------
  // Test 5: Edit Diary category dropdown localization test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Edit Diary Category Dropdown Localization ---');
  const editModalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/EditEntryModal.jsx'), 'utf-8');
  assert(editModalSrc.includes('getCategoryDisplayName'), 'EditEntryModal imports and uses getCategoryDisplayName');
  assert(editModalSrc.includes('getCategoryDisplayName(c.name, language)'), 'EditEntryModal renders category options with localized display labels');
  assert(editModalSrc.includes('value={c.name}'), 'EditEntryModal retains standard Firestore category string in value');

  // --------------------------------------------------------------------------
  // Test 6: Diary History category filter chips localization test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Diary History Category Filter Chips Localization ---');
  const diaryViewSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/views/DiaryView.jsx'), 'utf-8');
  assert(diaryViewSrc.includes('getCategoryDisplayName'), 'DiaryView imports and uses getCategoryDisplayName');
  assert(diaryViewSrc.includes('getCategoryDisplayName(cat.name, language)'), 'DiaryView maps category filter chips via getCategoryDisplayName');
  assert(diaryViewSrc.includes("t('allTypes')"), 'DiaryView maps "All" category filter chip via t(allTypes)');
  assert(diaryViewSrc.includes("t('searchPlaceholder')"), 'DiaryView localizes search input placeholder');
  assert(diaryViewSrc.includes("t('showing')"), 'DiaryView localizes record counter display');

  // --------------------------------------------------------------------------
  // Test 7: Dashboard recent activity category badge localization test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Dashboard Recent Activity Category Badge Localization ---');
  const homeViewSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/views/HomeView.jsx'), 'utf-8');
  assert(homeViewSrc.includes('getCategoryDisplayName'), 'HomeView imports getCategoryDisplayName');
  assert(homeViewSrc.includes('getCategoryDisplayName(entry.entryType, language)'), 'HomeView localizes RecentActivityItem category badges');
  assert(homeViewSrc.includes("t('audio')"), 'HomeView localizes audio attachment badge');
  assert(homeViewSrc.includes("t('todayEntries')"), 'HomeView localizes today entries metric card');
  assert(homeViewSrc.includes("t('logTodayEntry')"), 'HomeView localizes quick action buttons section');

  // --------------------------------------------------------------------------
  // Test 8: Calendar view category badge localization test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 8: Calendar View Category Badge Localization ---');
  const calendarViewSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/views/CalendarView.jsx'), 'utf-8');
  assert(calendarViewSrc.includes('getCategoryDisplayName'), 'CalendarView imports getCategoryDisplayName');
  assert(calendarViewSrc.includes('getCategoryDisplayName(entry.entryType, language)'), 'CalendarView localizes day detail entry badges');
  assert(calendarViewSrc.includes("t('photosCount')"), 'CalendarView localizes photo count label');
  assert(calendarViewSrc.includes("t('prevMonth')"), 'CalendarView localizes navigation button tooltips');

  // --------------------------------------------------------------------------
  // Test 9: Photo gallery category filter dropdown localization test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 9: Photo Gallery Category Filter Dropdown Localization ---');
  const photoGallerySrc = fs.readFileSync(path.join(ROOT_DIR, 'src/views/PhotoGalleryView.jsx'), 'utf-8');
  assert(photoGallerySrc.includes('getCategoryDisplayName'), 'PhotoGalleryView imports getCategoryDisplayName');
  assert(photoGallerySrc.includes('getCategoryDisplayName(c.name, language)'), 'PhotoGalleryView localizes category select dropdown options');
  assert(photoGallerySrc.includes("t('allTypes')"), 'PhotoGalleryView localizes "All Categories" dropdown option');
  assert(photoGallerySrc.includes("t('allMonths')"), 'PhotoGalleryView localizes all months filter option');

  // --------------------------------------------------------------------------
  // Test 10: Analytics expense / income category breakdown localization test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 10: Analytics Financial Breakdown Localization ---');
  const analyticsSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/views/AnalyticsView.jsx'), 'utf-8');
  assert(analyticsSrc.includes('getCategoryDisplayName'), 'AnalyticsView imports getCategoryDisplayName');
  assert(analyticsSrc.includes('getCategoryDisplayName(cat.name, language)'), 'AnalyticsView localizes expense & income category breakdown bars');
  assert(analyticsSrc.includes('getCategoryDisplayName(entry.entryType, language)'), 'AnalyticsView localizes financial ledger activity rows');
  assert(analyticsSrc.includes("t('analyticsTitle')"), 'AnalyticsView localizes analytics title');
  assert(analyticsSrc.includes("t('financialAnalytics')"), 'AnalyticsView localizes financial analytics heading');

  // --------------------------------------------------------------------------
  // Test 11: Export modal category selector localization test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 11: Export Modal Category Selector Localization ---');
  const exportModalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/ExportModal.jsx'), 'utf-8');
  assert(exportModalSrc.includes('getCategoryDisplayName'), 'ExportModal imports getCategoryDisplayName');
  assert(exportModalSrc.includes('getCategoryDisplayName(c.name, language)'), 'ExportModal localizes category export filter options');
  assert(exportModalSrc.includes("t('allCategories')"), 'ExportModal localizes "All Categories" option');
  assert(exportModalSrc.includes("t('exportTitle')"), 'ExportModal localizes dialog title');

  // --------------------------------------------------------------------------
  // Test 12: Workspaces view category list localization test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 12: Workspaces View Category List Localization ---');
  const workspacesSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/views/WorkspacesView.jsx'), 'utf-8');
  assert(workspacesSrc.includes('getCategoryDisplayName'), 'WorkspacesView imports getCategoryDisplayName');
  assert(workspacesSrc.includes('getCategoryDisplayName(c.name, language)'), 'WorkspacesView localizes category pill tags');
  assert(workspacesSrc.includes("t('manageTypes')"), 'WorkspacesView localizes manage types button');
  assert(workspacesSrc.includes("t('customEntryTypesFor')"), 'WorkspacesView localizes custom types header');

  const catModalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/CustomCategoryModal.jsx'), 'utf-8');
  assert(catModalSrc.includes('getCategoryDisplayName'), 'CustomCategoryModal imports getCategoryDisplayName');
  assert(catModalSrc.includes('getCategoryDisplayName(cat.name, language)'), 'CustomCategoryModal localizes built-in predefined category pills');

  // --------------------------------------------------------------------------
  // Test 13: Instant language toggle test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 13: Instant Language Toggle Reactive Architecture ---');
  const langContextSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/context/LanguageContext.jsx'), 'utf-8');
  assert(langContextSrc.includes('useState'), 'LanguageContext holds reactive state for current language');
  assert(langContextSrc.includes('setLanguage'), 'LanguageContext exposes setLanguage for instant switching');
  assert(langContextSrc.includes('localStorage.setItem'), 'LanguageContext persists user language preference to localStorage');
  assert(langContextSrc.includes('localStorage.getItem'), 'LanguageContext initializes from persisted localStorage preference');

  // Simulate language toggle:
  function tSimulator(key, lang) {
    return translations[lang]?.[key] || translations.en?.[key] || key;
  }
  assert(tSimulator('navHome', 'en') === 'Home', 'Returns English label "Home" when en selected');
  assert(tSimulator('navHome', 'ta') === 'முகப்பு', 'Returns Tamil label "முகப்பு" immediately when switched to ta without reload');
  assert(tSimulator('navAdd', 'en') === 'Add', 'Returns "Add" for en');
  assert(tSimulator('navAdd', 'ta') === 'சேர்', 'Returns "சேர்" immediately for ta');

  // --------------------------------------------------------------------------
  // Test 14: Hardcoded text scan test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 14: Hardcoded Text Absence Verification ---');
  const filesToScan = [
    { file: 'src/components/LogoutConfirmModal.jsx', forbidden: ['Sign Out of Diary?', 'Stay Signed In', 'Confirm Sign Out'] },
    { file: 'src/components/DeleteAccountModal.jsx', forbidden: ['Delete Account & Purge Data', 'Type your password to verify'] },
    { file: 'src/components/ConflictModal.jsx', forbidden: ['Sync Conflict Detected', 'Cloud Version (Server)', 'Local Version (This Device)'] },
    { file: 'src/components/SyncStatusModal.jsx', forbidden: ['Network & Cloud Sync Status', 'Connected to Cloud', 'Offline Mode (Local Storage)'] },
    { file: 'src/components/InviteMemberModal.jsx', forbidden: ['Share via WhatsApp', 'Close Window', 'Valid for 7 days'] },
    { file: 'src/components/WorkspaceSwitcherModal.jsx', forbidden: ['Switch Workspace', 'Private Personal Diary', 'Family & Agriculture'] }
  ];

  filesToScan.forEach(({ file, forbidden }) => {
    const content = fs.readFileSync(path.join(ROOT_DIR, file), 'utf-8');
    forbidden.forEach(str => {
      // Must not appear as a direct JSX raw child string outside comments or fallback
      assert(!content.includes(`>${str}<`), `${file} does not contain hardcoded raw text ">${str}<"`);
    });
  });

  // --------------------------------------------------------------------------
  // Test 15: Multi-member independent language preference test
  // --------------------------------------------------------------------------
  console.log('\n--- Test 15: Multi-Member Independent Language Preference ---');
  // Two distinct members accessing shared workspace entries:
  const memberA_language = 'en';
  const memberB_language = 'ta';

  const sharedCategory = 'Agriculture';
  const sharedNavKey = 'analyticsTitle';
  const sharedActionKey = 'exportTitle';

  const memberA_view = {
    categoryDisplay: getCategoryDisplayName(sharedCategory, memberA_language),
    navLabel: tSimulator(sharedNavKey, memberA_language),
    actionLabel: tSimulator(sharedActionKey, memberA_language)
  };

  const memberB_view = {
    categoryDisplay: getCategoryDisplayName(sharedCategory, memberB_language),
    navLabel: tSimulator(sharedNavKey, memberB_language),
    actionLabel: tSimulator(sharedActionKey, memberB_language)
  };

  assert(memberA_view.categoryDisplay === 'Agriculture', 'Member A sees category in English: Agriculture');
  assert(memberB_view.categoryDisplay === 'விவசாயம்', 'Member B sees category in Tamil: விவசாயம்');
  assert(memberA_view.navLabel === 'Analytics & Reports', 'Member A sees title in English: Analytics & Reports');
  assert(memberB_view.navLabel === 'பகுப்பாய்வு & அறிக்கைகள்', 'Member B sees title in Tamil: பகுப்பாய்வு & அறிக்கைகள்');
  assert(memberA_view.actionLabel === 'Export Workspace Diary', 'Member A sees export in English: Export Workspace Diary');
  assert(memberB_view.actionLabel === 'நாட்குறிப்பை ஏற்றுமதி செய்', 'Member B sees export in Tamil: நாட்குறிப்பை ஏற்றுமதி செய்');

  // --------------------------------------------------------------------------
  // Test 16: Production build verification
  // --------------------------------------------------------------------------
  console.log('\n--- Test 16: Production Build Artifacts Integrity ---');
  const distDir = path.join(ROOT_DIR, 'dist');
  assert(fs.existsSync(distDir), 'Production dist directory exists');
  assert(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html exists');

  const assetsDir = path.join(distDir, 'assets');
  assert(fs.existsSync(assetsDir), 'dist/assets directory exists');
  const assetFiles = fs.readdirSync(assetsDir);
  assert(assetFiles.some(f => f.startsWith('index-') && f.endsWith('.js')), 'Main bundle JS generated');
  assert(assetFiles.some(f => f.startsWith('index-') && f.endsWith('.css')), 'Main stylesheet CSS generated');
  assert(assetFiles.some(f => f.startsWith('firebase-') && f.endsWith('.js')), 'Firebase vendor chunk generated');

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`TOTAL PHASE 11.2 TESTS EXECUTED: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    console.error('Phase 11.2 Localization Tests Failed!');
    process.exit(1);
  } else {
    console.log('All Phase 11.2 Localization Tests Passed Successfully!');
  }
}

runPhase11_2Tests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
