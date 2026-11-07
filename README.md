# Ninaivo (நினைவு)

> **Your Life. Your Memories. Your Story.**  
> A modern, responsive, privacy-focused **Multi-Workspace Diary & Productivity System** built with React 18, Vite 5, Firebase Firestore, Web Speech API, and Cloudinary. Designed for personal reflections, family & agricultural activities, and business record-keeping with 100% bilingual support in **English** and **தமிழ் (Tamil)**.

---

## Table of Contents

1. [Project Title and Overview](#1-project-title-and-overview)
2. [Project Purpose](#2-project-purpose)
3. [Key Features](#3-key-features)
4. [Technology Stack](#4-technology-stack)
5. [Application Architecture](#5-application-architecture)
6. [Project Folder Structure](#6-project-folder-structure)
7. [Authentication and User Profiles](#7-authentication-and-user-profiles)
8. [Personal, Family and Business Workspaces](#8-personal-family-and-business-workspaces)
9. [Member Management and Role Permissions](#9-member-management-and-role-permissions)
10. [Diary Entry Management](#10-diary-entry-management)
11. [Tamil and English Language Support](#11-tamil-and-english-language-support)
12. [Translation and Text-to-Speech](#12-translation-and-text-to-speech)
13. [Voice Recording and Speech Transcription](#13-voice-recording-and-speech-transcription)
14. [Cloudinary Image and Audio Attachments](#14-cloudinary-image-and-audio-attachments)
15. [Dashboard and Analytics](#15-dashboard-and-analytics)
16. [Calendar and Diary History](#16-calendar-and-diary-history)
17. [Search, Filtering and Gallery](#17-search-filtering-and-gallery)
18. [Backup, Restore and CSV Export](#18-backup-restore-and-csv-export)
19. [Offline Support and PWA](#19-offline-support-and-pwa)
20. [Nature Fresh and Forest Night Themes](#20-nature-fresh-and-forest-night-themes)
21. [Firebase Configuration](#21-firebase-configuration)
22. [Cloudinary Configuration](#22-cloudinary-configuration)
23. [Environment Variables Setup](#23-environment-variables-setup)
24. [Installation Instructions](#24-installation-instructions)
25. [Development Commands](#25-development-commands)
26. [Production Build Instructions](#26-production-build-instructions)
27. [Testing Instructions](#27-testing-instructions)
28. [Deployment Instructions](#28-deployment-instructions)
29. [Security and Privacy Considerations](#29-security-and-privacy-considerations)
30. [Browser Compatibility](#30-browser-compatibility)
31. [Current Limitations](#31-current-limitations)
32. [Future Improvements](#32-future-improvements)

---

## 1. Project Title and Overview

**Ninaivo** (நினைவு — *Your Life. Your Memories. Your Story.*) is a progressive, mobile-first web application engineered to solve real-world daily tracking challenges for individuals, households, and growing commercial ventures. Featuring zero bloated component frameworks, it uses modern Vanilla CSS with scoped design tokens (`compact-ui.css`), delivering a clean, app-like experience with bottom navigation, responsive modals, instant bilingual toggling, offline persistence, and voice accessibility.

---

## 2. Project Purpose

Traditional diary tools are either rigid personal note apps or complex business project managers. Ninaivo bridges this divide:
- **Personal Life:** Secure, private reflections with full client-side privacy.
- **Family & Agriculture:** Collaborative household activities, crop schedules, harvest quantities, livestock events, and shared farm expenses.
- **Commercial Ventures:** Business daily updates, transactions, financial ledger tracking, and multi-member audit logging.
- **Language Inclusivity:** Native Tamil and Indian English language options ensure accessibility for multi-generational families and rural agricultural operations.

---

## 3. Key Features

- **Multi-Workspace Compartmentalization:** Seamlessly switch between Personal, Family, and Business workspaces with complete data isolation.
- **Role-Based Collaboration:** Granular 4-tier roles (`Owner`, `Admin`, `Editor`, `Viewer`) with cryptographic invite links and join approvals.
- **Bilingual Key Parity (568 Keys):** 100% dictionary parity between English and Tamil across every dialog, badge, and navigation element.
- **Multilingual Text-to-Speech (TTS):** On-device Web Speech API reads entries aloud in the viewing member's preferred language with automated pre-speech translation.
- **Voice Diary & Transcription:** Record voice memos via `MediaRecorder` with real-time waveform visualization and Web Speech API transcription.
- **Cloudinary Media Storage:** Direct unsigned uploads for multi-photo attachments and audio memos with automatic local fallback.
- **Interactive Calendar & Diary History:** Month-grid visualization with entry density counters, day detail drilldowns, and date filters.
- **Financial Analytics & Reports:** Income vs. expense ledger charts, monthly spending breakdowns, and category-level budgeting graphs.
- **Encrypted Backup & CSV Export:** Client-side AES encrypted JSON backups with password protection and UTF-8 CSV exports.
- **PWA & Offline Synchronization:** Multi-tab IndexedDB cache, background mutation queues, and 3-way conflict resolution.
- **Dual Visual Themes:** Pixel-accurate Nature Fresh (light sage) and Forest Night (dark emerald) palettes.

---

## 4. Technology Stack

- **Runtime & Framework:** React 18.3.1 (Strict Mode), React DOM 18.3.1
- **Bundler & Tooling:** Vite 5.4.11 / 5.4.21, `@vitejs/plugin-react`
- **Database & Authentication:** Firebase 13.2.0 (Firebase Auth, Cloud Firestore, Firebase Analytics)
- **Styling Architecture:** Pure Vanilla CSS with CSS Custom Properties, Scoped Compact Tokens, Zero UI Frameworks
- **Icons:** Lucide React 1.16.0
- **Media Processing:** Cloudinary REST API (unsigned presets), Web Audio API (AnalyserNode), Canvas rendering
- **Speech Technologies:** Web Speech API (`SpeechSynthesis`, `SpeechSynthesisUtterance`, `webkitSpeechRecognition`)
- **Cryptography & Security:** Web Crypto API (`crypto.subtle`, `crypto.getRandomValues`) for AES-GCM encryption and secure token generation

---

## 5. Application Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React 18 Single Page App                     │
├─────────────────┬───────────────────────────────┬───────────────┤
│ LanguageContext │          AuthContext          │WorkspaceContext│
│  (EN / TA - 568)│ (Firebase Auth / Local Cache) │ (Multi-Tenant)│
├─────────────────┴───────────────────────────────┴───────────────┤
│                         View Layer                              │
│ HomeView | DiaryView | CalendarView | AnalyticsView | etc.      │
├─────────────────────────────────────────────────────────────────┤
│                       Service Layer                             │
│ entryService   │ workspaceService │ speechService  │ syncService│
│ translationServ│ memberService    │ backupService  │ categorySvc│
├─────────────────────────────────────────────────────────────────┤
│                   Storage & Platform Layer                      │
│ Cloud Firestore │ IndexedDB Cache  │ Web Speech API │ Cloudinary│
└─────────────────────────────────────────────────────────────────┘
```

The system is architected as an **offline-first single-page application**:
1. All queries read from `localStorage` / `IndexedDB` first for instant zero-latency rendering.
2. Background synchronization queries Cloud Firestore when authenticated.
3. If network fails or user is offline, mutations are queued in an append-only transaction log.
4. When connectivity resumes, mutations sync automatically with version-checked optimistic concurrency.

---

## 6. Project Folder Structure

```
D:\Projects\diary notes\
├── public/                       # Static public assets
│   ├── icons/                    # Official Ninaivo PNG & PWA icons (light, dark, favicon, 192, 512, maskable)
│   ├── manifest.json             # Web App Manifest
│   └── sw.js                     # Service Worker (offline cache & network fallbacks)
├── src/                          # Application source code
│   ├── components/               # 22 Reusable UI modals and widgets
│   │   ├── AudioAttachmentPlayer.jsx   # Custom voice memo playback bar
│   │   ├── BottomNav.jsx               # Mobile dock navigation with active indicator
│   │   ├── ConflictModal.jsx           # 3-way conflict resolution dialog
│   │   ├── CustomCategoryModal.jsx     # Category creator and manager
│   │   ├── DeleteAccountModal.jsx      # Password-verified account purge
│   │   ├── DiaryEntryCard.jsx          # Compact diary card with speech button
│   │   ├── DiarySpeechButton.jsx       # Micro-popover TTS player with speeds
│   │   ├── EditEntryModal.jsx          # Full diary entry editor
│   │   ├── ErrorBoundary.jsx           # Top-level React error boundary
│   │   ├── ExportModal.jsx             # Category-filtered CSV export dialog
│   │   ├── Header.jsx                  # Decluttered mobile header with official Ninaivo branding
│   │   ├── InviteMemberModal.jsx       # WhatsApp / link invitation generator
│   │   ├── JoinRequestModal.jsx        # Join request submission modal
│   │   ├── LogoutConfirmModal.jsx      # Sign-out confirmation dialog
│   │   ├── NinaivoLogo.jsx             # Official shared branding component with theme-aware icon switching
│   │   ├── NotificationsModal.jsx      # In-app activity notifications panel
│   │   ├── PhotoLightboxModal.jsx      # Fullscreen image viewer
│   │   ├── PwaInstallPrompt.jsx        # Custom PWA install banner with official app icon
│   │   ├── SyncStatusModal.jsx         # Connection & offline mutation manager
│   │   ├── TranslationBadge.jsx        # Bilingual status chip
│   │   ├── VoiceRecorder.jsx           # Audio recorder with waveform canvas
│   │   └── WorkspaceSwitcherModal.jsx  # Compact workspace selector
│   ├── context/                  # React state providers
│   │   ├── AuthContext.jsx             # User identity & credential state
│   │   ├── LanguageContext.jsx         # Bilingual i18n provider (ta/en)
│   │   └── WorkspaceContext.jsx        # Active workspace & entity data provider
│   ├── firebase/                 # Firebase SDK integration
│   │   ├── authService.js              # Registration, login, password resets
│   │   ├── config.js                   # Persistent cache Firestore initialization
│   │   └── userService.js              # User document persistence & profiles
│   ├── hooks/                    # Custom React hooks
│   │   └── useTranslatedDiaryEntry.js  # Reactive language detection & translation
│   ├── i18n/                     # Internationalization
│   │   └── translations.js             # 568 key dictionary for English and Tamil
│   ├── services/                 # Business logic & platform services
│   │   ├── activityService.js          # Audit logging for workspace actions
│   │   ├── backupService.js            # AES-GCM encrypted backup & restore
│   │   ├── categoryService.js          # Predefined & custom category operations
│   │   ├── cloudinaryService.js        # Multi-photo & audio upload pipeline
│   │   ├── entryService.js             # CRUD, filters, sample entry seeders
│   │   ├── exportService.js            # UTF-8 CSV generation with BOM
│   │   ├── invitationService.js        # Cryptographic tokens & invite validation
│   │   ├── memberService.js            # Role assignments & permissions
│   │   ├── notificationService.js      # Workspace notifications
│   │   ├── speechService.js            # Web Speech API singleton & chunker
│   │   ├── syncService.js              # Offline mutation queues & sync loop
│   │   ├── transcriptionService.js     # Web Speech Recognition wrapper
│   │   ├── translationService.js       # Pre-speech translation & caching
│   │   └── workspaceService.js         # Starter workspaces & workspace CRUD
│   ├── styles/                   # Modular stylesheet tokens
│   │   ├── compact-ui.css              # Compact typography & padding variables
│   │   ├── design-tokens.css           # Global colors, radii, shadows, z-indices
│   │   └── themes.css                  # Nature Fresh & Forest Night themes
│   ├── utils/                    # Helper functions
│   │   └── categoryTranslations.js     # Standard category bilingual resolver
│   ├── views/                    # 15 Application screen views
│   │   ├── ActivityView.jsx            # Audit trail & workspace event logs
│   │   ├── AddEntryView.jsx            # Full diary entry creator
│   │   ├── AnalyticsView.jsx           # Financial charts & metrics
│   │   ├── BackupRestoreView.jsx       # Backup, restore & data migration
│   │   ├── CalendarView.jsx            # Month calendar & day breakdown
│   │   ├── DiaryView.jsx               # Chronological history & search
│   │   ├── ForgotPasswordView.jsx      # Password reset flow
│   │   ├── HomeView.jsx                # Locked dashboard with quick stats
│   │   ├── LoginView.jsx               # Email/password authentication
│   │   ├── MembersView.jsx             # Member roles & pending requests
│   │   ├── PhotoGalleryView.jsx        # Visual grid of photo attachments
│   │   ├── ProfileView.jsx             # User account settings & photo upload
│   │   ├── RegisterView.jsx            # Account registration
│   │   ├── SettingsView.jsx            # Theme, language, network & storage
│   │   └── WorkspacesView.jsx          # Workspace settings & category management
│   ├── App.jsx                   # Root routing & central panel orchestrator
│   ├── index.css                 # Main CSS stylesheet & keyframe animations
│   └── main.jsx                  # Application entry point & PWA registration
├── tests/                        # 12 Automated Regression Test Suites
│   ├── header_panel_layout_tests.mjs
│   ├── phase10_voice_diary_tests.mjs
│   ├── phase11_1_translation_fix_tests.mjs
│   ├── phase11_2_complete_localization_tests.mjs
│   ├── phase11_translation_tests.mjs
│   ├── phase13_tts_tests.mjs
│   ├── phase5_analytics_tests.mjs
│   ├── phase6_backup_restore_tests.mjs
│   ├── phase7_reliability_tests.mjs
│   ├── phase8_security_and_permission_tests.mjs
│   ├── phase9_release_regression_tests.mjs   # Executed by npm test
│   └── pixel_accurate_ui_tests.mjs
├── scripts/                      # Developer automation scripts
│   └── capture_screenshots.mjs   # Headless Chrome mobile capture utility
├── screenshots/                  # Design acceptance reference visual assets
├── .env.example                  # Environment configuration template
├── .env.staging.example          # Staging environment template
├── .firebaserc                   # Firebase multi-project alias target mapping
├── .gitignore                    # Git exclusions
├── firebase.json                 # Firebase Hosting rewrites & Firestore rules config
├── firestore.rules               # Production-grade Firestore Security Rules
├── index.html                    # HTML shell with Google Fonts & mobile viewport
├── package.json                  # NPM dependencies & operational scripts
├── package-lock.json             # Pinned dependency lockfile
├── README.md                     # Master Project Documentation (This File)
└── vite.config.js                # Vite build and manual chunking configuration
```

---

## 7. Authentication and User Profiles

- **Email & Password Authentication:** Standard Firebase Authentication integration with input validation and friendly bilingual error messages.
- **Sensitive Action Re-authentication:** Security checks require re-entering the current password before changing account email, updating credentials, or purging the account.
- **Permanent Account Deletion:** Cleanly cascades deletion across user preferences, auth records, and local cache.
- **User Profile Management:**
  - Display name, bio, phone number, and timezone.
  - Avatar management via Cloudinary unsigned upload with camera/file picker.
  - Local caching in `pdt_user_profile_{uid}` for zero-delay offline startup.

---

## 8. Personal, Family and Business Workspaces

Every user is automatically initialized with three default starter workspaces:
1. **Personal Workspace:** Strictly private. Only the owner can view, create, edit, or delete notes. No other users can be invited or join.
2. **Family Workspace:** Designed for family memories, agriculture logs, harvest records, and daily household chores. Allows multi-member collaboration.
3. **Business Workspace:** Designed for commercial projects, trade logs, and shared business expenses.

### Features:
- Create unlimited custom workspaces.
- Color and icon customization per workspace.
- The active workspace ID is persisted in `localStorage` under `pdt_last_active_ws_{uid}` and restored automatically upon reload.

---

## 9. Member Management and Role Permissions

Workspaces enforce a **4-tier role-based access control (RBAC)** model:

| Permission | Owner | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|:---:|
| View diary entries, categories & activity | Yes | Yes | Yes | Yes |
| Create new diary entries | Yes | Yes | Yes | No |
| Edit own diary entries | Yes | Yes | Yes | No |
| Edit other members' entries | Yes | Yes | No | No |
| Delete own diary entries | Yes | Yes | Yes | No |
| Delete other members' entries | Yes | Yes | No | No |
| Create and rename custom categories | Yes | Yes | No | No |
| Generate invitation links & approve join requests | Yes | Yes | No | No |
| Promote / Demote member roles | Yes | No | No | No |
| Remove members from workspace | Yes | No | No | No |
| Delete workspace | Yes | No | No | No |

### Invitation & Join Request System:
- **Cryptographic Invite Links:** Generates 48-character hex tokens with 7-day expiration.
- **WhatsApp Share:** One-click sharing via formatted WhatsApp URL.
- **Join Requests:** Users can submit requests to join Family/Business workspaces. Admins and Owners receive in-app notifications to accept or reject.
- **Audit Logs:** All member joins, role adjustments, and removals are logged in `activityLogs`.

---

## 10. Diary Entry Management

Full CRUD lifecycle for structured diary records:
- **Required Fields:** Title, Category, Date (`YYYY-MM-DD`).
- **Optional Fields:** Time (`HH:MM`), Description, Financial Amount (with `income` / `expense` categorization and `₹` currency), Location, Tags, Multiple Photos, and Voice Memo.
- **Predefined Categories:** *Daily Activity*, *Agriculture*, *Personal*, *Family*, *Business*, *Important Event*, *Reminder*, *Income*, *Expense*.
- **Custom Categories:** Users can add unlimited custom categories per workspace (e.g. *Paddy Field Work*, *Irrigation Schedule*, *Harvest Records*).
- **Concurrency & Versioning:** Every entry maintains an integer `version` and `updatedAt` timestamp to prevent overwrite collisions during multi-tab or offline synchronization.

---

## 11. Tamil and English Language Support

Ninaivo delivers **100% bilingual parity**:
- **568 translation keys** exist in both English and Tamil dictionaries in `src/i18n/translations.js`.
- **Instant Toggle:** Switch language instantly via the header pill or Settings without full page reloads.
- **Predefined Category Localization:** Categories like *Agriculture* automatically render as *விவசாயம்* in Tamil while preserving the canonical English ID in the database.
- **Independent Member Preference:** Member A in a Family workspace can view the application in English while Member B views the exact same workspace in Tamil.

---

## 12. Translation and Text-to-Speech

### Text-to-Speech (TTS) Engine (`src/services/speechService.js`):
- Native `window.speechSynthesis` with zero third-party cloud audio dependencies.
- **Preferred Voice Selection:** Automatically matches `ta-IN` for Tamil and `en-IN` (Indian English) before falling back to generic English.
- **Strict Language Protection:** Tamil text is never read with an English voice, and English text is never read with a Tamil voice.
- **Automated Pre-Speech Translation:** If a Tamil diary entry is viewed by a member with English preference, the entry is automatically translated into English before speaking (and vice-versa).
- **Spoken Text Compiler:** Strips Markdown notation, URLs, and database IDs, speaking Title, Category, Description, Financial Amount, and Location in natural sentences.
- **Chromium Keepalive & Chunking:** Chunks text into <= 180 character sentences with a 10-second heartbeat to eliminate Chromium's silent 15-second speech cutoff bug.
- **Speed Customization:** 4 speeds (`0.75x`, `1.0x`, `1.25x`, `1.5x`) persisted in `localStorage`.

---

## 13. Voice Recording and Speech Transcription

- **HTML5 MediaRecorder API:** High-fidelity voice recording supporting `audio/webm`, `audio/mp4`, and `audio/ogg`.
- **Web Audio API Waveform Visualizer:** Real-time 32-bar visualizer rendered dynamically on HTML5 `<canvas>`.
- **Live Speech-to-Text Transcription:** Integrated `SpeechRecognition` / `webkitSpeechRecognition` transcribes speech into text in real-time, automatically appending to the entry description.
- **Storage Strategy:** Uploads audio files to Cloudinary unsigned preset. If offline or unconfigured, falls back gracefully to a base64 Data URL stored locally.

---

## 14. Cloudinary Image and Audio Attachments

- **Unsigned Upload Pipeline:** Direct client-to-Cloudinary image and audio uploads without server credentials.
- **Multi-Photo Attachments:** Upload multiple images per entry with upload progress bars.
- **Photo Lightbox:** Fullscreen image viewer with responsive zoom, touch dismissal, and caption metadata.
- **Offline Fallback:** If Cloudinary is unconfigured or network is unavailable, files are converted to compressed base64 data strings for offline storage.

---

## 15. Dashboard and Analytics

- **Locked Visual Dashboard (`HomeView.jsx`):** Preserved pixel-accurate hero banner, quick actions (`Add Diary`, `Calendar`, `Gallery`, `Analytics`), pastel workspace cards, and decorative landscape illustration.
- **Financial Analytics (`AnalyticsView.jsx`):**
  - Total income vs. total expense tally with net balance.
  - Category breakdown horizontal progress bars.
  - 6-month transaction activity ledger.
- **Activity Metrics:** Quick stats display total entries, workspace members count, and total photos attached.

---

## 16. Calendar and Diary History

- **Interactive Month Calendar (`CalendarView.jsx`):**
  - Full-month grid with quick navigation (`Prev`, `Next`, `Today`).
  - Density indicator badges highlighting dates with active diary notes.
  - Day detail section showing all entries recorded on the selected date with integrated TTS speaker buttons.
- **Chronological History (`DiaryView.jsx`):**
  - Quick filter buttons: *Today*, *Yesterday*, or custom date range.
  - Sort by newest or oldest.
  - Category filter pill carousel with count badges.

---

## 17. Search, Filtering and Gallery

- **Instant Full-Text Search:** Case-insensitive search across entry titles, notes, location, category, and tags.
- **Photo Gallery View (`PhotoGalleryView.jsx`):**
  - Dedicated photo gallery organizing all attached pictures into a responsive grid.
  - Filter gallery photos by category or month.
  - Tap any thumbnail to open the full-resolution lightbox modal.

---

## 18. Backup, Restore and CSV Export

- **AES-256-GCM Encrypted JSON Backup:**
  - Export all workspaces, entries, categories, and settings into an encrypted `.json` file.
  - Key derived from user-provided password using PBKDF2 (100,000 iterations).
  - Can be restored on any device by supplying the decryption password.
- **UTF-8 CSV Export:**
  - Export workspace diary records to CSV with UTF-8 Byte Order Mark (`\uFEFF`) to ensure Tamil script renders correctly in Microsoft Excel and Google Sheets.
  - Filter CSV export by specific category or date range.

---

## 19. Offline Support and PWA

- **Progressive Web App (PWA):** Installable on Android, iOS, Windows, and macOS via `manifest.json`.
- **Service Worker (`public/sw.js`):** Caches HTML, CSS, JavaScript, and fonts for offline operation.
- **Multi-Tab IndexedDB Caching:** Powered by Firestore `persistentLocalCache` and `persistentMultipleTabManager`.
- **Mutation Queue (`src/services/syncService.js`):** Queues create, update, and delete actions when offline. Automatically flushes upon reconnection.
- **Conflict Resolution Modal (`ConflictModal.jsx`):** Detects server-vs-local version mismatches and offers 3 resolution choices: *Keep Cloud Version*, *Keep Local Version*, or *Merge & Save Both*.

---

## 20. Nature Fresh and Forest Night Themes

The design system implements two custom themes:

| Theme | Background | Surface / Cards | Primary Accent | Best For |
|---|---|---|---|---|
| **Nature Fresh** (Light) | `#f3f6f1` (Soft Sage) | `#ffffff` / `#eef3ec` | `#165a36` (Forest Green) | Daytime outdoor use, farm work |
| **Forest Night** (Dark) | `#0e1813` (Deep Pine) | `#14221b` / `#1c3026` | `#22c55e` (Bright Emerald) | Nighttime, low-light environments |

Themes toggle instantly via the header icon and persist in `localStorage` under `pdt_theme`.

---

## 21. Firebase Configuration

The project utilizes Firebase for Authentication and Cloud Firestore.

### Firestore Rules Setup
Deploy security rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

Key security mechanisms in `firestore.rules`:
- Users can only read/write their own user profile document.
- Workspace data is strictly locked to authenticated members.
- Role checks prevent viewers and editors from modifying administrative settings or deleting other members' records.

---

## 22. Cloudinary Configuration

For multi-photo and voice memo uploads:
1. Create a free account at [Cloudinary](https://cloudinary.com).
2. Go to **Settings > Upload > Upload Presets**.
3. Create an **Unsigned** upload preset (e.g. `diary_unsigned`).
4. Copy your **Cloud Name** and **Upload Preset Name** into `.env`.

*Note: If Cloudinary is not configured, the app automatically switches to local base64 storage without crashing.*

---

## 23. Environment Variables Setup

Create a `.env` file in the project root based on `.env.example`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Cloudinary Configuration (Unsigned)
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset_name
```

---

## 24. Installation Instructions

### Prerequisites
- [Node.js](https://nodejs.org) version 18.0.0 or higher.
- NPM version 9.0.0 or higher.

### Step-by-Step Setup
1. Clone or copy the project into your local directory:
   ```bash
   cd "D:\Projects\diary notes"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create and populate your `.env` file with Firebase credentials.

---

## 25. Development Commands

```bash
# Start local development server with Hot Module Replacement (HMR)
npm run dev

# Start development server on specific port
npm run dev -- --port 3000

# Start development server accessible over local network (mobile testing)
npm run dev -- --host
```

---

## 26. Production Build Instructions

```bash
# Standard Production Build (outputs to dist/)
npm run build

# Staging Environment Build
npm run build:staging

# Preview the local production build
npm run preview
```

---

## 27. Testing Instructions

The repository includes 12 automated regression test suites covering 408 distinct assertions:

```bash
# Run the Master Release Gate test suite (configured in package.json)
npm test

# Run the Phase 13 Multilingual Text-to-Speech test suite
node tests/phase13_tts_tests.mjs

# Run the 100% Bilingual Parity Localization test suite (568 keys)
node tests/phase11_2_complete_localization_tests.mjs

# Run the Voice Recording & Transcription test suite
node tests/phase10_voice_diary_tests.mjs

# Run the Multi-Workspace Role & Permissions test suite
node tests/phase8_security_and_permission_tests.mjs

# Run the Offline Reliability & Mutation Queue test suite
node tests/phase7_reliability_tests.mjs

# Run the Header Panel Layout & Exclusivity test suite
node tests/header_panel_layout_tests.mjs

# Run the Pixel-Accurate UI Recreation test suite
node tests/pixel_accurate_ui_tests.mjs
```

---

## 28. Deployment Instructions

> **Deployment Status:** Build artifacts and Firebase Hosting configurations (`firebase.json`, `.firebaserc`) are production-ready. Actual deployment to live hosting has **not yet been executed**.

### Deploying to Firebase Hosting

1. **Install Firebase CLI globally (if not installed):**
   ```bash
   npm install -g firebase-tools
   ```
2. **Authenticate with Google:**
   ```bash
   firebase login
   ```
3. **Compile the production bundle:**
   ```bash
   npm run build
   ```
4. **Deploy Security Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```
5. **Deploy to Staging Environment:**
   ```bash
   firebase use diary-tracker-staging
   firebase deploy --only hosting
   ```
6. **Deploy to Production Environment:**
   ```bash
   firebase use diary-tracker-c888d
   firebase deploy --only hosting
   ```

---

## 29. Security and Privacy Considerations

- **Client-Side Privacy:** Diary text synthesized via TTS uses on-device Web Speech API. Content is never sent to third-party cloud voice synthesizers.
- **Encrypted Local Storage:** Passphrase-protected backups utilize AES-256-GCM with PBKDF2 key stretching.
- **Safe Authentication:** Strict email verification, password recovery, and re-authentication for destructive account operations.
- **Firestore Security Rules:** Server-side rules enforce author checks and prevent unauthorized data tampering.
- **Sanitized Spoken Output:** Spoken text builders strip HTML tags, markdown, URLs, and database UUIDs.

---

## 30. Browser Compatibility

| Browser | Platform | UI & Layout | TTS Voice Support | Voice Recording |
|---|---|:---:|:---:|:---:|
| **Google Chrome** | Android, Windows, macOS | Excellent | Full (ta-IN, en-IN) | Full (MediaRecorder) |
| **Apple Safari** | iOS 14+, iPadOS, macOS | Excellent | Native Apple voices | Full |
| **Samsung Internet**| Android | Excellent | Full (Samsung / Google TTS)| Full |
| **Mozilla Firefox** | Desktop, Android | Excellent | System dependent | Full |
| **Microsoft Edge**  | Windows, macOS | Excellent | Microsoft Natural voices | Full |

---

## 31. Current Limitations

- **Browser-Dependent Voices:** While English (`en-IN`) is widely available on all operating systems, high-quality Tamil (`ta-IN`) voice synthesis requires Google Speech Services on Android or Siri/Microsoft Tamil voice packs on iOS/Windows.
- **Direct P2P Sync:** Offline sync relies on an intermediate Firestore server; direct local peer-to-peer sync between devices without internet is not supported.
- **Audio File Size:** Large voice recordings (>25MB) require active network connection for Cloudinary upload.

---

## 32. Future Improvements

- [ ] Push notifications for upcoming reminder-type diary entries via Web Push API.
- [ ] Biometric App Lock (WebAuthn / Fingerprint / FaceID) before revealing private entries.
- [ ] Automated PDF journal generation for printing monthly diary books.
- [ ] Offline Tamil Optical Character Recognition (OCR) to convert handwritten journal photos into text.

---

*Ninaivo (நினைவு) — Your Life. Your Memories. Your Story. Built for seamless multi-workspace personal, agricultural, and business memory capture.*
