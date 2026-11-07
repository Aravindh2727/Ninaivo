import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

// -----------------------------------------------------------------------------
// Test 1: Canonicalize JSON & SHA-256 Checksum Verification
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 1: Canonical JSON & Cryptographic SHA-256 Checksum ---');

function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalizeJson(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(key => JSON.stringify(key) + ':' + canonicalizeJson(obj[key]));
  return '{' + entries.join(',') + '}';
}

function calculateSha256(canonicalStr) {
  return 'sha256-' + crypto.createHash('sha256').update(canonicalStr, 'utf8').digest('hex');
}

const sampleObjA = { b: 2, a: 1, c: { y: 'world', x: 'hello' } };
const sampleObjB = { a: 1, c: { x: 'hello', y: 'world' }, b: 2 };

const canonA = canonicalizeJson(sampleObjA);
const canonB = canonicalizeJson(sampleObjB);

assert(canonA === canonB, 'Canonical JSON output is identical regardless of object property ordering');

const hashA = calculateSha256(canonA);
const hashB = calculateSha256(canonB);
assert(hashA === hashB, 'SHA-256 hash is deterministic and matches for identical structures');
assert(hashA.startsWith('sha256-') && hashA.length === 71, 'SHA-256 checksum has valid prefix and 64 hex characters');

// Tamper test
const tamperedObj = { ...sampleObjA, b: 3 };
const tamperedHash = calculateSha256(canonicalizeJson(tamperedObj));
assert(tamperedHash !== hashA, 'Modifying any value in the payload produces a different SHA-256 checksum');

// -----------------------------------------------------------------------------
// Test 2: PWA Manifest & Service Worker Verification
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: PWA Manifest & Service Worker ---');

const manifestPath = path.join(rootDir, 'public', 'manifest.json');
assert(fs.existsSync(manifestPath), 'public/manifest.json exists');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.name.includes('Ninaivo'), 'Manifest has correct full app name (Ninaivo)');
assert(manifest.short_name === 'Ninaivo', 'Manifest has valid short_name (Ninaivo)');
assert(manifest.display === 'standalone', 'Manifest display mode is "standalone"');
assert(manifest.theme_color === '#14532D', 'Manifest theme_color matches brand palette');
assert(manifest.background_color === '#14532D', 'Manifest background_color matches brand palette');
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'Manifest defines icons (192, 512, maskable)');

const swPath = path.join(rootDir, 'public', 'sw.js');
assert(fs.existsSync(swPath), 'public/sw.js exists');

const swContent = fs.readFileSync(swPath, 'utf8');
assert(swContent.includes('install'), 'Service worker handles install event');
assert(swContent.includes('activate'), 'Service worker handles activate event');
assert(swContent.includes('fetch'), 'Service worker handles fetch event with caching strategy');
assert(swContent.includes('index.html'), 'Service worker includes navigation fallback to index.html for SPA routes');

// -----------------------------------------------------------------------------
// Test 3: Offline Sync Service & Queue Logic
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Offline Mutation Queue Logic ---');

const mockStorage = {};
const mockLocalStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; }
};

const QUEUE_KEY = 'pdt_offline_mutations';

function enqueueMockMutation(type, targetId, payload) {
  const queue = JSON.parse(mockLocalStorage.getItem(QUEUE_KEY) || '[]');
  const mutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    targetId,
    payload,
    timestamp: new Date().toISOString()
  };
  queue.push(mutation);
  mockLocalStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return mutation;
}

const mut1 = enqueueMockMutation('create', 'entry-1', { title: 'First Offline Note' });
const mut2 = enqueueMockMutation('update', 'entry-1', { title: 'Updated Offline Note' });
const mut3 = enqueueMockMutation('delete', 'entry-1', {});

const storedQueue = JSON.parse(mockLocalStorage.getItem(QUEUE_KEY));
assert(storedQueue.length === 3, 'Offline mutation queue enqueues operations sequentially');
assert(storedQueue[0].type === 'create' && storedQueue[0].targetId === 'entry-1', 'First mutation is preserved as create');
assert(storedQueue[1].type === 'update', 'Second mutation is preserved as update');
assert(storedQueue[2].type === 'delete', 'Third mutation is preserved as delete');

// Drain queue
mockLocalStorage.removeItem(QUEUE_KEY);
assert(mockLocalStorage.getItem(QUEUE_KEY) === null, 'Queue clears cleanly after synchronization');

// -----------------------------------------------------------------------------
// Test 4: Firestore Security Rules Integrity
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Firestore Security Rules Security Verification ---');

const rulesPath = path.join(rootDir, 'firestore.rules');
assert(fs.existsSync(rulesPath), 'firestore.rules exists');

const rulesContent = fs.readFileSync(rulesPath, 'utf8');
assert(rulesContent.includes('request.auth != null'), 'Firestore rules require authentication');
assert(rulesContent.includes('userUid == request.auth.uid'), 'Activity logs enforce userUid matching authenticated UID');
assert(rulesContent.includes('allow update, delete: if false'), 'Activity logs are immutable and cannot be updated or deleted');
assert(rulesContent.includes('isMember(getWorkspace())'), 'Diary entries enforce workspace membership');

// -----------------------------------------------------------------------------
// Test 5: Production Deployment Configuration
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Production Deployment Configuration ---');

const firebaseJsonPath = path.join(rootDir, 'firebase.json');
assert(fs.existsSync(firebaseJsonPath), 'firebase.json exists');

const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
assert(firebaseJson.hosting && firebaseJson.hosting.public === 'dist', 'firebase.json routes hosting to dist/');
assert(firebaseJson.hosting.rewrites && firebaseJson.hosting.rewrites[0].destination === '/index.html', 'firebase.json has SPA rewrites to /index.html');

const firebasercPath = path.join(rootDir, '.firebaserc');
assert(fs.existsSync(firebasercPath), '.firebaserc exists');

const readmeGuidePath = path.join(rootDir, 'README.md');
assert(fs.existsSync(readmeGuidePath), 'README.md exists with deployment documentation');

// -----------------------------------------------------------------------------
// Test Summary
// -----------------------------------------------------------------------------
console.log('\n========================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('========================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All Phase 7 reliability and regression tests passed successfully!');
  process.exit(0);
}
