/**
 * ==============================================================================
 * GENUINE FIRESTORE SECURITY RULES EMULATOR TEST SUITE
 * Project: Ninaivo (Project ID: diary-tracker-c888d)
 * Tested File: firestore.rules (Directly loaded from repository root)
 * ==============================================================================
 * 
 * Verifies all 10 adversarial security attacks and the legitimate atomic
 * batch invitation acceptance flow against the live Firebase Firestore Emulator.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  initializeTestEnvironment, 
  assertFails, 
  assertSucceeds 
} from '@firebase/rules-unit-testing';
import { 
  doc, 
  getDoc, 
  getDocs,
  collection,
  setDoc, 
  updateDoc, 
  writeBatch, 
  serverTimestamp, 
  Timestamp, 
  arrayUnion 
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const RULES_PATH = path.join(ROOT_DIR, 'firestore.rules');

const PROJECT_ID = 'diary-tracker-c888d';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function logPass(msg) {
  totalAssertions++;
  passedAssertions++;
  console.log(`  ✓ ${msg}`);
}

function logFail(msg, err) {
  totalAssertions++;
  failedAssertions++;
  console.error(`  ✗ FAIL: ${msg}`);
  if (err) console.error('    Error details:', err);
}

async function runEmulatorTestSuite() {
  console.log('\n======================================================');
  console.log('   NINAIVO FIRESTORE SECURITY RULES EMULATOR SUITE    ');
  console.log('======================================================\n');

  console.log(`Loading actual firestore.rules from: ${RULES_PATH}`);
  const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');
  console.log(`Rules file loaded successfully (${rulesContent.length} bytes).\n`);

  const emuHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [host, portStr] = emuHost.split(':');
  const port = parseInt(portStr || '8080', 10);

  console.log(`Connecting to Firestore Emulator at ${host}:${port} (Project: ${PROJECT_ID})...`);
  
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port,
      rules: rulesContent
    }
  });

  console.log('Test environment initialized and rules deployed to emulator.\n');

  try {
    // ------------------------------------------------------------------------
    // SETUP FIXTURES (Using Admin context with security rules bypassed)
    // ------------------------------------------------------------------------
    const ownerUid = 'owner-sharma-123';
    const adminUid = 'admin-ravi-789';
    const editorUid = 'editor-kavita-321';
    const viewerUid = 'viewer-anand-654';
    const legitimateInviteeUid = 'invitee-priya-456';
    const attackerUid = 'attacker-rogue-999';
    const designatedEmail = 'priya.sharma@family.org';
    const familyWsId = 'ws-family-sharma-farm';
    const personalWsId = 'ws-personal-private-sharma';

    const validTokenHash = 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890';
    const revokedTokenHash = 'revoked-hash-1111222233334444555566667777888899990000aaaabbbbcccc';
    const expiredTokenHash = 'expired-hash-1111222233334444555566667777888899990000aaaabbbbcccc';

    const futureTime = Timestamp.fromMillis(Date.now() + 48 * 3600 * 1000);
    const pastTime = Timestamp.fromMillis(Date.now() - 2 * 3600 * 1000);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      // 1. Shared Family Workspace with Owner, Admin, Editor, and Viewer
      await setDoc(doc(adminDb, 'workspaces', familyWsId), {
        id: familyWsId,
        name: 'Sharma Family & Farm',
        type: 'family',
        ownerUid,
        members: [ownerUid, adminUid, editorUid, viewerUid],
        memberRoles: { 
          [ownerUid]: 'owner',
          [adminUid]: 'admin',
          [editorUid]: 'editor',
          [viewerUid]: 'viewer'
        },
        createdAt: new Date().toISOString()
      });

      // 2. Strict Private Personal Workspace
      await setDoc(doc(adminDb, 'workspaces', personalWsId), {
        id: personalWsId,
        name: 'Private Journal',
        type: 'personal',
        ownerUid,
        members: [ownerUid],
        memberRoles: { [ownerUid]: 'owner' },
        createdAt: new Date().toISOString()
      });

      // 3. Valid Pending Invitation for Priya (Editor role)
      await setDoc(doc(adminDb, 'invitations', validTokenHash), {
        workspaceId: familyWsId,
        workspaceName: 'Sharma Family & Farm',
        workspaceType: 'family',
        tokenHash: validTokenHash,
        invitedEmail: designatedEmail,
        role: 'editor',
        status: 'pending',
        createdByUid: ownerUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // 4. Revoked Invitation
      await setDoc(doc(adminDb, 'invitations', revokedTokenHash), {
        workspaceId: familyWsId,
        tokenHash: revokedTokenHash,
        invitedEmail: designatedEmail,
        role: 'editor',
        status: 'revoked',
        createdByUid: ownerUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // 5. Expired Invitation
      await setDoc(doc(adminDb, 'invitations', expiredTokenHash), {
        workspaceId: familyWsId,
        tokenHash: expiredTokenHash,
        invitedEmail: designatedEmail,
        role: 'editor',
        status: 'pending',
        createdByUid: ownerUid,
        createdAt: new Date().toISOString(),
        expiresAt: pastTime
      });

      // 6. EDGE CASE FIXTURES: Missing, Null, and Empty memberRoles Workspaces
      const wsMissingRolesId = 'ws-family-missing-roles';
      const wsNullRolesId = 'ws-family-null-roles';
      const wsEmptyRolesId = 'ws-family-empty-roles';

      // 6a. Workspace with memberRoles completely missing (omitted)
      await setDoc(doc(adminDb, 'workspaces', wsMissingRolesId), {
        id: wsMissingRolesId,
        name: 'Sharma Farm Missing Roles',
        type: 'family',
        ownerUid,
        members: [ownerUid],
        createdAt: new Date().toISOString()
      });

      // 6b. Workspace with memberRoles explicitly null
      await setDoc(doc(adminDb, 'workspaces', wsNullRolesId), {
        id: wsNullRolesId,
        name: 'Sharma Farm Null Roles',
        type: 'family',
        ownerUid,
        members: [ownerUid],
        memberRoles: null,
        createdAt: new Date().toISOString()
      });

      // 6c. Workspace with memberRoles as empty map {}
      await setDoc(doc(adminDb, 'workspaces', wsEmptyRolesId), {
        id: wsEmptyRolesId,
        name: 'Sharma Farm Empty Roles',
        type: 'family',
        ownerUid,
        members: [ownerUid],
        memberRoles: {},
        createdAt: new Date().toISOString()
      });

      // Invitations for Edge Case Workspaces
      const edgeTokens = [
        { hash: 'hash-missing-legit-1111222233334444555566667777888899990000aaaa', ws: wsMissingRolesId },
        { hash: 'hash-missing-inject-1111222233334444555566667777888899990000aaaa', ws: wsMissingRolesId },
        { hash: 'hash-null-legit-1111222233334444555566667777888899990000aaaa', ws: wsNullRolesId },
        { hash: 'hash-null-inject-1111222233334444555566667777888899990000aaaa', ws: wsNullRolesId },
        { hash: 'hash-empty-legit-1111222233334444555566667777888899990000aaaa', ws: wsEmptyRolesId },
        { hash: 'hash-empty-inject-1111222233334444555566667777888899990000aaaa', ws: wsEmptyRolesId }
      ];

      for (const t of edgeTokens) {
        await setDoc(doc(adminDb, 'invitations', t.hash), {
          workspaceId: t.ws,
          tokenHash: t.hash,
          invitedEmail: designatedEmail,
          role: 'editor',
          status: 'pending',
          createdByUid: ownerUid,
          createdAt: new Date().toISOString(),
          expiresAt: futureTime
        });
      }
    });

    console.log('Fixtures established in emulator memory.\n');

    // Authenticated contexts
    const ownerCtx = testEnv.authenticatedContext(ownerUid, { email: 'owner@sharma.org' });
    const adminCtx = testEnv.authenticatedContext(adminUid, { email: 'admin.ravi@sharma.org' });
    const editorCtx = testEnv.authenticatedContext(editorUid, { email: 'editor.kavita@sharma.org' });
    const viewerCtx = testEnv.authenticatedContext(viewerUid, { email: 'viewer.anand@sharma.org' });
    const legitInviteeCtx = testEnv.authenticatedContext(legitimateInviteeUid, { email: 'Priya.Sharma@Family.Org' }); // Case insensitivity test
    const attackerCtx = testEnv.authenticatedContext(attackerUid, { email: 'attacker@evil.com' });

    const ownerDb = ownerCtx.firestore();
    const adminUserDb = adminCtx.firestore();
    const editorUserDb = editorCtx.firestore();
    const viewerUserDb = viewerCtx.firestore();
    const legitDb = legitInviteeCtx.firestore();
    const rogueDb = attackerCtx.firestore();

    // ------------------------------------------------------------------------
    // SECTION A: 10 ADVERSARIAL ATTACK SCENARIOS
    // ------------------------------------------------------------------------
    console.log('--- SECTION A: 10 Adversarial Attack Scenarios ---');

    // 1. Direct self-joining without an invitation
    try {
      await assertFails(updateDoc(doc(rogueDb, 'workspaces', familyWsId), {
        members: arrayUnion('attacker-rogue-999'),
        'memberRoles.attacker-rogue-999': 'editor',
        lastInviteTokenHash: null
      }));
      logPass('Scenario 1: Direct self-joining without invitation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 1 failed', e);
    }

    // 2. Joining with a revoked invitation
    try {
      const batch2 = writeBatch(legitDb);
      batch2.update(doc(legitDb, 'workspaces', familyWsId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        lastInviteTokenHash: revokedTokenHash
      });
      batch2.set(doc(legitDb, 'workspaces', familyWsId, 'members', legitimateInviteeUid), {
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: revokedTokenHash
      });
      batch2.update(doc(legitDb, 'invitations', revokedTokenHash), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid
      });
      await assertFails(batch2.commit());
      logPass('Scenario 2: Joining with revoked invitation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 2 failed', e);
    }

    // 3. Joining with an expired invitation
    try {
      const batch3 = writeBatch(legitDb);
      batch3.update(doc(legitDb, 'workspaces', familyWsId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        lastInviteTokenHash: expiredTokenHash
      });
      batch3.set(doc(legitDb, 'workspaces', familyWsId, 'members', legitimateInviteeUid), {
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: expiredTokenHash
      });
      batch3.update(doc(legitDb, 'invitations', expiredTokenHash), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid
      });
      await assertFails(batch3.commit());
      logPass('Scenario 3: Joining with expired invitation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 3 failed', e);
    }

    // 4. Accepting an invitation assigned to another email
    try {
      const batch4 = writeBatch(rogueDb);
      batch4.update(doc(rogueDb, 'workspaces', familyWsId), {
        members: arrayUnion('attacker-rogue-999'),
        'memberRoles.attacker-rogue-999': 'editor',
        lastInviteTokenHash: validTokenHash
      });
      batch4.set(doc(rogueDb, 'workspaces', familyWsId, 'members', 'attacker-rogue-999'), {
        uid: 'attacker-rogue-999',
        role: 'editor',
        inviteTokenHash: validTokenHash
      });
      batch4.update(doc(rogueDb, 'invitations', validTokenHash), {
        status: 'accepted',
        acceptedByUid: 'attacker-rogue-999'
      });
      await assertFails(batch4.commit());
      logPass('Scenario 4: Accepting another person\'s email-restricted invitation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 4 failed', e);
    }

    // 5. Escalating editor privileges to admin
    try {
      const batch5 = writeBatch(legitDb);
      batch5.update(doc(legitDb, 'workspaces', familyWsId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'admin', // Escalation to admin!
        lastInviteTokenHash: validTokenHash
      });
      batch5.set(doc(legitDb, 'workspaces', familyWsId, 'members', legitimateInviteeUid), {
        uid: legitimateInviteeUid,
        role: 'admin',
        inviteTokenHash: validTokenHash
      });
      batch5.update(doc(legitDb, 'invitations', validTokenHash), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid
      });
      await assertFails(batch5.commit());
      logPass('Scenario 5: Escalating role from editor to admin DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 5 failed', e);
    }

    // 6. Assigning oneself the owner role
    try {
      const batch6 = writeBatch(legitDb);
      batch6.update(doc(legitDb, 'workspaces', familyWsId), {
        ownerUid: legitimateInviteeUid, // Usurping ownership!
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'owner',
        lastInviteTokenHash: validTokenHash
      });
      batch6.set(doc(legitDb, 'workspaces', familyWsId, 'members', legitimateInviteeUid), {
        uid: legitimateInviteeUid,
        role: 'owner',
        inviteTokenHash: validTokenHash
      });
      batch6.update(doc(legitDb, 'invitations', validTokenHash), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid
      });
      await assertFails(batch6.commit());
      logPass('Scenario 6: Usurping ownerUid and assigning owner role DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 6 failed', e);
    }

    // 7. Modifying existing member roles during joining
    try {
      const batch7 = writeBatch(legitDb);
      batch7.update(doc(legitDb, 'workspaces', familyWsId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${ownerUid}`]: 'viewer', // Demoting owner!
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        lastInviteTokenHash: validTokenHash
      });
      batch7.set(doc(legitDb, 'workspaces', familyWsId, 'members', legitimateInviteeUid), {
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: validTokenHash
      });
      batch7.update(doc(legitDb, 'invitations', validTokenHash), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid
      });
      await assertFails(batch7.commit());
      logPass('Scenario 7: Tampering with existing member roles during join DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 7 failed', e);
    }

    // 8. Arbitrary invitation status modification by stranger
    try {
      await assertFails(updateDoc(doc(rogueDb, 'invitations', validTokenHash), {
        status: 'accepted',
        acceptedByUid: 'attacker-rogue-999'
      }));
      logPass('Scenario 8: Arbitrary invitation status modification by stranger DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 8 failed', e);
    }

    // 9. Modifying immutable invitation fields
    try {
      await assertFails(updateDoc(doc(ownerDb, 'invitations', validTokenHash), {
        status: 'revoked',
        role: 'admin', // Tampering with role!
        workspaceId: 'tampered-workspace-id'
      }));
      logPass('Scenario 9: Modifying immutable fields during revocation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 9 failed', e);
    }

    // 10. Joining a Personal workspace through a forged invitation
    const forgedTokenHash = 'forged-hash-personal-1111222233334444555566667777888899990000aaaa';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'invitations', forgedTokenHash), {
        workspaceId: personalWsId, // Points to personal workspace
        tokenHash: forgedTokenHash,
        invitedEmail: designatedEmail,
        role: 'editor',
        status: 'pending',
        createdByUid: ownerUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });
    });

    try {
      const batch10 = writeBatch(legitDb);
      batch10.update(doc(legitDb, 'workspaces', personalWsId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        lastInviteTokenHash: forgedTokenHash
      });
      batch10.set(doc(legitDb, 'workspaces', personalWsId, 'members', legitimateInviteeUid), {
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: forgedTokenHash
      });
      batch10.update(doc(legitDb, 'invitations', forgedTokenHash), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid
      });
      await assertFails(batch10.commit());
      logPass('Scenario 10: Joining a Personal workspace via forged invitation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 10 failed', e);
    }

    // 10B. Unauthorized Extra Member-Role Injection during legitimate invite join:
    // Attacker uses valid invitation, adds legitimateInviteeUid as editor, BUT also injects 'rogue-extra-uid': 'admin' into memberRoles.
    try {
      const injectionBatch = writeBatch(legitDb);
      injectionBatch.update(doc(legitDb, 'workspaces', familyWsId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        'memberRoles.rogue-extra-uid': 'admin', // Unauthorized extra member-role injection!
        lastInviteTokenHash: validTokenHash
      });
      injectionBatch.set(doc(legitDb, 'workspaces', familyWsId, 'members', legitimateInviteeUid), {
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: validTokenHash
      });
      injectionBatch.update(doc(legitDb, 'invitations', validTokenHash), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid
      });
      await assertFails(injectionBatch.commit());
      logPass('Scenario 10B: Unauthorized extra member-role injection into memberRoles DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 10B failed', e);
    }

    // ------------------------------------------------------------------------
    // SECTION B: LEGITIMATE ATOMIC INVITATION FLOW VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION B: Legitimate Atomic Invitation Flow Verification ---');

    // 11. Legitimate atomic batch acceptance
    try {
      const legitimateBatch = writeBatch(legitDb);

      // 1. Workspace membership update
      legitimateBatch.update(doc(legitDb, 'workspaces', familyWsId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        lastInviteTokenHash: validTokenHash,
        updatedAt: serverTimestamp()
      });

      // 2. Member document creation
      legitimateBatch.set(doc(legitDb, 'workspaces', familyWsId, 'members', legitimateInviteeUid), {
        id: legitimateInviteeUid,
        uid: legitimateInviteeUid,
        displayName: 'Priya Sharma',
        email: 'priya.sharma@family.org',
        role: 'editor',
        inviteTokenHash: validTokenHash,
        status: 'active',
        joinedAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp()
      });

      // 3. Invitation transition from pending to accepted
      legitimateBatch.update(doc(legitDb, 'invitations', validTokenHash), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid,
        acceptedAt: serverTimestamp()
      });

      await assertSucceeds(legitimateBatch.commit());
      logPass('Scenario 11: Legitimate atomic batch (ws update + member doc + invite status) SUCCEEDS completely');
    } catch (e) {
      logFail('Scenario 11 failed', e);
    }

    // 12. Verification of single-use consumption: Attempting duplicate acceptance must fail
    try {
      const duplicateBatch = writeBatch(legitDb);
      duplicateBatch.update(doc(legitDb, 'workspaces', familyWsId), {
        lastInviteTokenHash: validTokenHash
      });
      await assertFails(duplicateBatch.commit());
      logPass('Scenario 12: Re-using the accepted single-use invitation token DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 12 failed', e);
    }

    // 13. Verification of newly joined member permissions: Can read entries in joined workspace
    try {
      // First, owner creates a diary entry
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'workspaces', familyWsId, 'entries', 'entry-farm-harvest'), {
          title: 'Harvest season update',
          content: 'Organic turmeric harvest completed.',
          createdByUid: ownerUid,
          workspaceId: familyWsId,
          createdAt: new Date().toISOString()
        });
      });

      const entrySnap = await getDoc(doc(legitDb, 'workspaces', familyWsId, 'entries', 'entry-farm-harvest'));
      if (entrySnap.exists() && entrySnap.data().title === 'Harvest season update') {
        logPass('Scenario 13: Joined member can read shared workspace diary entries');
      } else {
        throw new Error('Entry not found or unreadable');
      }
    } catch (e) {
      logFail('Scenario 13 failed', e);
    }

    // 14. Verification of newly joined editor permissions: Can create entries in joined workspace
    try {
      await assertSucceeds(setDoc(doc(legitDb, 'workspaces', familyWsId, 'entries', 'entry-priya-notes'), {
        title: 'Irrigation Schedule',
        content: 'Drip lines checked and running.',
        createdByUid: legitimateInviteeUid,
        workspaceId: familyWsId,
        createdAt: new Date().toISOString()
      }));
      logPass('Scenario 14: Joined Editor can create new diary entries in shared workspace');
    } catch (e) {
      logFail('Scenario 14 failed', e);
    }

    // 15. Verification of personal privacy: Joined member CANNOT read owner's personal workspace
    try {
      await assertFails(getDoc(doc(legitDb, 'workspaces', personalWsId)));
      logPass('Scenario 15: Joined family member strictly DENIED access to Owner\'s Personal workspace');
    } catch (e) {
      logFail('Scenario 15 failed', e);
    }

    // ------------------------------------------------------------------------
    // SECTION D: CRITICAL INVITATION-CREATOR AUTHORIZATION AUDIT
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION D: Critical Invitation-Creator Authorization Audit ---');

    const attackerForgedHash = 'hash-attacker-forged-1111222233334444555566667777888899990000aaaa';

    // 19A. Unrelated non-member attacker attempts to create root invitation for victim workspace
    try {
      await assertFails(setDoc(doc(rogueDb, 'invitations', attackerForgedHash), {
        workspaceId: familyWsId,
        tokenHash: attackerForgedHash,
        invitedEmail: 'attacker@evil.com',
        role: 'editor',
        status: 'pending',
        createdByUid: attackerUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      }));
      logPass('Scenario 19A: Unrelated non-member creating invitation for victim workspace DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 19A failed', e);
    }

    // 19B. Attacker attempts atomic join batch using an unauthorized invitation (even if seeded)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'invitations', attackerForgedHash), {
        workspaceId: familyWsId,
        tokenHash: attackerForgedHash,
        invitedEmail: 'attacker@evil.com',
        role: 'editor',
        status: 'pending',
        createdByUid: attackerUid, // Attacker is NOT owner or admin!
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });
    });

    try {
      const batch19B = writeBatch(rogueDb);
      batch19B.update(doc(rogueDb, 'workspaces', familyWsId), {
        members: arrayUnion(attackerUid),
        [`memberRoles.${attackerUid}`]: 'editor',
        lastInviteTokenHash: attackerForgedHash,
        updatedAt: serverTimestamp()
      });
      batch19B.set(doc(rogueDb, 'workspaces', familyWsId, 'members', attackerUid), {
        id: attackerUid,
        uid: attackerUid,
        role: 'editor',
        inviteTokenHash: attackerForgedHash,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch19B.update(doc(rogueDb, 'invitations', attackerForgedHash), {
        status: 'accepted',
        acceptedByUid: attackerUid,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch19B.commit());
      logPass('Scenario 19B: Joining via non-owner/non-admin invitation DENIED by isValidInviteJoin in Firestore Rules');
    } catch (e) {
      logFail('Scenario 19B failed', e);
    }

    // 20. Ordinary Editor attempts to create root invitation
    const editorInviteHash = 'hash-editor-invite-1111222233334444555566667777888899990000aaaa';
    try {
      await assertFails(setDoc(doc(editorUserDb, 'invitations', editorInviteHash), {
        workspaceId: familyWsId,
        tokenHash: editorInviteHash,
        invitedEmail: 'friend@editor.com',
        role: 'editor',
        status: 'pending',
        createdByUid: editorUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      }));
      logPass('Scenario 20: Ordinary Editor creating workspace invitation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 20 failed', e);
    }

    // 21. Ordinary Viewer attempts to create root invitation
    const viewerInviteHash = 'hash-viewer-invite-1111222233334444555566667777888899990000aaaa';
    try {
      await assertFails(setDoc(doc(viewerUserDb, 'invitations', viewerInviteHash), {
        workspaceId: familyWsId,
        tokenHash: viewerInviteHash,
        invitedEmail: 'friend@viewer.com',
        role: 'viewer',
        status: 'pending',
        createdByUid: viewerUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      }));
      logPass('Scenario 21: Ordinary Viewer creating workspace invitation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 21 failed', e);
    }

    // 22A. Authorized Workspace Admin creates root invitation
    const adminInviteHash = 'hash-admin-invite-1111222233334444555566667777888899990000aaaa';
    const adminInviteeUid = 'invitee-admin-target-555';
    try {
      await assertSucceeds(setDoc(doc(adminUserDb, 'invitations', adminInviteHash), {
        workspaceId: familyWsId,
        tokenHash: adminInviteHash,
        invitedEmail: 'cousin@family.org',
        role: 'editor',
        status: 'pending',
        createdByUid: adminUid, // Admin is authorized!
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      }));
      logPass('Scenario 22A: Authorized Workspace Administrator creating invitation SUCCEEDS');
    } catch (e) {
      logFail('Scenario 22A failed', e);
    }

    // 22B. Legitimate invitee accepts the Admin-created invitation via atomic batch
    const adminInviteeCtx = testEnv.authenticatedContext(adminInviteeUid, { email: 'cousin@family.org' });
    const adminInviteeDb = adminInviteeCtx.firestore();
    try {
      const batch22B = writeBatch(adminInviteeDb);
      batch22B.update(doc(adminInviteeDb, 'workspaces', familyWsId), {
        members: arrayUnion(adminInviteeUid),
        [`memberRoles.${adminInviteeUid}`]: 'editor',
        lastInviteTokenHash: adminInviteHash,
        updatedAt: serverTimestamp()
      });
      batch22B.set(doc(adminInviteeDb, 'workspaces', familyWsId, 'members', adminInviteeUid), {
        id: adminInviteeUid,
        uid: adminInviteeUid,
        role: 'editor',
        inviteTokenHash: adminInviteHash,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch22B.update(doc(adminInviteeDb, 'invitations', adminInviteHash), {
        status: 'accepted',
        acceptedByUid: adminInviteeUid,
        acceptedAt: serverTimestamp()
      });
      await assertSucceeds(batch22B.commit());
      logPass('Scenario 22B: Legitimate acceptance of Admin-created invitation SUCCEEDS completely');
    } catch (e) {
      logFail('Scenario 22B failed', e);
    }

    // 23. Authorized Workspace Owner creates root invitation
    const ownerFreshInviteHash = 'hash-owner-fresh-1111222233334444555566667777888899990000aaaa';
    try {
      await assertSucceeds(setDoc(doc(ownerDb, 'invitations', ownerFreshInviteHash), {
        workspaceId: familyWsId,
        tokenHash: ownerFreshInviteHash,
        invitedEmail: 'partner@family.org',
        role: 'editor',
        status: 'pending',
        createdByUid: ownerUid, // Owner is authorized!
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      }));
      logPass('Scenario 23: Authorized Workspace Owner creating invitation SUCCEEDS');
    } catch (e) {
      logFail('Scenario 23 failed', e);
    }

    // 24. Personal workspace owner attempts to create invitation for personal workspace
    const personalInviteHash = 'hash-personal-attempt-1111222233334444555566667777888899990000aaaa';
    try {
      await assertFails(setDoc(doc(ownerDb, 'invitations', personalInviteHash), {
        workspaceId: personalWsId, // Personal workspace cannot have invitations!
        tokenHash: personalInviteHash,
        invitedEmail: 'friend@personal.com',
        role: 'editor',
        status: 'pending',
        createdByUid: ownerUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      }));
      logPass('Scenario 24: Creating invitation for Personal workspace strictly DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 24 failed', e);
    }
    console.log('\n--- SECTION C: Null, Missing & Empty memberRoles Edge-Case Verification ---');

    const wsMissingRolesId = 'ws-family-missing-roles';
    const wsNullRolesId = 'ws-family-null-roles';
    const wsEmptyRolesId = 'ws-family-empty-roles';

    // 16A. memberRoles completely missing: Legitimate invited member joins
    const tokenMissingLegit = 'hash-missing-legit-1111222233334444555566667777888899990000aaaa';
    try {
      const batch16A = writeBatch(legitDb);
      batch16A.update(doc(legitDb, 'workspaces', wsMissingRolesId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        lastInviteTokenHash: tokenMissingLegit,
        updatedAt: serverTimestamp()
      });
      batch16A.set(doc(legitDb, 'workspaces', wsMissingRolesId, 'members', legitimateInviteeUid), {
        id: legitimateInviteeUid,
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: tokenMissingLegit,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch16A.update(doc(legitDb, 'invitations', tokenMissingLegit), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid,
        acceptedAt: serverTimestamp()
      });
      await assertSucceeds(batch16A.commit());
      logPass('Scenario 16A: Workspace with MISSING memberRoles - Legitimate invited member join SUCCEEDS');
    } catch (e) {
      logFail('Scenario 16A failed', e);
    }

    // 16B. memberRoles completely missing: Unauthorized extra UID injection
    const tokenMissingInject = 'hash-missing-inject-1111222233334444555566667777888899990000aaaa';
    try {
      const batch16B = writeBatch(legitDb);
      batch16B.update(doc(legitDb, 'workspaces', wsMissingRolesId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        'memberRoles.rogue-extra-uid': 'admin', // Malicious extra injection
        lastInviteTokenHash: tokenMissingInject,
        updatedAt: serverTimestamp()
      });
      batch16B.set(doc(legitDb, 'workspaces', wsMissingRolesId, 'members', legitimateInviteeUid), {
        id: legitimateInviteeUid,
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: tokenMissingInject,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch16B.update(doc(legitDb, 'invitations', tokenMissingInject), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch16B.commit());
      logPass('Scenario 16B: Workspace with MISSING memberRoles - Unauthorized extra UID injection DENIED');
    } catch (e) {
      logFail('Scenario 16B failed', e);
    }

    // 17A. memberRoles explicitly NULL: Legitimate invited member joins
    const tokenNullLegit = 'hash-null-legit-1111222233334444555566667777888899990000aaaa';
    try {
      const batch17A = writeBatch(legitDb);
      batch17A.update(doc(legitDb, 'workspaces', wsNullRolesId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        lastInviteTokenHash: tokenNullLegit,
        updatedAt: serverTimestamp()
      });
      batch17A.set(doc(legitDb, 'workspaces', wsNullRolesId, 'members', legitimateInviteeUid), {
        id: legitimateInviteeUid,
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: tokenNullLegit,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch17A.update(doc(legitDb, 'invitations', tokenNullLegit), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid,
        acceptedAt: serverTimestamp()
      });
      await assertSucceeds(batch17A.commit());
      logPass('Scenario 17A: Workspace with NULL memberRoles - Legitimate invited member join SUCCEEDS');
    } catch (e) {
      logFail('Scenario 17A failed', e);
    }

    // 17B. memberRoles explicitly NULL: Unauthorized extra UID injection
    const tokenNullInject = 'hash-null-inject-1111222233334444555566667777888899990000aaaa';
    try {
      const batch17B = writeBatch(legitDb);
      batch17B.update(doc(legitDb, 'workspaces', wsNullRolesId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        'memberRoles.rogue-extra-uid': 'admin', // Malicious extra injection
        lastInviteTokenHash: tokenNullInject,
        updatedAt: serverTimestamp()
      });
      batch17B.set(doc(legitDb, 'workspaces', wsNullRolesId, 'members', legitimateInviteeUid), {
        id: legitimateInviteeUid,
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: tokenNullInject,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch17B.update(doc(legitDb, 'invitations', tokenNullInject), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch17B.commit());
      logPass('Scenario 17B: Workspace with NULL memberRoles - Unauthorized extra UID injection DENIED');
    } catch (e) {
      logFail('Scenario 17B failed', e);
    }

    // 18A. memberRoles present as EMPTY MAP {}: Legitimate invited member joins
    const tokenEmptyLegit = 'hash-empty-legit-1111222233334444555566667777888899990000aaaa';
    try {
      const batch18A = writeBatch(legitDb);
      batch18A.update(doc(legitDb, 'workspaces', wsEmptyRolesId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        lastInviteTokenHash: tokenEmptyLegit,
        updatedAt: serverTimestamp()
      });
      batch18A.set(doc(legitDb, 'workspaces', wsEmptyRolesId, 'members', legitimateInviteeUid), {
        id: legitimateInviteeUid,
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: tokenEmptyLegit,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch18A.update(doc(legitDb, 'invitations', tokenEmptyLegit), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid,
        acceptedAt: serverTimestamp()
      });
      await assertSucceeds(batch18A.commit());
      logPass('Scenario 18A: Workspace with EMPTY MAP memberRoles - Legitimate invited member join SUCCEEDS');
    } catch (e) {
      logFail('Scenario 18A failed', e);
    }

    // 18B. memberRoles present as EMPTY MAP {}: Unauthorized extra UID injection
    const tokenEmptyInject = 'hash-empty-inject-1111222233334444555566667777888899990000aaaa';
    try {
      const batch18B = writeBatch(legitDb);
      batch18B.update(doc(legitDb, 'workspaces', wsEmptyRolesId), {
        members: arrayUnion(legitimateInviteeUid),
        [`memberRoles.${legitimateInviteeUid}`]: 'editor',
        'memberRoles.rogue-extra-uid': 'admin', // Malicious extra injection
        lastInviteTokenHash: tokenEmptyInject,
        updatedAt: serverTimestamp()
      });
      batch18B.set(doc(legitDb, 'workspaces', wsEmptyRolesId, 'members', legitimateInviteeUid), {
        id: legitimateInviteeUid,
        uid: legitimateInviteeUid,
        role: 'editor',
        inviteTokenHash: tokenEmptyInject,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch18B.update(doc(legitDb, 'invitations', tokenEmptyInject), {
        status: 'accepted',
        acceptedByUid: legitimateInviteeUid,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch18B.commit());
      logPass('Scenario 18B: Workspace with EMPTY MAP memberRoles - Unauthorized extra UID injection DENIED');
    } catch (e) {
      logFail('Scenario 18B failed', e);
    }

    // ------------------------------------------------------------------------
    // SECTION E: ADMINISTRATOR & OWNER LIFECYCLE REVALIDATION (DEMOTION/REMOVAL/TRANSFER)
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION E: Administrator & Owner Lifecycle Revalidation ---');

    const wsLifecycleId = 'ws-lifecycle-sharma';
    const lifecycleInviteeUid = 'invitee-lifecycle-target';
    const lifecycleInviteeCtx = testEnv.authenticatedContext(lifecycleInviteeUid, { email: 'invitee.lifecycle@family.org' });
    const lifecycleInviteeDb = lifecycleInviteeCtx.firestore();

    // Setup lifecycle workspace: Owner + Admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'workspaces', wsLifecycleId), {
        id: wsLifecycleId,
        name: 'Sharma Lifecycle Workspace',
        type: 'family',
        ownerUid,
        members: [ownerUid, adminUid],
        memberRoles: {
          [ownerUid]: 'owner',
          [adminUid]: 'admin'
        },
        createdAt: new Date().toISOString()
      });
    });

    // 25A. Admin creates invitation and remains an admin: Acceptance SUCCEEDS
    const tokenLifecycleA = 'hash-lifecycle-a-1111222233334444555566667777888899990000aaaa';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'invitations', tokenLifecycleA), {
        workspaceId: wsLifecycleId,
        tokenHash: tokenLifecycleA,
        invitedEmail: 'invitee.lifecycle@family.org',
        role: 'editor',
        status: 'pending',
        createdByUid: adminUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });
    });

    try {
      const batch25A = writeBatch(lifecycleInviteeDb);
      batch25A.update(doc(lifecycleInviteeDb, 'workspaces', wsLifecycleId), {
        members: arrayUnion(lifecycleInviteeUid),
        [`memberRoles.${lifecycleInviteeUid}`]: 'editor',
        lastInviteTokenHash: tokenLifecycleA,
        updatedAt: serverTimestamp()
      });
      batch25A.set(doc(lifecycleInviteeDb, 'workspaces', wsLifecycleId, 'members', lifecycleInviteeUid), {
        id: lifecycleInviteeUid,
        uid: lifecycleInviteeUid,
        role: 'editor',
        inviteTokenHash: tokenLifecycleA,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch25A.update(doc(lifecycleInviteeDb, 'invitations', tokenLifecycleA), {
        status: 'accepted',
        acceptedByUid: lifecycleInviteeUid,
        acceptedAt: serverTimestamp()
      });
      await assertSucceeds(batch25A.commit());
      logPass('Scenario 25A: Admin creates invitation and remains admin - Acceptance SUCCEEDS');
    } catch (e) {
      logFail('Scenario 25A failed', e);
    }

    // 25B. Admin creates invitation, then owner demotes admin to editor: Acceptance DENIED
    const tokenLifecycleB = 'hash-lifecycle-b-1111222233334444555566667777888899990000aaaa';
    const inviteeB = 'invitee-target-b';
    const inviteeBCtx = testEnv.authenticatedContext(inviteeB, { email: 'invitee.b@family.org' });
    const inviteeBDb = inviteeBCtx.firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      // Admin created invite when they were admin
      await setDoc(doc(adminDb, 'invitations', tokenLifecycleB), {
        workspaceId: wsLifecycleId,
        tokenHash: tokenLifecycleB,
        invitedEmail: 'invitee.b@family.org',
        role: 'editor',
        status: 'pending',
        createdByUid: adminUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // Owner demotes admin to editor
      await updateDoc(doc(adminDb, 'workspaces', wsLifecycleId), {
        [`memberRoles.${adminUid}`]: 'editor'
      });
    });

    try {
      const batch25B = writeBatch(inviteeBDb);
      batch25B.update(doc(inviteeBDb, 'workspaces', wsLifecycleId), {
        members: arrayUnion(inviteeB),
        [`memberRoles.${inviteeB}`]: 'editor',
        lastInviteTokenHash: tokenLifecycleB,
        updatedAt: serverTimestamp()
      });
      batch25B.set(doc(inviteeBDb, 'workspaces', wsLifecycleId, 'members', inviteeB), {
        id: inviteeB,
        uid: inviteeB,
        role: 'editor',
        inviteTokenHash: tokenLifecycleB,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch25B.update(doc(inviteeBDb, 'invitations', tokenLifecycleB), {
        status: 'accepted',
        acceptedByUid: inviteeB,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch25B.commit());
      logPass('Scenario 25B: Admin demoted to editor before acceptance - Acceptance DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 25B failed', e);
    }

    // 25C. Admin creates invitation, then owner removes admin from workspace: Acceptance DENIED
    const tokenLifecycleC = 'hash-lifecycle-c-1111222233334444555566667777888899990000aaaa';
    const inviteeC = 'invitee-target-c';
    const inviteeCCtx = testEnv.authenticatedContext(inviteeC, { email: 'invitee.c@family.org' });
    const inviteeCDb = inviteeCCtx.firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'invitations', tokenLifecycleC), {
        workspaceId: wsLifecycleId,
        tokenHash: tokenLifecycleC,
        invitedEmail: 'invitee.c@family.org',
        role: 'editor',
        status: 'pending',
        createdByUid: adminUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // Owner removes admin from members completely
      const wsSnap = await getDoc(doc(adminDb, 'workspaces', wsLifecycleId));
      const currentMembers = wsSnap.data().members || [];
      const updatedMembers = currentMembers.filter(m => m !== adminUid);
      await updateDoc(doc(adminDb, 'workspaces', wsLifecycleId), {
        members: updatedMembers
      });
    });

    try {
      const batch25C = writeBatch(inviteeCDb);
      batch25C.update(doc(inviteeCDb, 'workspaces', wsLifecycleId), {
        members: arrayUnion(inviteeC),
        [`memberRoles.${inviteeC}`]: 'editor',
        lastInviteTokenHash: tokenLifecycleC,
        updatedAt: serverTimestamp()
      });
      batch25C.set(doc(inviteeCDb, 'workspaces', wsLifecycleId, 'members', inviteeC), {
        id: inviteeC,
        uid: inviteeC,
        role: 'editor',
        inviteTokenHash: tokenLifecycleC,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch25C.update(doc(inviteeCDb, 'invitations', tokenLifecycleC), {
        status: 'accepted',
        acceptedByUid: inviteeC,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch25C.commit());
      logPass('Scenario 25C: Admin removed from workspace before acceptance - Acceptance DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 25C failed', e);
    }

    // 25D. Owner creates invitation and remains workspace owner: Acceptance SUCCEEDS
    const wsOwnerCheckId = 'ws-owner-check-workspace';
    const tokenLifecycleD = 'hash-lifecycle-d-1111222233334444555566667777888899990000aaaa';
    const inviteeD = 'invitee-target-d';
    const inviteeDCtx = testEnv.authenticatedContext(inviteeD, { email: 'invitee.d@family.org' });
    const inviteeDDb = inviteeDCtx.firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'workspaces', wsOwnerCheckId), {
        id: wsOwnerCheckId,
        name: 'Sharma Owner Workspace',
        type: 'family',
        ownerUid,
        members: [ownerUid],
        memberRoles: { [ownerUid]: 'owner' },
        createdAt: new Date().toISOString()
      });

      await setDoc(doc(adminDb, 'invitations', tokenLifecycleD), {
        workspaceId: wsOwnerCheckId,
        tokenHash: tokenLifecycleD,
        invitedEmail: 'invitee.d@family.org',
        role: 'editor',
        status: 'pending',
        createdByUid: ownerUid,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });
    });

    try {
      const batch25D = writeBatch(inviteeDDb);
      batch25D.update(doc(inviteeDDb, 'workspaces', wsOwnerCheckId), {
        members: arrayUnion(inviteeD),
        [`memberRoles.${inviteeD}`]: 'editor',
        lastInviteTokenHash: tokenLifecycleD,
        updatedAt: serverTimestamp()
      });
      batch25D.set(doc(inviteeDDb, 'workspaces', wsOwnerCheckId, 'members', inviteeD), {
        id: inviteeD,
        uid: inviteeD,
        role: 'editor',
        inviteTokenHash: tokenLifecycleD,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch25D.update(doc(inviteeDDb, 'invitations', tokenLifecycleD), {
        status: 'accepted',
        acceptedByUid: inviteeD,
        acceptedAt: serverTimestamp()
      });
      await assertSucceeds(batch25D.commit());
      logPass('Scenario 25D: Owner creates invitation and remains owner - Acceptance SUCCEEDS');
    } catch (e) {
      logFail('Scenario 25D failed', e);
    }

    // 25E. Owner creates invitation, then ownership is transferred: Acceptance DENIED
    const wsTransferId = 'ws-ownership-transfer-test';
    const previousOwnerUid = 'previous-owner-uid-111';
    const newOwnerUid = 'new-owner-uid-222';
    const tokenLifecycleE = 'hash-lifecycle-e-1111222233334444555566667777888899990000aaaa';
    const inviteeE = 'invitee-target-e';
    const inviteeECtx = testEnv.authenticatedContext(inviteeE, { email: 'invitee.e@family.org' });
    const inviteeEDb = inviteeECtx.firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      // Initially owned by previousOwnerUid
      await setDoc(doc(adminDb, 'workspaces', wsTransferId), {
        id: wsTransferId,
        name: 'Transferred Workspace',
        type: 'family',
        ownerUid: newOwnerUid, // Ownership transferred to newOwnerUid!
        members: [newOwnerUid, previousOwnerUid],
        memberRoles: {
          [newOwnerUid]: 'owner',
          [previousOwnerUid]: 'viewer' // Previous owner is now just a viewer!
        },
        createdAt: new Date().toISOString()
      });

      // Invitation created by previousOwnerUid before transfer
      await setDoc(doc(adminDb, 'invitations', tokenLifecycleE), {
        workspaceId: wsTransferId,
        tokenHash: tokenLifecycleE,
        invitedEmail: 'invitee.e@family.org',
        role: 'editor',
        status: 'pending',
        createdByUid: previousOwnerUid, // Previous owner!
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });
    });

    try {
      const batch25E = writeBatch(inviteeEDb);
      batch25E.update(doc(inviteeEDb, 'workspaces', wsTransferId), {
        members: arrayUnion(inviteeE),
        [`memberRoles.${inviteeE}`]: 'editor',
        lastInviteTokenHash: tokenLifecycleE,
        updatedAt: serverTimestamp()
      });
      batch25E.set(doc(inviteeEDb, 'workspaces', wsTransferId, 'members', inviteeE), {
        id: inviteeE,
        uid: inviteeE,
        role: 'editor',
        inviteTokenHash: tokenLifecycleE,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch25E.update(doc(inviteeEDb, 'invitations', tokenLifecycleE), {
        status: 'accepted',
        acceptedByUid: inviteeE,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch25E.commit());
      logPass('Scenario 25E: Previous owner whose ownership was transferred - Acceptance DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 25E failed', e);
    }

    // ------------------------------------------------------------------------
    // SECTION G: INVITATION TOKEN CONSUMPTION & WORKSPACE BINDING SECURITY
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION G: Token Consumption & Workspace Binding Security ---');

    const wsTokenConsumptionId = 'ws-token-consumption-audit';
    const tokenConsumptionOwner = 'owner-audit-100';
    const tokenConsumptionAdmin = 'admin-audit-200';
    const tokenConsumptionEditor = 'editor-audit-300';
    const tokenConsumptionInvitee = 'invitee-audit-400';
    const tokenConsumptionInviteeEmail = 'invitee.audit@example.com';
    const tokenConsumptionAttacker = 'attacker-audit-900';

    const tokenIsolated = 'token-hash-isolated-acceptance-test-1111222233334444555566667777';
    const tokenLegit = 'token-hash-legit-batch-acceptance-test-1111222233334444555566667777';
    const tokenImpersonate = 'token-hash-impersonate-test-11112222333344445555666677778888';
    const tokenOwnerRevoke = 'token-hash-owner-revocation-test-1111222233334444555566667777';
    const tokenAdminRevoke = 'token-hash-admin-revocation-test-1111222233334444555566667777';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      // Setup workspace
      await setDoc(doc(adminDb, 'workspaces', wsTokenConsumptionId), {
        id: wsTokenConsumptionId,
        name: 'Token Consumption Audit Workspace',
        type: 'family',
        ownerUid: tokenConsumptionOwner,
        members: [tokenConsumptionOwner, tokenConsumptionAdmin, tokenConsumptionEditor],
        memberRoles: {
          [tokenConsumptionOwner]: 'owner',
          [tokenConsumptionAdmin]: 'admin',
          [tokenConsumptionEditor]: 'editor'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Fixture 1: For isolated acceptance test
      await setDoc(doc(adminDb, 'invitations', tokenIsolated), {
        workspaceId: wsTokenConsumptionId,
        tokenHash: tokenIsolated,
        invitedEmail: tokenConsumptionInviteeEmail,
        role: 'editor',
        status: 'pending',
        createdByUid: tokenConsumptionOwner,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // Fixture 2: For legit batch acceptance test
      await setDoc(doc(adminDb, 'invitations', tokenLegit), {
        workspaceId: wsTokenConsumptionId,
        tokenHash: tokenLegit,
        invitedEmail: tokenConsumptionInviteeEmail,
        role: 'editor',
        status: 'pending',
        createdByUid: tokenConsumptionOwner,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // Fixture 3: For impersonation test
      await setDoc(doc(adminDb, 'invitations', tokenImpersonate), {
        workspaceId: wsTokenConsumptionId,
        tokenHash: tokenImpersonate,
        invitedEmail: tokenConsumptionInviteeEmail,
        role: 'editor',
        status: 'pending',
        createdByUid: tokenConsumptionOwner,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // Fixture 4: Created by Admin for Owner revocation test
      await setDoc(doc(adminDb, 'invitations', tokenOwnerRevoke), {
        workspaceId: wsTokenConsumptionId,
        tokenHash: tokenOwnerRevoke,
        invitedEmail: 'someone@example.com',
        role: 'editor',
        status: 'pending',
        createdByUid: tokenConsumptionAdmin,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // Fixture 5: Created by Owner for Admin revocation test
      await setDoc(doc(adminDb, 'invitations', tokenAdminRevoke), {
        workspaceId: wsTokenConsumptionId,
        tokenHash: tokenAdminRevoke,
        invitedEmail: 'someone.else@example.com',
        role: 'editor',
        status: 'pending',
        createdByUid: tokenConsumptionOwner,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });
    });

    const inviteeAuditDb = testEnv.authenticatedContext(tokenConsumptionInvitee, { email: tokenConsumptionInviteeEmail }).firestore();
    const attackerAuditDb = testEnv.authenticatedContext(tokenConsumptionAttacker, { email: 'attacker@evil.com' }).firestore();

    // 1 & 2. Isolated update of /invitations/{tokenHash} to accepted without workspace join
    try {
      await assertFails(updateDoc(doc(inviteeAuditDb, 'invitations', tokenIsolated), {
        status: 'accepted',
        acceptedByUid: tokenConsumptionInvitee
      }));
      logPass('Scenario 26: Isolated update of /invitations/{tokenHash} to accepted without workspace join DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 26 failed', e);
    }

    // 3. Legitimate atomic batch acceptance
    try {
      const batch27 = writeBatch(inviteeAuditDb);
      batch27.update(doc(inviteeAuditDb, 'workspaces', wsTokenConsumptionId), {
        members: arrayUnion(tokenConsumptionInvitee),
        [`memberRoles.${tokenConsumptionInvitee}`]: 'editor',
        lastInviteTokenHash: tokenLegit,
        updatedAt: serverTimestamp()
      });
      batch27.set(doc(inviteeAuditDb, 'workspaces', wsTokenConsumptionId, 'members', tokenConsumptionInvitee), {
        id: tokenConsumptionInvitee,
        uid: tokenConsumptionInvitee,
        role: 'editor',
        inviteTokenHash: tokenLegit,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch27.update(doc(inviteeAuditDb, 'invitations', tokenLegit), {
        status: 'accepted',
        acceptedByUid: tokenConsumptionInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertSucceeds(batch27.commit());
      logPass('Scenario 27: Legitimate atomic invitation acceptance batch SUCCEEDS completely');
    } catch (e) {
      logFail('Scenario 27 failed', e);
    }

    // 4. Invitee attempts to accept using another user identity
    try {
      const victimUid = 'victim-identity-777';
      const batch28 = writeBatch(inviteeAuditDb);
      batch28.update(doc(inviteeAuditDb, 'workspaces', wsTokenConsumptionId), {
        members: arrayUnion(victimUid),
        [`memberRoles.${victimUid}`]: 'editor',
        lastInviteTokenHash: tokenImpersonate,
        updatedAt: serverTimestamp()
      });
      batch28.set(doc(inviteeAuditDb, 'workspaces', wsTokenConsumptionId, 'members', victimUid), {
        id: victimUid,
        uid: victimUid,
        role: 'editor',
        inviteTokenHash: tokenImpersonate,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch28.update(doc(inviteeAuditDb, 'invitations', tokenImpersonate), {
        status: 'accepted',
        acceptedByUid: victimUid,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch28.commit());
      logPass('Scenario 28: Invitee attempting acceptance under another user identity DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 28 failed', e);
    }

    // 5. Unauthorized user attempts to consume or invalidate a valid invitation
    try {
      await assertFails(updateDoc(doc(attackerAuditDb, 'invitations', tokenIsolated), {
        status: 'accepted',
        acceptedByUid: tokenConsumptionAttacker
      }));
      const batch29 = writeBatch(attackerAuditDb);
      batch29.update(doc(attackerAuditDb, 'workspaces', wsTokenConsumptionId), {
        members: arrayUnion(tokenConsumptionAttacker),
        [`memberRoles.${tokenConsumptionAttacker}`]: 'editor',
        lastInviteTokenHash: tokenIsolated,
        updatedAt: serverTimestamp()
      });
      batch29.set(doc(attackerAuditDb, 'workspaces', wsTokenConsumptionId, 'members', tokenConsumptionAttacker), {
        id: tokenConsumptionAttacker,
        uid: tokenConsumptionAttacker,
        role: 'editor',
        inviteTokenHash: tokenIsolated,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch29.update(doc(attackerAuditDb, 'invitations', tokenIsolated), {
        status: 'accepted',
        acceptedByUid: tokenConsumptionAttacker,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch29.commit());
      logPass('Scenario 29: Unauthorized user attempting to consume or invalidate invitation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 29 failed', e);
    }

    // 6. Authorized workspace owner revokes eligible pending invitation (created by admin)
    try {
      const ownerAuditDb = testEnv.authenticatedContext(tokenConsumptionOwner).firestore();
      await assertSucceeds(updateDoc(doc(ownerAuditDb, 'invitations', tokenOwnerRevoke), {
        status: 'revoked'
      }));
      logPass('Scenario 30A: Authorized workspace owner revokes pending invitation SUCCEEDS');
    } catch (e) {
      logFail('Scenario 30A failed', e);
    }

    // 6. Authorized workspace administrator revokes eligible pending invitation (created by owner)
    try {
      const adminAuditDb = testEnv.authenticatedContext(tokenConsumptionAdmin).firestore();
      await assertSucceeds(updateDoc(doc(adminAuditDb, 'invitations', tokenAdminRevoke), {
        status: 'revoked'
      }));
      logPass('Scenario 30B: Authorized workspace administrator revokes pending invitation SUCCEEDS');
    } catch (e) {
      logFail('Scenario 30B failed', e);
    }

    // 6. Unauthorized user or non-manager attempting revocation
    try {
      const editorAuditDb = testEnv.authenticatedContext(tokenConsumptionEditor).firestore();
      await assertFails(updateDoc(doc(editorAuditDb, 'invitations', tokenIsolated), {
        status: 'revoked'
      }));
      await assertFails(updateDoc(doc(attackerAuditDb, 'invitations', tokenIsolated), {
        status: 'revoked'
      }));
      logPass('Scenario 30C: Unauthorized user or non-manager attempting revocation DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 30C failed', e);
    }

    // ------------------------------------------------------------------------
    // SECTION H: WORKSPACE SELF-JOIN FIELD INTEGRITY & AFFECTED KEYS AUDIT
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION H: Workspace Self-Join Field Integrity & Affected Keys Audit ---');

    const wsFieldIntegrityId = 'ws-field-integrity-audit';
    const wsFieldIntegrityId2 = 'ws-field-integrity-audit-2';
    const wsFieldIntegrityId3 = 'ws-field-integrity-audit-3';
    const fieldIntegrityOwner = 'owner-integrity-100';
    const fieldIntegrityInvitee = 'invitee-integrity-400';
    const fieldIntegrityInviteeEmail = 'invitee.integrity@example.com';

    const tokenIntegrity31 = 'token-hash-integrity-rename-11112222333344445555666677778888';
    const tokenIntegrity32 = 'token-hash-integrity-settings-11112222333344445555666677778888';
    const tokenIntegrity33 = 'token-hash-integrity-metadata-11112222333344445555666677778888';
    const tokenIntegrity34 = 'token-hash-integrity-owner-11112222333344445555666677778888';
    const tokenIntegrity35 = 'token-hash-integrity-roles-11112222333344445555666677778888';
    const tokenIntegrity36 = 'token-hash-integrity-type-11112222333344445555666677778888';
    const tokenIntegrity37 = 'token-hash-integrity-legit-no-upd-1111222233334444555566667777';
    const tokenIntegrity38 = 'token-hash-integrity-legit-with-upd-1111222233334444555566667777';
    const tokenIntegrity39 = 'token-hash-integrity-client-ts-11112222333344445555666677778888';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      // Setup workspace 1
      await setDoc(doc(adminDb, 'workspaces', wsFieldIntegrityId), {
        id: wsFieldIntegrityId,
        name: 'Original Family Sanctuary',
        type: 'family',
        ownerUid: fieldIntegrityOwner,
        members: [fieldIntegrityOwner],
        memberRoles: {
          [fieldIntegrityOwner]: 'owner'
        },
        settings: {
          theme: 'forest',
          color: '#059669',
          icon: 'Home'
        },
        description: 'Original Family Description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Setup workspace 2 (for scenario 38)
      await setDoc(doc(adminDb, 'workspaces', wsFieldIntegrityId2), {
        id: wsFieldIntegrityId2,
        name: 'Second Family Sanctuary',
        type: 'family',
        ownerUid: fieldIntegrityOwner,
        members: [fieldIntegrityOwner],
        memberRoles: {
          [fieldIntegrityOwner]: 'owner'
        },
        settings: {
          theme: 'nature',
          color: '#10b981',
          icon: 'Heart'
        },
        description: 'Second Family Description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const tokens = [
        tokenIntegrity31, tokenIntegrity32, tokenIntegrity33, tokenIntegrity34,
        tokenIntegrity35, tokenIntegrity36, tokenIntegrity37
      ];
      for (const t of tokens) {
        await setDoc(doc(adminDb, 'invitations', t), {
          workspaceId: wsFieldIntegrityId,
          tokenHash: t,
          invitedEmail: fieldIntegrityInviteeEmail,
          role: 'editor',
          status: 'pending',
          createdByUid: fieldIntegrityOwner,
          createdAt: new Date().toISOString(),
          expiresAt: futureTime
        });
      }

      await setDoc(doc(adminDb, 'invitations', tokenIntegrity38), {
        workspaceId: wsFieldIntegrityId2,
        tokenHash: tokenIntegrity38,
        invitedEmail: fieldIntegrityInviteeEmail,
        role: 'editor',
        status: 'pending',
        createdByUid: fieldIntegrityOwner,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // Setup workspace 3 (for scenario 39 client-timestamp test)
      await setDoc(doc(adminDb, 'workspaces', wsFieldIntegrityId3), {
        id: wsFieldIntegrityId3,
        name: 'Third Family Sanctuary',
        type: 'family',
        ownerUid: fieldIntegrityOwner,
        members: [fieldIntegrityOwner],
        memberRoles: {
          [fieldIntegrityOwner]: 'owner'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await setDoc(doc(adminDb, 'invitations', tokenIntegrity39), {
        workspaceId: wsFieldIntegrityId3,
        tokenHash: tokenIntegrity39,
        invitedEmail: fieldIntegrityInviteeEmail,
        role: 'editor',
        status: 'pending',
        createdByUid: fieldIntegrityOwner,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });
    });

    const inviteeIntegrityDb = testEnv.authenticatedContext(fieldIntegrityInvitee, { email: fieldIntegrityInviteeEmail }).firestore();

    // 1. Invitee attempts to rename the workspace during acceptance
    try {
      const batch31 = writeBatch(inviteeIntegrityDb);
      batch31.update(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId), {
        name: 'Hijacked Workspace Name',
        members: arrayUnion(fieldIntegrityInvitee),
        [`memberRoles.${fieldIntegrityInvitee}`]: 'editor',
        lastInviteTokenHash: tokenIntegrity31,
        updatedAt: serverTimestamp()
      });
      batch31.set(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId, 'members', fieldIntegrityInvitee), {
        id: fieldIntegrityInvitee,
        uid: fieldIntegrityInvitee,
        role: 'editor',
        inviteTokenHash: tokenIntegrity31,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch31.update(doc(inviteeIntegrityDb, 'invitations', tokenIntegrity31), {
        status: 'accepted',
        acceptedByUid: fieldIntegrityInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch31.commit());
      logPass('Scenario 31: Invitee attempting to rename workspace during acceptance DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 31 failed', e);
    }

    // 2. Invitee attempts to modify workspace settings during acceptance
    try {
      const batch32 = writeBatch(inviteeIntegrityDb);
      batch32.update(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId), {
        settings: { theme: 'dark-hacked', color: '#ff0000', icon: 'Skull' },
        members: arrayUnion(fieldIntegrityInvitee),
        [`memberRoles.${fieldIntegrityInvitee}`]: 'editor',
        lastInviteTokenHash: tokenIntegrity32,
        updatedAt: serverTimestamp()
      });
      batch32.set(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId, 'members', fieldIntegrityInvitee), {
        id: fieldIntegrityInvitee,
        uid: fieldIntegrityInvitee,
        role: 'editor',
        inviteTokenHash: tokenIntegrity32,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch32.update(doc(inviteeIntegrityDb, 'invitations', tokenIntegrity32), {
        status: 'accepted',
        acceptedByUid: fieldIntegrityInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch32.commit());
      logPass('Scenario 32: Invitee attempting to modify workspace settings during acceptance DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 32 failed', e);
    }

    // 3. Invitee attempts to modify description or inject unrelated metadata
    try {
      const batch33 = writeBatch(inviteeIntegrityDb);
      batch33.update(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId), {
        description: 'Tampered Description by Invitee',
        extraInjectedField: 'Malicious Content',
        members: arrayUnion(fieldIntegrityInvitee),
        [`memberRoles.${fieldIntegrityInvitee}`]: 'editor',
        lastInviteTokenHash: tokenIntegrity33,
        updatedAt: serverTimestamp()
      });
      batch33.set(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId, 'members', fieldIntegrityInvitee), {
        id: fieldIntegrityInvitee,
        uid: fieldIntegrityInvitee,
        role: 'editor',
        inviteTokenHash: tokenIntegrity33,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch33.update(doc(inviteeIntegrityDb, 'invitations', tokenIntegrity33), {
        status: 'accepted',
        acceptedByUid: fieldIntegrityInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch33.commit());
      logPass('Scenario 33: Invitee attempting to modify description or metadata during acceptance DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 33 failed', e);
    }

    // 4. Invitee attempts to modify workspace ownerUid
    try {
      const batch34 = writeBatch(inviteeIntegrityDb);
      batch34.update(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId), {
        ownerUid: fieldIntegrityInvitee,
        members: arrayUnion(fieldIntegrityInvitee),
        [`memberRoles.${fieldIntegrityInvitee}`]: 'editor',
        lastInviteTokenHash: tokenIntegrity34,
        updatedAt: serverTimestamp()
      });
      batch34.set(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId, 'members', fieldIntegrityInvitee), {
        id: fieldIntegrityInvitee,
        uid: fieldIntegrityInvitee,
        role: 'editor',
        inviteTokenHash: tokenIntegrity34,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch34.update(doc(inviteeIntegrityDb, 'invitations', tokenIntegrity34), {
        status: 'accepted',
        acceptedByUid: fieldIntegrityInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch34.commit());
      logPass('Scenario 34: Invitee attempting to modify workspace ownerUid during acceptance DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 34 failed', e);
    }

    // 5. Invitee attempts to modify existing member roles
    try {
      const batch35 = writeBatch(inviteeIntegrityDb);
      batch35.update(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId), {
        members: arrayUnion(fieldIntegrityInvitee),
        memberRoles: {
          [fieldIntegrityOwner]: 'viewer',
          [fieldIntegrityInvitee]: 'editor'
        },
        lastInviteTokenHash: tokenIntegrity35,
        updatedAt: serverTimestamp()
      });
      batch35.set(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId, 'members', fieldIntegrityInvitee), {
        id: fieldIntegrityInvitee,
        uid: fieldIntegrityInvitee,
        role: 'editor',
        inviteTokenHash: tokenIntegrity35,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch35.update(doc(inviteeIntegrityDb, 'invitations', tokenIntegrity35), {
        status: 'accepted',
        acceptedByUid: fieldIntegrityInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch35.commit());
      logPass('Scenario 35: Invitee attempting to modify existing member roles during acceptance DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 35 failed', e);
    }

    // 6. Invitee attempts to modify workspace type
    try {
      const batch36 = writeBatch(inviteeIntegrityDb);
      batch36.update(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId), {
        type: 'business',
        members: arrayUnion(fieldIntegrityInvitee),
        [`memberRoles.${fieldIntegrityInvitee}`]: 'editor',
        lastInviteTokenHash: tokenIntegrity36,
        updatedAt: serverTimestamp()
      });
      batch36.set(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId, 'members', fieldIntegrityInvitee), {
        id: fieldIntegrityInvitee,
        uid: fieldIntegrityInvitee,
        role: 'editor',
        inviteTokenHash: tokenIntegrity36,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch36.update(doc(inviteeIntegrityDb, 'invitations', tokenIntegrity36), {
        status: 'accepted',
        acceptedByUid: fieldIntegrityInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch36.commit());
      logPass('Scenario 36: Invitee attempting to modify workspace type during acceptance DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 36 failed', e);
    }

    // 7. Legitimate invitation acceptance with only authorized membership changes (without updatedAt)
    try {
      const batch37 = writeBatch(inviteeIntegrityDb);
      batch37.update(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId), {
        members: arrayUnion(fieldIntegrityInvitee),
        [`memberRoles.${fieldIntegrityInvitee}`]: 'editor',
        lastInviteTokenHash: tokenIntegrity37
      });
      batch37.set(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId, 'members', fieldIntegrityInvitee), {
        id: fieldIntegrityInvitee,
        uid: fieldIntegrityInvitee,
        role: 'editor',
        inviteTokenHash: tokenIntegrity37,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch37.update(doc(inviteeIntegrityDb, 'invitations', tokenIntegrity37), {
        status: 'accepted',
        acceptedByUid: fieldIntegrityInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertSucceeds(batch37.commit());
      logPass('Scenario 37: Legitimate acceptance with only authorized membership changes SUCCEEDS');
    } catch (e) {
      logFail('Scenario 37 failed', e);
    }

    // 8. Legitimate acceptance with authorized membership changes and updatedAt metadata
    try {
      const batch38 = writeBatch(inviteeIntegrityDb);
      batch38.update(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId2), {
        members: arrayUnion(fieldIntegrityInvitee),
        [`memberRoles.${fieldIntegrityInvitee}`]: 'editor',
        lastInviteTokenHash: tokenIntegrity38,
        updatedAt: serverTimestamp()
      });
      batch38.set(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId2, 'members', fieldIntegrityInvitee), {
        id: fieldIntegrityInvitee,
        uid: fieldIntegrityInvitee,
        role: 'editor',
        inviteTokenHash: tokenIntegrity38,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch38.update(doc(inviteeIntegrityDb, 'invitations', tokenIntegrity38), {
        status: 'accepted',
        acceptedByUid: fieldIntegrityInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertSucceeds(batch38.commit());
      logPass('Scenario 38: Legitimate acceptance with authorized membership changes and updatedAt SUCCEEDS');
    } catch (e) {
      logFail('Scenario 38 failed', e);
    }

    // 9. Invitee attempts self-join with arbitrary client-supplied timestamp
    try {
      const batch39 = writeBatch(inviteeIntegrityDb);
      batch39.update(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId3), {
        members: arrayUnion(fieldIntegrityInvitee),
        [`memberRoles.${fieldIntegrityInvitee}`]: 'editor',
        lastInviteTokenHash: tokenIntegrity39,
        updatedAt: Timestamp.fromMillis(Date.now() - 3600000) // Client-supplied arbitrary timestamp!
      });
      batch39.set(doc(inviteeIntegrityDb, 'workspaces', wsFieldIntegrityId3, 'members', fieldIntegrityInvitee), {
        id: fieldIntegrityInvitee,
        uid: fieldIntegrityInvitee,
        role: 'editor',
        inviteTokenHash: tokenIntegrity39,
        status: 'active',
        serverCreatedAt: serverTimestamp()
      });
      batch39.update(doc(inviteeIntegrityDb, 'invitations', tokenIntegrity39), {
        status: 'accepted',
        acceptedByUid: fieldIntegrityInvitee,
        acceptedAt: serverTimestamp()
      });
      await assertFails(batch39.commit());
      logPass('Scenario 39: Invitee attempting self-join with arbitrary client-supplied updatedAt timestamp DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 39 failed', e);
    }

    // ------------------------------------------------------------------------
    // SECTION I: WORKSPACE INVITATION SUBCOLLECTION & ROOT LOOKUP AUDIT
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION I: Workspace Invitation Subcollection & Root Lookup Audit ---');

    const wsSubinvId = 'ws-subinv-audit';
    const subinvOwner = 'owner-subinv-100';
    const subinvAdmin = 'admin-subinv-200';
    const subinvEditor = 'editor-subinv-300';
    const subinvStranger = 'stranger-subinv-900';
    const subinvDocId = 'inv-subdoc-123';
    const subinvRootHash = 'token-hash-subinv-audit-11112222333344445555666677778888';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'workspaces', wsSubinvId), {
        id: wsSubinvId,
        name: 'Subinv Audit Workspace',
        type: 'family',
        ownerUid: subinvOwner,
        members: [subinvOwner, subinvAdmin, subinvEditor],
        memberRoles: {
          [subinvOwner]: 'owner',
          [subinvAdmin]: 'admin',
          [subinvEditor]: 'editor'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Subcollection invitation
      await setDoc(doc(adminDb, 'workspaces', wsSubinvId, 'invitations', subinvDocId), {
        workspaceId: wsSubinvId,
        tokenHash: subinvRootHash,
        invitedEmail: 'test.subinv@example.com',
        role: 'editor',
        status: 'pending',
        createdByUid: subinvOwner,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });

      // Root invitation lookup
      await setDoc(doc(adminDb, 'invitations', subinvRootHash), {
        workspaceId: wsSubinvId,
        tokenHash: subinvRootHash,
        invitedEmail: 'test.subinv@example.com',
        role: 'editor',
        status: 'pending',
        createdByUid: subinvOwner,
        createdAt: new Date().toISOString(),
        expiresAt: futureTime
      });
    });

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const strangerDb = testEnv.authenticatedContext(subinvStranger).firestore();
    const editorDb = testEnv.authenticatedContext(subinvEditor).firestore();
    const ownerSubDb = testEnv.authenticatedContext(subinvOwner).firestore();
    const adminSubDb = testEnv.authenticatedContext(subinvAdmin).firestore();

    // Scenario 40: Unauthenticated user reading workspace invitation subcollection
    try {
      await assertFails(getDoc(doc(unauthDb, 'workspaces', wsSubinvId, 'invitations', subinvDocId)));
      logPass('Scenario 40: Unauthenticated user reading workspace invitation subcollection DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 40 failed', e);
    }

    // Scenario 41: Authenticated non-member reading workspace invitation subcollection
    try {
      await assertFails(getDoc(doc(strangerDb, 'workspaces', wsSubinvId, 'invitations', subinvDocId)));
      logPass('Scenario 41: Authenticated non-member reading workspace invitation subcollection DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 41 failed', e);
    }

    // Scenario 42: Ordinary workspace member (Editor) reading or listing workspace invitation subcollection
    try {
      await assertFails(getDoc(doc(editorDb, 'workspaces', wsSubinvId, 'invitations', subinvDocId)));
      await assertFails(getDocs(collection(editorDb, 'workspaces', wsSubinvId, 'invitations')));
      logPass('Scenario 42: Ordinary workspace member (Editor) reading or listing workspace invitation subcollection DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 42 failed', e);
    }

    // Scenario 43: Authorized workspace Manager (Owner) reading and listing workspace invitations subcollection
    try {
      await assertSucceeds(getDoc(doc(ownerSubDb, 'workspaces', wsSubinvId, 'invitations', subinvDocId)));
      await assertSucceeds(getDocs(collection(ownerSubDb, 'workspaces', wsSubinvId, 'invitations')));
      logPass('Scenario 43: Authorized workspace Owner reading and listing workspace invitations subcollection SUCCEEDS');
    } catch (e) {
      logFail('Scenario 43 failed', e);
    }

    // Scenario 44: Authorized workspace Manager (Admin) reading and listing workspace invitations subcollection
    try {
      await assertSucceeds(getDoc(doc(adminSubDb, 'workspaces', wsSubinvId, 'invitations', subinvDocId)));
      await assertSucceeds(getDocs(collection(adminSubDb, 'workspaces', wsSubinvId, 'invitations')));
      logPass('Scenario 44: Authorized workspace Admin reading and listing workspace invitations subcollection SUCCEEDS');
    } catch (e) {
      logFail('Scenario 44 failed', e);
    }

    // Scenario 45: Root token-based invitation lookup by hash (single document get)
    try {
      await assertSucceeds(getDoc(doc(unauthDb, 'invitations', subinvRootHash)));
      await assertSucceeds(getDoc(doc(strangerDb, 'invitations', subinvRootHash)));
      logPass('Scenario 45: Root token-based invitation lookup by hash SUCCEEDS publicly for single-document get');
    } catch (e) {
      logFail('Scenario 45 failed', e);
    }

    // Scenario 46: Root invitations collection listing (enumeration protection)
    try {
      await assertFails(getDocs(collection(unauthDb, 'invitations')));
      await assertFails(getDocs(collection(strangerDb, 'invitations')));
      logPass('Scenario 46: Root invitations collection listing DENIED by Firestore Rules');
    } catch (e) {
      logFail('Scenario 46 failed', e);
    }

  } finally {
    console.log('\nCleaning up emulator environment...');
    await testEnv.cleanup();
    console.log('Cleanup complete.\n');
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('======================================================');
  console.log(`TOTAL EMULATOR ASSERTIONS EXECUTED: ${totalAssertions}`);
  console.log(`PASSED: ${passedAssertions}`);
  console.log(`FAILED: ${failedAssertions}`);
  console.log('======================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  } else {
    console.log('All Genuine Firestore Emulator Tests Passed Successfully!\n');
    process.exit(0);
  }
}

runEmulatorTestSuite().catch(err => {
  console.error('\nFatal test runner error:', err);
  process.exit(1);
});

