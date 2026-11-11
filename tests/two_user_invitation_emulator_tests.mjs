// tests/two_user_invitation_emulator_tests.mjs
// Phase 4B Two-User Live Firestore Emulator Test Suite
// Simulates Account A (Owner) & Account B (Invitee) against actual firestore.rules

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  getDocs,
  query,
  where,
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

let total = 0;
let passed = 0;
let failed = 0;

function sha256Hex(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function pass(label) {
  total++;
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label, err) {
  total++;
  failed++;
  console.error(`  ✗ FAIL: ${label}`);
  if (err) console.error('   ', err.message || err);
}

async function runTwoUserSuite() {
  console.log('\n================================================================');
  console.log('   NINAIVO — TWO-USER LIVE FIRESTORE EMULATOR INVITE TEST SUITE  ');
  console.log('================================================================\n');

  const rules = fs.readFileSync(RULES_PATH, 'utf8');
  const emuHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [host, portStr] = emuHost.split(':');
  const port = parseInt(portStr || '8080', 10);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port, rules }
  });

  try {
    const uidA = 'account-a-owner-001';
    const uidB = 'account-b-invitee-002';
    const uidC = 'account-c-intruder-003';

    const ctxA = testEnv.authenticatedContext(uidA, { email: 'owner.a@ninaivo.test' });
    const ctxB = testEnv.authenticatedContext(uidB, { email: 'invitee.b@ninaivo.test' });
    const ctxC = testEnv.authenticatedContext(uidC, { email: 'stranger.c@ninaivo.test' });

    const dbA = ctxA.firestore();
    const dbB = ctxB.firestore();
    const dbC = ctxC.firestore();

    const familyWsId = 'ws-family-two-user-01';
    const personalWsA = `ws-personal-${uidA}`;
    const personalWsB = `ws-personal-${uidB}`;

    // 1. Account A creates Family workspace, existing Family entry, and Personal workspace/entry
    await assertSucceeds(setDoc(doc(dbA, 'workspaces', familyWsId), {
      id: familyWsId,
      name: 'Account A Family & Farm',
      type: 'family',
      ownerUid: uidA,
      members: [uidA],
      memberRoles: { [uidA]: 'owner' },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(dbA, 'workspaces', familyWsId, 'members', uidA), {
      id: uidA,
      uid: uidA,
      displayName: 'Account A Owner',
      email: 'owner.a@ninaivo.test',
      role: 'owner',
      status: 'active',
      joinedAt: new Date().toISOString()
    }));
    await assertSucceeds(setDoc(doc(dbA, 'workspaces', familyWsId, 'entries', 'entry-a-1'), {
      id: 'entry-a-1',
      workspaceId: familyWsId,
      createdByUid: uidA,
      authorName: 'Account A Owner',
      title: 'Existing Family Harvest Log',
      description: 'Shared family harvest data already in workspace.',
      entryType: 'Agriculture',
      date: '2026-11-10',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(dbA, 'workspaces', personalWsA), {
      id: personalWsA,
      name: 'Account A Private Diary',
      type: 'personal',
      ownerUid: uidA,
      members: [uidA]
    }));
    await assertSucceeds(setDoc(doc(dbA, 'workspaces', personalWsA, 'entries', 'entry-priv-a'), {
      id: 'entry-priv-a',
      workspaceId: personalWsA,
      createdByUid: uidA,
      title: 'A Secret Personal Reflection'
    }));

    // Account B creates its own Personal workspace & entry
    await assertSucceeds(setDoc(doc(dbB, 'workspaces', personalWsB), {
      id: personalWsB,
      name: 'Account B Private Diary',
      type: 'personal',
      ownerUid: uidB,
      members: [uidB]
    }));
    await assertSucceeds(setDoc(doc(dbB, 'workspaces', personalWsB, 'entries', 'entry-priv-b'), {
      id: 'entry-priv-b',
      workspaceId: personalWsB,
      createdByUid: uidB,
      title: 'B Secret Personal Reflection'
    }));
    pass('Account A & Account B setup workspaces and initial entries cleanly');

    // 2. Account A creates Shareable Editor Invitation with Never expiry
    const rawToken = 'neverexpiringeditortoken' + crypto.randomBytes(12).toString('hex');
    const tokenHash = sha256Hex(rawToken);
    const invId = 'inv-never-01';
    const invDoc = {
      id: invId,
      workspaceId: familyWsId,
      workspaceName: 'Account A Family & Farm',
      workspaceType: 'family',
      tokenHash,
      rawToken: null,
      invitedEmail: null,
      role: 'editor',
      relationship: 'family',
      expiresAt: null,
      status: 'pending',
      createdByUid: uidA,
      createdByName: 'Account A Owner',
      createdAt: new Date().toISOString(),
      serverCreatedAt: serverTimestamp()
    };

    await assertSucceeds(setDoc(doc(dbA, 'workspaces', familyWsId, 'invitations', invId), invDoc));
    await assertSucceeds(setDoc(doc(dbA, 'invitations', tokenHash), invDoc));
    pass('Account A creates shareable Editor invitation with Never expiry');

    // 3. Account B resolves root /invitations/{tokenHash} and executes atomic acceptance batch
    const resolvedSnap = await assertSucceeds(getDoc(doc(dbB, 'invitations', tokenHash)));
    if (!resolvedSnap.exists() || resolvedSnap.data().role !== 'editor') {
      throw new Error('Failed to resolve Never-expiring invitation doc');
    }

    const acceptBatch = writeBatch(dbB);
    acceptBatch.update(doc(dbB, 'workspaces', familyWsId), {
      members: arrayUnion(uidB),
      [`memberRoles.${uidB}`]: 'editor',
      lastInviteTokenHash: tokenHash,
      updatedAt: serverTimestamp()
    });
    acceptBatch.set(doc(dbB, 'workspaces', familyWsId, 'members', uidB), {
      id: uidB,
      uid: uidB,
      displayName: 'Account B Member',
      email: 'invitee.b@ninaivo.test',
      role: 'editor',
      relationship: 'family',
      inviteTokenHash: tokenHash,
      status: 'active',
      joinedAt: new Date().toISOString(),
      serverCreatedAt: serverTimestamp()
    });
    acceptBatch.update(doc(dbB, 'invitations', tokenHash), {
      status: 'accepted',
      acceptedByUid: uidB,
      acceptedAt: serverTimestamp()
    });
    await assertSucceeds(acceptBatch.commit());
    await assertSucceeds(setDoc(doc(dbB, 'users', uidB), {
      uid: uidB,
      joinedWorkspaceIds: arrayUnion(familyWsId),
      updatedAt: serverTimestamp()
    }, { merge: true }));
    pass('Account B accepts Shareable Never-expiring Editor invitation atomically');

    // 4. Verify Account B becomes Editor in Account A's workspace & member list
    const wsAfter = await assertSucceeds(getDoc(doc(dbB, 'workspaces', familyWsId)));
    const memB = await assertSucceeds(getDoc(doc(dbB, 'workspaces', familyWsId, 'members', uidB)));
    if (
      wsAfter.data().members.includes(uidB) &&
      wsAfter.data().memberRoles[uidB] === 'editor' &&
      memB.data().role === 'editor'
    ) {
      pass('Account B is confirmed Editor in Account A Family workspace');
    } else {
      fail('Account B role/membership verification mismatch');
    }

    // Verify Account B discovers joined Family workspace via qMember + user joinedWorkspaceIds
    const qMemB = query(
      collection(dbB, 'workspaces'),
      where('members', 'array-contains', uidB),
      where('type', 'in', ['family', 'business'])
    );
    const qMemSnap = await assertSucceeds(getDocs(qMemB));
    const uDocB = await assertSucceeds(getDoc(doc(dbB, 'users', uidB)));
    if (
      qMemSnap.docs.some((d) => d.id === familyWsId) &&
      Array.isArray(uDocB.data().joinedWorkspaceIds) &&
      uDocB.data().joinedWorkspaceIds.includes(familyWsId)
    ) {
      pass('Account B discovers joined workspace via both query and user joinedWorkspaceIds fallback');
    } else {
      fail('Workspace discovery failed for Account B');
    }

    // 5. Account B reads existing Family entries
    const entriesForB = await assertSucceeds(getDocs(collection(dbB, 'workspaces', familyWsId, 'entries')));
    if (entriesForB.docs.some((d) => d.id === 'entry-a-1' && d.data().title === 'Existing Family Harvest Log')) {
      pass('Account B reads existing shared Family workspace entries');
    } else {
      fail('Account B could not read existing Family entry');
    }

    // 6. Account B creates a new Family workspace entry
    await assertSucceeds(setDoc(doc(dbB, 'workspaces', familyWsId, 'entries', 'entry-b-2'), {
      id: 'entry-b-2',
      workspaceId: familyWsId,
      createdByUid: uidB,
      authorName: 'Account B Member',
      title: 'Account B Evening Dairy Update',
      description: 'Created by Editor Account B.',
      entryType: 'Family',
      date: '2026-11-11',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    pass('Account B creates new entry in shared Family workspace');

    // 7. Account A reads Account B's new entry
    const entryBSeenByA = await assertSucceeds(getDoc(doc(dbA, 'workspaces', familyWsId, 'entries', 'entry-b-2')));
    if (entryBSeenByA.exists() && entryBSeenByA.data().title === 'Account B Evening Dairy Update') {
      pass('Account A reads Account B newly created Family workspace entry');
    } else {
      fail('Account A could not read Account B entry');
    }

    // 8. Personal Workspace Strict Isolation (A <-> B)
    await assertFails(getDoc(doc(dbA, 'workspaces', personalWsB)));
    await assertFails(getDocs(collection(dbA, 'workspaces', personalWsB, 'entries')));
    await assertFails(getDoc(doc(dbB, 'workspaces', personalWsA)));
    await assertFails(getDocs(collection(dbB, 'workspaces', personalWsA, 'entries')));
    pass('Personal workspaces remain strictly private between Account A and Account B');

    // 9. Negative Security Cases — All Must Be DENIED by Firestore Rules
    // 9a. Replay already consumed invitation
    const replayBatch = writeBatch(dbC);
    replayBatch.update(doc(dbC, 'workspaces', familyWsId), {
      members: arrayUnion(uidC),
      [`memberRoles.${uidC}`]: 'editor',
      lastInviteTokenHash: tokenHash,
      updatedAt: serverTimestamp()
    });
    replayBatch.set(doc(dbC, 'workspaces', familyWsId, 'members', uidC), {
      id: uidC, uid: uidC, role: 'editor', inviteTokenHash: tokenHash, joinedAt: new Date().toISOString()
    });
    replayBatch.update(doc(dbC, 'invitations', tokenHash), { status: 'accepted', acceptedByUid: uidC });
    await assertFails(replayBatch.commit());
    pass('Negative Security Case DENIED: Replay of consumed invitation blocked');

    // 9b. Revoked invitation
    const revHash = sha256Hex('revoked-token-' + Date.now());
    await assertSucceeds(setDoc(doc(dbA, 'invitations', revHash), {
      id: 'inv-rev', workspaceId: familyWsId, workspaceType: 'family', tokenHash: revHash,
      invitedEmail: null, role: 'editor', expiresAt: null, status: 'pending', createdByUid: uidA
    }));
    await assertSucceeds(updateDoc(doc(dbA, 'invitations', revHash), {
      status: 'revoked'
    }));
    const revBatch = writeBatch(dbC);
    revBatch.update(doc(dbC, 'workspaces', familyWsId), {
      members: arrayUnion(uidC), [`memberRoles.${uidC}`]: 'editor', lastInviteTokenHash: revHash, updatedAt: serverTimestamp()
    });
    revBatch.set(doc(dbC, 'workspaces', familyWsId, 'members', uidC), {
      id: uidC, uid: uidC, role: 'editor', inviteTokenHash: revHash
    });
    revBatch.update(doc(dbC, 'invitations', revHash), { status: 'accepted', acceptedByUid: uidC });
    await assertFails(revBatch.commit());
    pass('Negative Security Case DENIED: Revoked invitation blocked');

    // 9c. Expired invitation
    const expHash = sha256Hex('expired-token-' + Date.now());
    await assertSucceeds(setDoc(doc(dbA, 'invitations', expHash), {
      id: 'inv-exp', workspaceId: familyWsId, workspaceType: 'family', tokenHash: expHash,
      invitedEmail: null, role: 'editor', expiresAt: Timestamp.fromMillis(Date.now() - 60000), status: 'pending', createdByUid: uidA
    }));
    const expBatch = writeBatch(dbC);
    expBatch.update(doc(dbC, 'workspaces', familyWsId), {
      members: arrayUnion(uidC), [`memberRoles.${uidC}`]: 'editor', lastInviteTokenHash: expHash, updatedAt: serverTimestamp()
    });
    expBatch.set(doc(dbC, 'workspaces', familyWsId, 'members', uidC), {
      id: uidC, uid: uidC, role: 'editor', inviteTokenHash: expHash
    });
    expBatch.update(doc(dbC, 'invitations', expHash), { status: 'accepted', acceptedByUid: uidC });
    await assertFails(expBatch.commit());
    pass('Negative Security Case DENIED: Expired invitation blocked');

    // 9d. Mismatched invitedEmail
    const emailHash = sha256Hex('email-locked-' + Date.now());
    await assertSucceeds(setDoc(doc(dbA, 'invitations', emailHash), {
      id: 'inv-email', workspaceId: familyWsId, workspaceType: 'family', tokenHash: emailHash,
      invitedEmail: 'designated.only@ninaivo.test', role: 'editor', expiresAt: null, status: 'pending', createdByUid: uidA
    }));
    const wrongEmailBatch = writeBatch(dbC);
    wrongEmailBatch.update(doc(dbC, 'workspaces', familyWsId), {
      members: arrayUnion(uidC), [`memberRoles.${uidC}`]: 'editor', lastInviteTokenHash: emailHash, updatedAt: serverTimestamp()
    });
    wrongEmailBatch.set(doc(dbC, 'workspaces', familyWsId, 'members', uidC), {
      id: uidC, uid: uidC, role: 'editor', inviteTokenHash: emailHash
    });
    wrongEmailBatch.update(doc(dbC, 'invitations', emailHash), { status: 'accepted', acceptedByUid: uidC });
    await assertFails(wrongEmailBatch.commit());
    pass('Negative Security Case DENIED: Mismatched invitedEmail blocked');

    // 9e. Unauthorized self-join without invitation token
    await assertFails(updateDoc(doc(dbC, 'workspaces', familyWsId), {
      members: arrayUnion(uidC),
      [`memberRoles.${uidC}`]: 'editor'
    }));
    pass('Negative Security Case DENIED: Unauthorized self-join without token blocked');

    // 9f. Invalid / nonexistent token hash
    const bogusHash = sha256Hex('bogus-nonexistent-token');
    const bogusBatch = writeBatch(dbC);
    bogusBatch.update(doc(dbC, 'workspaces', familyWsId), {
      members: arrayUnion(uidC), [`memberRoles.${uidC}`]: 'editor', lastInviteTokenHash: bogusHash, updatedAt: serverTimestamp()
    });
    bogusBatch.set(doc(dbC, 'workspaces', familyWsId, 'members', uidC), {
      id: uidC, uid: uidC, role: 'editor', inviteTokenHash: bogusHash
    });
    await assertFails(bogusBatch.commit());
    pass('Negative Security Case DENIED: Invalid/nonexistent token blocked');

    // 9g. Role self-escalation attempt during join (editor invite trying to become admin)
    const escHash = sha256Hex('escalation-token-' + Date.now());
    await assertSucceeds(setDoc(doc(dbA, 'invitations', escHash), {
      id: 'inv-esc', workspaceId: familyWsId, workspaceType: 'family', tokenHash: escHash,
      invitedEmail: null, role: 'editor', expiresAt: null, status: 'pending', createdByUid: uidA
    }));
    const escBatch = writeBatch(dbC);
    escBatch.update(doc(dbC, 'workspaces', familyWsId), {
      members: arrayUnion(uidC), [`memberRoles.${uidC}`]: 'admin', lastInviteTokenHash: escHash, updatedAt: serverTimestamp()
    });
    escBatch.set(doc(dbC, 'workspaces', familyWsId, 'members', uidC), {
      id: uidC, uid: uidC, role: 'admin', inviteTokenHash: escHash
    });
    escBatch.update(doc(dbC, 'invitations', escHash), { status: 'accepted', acceptedByUid: uidC });
    await assertFails(escBatch.commit());
    pass('Negative Security Case DENIED: Role self-escalation (editor -> admin) blocked');

    // 10. Phase 2.5 Owner Member-Record Rules, Viewer Flow, Presence, Admin Demotion & Removal
    const uidD = 'account-d-viewer-004';
    const uidE = 'account-e-admin-005';
    const dbD = testEnv.authenticatedContext(uidD, { email: 'viewer.d@ninaivo.test' }).firestore();
    const dbE = testEnv.authenticatedContext(uidE, { email: 'admin.e@ninaivo.test' }).firestore();

    // 10a. Non-owner creates owner record -> DENIED; Owner creates owner record for another UID -> DENIED
    await assertFails(setDoc(doc(dbB, 'workspaces', familyWsId, 'members', uidB), {
      id: uidB, uid: uidB, role: 'owner'
    }));
    await assertFails(setDoc(doc(dbC, 'workspaces', familyWsId, 'members', uidC), {
      id: uidC, uid: uidC, role: 'owner'
    }));
    await assertFails(setDoc(doc(dbA, 'workspaces', familyWsId, 'members', uidC), {
      id: uidC, uid: uidC, role: 'owner'
    }));
    pass('Owner Member-Record Security DENIED: Non-owner & cross-UID owner creation blocked');

    // 10b. Valid Viewer invitation acceptance & Viewer read-only enforcement
    const viewerHash = sha256Hex('viewer-invite-' + Date.now());
    const viewerInv = {
      id: 'inv-viewer-01', workspaceId: familyWsId, workspaceName: 'Account A Family & Farm',
      workspaceType: 'family', tokenHash: viewerHash, rawToken: null, invitedEmail: null,
      role: 'viewer', relationship: 'family', expiresAt: null, status: 'pending', createdByUid: uidA
    };
    await assertSucceeds(setDoc(doc(dbA, 'invitations', viewerHash), viewerInv));
    const viewerBatch = writeBatch(dbD);
    viewerBatch.update(doc(dbD, 'workspaces', familyWsId), {
      members: arrayUnion(uidD), [`memberRoles.${uidD}`]: 'viewer', lastInviteTokenHash: viewerHash, updatedAt: serverTimestamp()
    });
    viewerBatch.set(doc(dbD, 'workspaces', familyWsId, 'members', uidD), {
      id: uidD, uid: uidD, role: 'viewer', inviteTokenHash: viewerHash, status: 'active'
    });
    viewerBatch.update(doc(dbD, 'invitations', viewerHash), { status: 'accepted', acceptedByUid: uidD });
    await assertSucceeds(viewerBatch.commit());
    await assertSucceeds(getDocs(collection(dbD, 'workspaces', familyWsId, 'entries')));
    await assertFails(setDoc(doc(dbD, 'workspaces', familyWsId, 'entries', 'entry-d-fail'), {
      id: 'entry-d-fail', workspaceId: familyWsId, createdByUid: uidD, title: 'Unauthorized Viewer Write'
    }));
    await assertFails(updateDoc(doc(dbD, 'workspaces', familyWsId, 'entries', 'entry-b-2'), { title: 'Tampered' }));
    await assertFails(deleteDoc(doc(dbD, 'workspaces', familyWsId, 'entries', 'entry-b-2')));
    pass('Viewer Role Security: Valid Viewer invite allowed; Viewer write/edit/delete DENIED');

    // 10c. Personal workspace self-join attempt -> DENIED
    const persJoinBatch = writeBatch(dbC);
    persJoinBatch.update(doc(dbC, 'workspaces', personalWsA), {
      members: arrayUnion(uidC), [`memberRoles.${uidC}`]: 'editor', lastInviteTokenHash: escHash, updatedAt: serverTimestamp()
    });
    persJoinBatch.set(doc(dbC, 'workspaces', personalWsA, 'members', uidC), {
      id: uidC, uid: uidC, role: 'editor', inviteTokenHash: escHash
    });
    await assertFails(persJoinBatch.commit());
    pass('Negative Security Case DENIED: Personal workspace self-join blocked');

    // 10d. Presence Security: Permitted self-presence allowed; cross-user & role/status mutation DENIED
    await assertSucceeds(updateDoc(doc(dbB, 'workspaces', familyWsId, 'members', uidB), {
      isOnline: true,
      lastSeen: new Date().toISOString(),
      lastSessionId: 'sess_1',
      'activeSessions.sess_1': Date.now(),
      'activeSessions.sess_2': Date.now()
    }));
    await assertSucceeds(updateDoc(doc(dbB, 'workspaces', familyWsId, 'members', uidB), {
      'activeSessions.sess_1': deleteField()
    }));
    await assertFails(updateDoc(doc(dbB, 'workspaces', familyWsId, 'members', uidA), { isOnline: false }));
    await assertFails(updateDoc(doc(dbB, 'workspaces', familyWsId, 'members', uidB), {
      isOnline: true, role: 'admin'
    }));
    await assertFails(updateDoc(doc(dbB, 'workspaces', familyWsId, 'members', uidB), {
      isOnline: true, status: 'suspended'
    }));
    pass('Presence Security: Self multi-session update allowed; cross-user/role/status mutation DENIED');

    // 10e. Unauthorized workspace modification -> DENIED
    await assertFails(updateDoc(doc(dbB, 'workspaces', familyWsId), { name: 'Hacked Family Name' }));
    await assertFails(updateDoc(doc(dbC, 'workspaces', familyWsId), { ownerUid: uidC }));
    pass('Negative Security Case DENIED: Unauthorized workspace modification by Editor/Stranger blocked');

    // 10f. Demoted admin's pending invitation becomes invalid
    const admInviteHash = sha256Hex('demoted-admin-invite-' + Date.now());
    await assertSucceeds(updateDoc(doc(dbA, 'workspaces', familyWsId), {
      members: arrayUnion(uidE), [`memberRoles.${uidE}`]: 'admin'
    }));
    await assertSucceeds(setDoc(doc(dbA, 'workspaces', familyWsId, 'members', uidE), {
      id: uidE, uid: uidE, role: 'admin', status: 'active'
    }));
    await assertSucceeds(setDoc(doc(dbE, 'invitations', admInviteHash), {
      id: 'inv-adm-1', workspaceId: familyWsId, workspaceType: 'family', tokenHash: admInviteHash,
      invitedEmail: null, role: 'editor', expiresAt: null, status: 'pending', createdByUid: uidE
    }));
    // Owner demotes uidE -> editor
    await assertSucceeds(updateDoc(doc(dbA, 'workspaces', familyWsId), { [`memberRoles.${uidE}`]: 'editor' }));
    const demBatch = writeBatch(dbC);
    demBatch.update(doc(dbC, 'workspaces', familyWsId), {
      members: arrayUnion(uidC), [`memberRoles.${uidC}`]: 'editor', lastInviteTokenHash: admInviteHash, updatedAt: serverTimestamp()
    });
    demBatch.set(doc(dbC, 'workspaces', familyWsId, 'members', uidC), {
      id: uidC, uid: uidC, role: 'editor', inviteTokenHash: admInviteHash
    });
    demBatch.update(doc(dbC, 'invitations', admInviteHash), { status: 'accepted', acceptedByUid: uidC });
    await assertFails(demBatch.commit());
    pass('Negative Security Case DENIED: Invitation from demoted Admin blocked');

    // 10g. Removed member loses access immediately
    await assertSucceeds(deleteDoc(doc(dbA, 'workspaces', familyWsId, 'members', uidD)));
    await assertSucceeds(updateDoc(doc(dbA, 'workspaces', familyWsId), {
      members: [uidA, uidB, uidE],
      [`memberRoles.${uidD}`]: deleteField()
    }));
    await assertFails(getDoc(doc(dbD, 'workspaces', familyWsId)));
    await assertFails(getDocs(collection(dbD, 'workspaces', familyWsId, 'entries')));
    pass('Member Removal Security: Removed member immediately loses workspace and entries read access');
  } finally {
    await testEnv.cleanup();
  }

  console.log('\n================================================================');
  console.log(`TOTAL TWO-USER EMULATOR ASSERTIONS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTwoUserSuite().catch((err) => {
  console.error('Fatal Two-User Emulator Test Error:', err);
  process.exit(1);
});
