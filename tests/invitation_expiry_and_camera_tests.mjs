/**
 * tests/invitation_expiry_and_camera_tests.mjs
 * Comprehensive test suite verifying:
 * 1. Invitation link expiration "Never" support (creation, validation, query, display).
 * 2. Direct Camera Photo Capture alongside File Upload (Add Diary & Edit Diary).
 * 3. Bilingual localization parity for all newly introduced options and buttons.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('   NINAIVO — INVITATION EXPIRY "NEVER" & CAMERA CAPTURE TESTS   ');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: Localized Translations & Key Parity
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Localization & Key Parity ---');

const translationsPath = path.join(rootDir, 'src', 'i18n', 'translations.js');
const translationsContent = fs.readFileSync(translationsPath, 'utf8');

// Dynamic evaluation of translations
const translationsModule = await import('../src/i18n/translations.js');
const { translations } = translationsModule;

runTest('English dictionary defines takePhoto, uploadPhotos, never', () => {
  assert.strictEqual(translations.en.takePhoto, 'Take Photo');
  assert.strictEqual(translations.en.uploadPhotos, 'Upload Photos');
  assert.strictEqual(translations.en.never, 'Never');
});

runTest('Tamil dictionary defines takePhoto, uploadPhotos, never', () => {
  assert.strictEqual(translations.ta.takePhoto, 'புகைப்படம் எடுக்கவும்');
  assert.strictEqual(translations.ta.uploadPhotos, 'புகைப்படங்களைப் பதிவேற்றவும்');
  assert.strictEqual(translations.ta.never, 'காலாவதியாகாது');
});

runTest('100% key parity between English and Tamil dictionaries', () => {
  const enKeys = Object.keys(translations.en).sort();
  const taKeys = Object.keys(translations.ta).sort();
  assert.strictEqual(enKeys.length, taKeys.length, `Key counts differ: EN=${enKeys.length}, TA=${taKeys.length}`);
  const missingInTa = enKeys.filter(k => !(k in translations.ta));
  const missingInEn = taKeys.filter(k => !(k in translations.en));
  assert.strictEqual(missingInTa.length, 0, `Keys missing in TA: ${missingInTa.join(', ')}`);
  assert.strictEqual(missingInEn.length, 0, `Keys missing in EN: ${missingInEn.join(', ')}`);
});

// -----------------------------------------------------------------------------
// SECTION 2: Invitation Service "Never" Expiration Architecture
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Invitation Service "Never" Expiration Logic ---');

const invServicePath = path.join(rootDir, 'src', 'services', 'invitationService.js');
const invServiceContent = fs.readFileSync(invServicePath, 'utf8');

runTest('createWorkspaceInvitation detects "never", null, and 0 for indefinite validity', () => {
  assert.ok(
    invServiceContent.includes("expiresInHours === 'never' || expiresInHours === null || expiresInHours === 0 || expiresInHours === '0'"),
    'createWorkspaceInvitation must detect never/null/0'
  );
  assert.ok(
    invServiceContent.includes('let expiresAtMs = null;'),
    'expiresAtMs initialized to null'
  );
  assert.ok(
    invServiceContent.includes('expiresAt: expiresAtMs ? Timestamp.fromMillis(expiresAtMs) : null'),
    'Firestore doc sets expiresAt as null when indefinite'
  );
});

runTest('getWorkspaceInvitations does not prematurely expire invitations with null expiresAt', () => {
  assert.ok(
    invServiceContent.includes('const expMs = getTimestampMs(inv.expiresAt);'),
    'getWorkspaceInvitations must use getTimestampMs(inv.expiresAt)'
  );
  assert.ok(
    invServiceContent.includes('if (inv.status === \'pending\' && expMs && expMs < now)'),
    'Must check expMs truthiness before comparing with now'
  );
});

runTest('Simulated validation of "never" expiring invitation', () => {
  // Pure logic test simulating validateInvitationToken
  function validateMock(invitation) {
    if (invitation.status === 'revoked') return { valid: false, reason: 'Revoked' };
    if (invitation.status === 'accepted') return { valid: false, reason: 'Accepted' };
    
    // getTimestampMs logic
    const val = invitation.expiresAt;
    let expMs = null;
    if (val) {
      if (typeof val === 'number') expMs = val;
      else {
        const parsed = new Date(val).getTime();
        expMs = isNaN(parsed) ? null : parsed;
      }
    }

    if (expMs && expMs < Date.now()) {
      return { valid: false, reason: 'Expired' };
    }
    return { valid: true, invitation };
  }

  // 1. Never-expiring invitation (expiresAt = null)
  const neverInv = { id: 'inv-1', status: 'pending', expiresAt: null };
  const res1 = validateMock(neverInv);
  assert.strictEqual(res1.valid, true, 'Indefinite invitation must be valid');

  // 2. Future expiring invitation (expires in 48h)
  const futureInv = { id: 'inv-2', status: 'pending', expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString() };
  const res2 = validateMock(futureInv);
  assert.strictEqual(res2.valid, true, 'Future invitation must be valid');

  // 3. Past expired invitation
  const pastInv = { id: 'inv-3', status: 'pending', expiresAt: new Date(Date.now() - 3600 * 1000).toISOString() };
  const res3 = validateMock(pastInv);
  assert.strictEqual(res3.valid, false, 'Past invitation must be invalid');
  assert.strictEqual(res3.reason, 'Expired');

  // 4. Revoked invitation
  const revokedInv = { id: 'inv-4', status: 'revoked', expiresAt: null };
  const res4 = validateMock(revokedInv);
  assert.strictEqual(res4.valid, false, 'Revoked invitation must be rejected even if expiresAt is null');

  // 5. Accepted invitation
  const acceptedInv = { id: 'inv-5', status: 'accepted', expiresAt: null };
  const res5 = validateMock(acceptedInv);
  assert.strictEqual(res5.valid, false, 'Accepted invitation must be rejected');
});

runTest('Simulated getWorkspaceInvitations expiration filter', () => {
  function filterInvitations(invitations) {
    const now = Date.now();
    return invitations.map(inv => {
      // getTimestampMs logic
      const val = inv.expiresAt;
      let expMs = null;
      if (val) {
        if (typeof val === 'number') expMs = val;
        else {
          const parsed = new Date(val).getTime();
          expMs = isNaN(parsed) ? null : parsed;
        }
      }
      if (inv.status === 'pending' && expMs && expMs < now) {
        return { ...inv, status: 'expired' };
      }
      return inv;
    });
  }

  const list = [
    { id: '1', status: 'pending', expiresAt: null }, // Never expires
    { id: '2', status: 'pending', expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() }, // Active
    { id: '3', status: 'pending', expiresAt: new Date(Date.now() - 1000).toISOString() }, // Expired
    { id: '4', status: 'revoked', expiresAt: null } // Revoked
  ];

  const processed = filterInvitations(list);
  assert.strictEqual(processed[0].status, 'pending', 'Never-expiring invitation must remain pending');
  assert.strictEqual(processed[1].status, 'pending', 'Future invitation must remain pending');
  assert.strictEqual(processed[2].status, 'expired', 'Past invitation must be marked expired');
  assert.strictEqual(processed[3].status, 'revoked', 'Revoked invitation must remain revoked');
});

// -----------------------------------------------------------------------------
// SECTION 3: UI Integration — Invite Member Modal & Members View
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Modal & View UI Integration ---');

const inviteModalPath = path.join(rootDir, 'src', 'components', 'InviteMemberModal.jsx');
const inviteModalContent = fs.readFileSync(inviteModalPath, 'utf8');

runTest('InviteMemberModal dropdown includes "Never" option', () => {
  assert.ok(
    inviteModalContent.includes('<option value="never">{t(\'never\')}</option>'),
    'Dropdown must render option for never'
  );
  assert.ok(
    inviteModalContent.includes('<option value="24">{t(\'hours24\')}</option>') &&
    inviteModalContent.includes('<option value="48">{t(\'hours48\')}</option>') &&
    inviteModalContent.includes('<option value="168">{t(\'days7\')}</option>'),
    'Dropdown must retain 24h, 48h, 7d options'
  );
});

runTest('InviteMemberModal passes "never" parameter correctly to generator', () => {
  assert.ok(
    inviteModalContent.includes("expiresInHours: expiresInHours === 'never' ? 'never' : Number(expiresInHours)"),
    'Must handle string "never" without converting to NaN'
  );
});

runTest('InviteMemberModal displays localized "never" when expiresAt is null', () => {
  assert.ok(
    inviteModalContent.includes("inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : t('never')"),
    'Active invitations list must display t(never) when expiresAt is null'
  );
});

const membersViewPath = path.join(rootDir, 'src', 'views', 'MembersView.jsx');
const membersViewContent = fs.readFileSync(membersViewPath, 'utf8');

runTest('MembersView active invitations displays localized "never" when expiresAt is null', () => {
  assert.ok(
    membersViewContent.includes("inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : t('never')"),
    'MembersView active list must display t(never) when expiresAt is null'
  );
});

// -----------------------------------------------------------------------------
// SECTION 4: Direct Camera Photo Capture & File Upload Controls
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Camera & Photo Upload Controls ---');

const addEntryPath = path.join(rootDir, 'src', 'views', 'AddEntryView.jsx');
const addEntryContent = fs.readFileSync(addEntryPath, 'utf8');

runTest('AddEntryView imports Camera from lucide-react', () => {
  assert.ok(
    addEntryContent.includes('Camera') && addEntryContent.includes("'lucide-react'"),
    'AddEntryView must import Camera icon'
  );
});

runTest('AddEntryView contains separate Upload Photos and Take Photo buttons', () => {
  assert.ok(
    addEntryContent.includes('htmlFor="new-entry-photo-input"') &&
    addEntryContent.includes('htmlFor="new-entry-camera-input"'),
    'AddEntryView must have distinct label triggers for file picker and camera'
  );
  assert.ok(
    addEntryContent.includes("title={uploading ? t('uploadingPhotos') : t('uploadPhotos')}") &&
    addEntryContent.includes("title={t('takePhoto')}"),
    'AddEntryView must provide accessible tooltips on upload and camera triggers'
  );
  // Verify icon-only: label does not render visible text nodes inside
  const uploadLabelMatch = addEntryContent.match(/<label[^>]*htmlFor="new-entry-photo-input"[^>]*>(.*?)<\/label>/s);
  assert.ok(uploadLabelMatch && uploadLabelMatch[1].trim() === '<UploadCloud size={13} />', 'Upload button must be icon-only');
  const cameraLabelMatch = addEntryContent.match(/<label[^>]*htmlFor="new-entry-camera-input"[^>]*>(.*?)<\/label>/s);
  assert.ok(cameraLabelMatch && cameraLabelMatch[1].trim() === '<Camera size={13} />', 'Camera button must be icon-only');
});

runTest('AddEntryView camera input has capture="environment" and accept="image/*"', () => {
  const cameraInputRegex = /<input[^>]*id="new-entry-camera-input"[^>]*\/>/s;
  const match = addEntryContent.match(cameraInputRegex);
  assert.ok(match, 'Camera input element found');
  const tag = match[0];
  assert.ok(tag.includes('accept="image/*"'), 'Camera input must have accept="image/*"');
  assert.ok(tag.includes('capture="environment"'), 'Camera input must have capture="environment"');
  assert.ok(!tag.includes('multiple'), 'Camera single capture must not specify multiple');
});

const editModalPath = path.join(rootDir, 'src', 'components', 'EditEntryModal.jsx');
const editModalContent = fs.readFileSync(editModalPath, 'utf8');

runTest('EditEntryModal imports Camera from lucide-react', () => {
  assert.ok(
    editModalContent.includes('Camera') && editModalContent.includes("'lucide-react'"),
    'EditEntryModal must import Camera icon'
  );
});

runTest('EditEntryModal contains separate Upload Photos and Take Photo buttons', () => {
  assert.ok(
    editModalContent.includes('htmlFor="edit-modal-photo-input"') &&
    editModalContent.includes('htmlFor="edit-modal-camera-input"'),
    'EditEntryModal must have distinct label triggers for file picker and camera'
  );
  assert.ok(
    editModalContent.includes("title={uploading ? t('uploadingPhotos') : t('uploadPhotos')}") &&
    editModalContent.includes("title={t('takePhoto')}"),
    'EditEntryModal must provide accessible tooltips on upload and camera triggers'
  );
  // Verify icon-only: label does not render visible text nodes inside
  const uploadLabelMatch = editModalContent.match(/<label[^>]*htmlFor="edit-modal-photo-input"[^>]*>(.*?)<\/label>/s);
  assert.ok(uploadLabelMatch && uploadLabelMatch[1].trim() === '<UploadCloud size={13} />', 'Upload button must be icon-only');
  const cameraLabelMatch = editModalContent.match(/<label[^>]*htmlFor="edit-modal-camera-input"[^>]*>(.*?)<\/label>/s);
  assert.ok(cameraLabelMatch && cameraLabelMatch[1].trim() === '<Camera size={13} />', 'Camera button must be icon-only');
});

runTest('EditEntryModal camera input has capture="environment" and accept="image/*"', () => {
  const cameraInputRegex = /<input[^>]*id="edit-modal-camera-input"[^>]*\/>/s;
  const match = editModalContent.match(cameraInputRegex);
  assert.ok(match, 'Camera input element found');
  const tag = match[0];
  assert.ok(tag.includes('accept="image/*"'), 'Camera input must have accept="image/*"');
  assert.ok(tag.includes('capture="environment"'), 'Camera input must have capture="environment"');
  assert.ok(!tag.includes('multiple'), 'Camera single capture must not specify multiple');
});

// -----------------------------------------------------------------------------
// SECTION 5: Cloudinary Service Integration Preservation
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Cloudinary Service Integration & Metadata Format ---');

const cloudinaryServicePath = path.join(rootDir, 'src', 'services', 'cloudinaryService.js');
const cloudinaryContent = fs.readFileSync(cloudinaryServicePath, 'utf8');

runTest('Cloudinary unsigned upload presets and cloud name intact', () => {
  assert.ok(
    cloudinaryContent.includes('VITE_CLOUDINARY_CLOUD_NAME') || cloudinaryContent.includes('cloudName'),
    'Cloudinary configuration intact'
  );
  assert.ok(
    cloudinaryContent.includes('uploadMultipleDiaryPhotos'),
    'uploadMultipleDiaryPhotos function intact'
  );
});

// -----------------------------------------------------------------------------
// SECTION 6: Firestore Rules Compatibility Check
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: Firestore Rules Compatibility ---');

const rulesPath = path.join(rootDir, 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

runTest('firestore.rules permits null expiresAt for root invitations and workspace join', () => {
  assert.ok(
    rulesContent.includes("(resource.data.get('expiresAt', null) == null || request.time < resource.data.expiresAt)"),
    'Rules explicitly allow null expiresAt on root invitation acceptance'
  );
  assert.ok(
    rulesContent.includes("(invBefore.get('expiresAt', null) == null || request.time < invBefore.expiresAt)") ||
    rulesContent.includes("(invBefore.expiresAt == null || request.time < invBefore.expiresAt)"),
    'Rules explicitly allow null expiresAt during workspace self-join verification'
  );
  assert.ok(
    rulesContent.includes("request.resource.data.get('expiresAt', null) == resource.data.get('expiresAt', null)"),
    'Rules enforce that expiresAt cannot be tampered with during status updates'
  );
});

console.log('\n================================================================');
console.log(`TOTAL TESTS EXECUTED: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('All Feature 1 and Feature 2 Verification Scenarios Passed Successfully!\n');
}
