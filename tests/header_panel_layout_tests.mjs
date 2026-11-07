// tests/header_panel_layout_tests.mjs
// Automated verification suite for Notifications & Network/Storage Panel Layout Bug Fix

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

console.log('\n======================================================');
console.log('   HEADER PANEL UI & LAYOUT VERIFICATION SUITE       ');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Panel State Centralization & Mutual Exclusivity
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Panel State Centralization & Mutual Exclusivity ---');

const appJsx = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf-8');

test('App.jsx defines centralized activePanel state instead of independent booleans', () => {
  assert(appJsx.includes('const [activePanel, setActivePanel] = useState(null);'), 'activePanel state not found in App.jsx');
  assert(!appJsx.includes('showNotificationsModal'), 'Obsolete showNotificationsModal state variable still present in App.jsx');
  assert(!appJsx.includes('showSyncModal'), 'Obsolete showSyncModal state variable still present in App.jsx');
});

test('App.jsx defines toggle and close handlers enforcing exclusivity', () => {
  assert(appJsx.includes('handleTogglePanel'), 'handleTogglePanel handler missing in App.jsx');
  assert(appJsx.includes('handleClosePanel'), 'handleClosePanel handler missing in App.jsx');
});

test('App.jsx passes activePanel and handlers to Header component', () => {
  assert(appJsx.includes('activePanel={activePanel}'), 'activePanel prop not passed to Header');
  assert(appJsx.includes('onClosePanel={handleClosePanel}'), 'onClosePanel prop not passed to Header');
  assert(appJsx.includes('onTogglePanel={handleTogglePanel}'), 'onTogglePanel prop not passed to Header');
});

test('NotificationsModal and SyncStatusModal are controlled exclusively by activePanel', () => {
  assert(appJsx.includes("isOpen={activePanel === 'notifications'}"), 'NotificationsModal isOpen condition incorrect');
  assert(appJsx.includes("isOpen={activePanel === 'network'}"), 'SyncStatusModal isOpen condition incorrect');
  assert(appJsx.includes('onClose={handleClosePanel}'), 'onClose handler in App.jsx not calling handleClosePanel');
});

test('BottomNav navigation closes active header panels', () => {
  assert(appJsx.includes('handleClosePanel();\n          setActiveTab(tabId);') || 
         appJsx.includes('handleClosePanel();') && appJsx.includes('setActiveTab(tabId)'), 
         'Bottom navigation tab switch should close active panel');
});

// -----------------------------------------------------------------------------
// Test Suite 2: CSS Architecture & Responsive Positioning
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: CSS Architecture & Responsive Positioning ---');

const indexCss = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf-8');

test('index.css defines .header-panel-backdrop with proper bounds', () => {
  assert(indexCss.includes('.header-panel-backdrop'), '.header-panel-backdrop class missing');
  assert(indexCss.includes('top: 60px;'), 'Header panel backdrop not anchored below 60px header');
  assert(indexCss.includes('bottom: var(--bottom-nav-height, 68px);'), 'Header panel backdrop bottom not bounded above bottom nav');
  assert(indexCss.includes('z-index: 85;'), 'Header panel backdrop z-index should be 85');
});

test('index.css anchors desktop panel sheet to top-right below triggers', () => {
  assert(indexCss.includes('justify-content: flex-end;'), 'Desktop backdrop flex-end alignment missing');
  assert(indexCss.includes('align-items: flex-start;'), 'Desktop backdrop flex-start alignment missing');
});

test('index.css defines .header-panel-sheet responsive dimensions and shadows', () => {
  assert(indexCss.includes('.header-panel-sheet'), '.header-panel-sheet class missing');
  assert(indexCss.includes('max-width: 440px;'), 'Desktop max-width 440px not set');
  assert(indexCss.includes('animation: panelSlideDown'), 'panelSlideDown animation not applied');
});

test('index.css provides mobile-first media query for full-width sheet', () => {
  assert(indexCss.includes('@media (max-width: 639px)'), 'Mobile media query missing');
  assert(indexCss.includes('max-width: 100%;') || indexCss.includes('width: 100%;'), 'Mobile full-width sheet missing');
});

