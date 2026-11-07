# Ninaivo — Production Data Persistence Root Cause Analysis

**Project:** Ninaivo (நினைவு)  
**Production Platform:** Render (`https://ninaivo.onrender.com`)  
**Backend:** Firebase Authentication & Cloud Firestore (`diary-tracker-c888d`)  
**Report Date:** November 8, 2026  
**Status:** Root Causes Fully Identified & Documented  

---

## Executive Summary

Real registered users experienced severe data and configuration loss when using Ninaivo:
1. Users logged in and modified diary entries, settings, or workspace metadata.
2. Upon closing and reopening the application or refreshing the browser, recently made changes disappeared, previous entries were overwritten or went missing, or the UI reverted to hardcoded defaults (such as 45 total entries, 28 photos, or default settings).

An exhaustive investigation of the client-side services, Firebase SDK configuration, local caching layers, context lifecycle, and Firestore synchronization rules revealed **seven distinct architectural root causes**. The issue was neither a transient network glitch nor a simple UI rendering bug; it was an architectural flaw combining **cache shadowing**, **auth initialization race conditions**, **silent demo fallbacks**, and **one-way local storage partitioning**.

---

## Failure Mode Architecture & Diagnostic Diagram

```
[ User Action / Preferences Update ]
                │
                ▼
      ┌──────────────────┐
      │  Local Cache     │ ◄── Written synchronously to localStorage
      └────────┬─────────┘
               │
               ▼
   [ App Reload / Browser Reopen ]
               │
               ├─────────────────────────────────────────┐
               ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │ Auth Initialization   │                 │ WorkspaceContext Init │
   └───────────┬───────────┘                 └───────────┬───────────┘
               │                                         │
               │ (Takes ~300-800ms)                      │ (Evaluates synchronously)
               │                                         ▼
               │                            currentUser is NULL !
               │                            Fallback to 'demo-user-42' !
               │                                         │
               ▼                                         ▼
   auth.currentUser resolved                 Loads demo-user-42 workspaces
               │                             Overwrites active workspace!
               ▼                                         │
   ┌───────────────────────┐                             ▼
   │ Data Fetch Services   │                 ┌───────────────────────┐
   └───────────┬───────────┘                 │ Cache Shadowing Bug   │
               │                             └───────────┬───────────┘
               │ (Check: if cached !== null)             │
               │ Cached data exists in localStorage!     │
               ▼                                         ▼
   NEVER Queries Cloud Firestore!             Stale / Demo data rendered
   Cloud changes completely shadowed!         Zero entries re-seeded with fake entries!
```

---

## Detailed Breakdown of the 7 Root Causes

### Root Cause 1: Cache Shadowing in Data Services
* **Responsible Files:**
  - `src/services/entryService.js`
  - `src/services/categoryService.js`
  - `src/services/memberService.js`
  - `src/services/activityService.js`
  - `src/services/notificationService.js`
  - `src/services/invitationService.js`
* **Mechanism:**
  In each of these services, the fetch function inspected `localStorage` first:
  ```javascript
  // Defective Pattern
  export async function getWorkspaceEntries(workspaceId) {
    const cached = localStorage.getItem(`pdt_entries_${workspaceId}`);
    if (cached !== null) {
      return JSON.parse(cached); // HALTS HERE — Firestore is never queried!
    }
    // Only fetches from Firestore if cached === null
    ...
  }
  ```
  Once an entry, category list, or member roster was saved to `localStorage`, the condition `cached !== null` remained true forever.
* **Failure Consequence:**
  - If a user added or edited an entry on their mobile phone, and then opened Ninaivo on their laptop (or re-logged in after local cache was invalidated or cleared), or if an invited workspace collaborator added notes, the Firestore updates were completely ignored.
  - When the app restarted, any out-of-band Firestore updates were never retrieved.

---

### Root Cause 2: Auto-Seeding Fake Demo Entries on Empty Workspace
* **Responsible File:** `src/services/entryService.js`
* **Mechanism:**
  `entryService.js` included the legacy fallback function `getSampleEntriesForWorkspace(workspaceId, type)`. When querying entries:
  ```javascript
  // Defective Pattern
  const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (entries.length === 0) {
    const seeded = getSampleEntriesForWorkspace(workspaceId, 'personal');
    // Wrote fake "Paddy Field Sowing" and "Commercial Wholesale Grain" to Firestore!
    return seeded;
  }
  ```
* **Failure Consequence:**
  - When a real user registered, their personal workspace had 0 entries. The application immediately generated fake mock entries and wrote them to Firestore.
  - If a user deleted all entries in their workspace, the moment they reloaded the page, `entries.length === 0` triggered again, resurrecting fake sample data.

---

### Root Cause 3: Auth Initialization Race Condition & 'demo-user-42' Fallback
* **Responsible Files:**
  - `src/context/WorkspaceContext.jsx`
  - `src/context/AuthContext.jsx`
  - `src/App.jsx`
