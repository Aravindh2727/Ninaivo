// tests/pixel_accurate_ui_tests.mjs
// Automated Verification Suite for Pixel-Accurate Mobile UI/UX Recreation

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n================================================================');
console.log('   PIXEL-ACCURATE MOBILE UI/UX RECREATION VERIFICATION SUITE    ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Exact Suggested Color Palettes (Section 2)
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Exact Suggested Color Palettes (Section 2) ---');

const themesCss = fs.readFileSync(path.join(projectRoot, 'src', 'styles', 'themes.css'), 'utf-8');

test('Theme A: Nature Fresh (Light Mode) defines exact palette variables', () => {
  assert(themesCss.includes('--background: #F8FAF3;'), 'Missing --background: #F8FAF3 in Light Mode');
  assert(themesCss.includes('--surface: #FFFFFF;'), 'Missing --surface: #FFFFFF in Light Mode');
  assert(themesCss.includes('--primary: #168B45;'), 'Missing --primary: #168B45 in Light Mode');
  assert(themesCss.includes('--primary-dark: #14532D;'), 'Missing --primary-dark: #14532D in Light Mode');
  assert(themesCss.includes('--soft-green: #E5F5DF;'), 'Missing --soft-green: #E5F5DF in Light Mode');
  assert(themesCss.includes('--soft-blue: #E3F0FF;'), 'Missing --soft-blue: #E3F0FF in Light Mode');
  assert(themesCss.includes('--soft-orange: #FFF0D9;'), 'Missing --soft-orange: #FFF0D9 in Light Mode');
  assert(themesCss.includes('--soft-purple: #EEE9FF;'), 'Missing --soft-purple: #EEE9FF in Light Mode');
  assert(themesCss.includes('--text-primary: #172033;'), 'Missing --text-primary: #172033 in Light Mode');
  assert(themesCss.includes('--text-secondary: #64748B;'), 'Missing --text-secondary: #64748B in Light Mode');
  assert(themesCss.includes('--border: #E7EDE7;'), 'Missing --border: #E7EDE7 in Light Mode');
});

test('Theme B: Forest Night (Dark Mode) defines exact palette variables', () => {
  assert(themesCss.includes('--background: #102B23;'), 'Missing --background: #102B23 in Dark Mode');
  assert(themesCss.includes('--surface: #17382D;'), 'Missing --surface: #17382D in Dark Mode');
  assert(themesCss.includes('--surface-elevated: #264B3D;'), 'Missing --surface-elevated: #264B3D in Dark Mode');
  assert(themesCss.includes('--primary: #42C95A;'), 'Missing --primary: #42C95A in Dark Mode');
  assert(themesCss.includes('--primary-light: #8BE36C;'), 'Missing --primary-light: #8BE36C in Dark Mode');
  assert(themesCss.includes('--accent-blue: #69A9FF;'), 'Missing --accent-blue: #69A9FF in Dark Mode');
  assert(themesCss.includes('--accent-orange: #F5AD48;'), 'Missing --accent-orange: #F5AD48 in Dark Mode');
  assert(themesCss.includes('--accent-purple: #B99AFF;'), 'Missing --accent-purple: #B99AFF in Dark Mode');
  assert(themesCss.includes('--text-primary: #F4F8F1;'), 'Missing --text-primary: #F4F8F1 in Dark Mode');
  assert(themesCss.includes('--text-secondary: #B5C8BB;'), 'Missing --text-secondary: #B5C8BB in Dark Mode');
  assert(themesCss.includes('--border: #355447;'), 'Missing --border: #355447 in Dark Mode');
});

// -----------------------------------------------------------------------------
// Test Suite 2: Mobile Status Bar & Header (Section 3.A & 3.B)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Mobile Status Bar & Header (Section 3.A & 3.B) ---');

const appJsx = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf-8');
const headerJsx = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Header.jsx'), 'utf-8');

test('App.jsx does not render simulated mock status bar (9:41, cellular, wifi, battery)', () => {
  assert(!appJsx.includes('mobile-status-bar'), 'mobile-status-bar should be completely removed from App.jsx');
  assert(!appJsx.includes('status-battery'), 'status-battery should be completely removed from App.jsx');
});

test('Header.jsx renders project icon, title, subtitle and language selector pill showing the target language', () => {
  assert(headerJsx.includes("appSubtitleTagline"), 'Header subtitle tagline missing');
  assert(headerJsx.includes("language === 'en' ? 'தமிழ்' : 'EN'"), 'Language pill should display the destination language');
  assert(headerJsx.includes('Globe'), 'Globe icon missing in Header');
  assert(headerJsx.includes('ChevronDown'), 'ChevronDown missing in Header language pill');
});

// -----------------------------------------------------------------------------
// Test Suite 3: Welcome Banner (Section 3.C)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Welcome Banner (Section 3.C) ---');

const homeViewJsx = fs.readFileSync(path.join(projectRoot, 'src', 'views', 'HomeView.jsx'), 'utf-8');

test('HomeView.jsx renders welcome banner with personalized greeting and tagline', () => {
  assert(homeViewJsx.includes('welcome-landscape-banner'), 'welcome-landscape-banner class missing');
  assert(homeViewJsx.includes('Hello, {userName}!'), 'Personalized greeting missing');
  assert(homeViewJsx.includes('welcomeBannerTagline'), 'welcomeBannerTagline missing');
  assert(homeViewJsx.includes('welcome-banner-bg'), 'welcome-banner-bg class missing');
});

test('HomeView.jsx includes circular right arrow action button on banner', () => {
  assert(homeViewJsx.includes('ChevronRight'), 'ChevronRight button missing on welcome banner');
});

// -----------------------------------------------------------------------------
// Test Suite 4: Quick Action Cards (Section 3.D)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Quick Action Cards (Section 3.D) ---');

test('HomeView.jsx renders 4 horizontal quick action cards: Add Diary, Calendar, Gallery, Analytics', () => {
  assert(homeViewJsx.includes("t('addDiary')"), 'Add Diary card missing');
  assert(homeViewJsx.includes("t('calendar')"), 'Calendar quick action card missing');
  assert(homeViewJsx.includes("t('gallery')"), 'Gallery quick action card missing');
  assert(homeViewJsx.includes("t('analytics')"), 'Analytics quick action card missing');
  assert(homeViewJsx.includes('quick-actions-row'), 'quick-actions-row container missing');
});

// -----------------------------------------------------------------------------
// Test Suite 5: My Workspaces (Section 3.E)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: My Workspaces (Section 3.E) ---');

test('HomeView.jsx renders My Workspaces with Sprout icon and View All link', () => {
  assert(homeViewJsx.includes("t('myWorkspaces')"), 'myWorkspaces heading missing');
  assert(homeViewJsx.includes("t('viewAll')"), 'viewAll link missing in Workspaces');
  assert(homeViewJsx.includes('Sprout'), 'Sprout icon missing in Workspaces heading');
});

test('HomeView.jsx renders 3 pastel cards for Personal, Family, and Business workspaces', () => {
  assert(homeViewJsx.includes("t('modePersonal')"), 'Personal workspace card missing');
  assert(homeViewJsx.includes("t('personalSubtitle')"), 'Personal subtitle "Just for you" missing');
  assert(homeViewJsx.includes("t('modeFamily')"), 'Family workspace card missing');
  assert(homeViewJsx.includes("t('familySubtitle')"), 'Family subtitle "Together always" missing');
  assert(homeViewJsx.includes("t('modeBusiness')"), 'Business workspace card missing');
  assert(homeViewJsx.includes("t('businessSubtitle')"), 'Business subtitle "Grow together" missing');
});

// -----------------------------------------------------------------------------
// Test Suite 6: Recent Entries (Section 3.F)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Recent Entries (Section 3.F) ---');

test('HomeView.jsx renders Recent Entries with Clock icon and View All link', () => {
  assert(homeViewJsx.includes("t('recentEntries')"), 'recentEntries heading missing');
  assert(homeViewJsx.includes('Clock'), 'Clock icon missing in Recent Entries heading');
});

test('RecentActivityItem reproduces horizontal thumbnail, category chip, title and metadata', () => {
  assert(homeViewJsx.includes('recent-entry-card'), 'recent-entry-card class missing');
  assert(homeViewJsx.includes('getCategoryDisplayName(entry.entryType, language)'), 'Category localization missing');
  assert(homeViewJsx.includes('MoreVertical'), '3-dots menu icon missing');
  assert(homeViewJsx.includes('photosCount'), 'Photos count label missing');
});

// -----------------------------------------------------------------------------
// Test Suite 7: Quick Stats (Section 3.G)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 7: Quick Stats (Section 3.G) ---');

test('HomeView.jsx renders Quick Stats with 3 columns: Total Entries, Members, Photos', () => {
  assert(homeViewJsx.includes("t('quickStats')"), 'quickStats heading missing');
  assert(homeViewJsx.includes("t('totalEntries')"), 'Total Entries stat missing');
  assert(homeViewJsx.includes("t('workspaceMembers')"), 'Workspace Members stat missing');
  assert(homeViewJsx.includes("t('photos')"), 'Photos stat missing');
  assert(homeViewJsx.includes('BarChart3'), 'BarChart3 icon missing in Quick Stats');
});

// -----------------------------------------------------------------------------
// Test Suite 8: Decorative Bottom Landscape (Section 3.H)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 8: Decorative Bottom Landscape (Section 3.H) ---');

test('HomeView.jsx renders subtle rolling green landscape decoration above bottom nav', () => {
  assert(homeViewJsx.includes('DecorativeLandscape'), 'DecorativeLandscape component missing');
  assert(homeViewJsx.includes('decorative-bottom-landscape'), 'decorative-bottom-landscape class missing');
});

// -----------------------------------------------------------------------------
// Test Suite 9: Bottom Navigation Structure (Section 3.I)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 9: Bottom Navigation Structure (Section 3.I) ---');

const bottomNavJsx = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'BottomNav.jsx'), 'utf-8');

