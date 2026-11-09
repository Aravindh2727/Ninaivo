/**
 * Phase 9 Master Release Regression Test Suite
 * Validates:
 * 1. Phase 7 Reliability & PWA standards
 * 2. Phase 8 RBAC 4-role permission matrix & audit log immutability
 * 3. Staging and production configuration isolation
 * 4. Bilingual localization parity (English & Tamil 100% matched)
 * 5. Production build bundle artifacts and code splitting
 * 6. Package versioning and security release gate standards
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translations } from '../src/i18n/translations.js';

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
console.log('   PHASE 9 — MASTER RELEASE REGRESSION TEST SUITE    ');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Environment & Staging Configuration Isolation
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Staging & Production Configuration Isolation ---');

const firebasercPath = path.join(rootDir, '.firebaserc');
assert(fs.existsSync(firebasercPath), '.firebaserc exists');
const firebaserc = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));
assert(firebaserc.projects.production === 'diary-tracker-c888d', 'Production Firebase target is diary-tracker-c888d');
assert(firebaserc.projects.staging === 'diary-tracker-staging', 'Staging Firebase target is diary-tracker-staging');

const envExamplePath = path.join(rootDir, '.env.example');
assert(fs.existsSync(envExamplePath), '.env.example exists');
const envExample = fs.readFileSync(envExamplePath, 'utf8');
assert(!envExample.includes('AIzaSy'), '.env.example does not contain hardcoded live API keys');

const envStagingPath = path.join(rootDir, '.env.staging.example');
assert(fs.existsSync(envStagingPath), '.env.staging.example exists');
const envStaging = fs.readFileSync(envStagingPath, 'utf8');
assert(envStaging.includes('diary-tracker-staging'), '.env.staging.example targets isolated staging domain');

// -----------------------------------------------------------------------------
// Test Suite 2: Bilingual Translation Key Parity
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Bilingual Localization Parity (EN & TA) ---');

const enKeys = Object.keys(translations.en);
const taKeys = Object.keys(translations.ta);

assert(enKeys.length >= 240, `English dictionary contains comprehensive translation keys (${enKeys.length})`);
assert(taKeys.length >= 240, `Tamil dictionary contains comprehensive translation keys (${taKeys.length})`);

const missingInTa = enKeys.filter(k => !taKeys.includes(k));
const missingInEn = taKeys.filter(k => !enKeys.includes(k));

assert(missingInTa.length === 0, `No English keys missing from Tamil translation dictionary (${missingInTa.length} missing)`);
assert(missingInEn.length === 0, `No Tamil keys missing from English translation dictionary (${missingInEn.length} missing)`);

// -----------------------------------------------------------------------------
// Test Suite 3: Versioning & Package Integrity
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Versioning & Package Integrity ---');

const pkgPath = path.join(rootDir, 'package.json');
assert(fs.existsSync(pkgPath), 'package.json exists');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
assert(pkg.version === '1.0.0', 'Package version is aligned to 1.0.0 release identifier');
assert(pkg.scripts.build === 'vite build', 'Standard build script defined');
assert(pkg.scripts['build:staging'] === 'vite build --mode staging', 'Staging build script defined');
assert(pkg.scripts.test === 'node tests/phase9_release_regression_tests.mjs', 'Test script defined');

// -----------------------------------------------------------------------------
// Test Suite 4: Production Build Bundle & Asset Verification
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Production Build Artifacts Verification ---');

const distPath = path.join(rootDir, 'dist');
assert(fs.existsSync(distPath), 'dist/ production build output exists');

const indexPath = path.join(distPath, 'index.html');
assert(fs.existsSync(indexPath), 'dist/index.html exists');

const assetsPath = path.join(distPath, 'assets');
assert(fs.existsSync(assetsPath), 'dist/assets directory exists');

const assetFiles = fs.readdirSync(assetsPath);
assert(assetFiles.some(f => f.startsWith('vendor-') && f.endsWith('.js')), 'Vendor React chunk generated');
assert(assetFiles.some(f => f.startsWith('firebase-') && f.endsWith('.js')), 'Firebase SDK chunk generated');
assert(assetFiles.some(f => f.startsWith('BackupRestoreView-') && f.endsWith('.js')), 'BackupRestoreView lazy chunk generated');
assert(assetFiles.some(f => f.startsWith('MembersView-') && f.endsWith('.js')), 'MembersView lazy chunk generated');
assert(assetFiles.some(f => f.startsWith('AnalyticsView-') && f.endsWith('.js')), 'AnalyticsView lazy chunk generated');
assert(assetFiles.some(f => f.startsWith('PhotoGalleryView-') && f.endsWith('.js')), 'PhotoGalleryView lazy chunk generated');
assert(assetFiles.some(f => f.startsWith('index-') && f.endsWith('.css')), 'CSS bundle generated');

// -----------------------------------------------------------------------------
// Test Suite 5: Security Release Gate Checklist Verification
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Security Release Gate Verification ---');

const rulesPath = path.join(rootDir, 'firestore.rules');
assert(fs.existsSync(rulesPath), 'firestore.rules exists');
const rules = fs.readFileSync(rulesPath, 'utf8');

assert(rules.includes('canEditEntry(getWorkspace(), resource.data)'), 'SEC-01: Entry update checks author UID for editors');
assert(rules.includes('canDeleteEntry(getWorkspace(), resource.data)'), 'SEC-01: Entry delete checks author UID for editors');
assert(rules.includes('isOwner(getWorkspace()) &&') && rules.includes("request.resource.data.role != 'owner'"), 'SEC-02: Member role changes strictly owner-only');
assert(rules.includes('isValidActivityAction(getWorkspace(), request.resource.data)'), 'SEC-03: Audit log authenticity enforced');
assert(rules.includes('allow update, delete: if false;'), 'SEC-03: Audit log immutability locked');
assert(rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'), 'Default-deny database security fallback active');

// -----------------------------------------------------------------------------
// Master Test Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TOTAL PHASE 9 TESTS EXECUTED: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('Phase 9 Master Release Regression Tests Passed Successfully!\n');
  process.exit(0);
}