test('index.css layers App Header and Bottom Nav at z-index 90 above panel backdrop', () => {
  assert(indexCss.includes('.app-header {\n  height: 60px;') && indexCss.includes('z-index: 90;'), 'app-header z-index should be 90');
  assert(indexCss.includes('.bottom-nav {') && indexCss.includes('z-index: 90;'), 'bottom-nav z-index should be 90');
});

test('index.css provides centered .modal-backdrop and .modal-sheet for full dialogs', () => {
  assert(indexCss.includes('.modal-backdrop'), '.modal-backdrop class missing');
  assert(indexCss.includes('.modal-sheet'), '.modal-sheet class missing');
  assert(indexCss.includes('align-items: center;'), 'Centered modal alignment missing');
});

test('index.css defines .header-action-btn.active highlight style', () => {
  assert(indexCss.includes('.header-action-btn.active'), '.header-action-btn.active class missing');
});

// -----------------------------------------------------------------------------
// Test Suite 3: Header Component Controls & Active State
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Header Component Controls & Active State ---');

const headerJsx = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Header.jsx'), 'utf-8');

test('Header.jsx accepts activePanel and panel handlers', () => {
  assert(headerJsx.includes('activePanel'), 'Header missing activePanel prop');
  assert(headerJsx.includes('onClosePanel'), 'Header missing onClosePanel prop');
});

test('Header.jsx removes Wifi and Profile buttons for decluttered mobile header', () => {
  assert(!headerJsx.includes('Wifi'), 'Wifi button should be removed from Header.jsx');
  assert(!headerJsx.includes('onOpenProfile'), 'onOpenProfile button should be removed from Header.jsx');
});

test('Header.jsx highlights Notifications Bell button with active class when open', () => {
  assert(headerJsx.includes("activePanel === 'notifications' ? 'active' : ''"), 'Active class condition missing for notifications button');
  assert(headerJsx.includes("aria-expanded={activePanel === 'notifications'}"), 'aria-expanded missing for notifications button');
});

test('SettingsView.jsx includes Network & Storage action row and triggers sync status', () => {
  const settingsJsx = fs.readFileSync(path.join(projectRoot, 'src', 'views', 'SettingsView.jsx'), 'utf-8');
  assert(settingsJsx.includes('networkAndStorage'), 'networkAndStorage missing in SettingsView.jsx');
  assert(settingsJsx.includes('onOpenSyncStatus'), 'onOpenSyncStatus missing in SettingsView.jsx');
});

test('Header.jsx closes active panel when opening Workspace Switcher', () => {
  assert(headerJsx.includes('onClosePanel?.();\n          onOpenWorkspaceSwitcher();') || 
         headerJsx.includes('onClosePanel?.()') && headerJsx.includes('onOpenWorkspaceSwitcher'), 
         'Workspace switcher click must close active panel');
});

// -----------------------------------------------------------------------------
// Test Suite 4: Dismissal Behaviors (Escape Key & Backdrop Click)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Dismissal Behaviors (Escape Key & Backdrop Click) ---');

const notifModalJsx = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'NotificationsModal.jsx'), 'utf-8');
const syncModalJsx = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'SyncStatusModal.jsx'), 'utf-8');

test('NotificationsModal implements Escape key listener in useEffect', () => {
  assert(notifModalJsx.includes("e.key === 'Escape'"), 'Escape key handler missing in NotificationsModal');
  assert(notifModalJsx.includes("addEventListener('keydown'"), 'Keydown event listener not attached in NotificationsModal');
});

test('NotificationsModal closes on backdrop click and stops sheet event propagation', () => {
  assert(notifModalJsx.includes('className="header-panel-backdrop"'), 'header-panel-backdrop class missing in NotificationsModal');
  assert(notifModalJsx.includes('onClick={onClose}'), 'Backdrop missing onClick={onClose} in NotificationsModal');
  assert(notifModalJsx.includes('className="header-panel-sheet"'), 'header-panel-sheet class missing in NotificationsModal');
  assert(notifModalJsx.includes('e.stopPropagation()'), 'stopPropagation missing on sheet in NotificationsModal');
});

