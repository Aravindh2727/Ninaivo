/**
 * Ninaivo - Production Persistence, Demo Data Removal & Live Hardening Test Suite
 * Validates:
 * 1. Firebase Auth session persistence configuration (browserLocalPersistence).
 * 2. Cloud-first authoritative entry fetching without fake demo seed pollution.
 * 3. Empty state handling (genuine 0 entries without fallback sample data).
 * 4. Multi-workspace querying (ownerUid + members array-contains).
 * 5. Preference persistence in Cloud Firestore (theme & language).
 * 6. Complete removal of demo logins, demo sessions, and sample reset controls.
 * 7. Security permission error propagation (no silent queueing of unauthorized operations).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
console.log('   NINAIVO — PRODUCTION PERSISTENCE & HARDENING SUITE  ');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Firebase Auth Session Persistence Architecture
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Firebase Auth Session Persistence ---');

const firebaseConfigJs = fs.readFileSync(path.join(rootDir, 'src', 'firebase', 'config.js'), 'utf8');
assert(firebaseConfigJs.includes('browserLocalPersistence'), 'Imports browserLocalPersistence from firebase/auth');
assert(firebaseConfigJs.includes('setPersistence(auth, browserLocalPersistence)'), 'Explicitly configures setPersistence with browserLocalPersistence');

const authContextJsx = fs.readFileSync(path.join(rootDir, 'src', 'context', 'AuthContext.jsx'), 'utf8');
assert(authContextJsx.includes('updateUserPreferences'), 'AuthContext exposes updateUserPreferences for cloud synchronization');
assert(authContextJsx.includes('loading'), 'AuthContext maintains loading state while restoring session');

// -----------------------------------------------------------------------------
// Test Suite 2: Cloud-First Authoritative Data Retrieval
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Cloud-First Authoritative Data Architecture ---');

const entryServiceJs = fs.readFileSync(path.join(rootDir, 'src', 'services', 'entryService.js'), 'utf8');
assert(!entryServiceJs.includes('getSampleEntriesForWorkspace'), 'Sample entries generator completely removed from entryService');
assert(!entryServiceJs.includes('Paddy Field Sowing'), 'Fake demo entry "Paddy Field Sowing" eliminated');
assert(!entryServiceJs.includes('Wholesale Grain Settlement'), 'Fake demo entry "Wholesale Grain Settlement" eliminated');
assert(entryServiceJs.includes('isOnline() && isFirebaseConfigured && auth?.currentUser'), 'Queries Cloud Firestore first when online');

const workspaceServiceJs = fs.readFileSync(path.join(rootDir, 'src', 'services', 'workspaceService.js'), 'utf8');
assert(workspaceServiceJs.includes("where('ownerUid', '==', uid)"), 'Queries workspaces owned by authenticated user');
assert(workspaceServiceJs.includes("where('members', 'array-contains', uid)"), 'Queries workspaces where user is an active member');
assert(workspaceServiceJs.includes('cloudWorkspaces.length > 0'), 'Cloud workspaces take precedence over local cache');

// -----------------------------------------------------------------------------
// Test Suite 3: User Preference Persistence (Theme & Language)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: User Preferences Cloud Persistence ---');

const userServiceJs = fs.readFileSync(path.join(rootDir, 'src', 'firebase', 'userService.js'), 'utf8');
assert(userServiceJs.includes('updates.preferences?.theme'), 'Syncs updated theme token directly to localStorage and DOM');
assert(userServiceJs.includes('preferences:'), 'Maintains preferences document schema in Cloud Firestore');
assert(userServiceJs.includes('{ merge: true }'), 'Uses merge setDoc to prevent overwriting existing user documents');

const appJsx = fs.readFileSync(path.join(rootDir, 'src', 'App.jsx'), 'utf8');
assert(appJsx.includes('updateUserPreferences({ theme: next })'), 'Theme toggle commits new theme to cloud user profile');
assert(appJsx.includes('ninaivo-language-changed'), 'Listens for language change events to update cloud preferences');
assert(!appJsx.includes('pdt_demo_session'), 'Demo session state completely eliminated from AppContent');
assert(!appJsx.includes('handleExploreDemo'), 'handleExploreDemo eliminated from AppContent');

// -----------------------------------------------------------------------------
// Test Suite 4: Demo Mode & Sample Data Elimination
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Demo Mode & Sample Data Elimination ---');

const loginViewJsx = fs.readFileSync(path.join(rootDir, 'src', 'views', 'LoginView.jsx'), 'utf8');
assert(!loginViewJsx.includes('onExploreDemo'), 'LoginView removes onExploreDemo prop and demo entry button');

const registerViewJsx = fs.readFileSync(path.join(rootDir, 'src', 'views', 'RegisterView.jsx'), 'utf8');
assert(!registerViewJsx.includes('onExploreDemo'), 'RegisterView removes onExploreDemo prop and demo entry button');

const settingsViewJsx = fs.readFileSync(path.join(rootDir, 'src', 'views', 'SettingsView.jsx'), 'utf8');
assert(!settingsViewJsx.includes('onResetData'), 'SettingsView removes onResetData prop');
assert(!settingsViewJsx.includes('resetDemoData'), 'SettingsView removes "Reset Demo Data" action row');

const homeViewJsx = fs.readFileSync(path.join(rootDir, 'src', 'views', 'HomeView.jsx'), 'utf8');
assert(!homeViewJsx.includes('entries?.length || 45'), 'HomeView does not fallback to hardcoded 45 total entries');
assert(!homeViewJsx.includes('0) || 28'), 'HomeView does not fallback to hardcoded 28 photos');
assert(!homeViewJsx.includes('Field irrigation completed'), 'HomeView does not render fake "Field irrigation completed" entry');
assert(homeViewJsx.includes('noEntriesYet'), 'HomeView renders authentic clean empty state when 0 entries');

// -----------------------------------------------------------------------------
// Test Suite 5: Security Error Handling & Offline Integrity
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Security Error Handling & Offline Integrity ---');

assert(entryServiceJs.includes("err?.code === 'permission-denied'"), 'Entry operations check for permission-denied errors');
assert(entryServiceJs.includes("throw new Error('Permission denied: You do not have permission to add entries"), 'createDiaryEntry throws real error on permission denial');
assert(entryServiceJs.includes("throw new Error('Permission denied: You do not have permission to edit this entry"), 'updateDiaryEntry throws real error on permission denial');
assert(entryServiceJs.includes("throw new Error('Permission denied: You do not have permission to delete this entry"), 'deleteDiaryEntry throws real error on permission denial');

const syncServiceJs = fs.readFileSync(path.join(rootDir, 'src', 'services', 'syncService.js'), 'utf8');
assert(!syncServiceJs.includes('isDemoSession'), 'syncService removes isDemoSession bypass');
assert(syncServiceJs.includes('!activeUser || !isFirebaseConfigured'), 'syncService halts if user session is unauthenticated');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TOTAL PRODUCTION HARDENING TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All Production Persistence & Hardening Tests Passed Successfully!\n');
  process.exit(0);
}