* **Mechanism:**
  Firebase Auth takes between 250ms and 900ms upon app load to read IndexedDB and restore the authenticated user token.
  However, `WorkspaceContext.jsx` initialized its `useEffect` immediately on mount without waiting for `authLoading`:
  ```javascript
  // Defective Pattern
  const activeUserId = currentUser?.uid || 'demo-user-42';
  loadWorkspaces(activeUserId);
  ```
* **Failure Consequence:**
  - For the first 300ms of application startup, `currentUser` was `null`.
  - `WorkspaceContext` immediately triggered `loadWorkspaces('demo-user-42')`, loading legacy mock workspaces from local storage.
  - When Firebase Auth finally emitted `onAuthStateChanged`, the workspace context was in an inconsistent half-initialized state or displaying the wrong workspace ID, causing entries for the real user to fail to display.

---

### Root Cause 4: Disconnected Preferences (Theme & Language Stored Only Locally)
* **Responsible Files:**
  - `src/App.jsx`
  - `src/context/LanguageContext.jsx`
  - `src/firebase/userService.js`
* **Mechanism:**
  Theme and language selections were treated as purely ephemeral browser client state stored only in `localStorage.getItem('ninaivo_theme')` and `localStorage.getItem('pdt_language')`.
  There was no synchronization mechanism to persist user preferences to the user's Firestore profile (`users/{uid}/preferences`).
* **Failure Consequence:**
  - Whenever a user logged in on a second device, cleared browser cookies/storage, or used an incognito window, all personalized settings (such as Tamil language choice or Dark theme) immediately reset to default English and Light mode.
  - Mobile PWA webviews frequently purge local storage when device storage pressure occurs, wiping out user preferences on reopen.

---

### Root Cause 5: Firestore Document Overwrite Failure on `updateDoc`
* **Responsible File:** `src/firebase/userService.js`
* **Mechanism:**
  The profile update function utilized Firestore's `updateDoc(userRef, updates)`.
  In Cloud Firestore, `updateDoc` strictly requires that the target document already exists in the database. If a user registered via certain auth providers or if document creation suffered a transient network hiccup, `updateDoc` threw:
  `FirebaseError: No document to update: projects/.../databases/(default)/documents/users/{uid}`.
* **Failure Consequence:**
  - The function caught the error, silently logged a warning, and stored the updates only in `localStorage`.
  - The user's profile and preferences were never created or updated in Cloud Firestore.

---

### Root Cause 6: Shared Workspace Exclusion in Workspace Queries
* **Responsible File:** `src/services/workspaceService.js`
* **Mechanism:**
  `getWorkspacesForUser(userId)` only executed:
  `query(collection(db, 'workspaces'), where('ownerUid', '==', userId))`
* **Failure Consequence:**
  - If a user was invited as an Editor, Admin, or Viewer to a Family or Business workspace, they were listed in the workspace's `members` array, but were not the `ownerUid`.
  - When reopening the app, the shared workspace failed to load from Firestore, disappearing from their workspace switcher and leaving only their personal workspace visible.

---

### Root Cause 7: Hardcoded Fallback Metrics and Fake Recent Entries in HomeView
* **Responsible File:** `src/views/HomeView.jsx`
* **Mechanism:**
  `HomeView.jsx` contained hardcoded fallback values intended for early design prototypes:
  ```javascript
  // Defective Pattern
  const totalEntries = entries?.length || 45;
  const totalPhotos = photosCount || 28;
  const recentEntryTitle = title || entry.title || 'Field irrigation completed';
  ```
* **Failure Consequence:**
  - Even when a user had 0 entries or had deleted their records, the dashboard displayed "45 Entries" and "28 Photos".
  - If an entry lacked an explicit title, it rendered "Field irrigation completed", confusing users who had never created agriculture entries.

---

## Summary Matrix of Root Causes & Corrective Actions

| ID | Component | Defect Mechanism | Live Production Consequence | Resolution Strategy |
|---|---|---|---|---|
| **RC-1** | `entryService.js` & related services | Cache check halts Firestore read (`cached !== null`) | Stale data; cloud edits never pulled | Network-first architecture; query Firestore whenever online |
| **RC-2** | `entryService.js` | Auto-seed sample entries when `entries.length === 0` | Fake entries inserted into user accounts | Remove sample entry generator; render authentic empty states |
| **RC-3** | `WorkspaceContext.jsx` | Evaluates before auth finishes; falls back to `demo-user-42` | Session race condition; loads mock data | Await `authLoading === false`; require real `currentUser.uid` |
| **RC-4** | `App.jsx` & `LanguageContext.jsx` | Preferences only saved in browser `localStorage` | Preferences reset on reload or new device | Sync preferences directly to `users/{uid}/preferences` in Firestore |
| **RC-5** | `userService.js` | Uses `updateDoc` which fails if doc does not exist | Profile updates silently fail on cloud | Use `setDoc(userRef, data, { merge: true })` |
| **RC-6** | `workspaceService.js` | Queries only `ownerUid == uid`, ignores `members` | Shared workspaces vanish on reload | Query both owned workspaces and member workspaces |
| **RC-7** | `HomeView.jsx` | Hardcoded fallbacks (45 entries, 28 photos, mock title) | Misleading metrics shown to real users | Render authentic calculated numbers and localized clean empty states |

