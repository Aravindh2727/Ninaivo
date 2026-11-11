import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('================================================================');
console.log('   NINAIVO — MOBILE ALIGNMENT & RESPONSIVE AUDIT TEST SUITE     ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runCheck(name, fn) {
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

// Read relevant files
const inviteModalPath = path.resolve('src/components/InviteMemberModal.jsx');
const inviteModalContent = fs.readFileSync(inviteModalPath, 'utf8');

const joinModalPath = path.resolve('src/components/JoinRequestModal.jsx');
const joinModalContent = fs.readFileSync(joinModalPath, 'utf8');

const membersViewPath = path.resolve('src/views/MembersView.jsx');
const membersViewContent = fs.readFileSync(membersViewPath, 'utf8');

const bottomNavPath = path.resolve('src/components/BottomNav.jsx');
const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');

const indexCssPath = path.resolve('src/index.css');
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

const appJsxPath = path.resolve('src/App.jsx');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');

const manifestPath = path.resolve('public/manifest.json');
const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('--- SUITE 1: InviteMemberModal Mobile Alignment & Portaling ---');

runCheck('1.1 InviteMemberModal uses createPortal to document.body', () => {
  assert(inviteModalContent.includes("createPortal"), 'Must import and use createPortal');
  assert(inviteModalContent.includes("createPortal(modalContent, document.body)"), 'Must portal to document.body');
});

runCheck('1.2 InviteMemberModal enforces body scroll lock while open', () => {
  assert(inviteModalContent.includes("document.body.style.overflow = 'hidden'"), 'Must lock body scroll');
  assert(inviteModalContent.includes("document.body.style.overflow = originalOverflow"), 'Must restore body scroll');
});

runCheck('1.3 InviteMemberModal has pinned header, scrollable body and pinned footer', () => {
  assert(inviteModalContent.includes("modal-header"), 'Must have modal header');
  assert(inviteModalContent.includes("overflowY: 'auto'"), 'Must have scrollable body');
  assert(inviteModalContent.includes("overscrollBehavior: 'contain'"), 'Must contain overscroll');
  assert(inviteModalContent.includes("WebkitOverflowScrolling: 'touch'"), 'Must support smooth touch scrolling');
  assert(inviteModalContent.includes("t('close')"), 'Must have close button in footer');
});

runCheck('1.4 InviteMemberModal role select uses clean concise options', () => {
  assert(inviteModalContent.includes("{t('roleEditor')}"), 'Editor option is concise');
  assert(inviteModalContent.includes("{t('roleAdmin')}"), 'Admin option is concise');
  assert(inviteModalContent.includes("{t('roleViewer')}"), 'Viewer option is concise');
  assert(inviteModalContent.includes("roleEditorDesc"), 'Description appears below select');
});

console.log('\n--- SUITE 2: MembersView Sub-Tabs & Member List Mobile Alignment ---');

runCheck('2.1 Sub-tabs use 2-column grid layout to prevent text clipping', () => {
  assert(membersViewContent.includes("gridTemplateColumns: '1fr 1fr'"), 'Must use 50/50 2-column grid');
  assert(membersViewContent.includes("activeMembersTitle"), 'Includes active members title');
  assert(membersViewContent.includes("activityAuditTitle"), 'Includes activity audit title');
});

runCheck('2.2 CreateGroupModal uses createPortal and locks body scroll', () => {
  assert(membersViewContent.includes("createPortal"), 'MembersView imports createPortal');
  assert(membersViewContent.includes("showCreateGroupModal"), 'Handles create group modal');
  assert(membersViewContent.includes("document.body.style.overflow = 'hidden'"), 'Locks scroll for create group');
});

runCheck('2.3 Member rows have flexShrink: 0 on role badges to prevent wrapping', () => {
  assert(membersViewContent.includes("flexShrink: 0"), 'Role actions have flexShrink: 0');
  assert(membersViewContent.includes("minWidth: 0"), 'Member info has minWidth: 0');
});

console.log('\n--- SUITE 3: Bottom Navigation Dock & Mobile Usability ---');

runCheck('3.1 BottomNav items have minimum 48px touch targets and manipulation touch-action', () => {
  assert(bottomNavContent.includes("minHeight: '48px'"), 'Items have 48px min touch target');
  assert(bottomNavContent.includes("touchAction: 'manipulation'"), 'Items prevent 300ms click delay');
  assert(bottomNavContent.includes("WebkitTapHighlightColor: 'transparent'"), 'Removes gray tap overlay');
});

runCheck('3.2 index.css styles bottom-nav as fixed dock on mobile', () => {
  assert(indexCssContent.includes("position: fixed"), 'bottom-nav is fixed on mobile');
  assert(indexCssContent.includes("safe-area-inset-bottom"), 'bottom-nav accounts for safe area');
  assert(indexCssContent.includes("z-index: 100"), 'bottom-nav has prominent z-index');
});

runCheck('3.3 app-content has adequate padding-bottom to prevent content occlusion', () => {
  assert(indexCssContent.includes("padding-bottom: calc(var(--bottom-nav-height, 68px) + env(safe-area-inset-bottom, 0px)"), 'Content padded above dock');
});

console.log('\n--- SUITE 4: Android Navigation Bar Color & Theme Synchronization ---');

runCheck('4.1 manifest.json uses light theme background_color (#F8FAF3) by default', () => {
  assert.strictEqual(manifestContent.background_color, '#F8FAF3', 'manifest background_color matches light theme');
  assert.strictEqual(manifestContent.theme_color, '#F8FAF3', 'manifest theme_color matches light theme');
});

runCheck('4.2 App.jsx dynamically updates meta theme-color on theme change', () => {
  assert(appJsxContent.includes("metaThemeColor.setAttribute('content', themeColor)"), 'Updates meta theme-color dynamically');
  assert(appJsxContent.includes("#102B23"), 'Dark theme color matches Forest Night');
  assert(appJsxContent.includes("#F8FAF3"), 'Light theme color matches Nature Fresh');
});

console.log('\n--- SUITE 5: Containing Block & Screen Fade Animation Fix ---');

runCheck('5.1 fadeIn keyframe resets transform: none to prevent containing block trap', () => {
  assert(indexCssContent.includes("transform: none;"), 'fadeIn resets transform to none');
});

runCheck('5.2 #root stretches on mobile to avoid letterboxing gaps', () => {
  assert(indexCssContent.includes("align-items: stretch;"), '#root stretches container on mobile');
});

runCheck('5.3 JoinRequestModal uses createPortal, scroll lock, and scrollable sheet', () => {
  assert(joinModalContent.includes("createPortal(modalContent, document.body)"), 'JoinRequestModal portals to body');
  assert(joinModalContent.includes("document.body.style.overflow = 'hidden'"), 'JoinRequestModal locks body scroll');
  assert(joinModalContent.includes("overflowY: 'auto'"), 'JoinRequestModal scrolls cleanly on short viewports');
});

runCheck('5.4 InviteMemberModal avoids double-padding from compact-modal-dialog override', () => {
  assert(!inviteModalContent.includes("modal-dialog compact-modal-dialog"), 'InviteMemberModal does not use !important compact-modal-dialog outer padding override');
});

runCheck('5.5 .modal-backdrop uses z-index 1100 and @media <=360px preserves safe-area padding-bottom', () => {
  assert(indexCssContent.includes("z-index: 1100;"), 'Modals sit above bottom nav');
  assert(!indexCssContent.includes("  .bottom-nav {\n    padding: 0 2px;") && !indexCssContent.includes("  .bottom-nav {\r\n    padding: 0 2px;"), '360px media query uses padding-left/right rather than overwriting padding-bottom');
});

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