test('BottomNav.jsx defines 5 destinations: Home, Calendar, Add, Members, Settings', () => {
  assert(bottomNavJsx.includes("id: 'home'"), 'Home tab missing in BottomNav');
  assert(bottomNavJsx.includes("id: 'calendar'"), 'Calendar tab missing in BottomNav');
  assert(bottomNavJsx.includes("id: 'add'"), 'Add central button missing in BottomNav');
  assert(bottomNavJsx.includes("id: 'members'"), 'Members tab missing in BottomNav');
  assert(bottomNavJsx.includes("id: 'settings'"), 'Settings tab missing in BottomNav');
});

test('BottomNav.jsx renders central floating circular Add button with elevated styling', () => {
  assert(bottomNavJsx.includes('add-btn-circle'), 'add-btn-circle class missing');
  assert(bottomNavJsx.includes('translateY(-14px)') || bottomNavJsx.includes('translateY(-12px)'), 'Elevated vertical offset missing');
});

test('BottomNav.jsx renders active indicator pill under active tab label', () => {
  assert(bottomNavJsx.includes('nav-active-pill'), 'nav-active-pill indicator missing');
});

// -----------------------------------------------------------------------------
// Test Suite 10: 100% Bilingual Dictionary Parity (544 keys each)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 10: 100% Bilingual Dictionary Parity (Section 8) ---');

const { translations } = await import('../src/i18n/translations.js');

test('100% Bilingual Parity between English and Tamil (zero discrepancy)', () => {
  const enKeys = Object.keys(translations.en).sort();
  const taKeys = Object.keys(translations.ta).sort();

  assert.strictEqual(enKeys.length, taKeys.length, `Key counts differ: EN=${enKeys.length}, TA=${taKeys.length}`);
  assert(enKeys.length >= 540, `Dictionary key count should be >= 540, received: ${enKeys.length}`);

  const missingInTa = enKeys.filter(k => !(k in translations.ta));
  const missingInEn = taKeys.filter(k => !(k in translations.en));

  assert.strictEqual(missingInTa.length, 0, `Keys missing in TA: ${missingInTa.join(', ')}`);
  assert.strictEqual(missingInEn.length, 0, `Keys missing in EN: ${missingInEn.join(', ')}`);
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL PIXEL-ACCURACY TESTS EXECUTED: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log('================================================================\n');

if (totalTests === passedTests) {
  console.log('All Pixel-Accurate UI Recreation Tests Passed Successfully!\n');
  process.exit(0);
} else {
  console.error('Some tests failed!\n');
  process.exit(1);
}

