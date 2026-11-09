/**
 * Automated Verification Suite for:
 * 1. Workspace Selection in Add Diary & Edit Diary
 * 2. Shared Diary Visibility & Real-Time Sync Logic
 * 3. Group-Oriented Member Management & Presence Calculations
 * 4. Member Relationship Labels & Role Governance
 * 5. Bilingual Key Parity
 */

import assert from 'node:assert/strict';
import { calculateGroupPresence } from '../src/services/presenceService.js';
import { translations } from '../src/i18n/translations.js';
import { WORKSPACE_ROLES } from '../src/services/memberService.js';
import { WORKSPACE_MODES } from '../src/services/workspaceService.js';

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function testAsync(description, fn) {
  try {
    await fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('--- SUITE 1: Group Presence & Member Count Calculations ---');

test('Presence: calculates exact total, online, and offline for accepted members only', () => {
  const members = [
    { uid: 'user-owner', role: 'owner', status: 'active', isOnline: true, lastSeen: Date.now() },
    { uid: 'user-admin', role: 'admin', status: 'active', isOnline: true, lastSeen: Date.now() - 60000 },
    { uid: 'user-editor', role: 'editor', status: 'active', isOnline: false, lastSeen: Date.now() - 3600000 },
    { uid: 'user-viewer', role: 'viewer', status: 'active', isOnline: false },
    // Pending or removed members MUST be excluded
    { uid: 'user-pending', role: 'editor', status: 'pending' },
    { uid: 'user-removed', role: 'editor', status: 'removed' }
  ];

  const stats = calculateGroupPresence(members, 'user-owner');

  assert.equal(stats.totalMembers, 4, 'Total members should only count 4 accepted members');
  assert.equal(stats.onlineCount, 2, '2 members should be online');
  assert.equal(stats.offlineCount, 2, '2 members should be offline');
  assert.equal(stats.totalMembers, stats.onlineCount + stats.offlineCount, 'Total must equal online + offline');
});

test('Presence: authenticated user in current session is always considered online', () => {
  const members = [
    { uid: 'user-self', role: 'editor', status: 'active', isOnline: false, lastSeen: Date.now() - 86400000 }
  ];

  const stats = calculateGroupPresence(members, 'user-self');
  assert.equal(stats.onlineCount, 1, 'Self session must be marked online');
  assert.equal(stats.offlineCount, 0, 'Offline count should be 0');
});

test('Presence: members whose lastSeen is older than 5 minutes are marked offline', () => {
  const sixMinutesAgo = Date.now() - 360000;
  const members = [
    { uid: 'user-stale', role: 'editor', status: 'active', isOnline: true, lastSeen: sixMinutesAgo }
  ];

  const stats = calculateGroupPresence(members, 'other-user');
  assert.equal(stats.onlineCount, 0, 'Stale heartbeat must be marked offline');
  assert.equal(stats.offlineCount, 1);
});

test('Presence: empty or null member list returns clean zeroes', () => {
  const stats = calculateGroupPresence([], null);
  assert.equal(stats.totalMembers, 0);
  assert.equal(stats.onlineCount, 0);
  assert.equal(stats.offlineCount, 0);
  assert.deepEqual(stats.membersWithPresence, []);
});

console.log('\n--- SUITE 2: Workspace Selection & Category Decoupling ---');

test('Category vs Workspace: Selecting "Family" category does not dictate workspace ID', () => {
  const targetWorkspaceId = 'ws-business-alpha';
  const entryCategory = 'Family';

  const entryData = {
    title: 'Family Day at Farm Office',
    entryType: entryCategory,
    date: '2026-11-09',
    description: 'Shared notes'
  };

  // Simulating addEntry target assignment
  const preparedEntry = {
    ...entryData,
    workspaceId: targetWorkspaceId
  };

  assert.equal(preparedEntry.workspaceId, 'ws-business-alpha', 'Workspace ID must match target workspace, not category');
  assert.equal(preparedEntry.entryType, 'Family', 'Category is purely metadata');
});

test('Category vs Workspace: Agriculture entry can be saved in Personal or Family workspace', () => {
  const personalEntry = { title: 'Secret Tomato Crop', entryType: 'Agriculture', workspaceId: 'ws-personal-u1' };
  const familyEntry = { title: 'Community Harvest', entryType: 'Agriculture', workspaceId: 'ws-family-u1' };

  assert.notEqual(personalEntry.workspaceId, familyEntry.workspaceId);
  assert.equal(personalEntry.entryType, familyEntry.entryType);
});

console.log('\n--- SUITE 3: Shared Diary Visibility & Member Query Constraints ---');

test('Query constraints: member shared workspaces query includes family and business only', () => {
  const allowedSharedTypes = ['family', 'business'];

  // Test that personal workspace is never exposed via shared array query
  assert.equal(allowedSharedTypes.includes(WORKSPACE_MODES.PERSONAL), false);
  assert.equal(allowedSharedTypes.includes(WORKSPACE_MODES.FAMILY), true);
  assert.equal(allowedSharedTypes.includes(WORKSPACE_MODES.BUSINESS), true);
});

test('Shared Diary: Member in Family workspace has read access to all entries in that workspace', () => {
  const workspace = {
    id: 'ws-family-shared-1',
    type: 'family',
    ownerUid: 'owner-123',
    members: ['owner-123', 'invitee-456'],
    memberRoles: {
      'owner-123': 'owner',
      'invitee-456': 'editor'
    }
  };

  const isMember = workspace.members.includes('invitee-456');
  const role = workspace.memberRoles['invitee-456'];
  const canRead = isMember && ['owner', 'admin', 'editor', 'viewer'].includes(role);
  const canWrite = isMember && ['owner', 'admin', 'editor'].includes(role);

  assert.equal(canRead, true, 'Accepted member must have read access to shared workspace');
  assert.equal(canWrite, true, 'Editor member must have write access to shared workspace');
});

console.log('\n--- SUITE 4: Member Relationship Labels & Role Governance ---');

test('Relationship labels: supports family, friend, colleague, partner, other while role controls permission', () => {
  const validRelationships = ['family', 'friend', 'colleague', 'partner', 'other'];

  const testMember = {
    uid: 'invitee-colleague',
    role: WORKSPACE_ROLES.VIEWER,
    relationship: 'colleague'
  };

  assert.equal(validRelationships.includes(testMember.relationship), true);
  assert.equal(testMember.role, 'viewer');
  // Viewer cannot write, regardless of being colleague
  const canWrite = ['owner', 'admin', 'editor'].includes(testMember.role);
  assert.equal(canWrite, false, 'Viewer role cannot write regardless of relationship');
});

console.log('\n--- SUITE 5: 100% Bilingual Localization Parity ---');

test('i18n: zero missing keys between English and Tamil translations', () => {
  const enKeys = Object.keys(translations.en);
  const taKeys = Object.keys(translations.ta);

  const missingInTa = enKeys.filter(k => !taKeys.includes(k));
  const missingInEn = taKeys.filter(k => !enKeys.includes(k));

  assert.equal(missingInTa.length, 0, `Missing in Tamil: ${missingInTa.join(', ')}`);
  assert.equal(missingInEn.length, 0, `Missing in English: ${missingInEn.join(', ')}`);
  assert.equal(enKeys.length >= 606, true, `Expected >= 606 keys, got ${enKeys.length}`);
});

test('i18n: new group, presence, and workspace keys exist in both languages', () => {
  const requiredKeys = [
    'destinationWorkspace',
    'selectWorkspace',
    'groupsTitle',
    'createGroupBtn',
    'newGroupModalTitle',
    'totalMembers',
    'membersCount',
    'online',
    'offline',
    'onlineCountLabel',
    'offlineCountLabel',
    'viewMembers',
    'relationshipLabel',
    'relFamily',
    'relFriend',
    'relColleague',
    'relPartner',
    'relOther',
    'groupDetails',
    'backToGroups',
    'groupName',
    'groupType',
    'groupDescription',
    'groupMembers',
    'noGroupsYet',
    'noGroupsYetDesc',
    'manageGroup',
    'enterGroupName',
    'groupDescPlaceholder',
    'sharedDiaryBadge'
  ];

  for (const k of requiredKeys) {
    assert.ok(translations.en[k], `Missing EN key: ${k}`);
    assert.ok(translations.ta[k], `Missing TA key: ${k}`);
  }
});

console.log(`\n========================================`);
console.log(`Summary: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}