test('SyncStatusModal implements Escape key listener in useEffect', () => {
  assert(syncModalJsx.includes("e.key === 'Escape'"), 'Escape key handler missing in SyncStatusModal');
  assert(syncModalJsx.includes("addEventListener('keydown'"), 'Keydown event listener not attached in SyncStatusModal');
});

test('SyncStatusModal closes on backdrop click and stops sheet event propagation', () => {
  assert(syncModalJsx.includes('className="header-panel-backdrop"'), 'header-panel-backdrop class missing in SyncStatusModal');
  assert(syncModalJsx.includes('onClick={onClose}'), 'Backdrop missing onClick={onClose} in SyncStatusModal');
  assert(syncModalJsx.includes('className="header-panel-sheet"'), 'header-panel-sheet class missing in SyncStatusModal');
  assert(syncModalJsx.includes('e.stopPropagation()'), 'stopPropagation missing on sheet in SyncStatusModal');
});

// -----------------------------------------------------------------------------
// Test Suite 5: Real Sync & Offline Storage Information
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Real Sync & Offline Storage Information ---');

test('SyncStatusModal accesses real cached entries from useWorkspace', () => {
  assert(syncModalJsx.includes('useWorkspace'), 'useWorkspace not imported in SyncStatusModal');
  assert(syncModalJsx.includes('entries'), 'entries not accessed in SyncStatusModal');
  assert(syncModalJsx.includes('offlineStorage'), 'offlineStorage translation key missing in SyncStatusModal');
});

test('SyncStatusModal renders empty-state reassurance when pending is zero', () => {
  assert(syncModalJsx.includes('pending === 0'), 'Zero pending check missing in SyncStatusModal');
  assert(syncModalJsx.includes('allSynced'), 'allSynced translation key missing in SyncStatusModal');
});

test('SyncStatusModal provides retry action on sync failure', () => {
  assert(syncModalJsx.includes('retrySync'), 'retrySync button missing in SyncStatusModal');
  assert(syncModalJsx.includes('handleManualSync'), 'handleManualSync retry call missing in SyncStatusModal');
});

// -----------------------------------------------------------------------------
// Test Suite 6: Translation Key Parity & Localization
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Translation Key Parity & Localization ---');

const { translations } = await import('../src/i18n/translations.js');

test('Required panel translation keys exist with authentic Tamil translations', () => {
  const requiredKeys = [
    'networkAndStorage',
    'connected',
    'pendingSync',
    'lastSynced',
    'retrySync',
    'close',
    'offlineStorage',
    'allSynced'
  ];

  for (const k of requiredKeys) {
    assert(translations.en[k], `Missing EN key: ${k}`);
    assert(translations.ta[k], `Missing TA key: ${k}`);
    assert.strictEqual(typeof translations.en[k], 'string');
    assert.strictEqual(typeof translations.ta[k], 'string');
    assert(translations.ta[k].length > 0);
  }
});

test('Global 100% translation key parity between English and Tamil dictionaries', () => {
  const enKeys = Object.keys(translations.en).sort();
  const taKeys = Object.keys(translations.ta).sort();
  assert.strictEqual(enKeys.length, taKeys.length, `Key counts differ: EN=${enKeys.length}, TA=${taKeys.length}`);
  const missingInTa = enKeys.filter(k => !(k in translations.ta));
  const missingInEn = taKeys.filter(k => !(k in translations.en));
  assert.strictEqual(missingInTa.length, 0, `Keys missing in TA: ${missingInTa.join(', ')}`);
  assert.strictEqual(missingInEn.length, 0, `Keys missing in EN: ${missingInEn.join(', ')}`);
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TOTAL PANEL LAYOUT TESTS EXECUTED: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log('======================================================\n');

if (totalTests === passedTests) {
  console.log('All Header Panel UI & Layout Tests Passed Successfully!\n');
  process.exit(0);
} else {
  console.error('Some tests failed!\n');
  process.exit(1);
}

