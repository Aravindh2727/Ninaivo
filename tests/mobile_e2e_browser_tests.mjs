// tests/mobile_e2e_browser_tests.mjs
// End-to-End Headless Chromium Mobile Browser Verification Suite (CDP + Auth & Firestore Emulators)
// Covers Phase 4A (Mobile Bottom Nav), Phase 4B/4D (Two-User Real-Time Invite Flow), Phase 4C (Modal Scrolling)

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 }
];

const VITE_PORT = 4174;
const CDP_PORT = 9235;
const APP_ORIGIN = `http://127.0.0.1:${VITE_PORT}`;

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function locateBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error('Chrome/Edge executable not found on system.');
  }
  return found;
}

async function waitForHttpReady(url, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CDPBrowser {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.permissionErrors = [];
    this.pageErrors = [];
    this.dialogs = [];
    this.sessionEvents = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });

    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(`CDP ${msg.method || ''}: ${msg.error.message}`));
        } else {
          resolve(msg.result || {});
        }
        return;
      }

      if (msg.sessionId) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
          if (msg.params.type === 'error') {
            this.consoleErrors.push({ sessionId: msg.sessionId, text });
          }
          if (/missing or insufficient permissions/i.test(text)) {
            this.permissionErrors.push({ sessionId: msg.sessionId, source: 'console', text });
          }
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const text = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'Exception';
          this.pageErrors.push({ sessionId: msg.sessionId, text });
          if (/missing or insufficient permissions/i.test(text)) {
            this.permissionErrors.push({ sessionId: msg.sessionId, source: 'exception', text });
          }
        } else if (msg.method === 'Page.javascriptDialogOpening') {
          const dlg = { sessionId: msg.sessionId, message: msg.params.message, type: msg.params.type };
          this.dialogs.push(dlg);
          if (/missing or insufficient permissions/i.test(dlg.message || '')) {
            this.permissionErrors.push({ sessionId: msg.sessionId, source: 'dialog', text: dlg.message });
          }
          this.send('Page.handleJavaScriptDialog', { accept: true }, msg.sessionId).catch(() => {});
        }
      }
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async createIsolatedPage(viewport = { width: 390, height: 844 }) {
    const { browserContextId } = await this.send('Target.createBrowserContext');
    const { targetId } = await this.send('Target.createTarget', {
      url: 'about:blank',
      browserContextId
    });
    const { sessionId } = await this.send('Target.attachToTarget', {
      targetId,
      flatten: true
    });
    await this.send('Page.enable', {}, sessionId);
    await this.send('Runtime.enable', {}, sessionId);
    await this.send('DOM.enable', {}, sessionId);

    const page = new CDPPage(this, sessionId, browserContextId, targetId);
    await page.setViewport(viewport.width, viewport.height);
    return page;
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

class CDPPage {
  constructor(browser, sessionId, browserContextId, targetId) {
    this.browser = browser;
    this.sessionId = sessionId;
    this.browserContextId = browserContextId;
    this.targetId = targetId;
  }

  async setViewport(width, height) {
    await this.browser.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: true
    }, this.sessionId);
    await this.browser.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5
    }, this.sessionId);
  }

  async goto(url) {
    await this.browser.send('Page.navigate', { url }, this.sessionId);
    await this.waitFor(() => document.readyState === 'complete', [], 15000);
  }

  async evaluate(fn, ...args) {
    const argJson = args.map((a) => JSON.stringify(a)).join(', ');
    const expression = `(${fn.toString()})(${argJson})`;
    const res = await this.browser.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    }, this.sessionId);
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Evaluation failed');
    }
    return res.result?.value;
  }

  async waitFor(fn, args = [], timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const result = await this.evaluate(fn, ...args);
        if (result) return result;
      } catch {
        // retry on transient navigation state
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
  }

  async tapAt(x, y) {
    const px = Math.round(x);
    const py = Math.round(y);
    await this.browser.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: px, y: py, id: 1 }]
    }, this.sessionId);
    await new Promise((r) => setTimeout(r, 40));
    await this.browser.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    }, this.sessionId);
    await new Promise((r) => setTimeout(r, 180));
  }

  async tapSelector(selector) {
    const coords = await this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, selector);
    if (!coords) throw new Error(`Element not found for tap: ${selector}`);
    await this.tapAt(coords.x, coords.y);
  }

  async tapButtonByText(textMatch) {
    const coords = await this.evaluate((needle) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().includes(needle));
      if (!target) return null;
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = target.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, textMatch);
    if (!coords) throw new Error(`Button containing "${textMatch}" not found`);
    await this.tapAt(coords.x, coords.y);
  }

  async fillInput(selector, value) {
    const ok = await this.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, selector, value);
    if (!ok) throw new Error(`Input not found: ${selector}`);
  }

  async selectOption(selector, value) {
    const ok = await this.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, selector, value);
    if (!ok) throw new Error(`Select not found: ${selector}`);
  }
}

async function verifyBottomNavAcrossAllTabs(page, viewportName, labelPrefix) {
  const navAudit = await page.evaluate(() => {
    const nav = document.querySelector('nav.bottom-nav');
    if (!nav) return { exists: false };
    const navStyle = getComputedStyle(nav);
    const navRect = nav.getBoundingClientRect();
    const btns = Array.from(nav.querySelectorAll('button.nav-item'));
    const items = btns.map((b, idx) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = Math.min(window.innerHeight - 4, Math.max(r.top + 8, r.top + r.height / 2));
      const topEl = document.elementFromPoint(cx, cy);
      const hitInsideButton = Boolean(topEl && (topEl === b || b.contains(topEl)));
      return {
        idx,
        aria: b.getAttribute('aria-label'),
        width: Math.round(r.width),
        height: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        hitInsideButton,
        topHitTag: topEl ? `${topEl.tagName}.${topEl.className}` : 'none'
      };
    });
    return {
      exists: true,
      position: navStyle.position,
      navBottom: Math.round(navRect.bottom),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      items
    };
  });

  check(`${labelPrefix} (${viewportName}): BottomNav present & fixed at bottom`,
    navAudit.exists && navAudit.position === 'fixed' && navAudit.navBottom <= navAudit.innerHeight + 1,
    JSON.stringify(navAudit));

  check(`${labelPrefix} (${viewportName}): Zero horizontal overflow on shell`,
    navAudit.docScrollWidth <= navAudit.innerWidth,
    `scrollWidth=${navAudit.docScrollWidth} innerWidth=${navAudit.innerWidth}`);

  check(`${labelPrefix} (${viewportName}): All 5 nav touch targets >= 44x44 & unobstructed hit-test`,
    navAudit.items.length === 5 && navAudit.items.every((i) => i.width >= 44 && i.height >= 44 && i.hitInsideButton),
    JSON.stringify(navAudit.items));

  const expectedMarkers = [
    { idx: 1, name: 'Calendar', checkFn: () => Boolean(document.body.innerText.match(/January|February|March|April|May|June|July|August|September|October|November|December|ஜனவரி|பிப்ரவரி|மார்ச்|ஏப்ரல்|மே|ஜூன்|ஜூலை|ஆகஸ்ட்|செப்டம்பர்|அக்டோபர்|நவம்பர்|டிசம்பர்/)) },
    { idx: 2, name: 'Add', checkFn: () => Boolean(document.querySelector('form input.form-input, form button[type="submit"]')) },
    { idx: 3, name: 'Members', checkFn: () => Boolean(document.body.innerText.match(/Group Overview|Members|குழு|உறுப்பினர்கள்/i)) },
    { idx: 4, name: 'Settings', checkFn: () => Boolean(document.body.innerText.match(/Display|Experience|Theme|Language|காட்சி|மொழி/i)) },
    { idx: 0, name: 'Home', checkFn: () => Boolean(document.querySelector('.welcome-landscape-banner')) }
  ];

  for (const step of expectedMarkers) {
    const coords = await page.evaluate((index) => {
      const btns = Array.from(document.querySelectorAll('nav.bottom-nav button.nav-item'));
      const btn = btns[index];
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: Math.min(window.innerHeight - 6, r.top + r.height / 2) };
    }, step.idx);
    await page.tapAt(coords.x, coords.y);
    const navWorked = await page.waitFor(step.checkFn, [], 8000).then(() => true).catch(() => false);
    const activeOk = await page.evaluate((index) => {
      const btns = Array.from(document.querySelectorAll('nav.bottom-nav button.nav-item'));
      return btns[index]?.classList.contains('active');
    }, step.idx);
    check(`${labelPrefix} (${viewportName}): Tap ${step.name} navigates & activates tab`, navWorked && activeOk);
  }
}

async function run() {
  console.log('\n================================================================');
  console.log('   NINAIVO — REAL CHROMIUM MOBILE E2E & TWO-USER EMULATOR SUITE ');
  console.log('================================================================\n');

  const browserPath = locateBrowser();
  const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'ninaivo-cdp-'));
  let viteProc = null;
  let chromeProc = null;
  let browser = null;

  try {
    // 1. Start Vite Dev Server targeting Auth + Firestore Emulators
    const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
    viteProc = spawn(process.execPath, [viteEntry, '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_USE_FIREBASE_EMULATORS: 'true',
        VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
        VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        VITE_FIREBASE_API_KEY: 'demo-ninaivo-api-key',
        VITE_FIREBASE_PROJECT_ID: 'diary-tracker-c888d',
        VITE_FIREBASE_AUTH_DOMAIN: 'localhost'
      },
      stdio: 'pipe'
    });

    await waitForHttpReady(APP_ORIGIN, 25000);
    console.log(`✓ Vite emulator app running at ${APP_ORIGIN}`);

    // 2. Start Headless Chrome
    chromeProc = spawn(browserPath, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--user-data-dir=${tempUserData}`,
      `--remote-debugging-port=${CDP_PORT}`,
      'about:blank'
    ], { stdio: 'pipe' });

    const verRes = await waitForHttpReady(`http://127.0.0.1:${CDP_PORT}/json/version`, 15000);
    const { webSocketDebuggerUrl } = await verRes.json();
    browser = new CDPBrowser(webSocketDebuggerUrl);
    await browser.connect();
    console.log(`✓ Connected to headless Chromium via CDP`);

    // =========================================================================
    // ACCOUNT A (OWNER): Registration, Navigation, Themes, Invite Creation & Scrolling
    // =========================================================================
    const pageA = await browser.createIsolatedPage({ width: 390, height: 844 });
    try {
    await pageA.goto(APP_ORIGIN);
    await pageA.waitFor(() => Boolean(document.querySelector('.auth-switch-link')));

    await pageA.tapButtonByText('Create an Account');
    await pageA.waitFor(() => document.querySelectorAll('.auth-card input').length >= 4);

    await pageA.fillInput('.auth-card input[type="text"]', 'Aravindh Owner');
    await pageA.fillInput('.auth-card input[type="email"]', 'owner@ninaivo.test');
    const pwCount = await pageA.evaluate(() => {
      const pws = Array.from(document.querySelectorAll('.auth-card input[type="password"]'));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      pws.forEach((p) => {
        setter.call(p, 'OwnerPass123!');
        p.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return pws.length;
    });
    check('Account A register inputs populated', pwCount >= 2);
    await pageA.tapButtonByText('Register & Open');
    await pageA.waitFor(() => Boolean(document.querySelector('nav.bottom-nav')), [], 25000);
    console.log('✓ Account A signed up & landed on Home shell');

    // Verify BottomNav across 360x800, 375x812, 390x844, 412x915
    for (const vp of VIEWPORTS) {
      await pageA.setViewport(vp.width, vp.height);
      await new Promise((r) => setTimeout(r, 150));
      await verifyBottomNavAcrossAllTabs(pageA, vp.name, 'Phase 4A Owner');
    }

    // Verify Dark Mode & Tamil language navigation at 360x800
    await pageA.setViewport(360, 800);
    await pageA.tapSelector('nav.bottom-nav button.nav-item:nth-child(5)');
    await pageA.waitFor(() => Boolean(document.body.innerText.match(/Theme|Tamil|தமிழ்/)));
    await pageA.evaluate(() => {
      // Toggle Theme to Dark via Header sun/moon button (.header-right button:nth-child(2))
      const themeBtn = document.querySelector('.header-right button:nth-child(2)');
      if (themeBtn) themeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 150));
    const darkThemeActive = await pageA.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');
    check('Phase 4A: Theme toggles to dark mode cleanly', darkThemeActive);

    // Toggle Language to Tamil via Header Globe button (.header-right button:nth-child(3))
    await pageA.evaluate(() => {
      const langBtn = document.querySelector('.header-right button:nth-child(3)');
      if (langBtn) langBtn.click();
    });
    await pageA.waitFor(() =>
      Boolean(document.querySelector('.header-right button:nth-child(3)')?.innerText.includes('EN'))
    );
    await verifyBottomNavAcrossAllTabs(pageA, '360x800', 'Phase 4A Tamil+Dark');

    // Toggle back to Light Mode + English for subsequent tests
    await pageA.evaluate(() => {
      const themeBtn = document.querySelector('.header-right button:nth-child(2)');
      if (themeBtn) themeBtn.click();
      const langBtn = document.querySelector('.header-right button:nth-child(3)');
      if (langBtn) langBtn.click();
    });
    await pageA.waitFor(() =>
      document.documentElement.getAttribute('data-theme') === 'light' &&
      Boolean(document.querySelector('.header-right button:nth-child(3)')?.innerText.includes('தமிழ்'))
    );

    // Seed a Personal private entry first while in Personal Diary
    await pageA.tapSelector('nav.bottom-nav button.nav-item:nth-child(3)'); // Add (+)
    await pageA.waitFor(() => Boolean(document.querySelector('form input[type="text"]')));
    await pageA.fillInput('form input[type="text"]', 'Owner Private Reflection');
    await pageA.tapButtonByText('Save to Diary');
    await pageA.waitFor(() => document.body.innerText.includes('Owner Private Reflection'), [], 15000);
    check('Account A created private Personal Diary entry', true);

    // Switch Workspace to "My Family & Agriculture" via Header WorkspaceSwitcherModal
    await pageA.tapSelector('.header-left');
    await pageA.waitFor(() => document.body.innerText.includes('My Family & Agriculture'));
    await pageA.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.compact-ws-row'));
      const fam = rows.find((r) => r.innerText.includes('My Family & Agriculture'));
      if (fam) fam.click();
    });
    await pageA.waitFor(() => !document.querySelector('.modal-overlay'));
    const activeHeaderWs = await pageA.evaluate(() => document.body.innerText.includes('My Family & Agriculture'));
    check('WorkspaceSwitcherModal switches Account A to Family workspace', activeHeaderWs);

    // Verify BottomNav STILL works cleanly AFTER switching workspaces
    await verifyBottomNavAcrossAllTabs(pageA, '390x844', 'Phase 4A Post-Workspace-Switch');

    // Add Diary Phase 6 Check: Destination Workspace selector appears BEFORE Entry Category,
    // and selecting "Agriculture" category preserves selected Destination Workspace
    await pageA.tapSelector('nav.bottom-nav button.nav-item:nth-child(3)'); // Add (+)
    await pageA.waitFor(() => Boolean(document.querySelector('form input[type="text"]')));
    const addOrderCheck = await pageA.evaluate(() => {
      const form = document.querySelector('form');
      const labels = Array.from(form?.querySelectorAll('label') || []);
      const destIdx = labels.findIndex((l) => l.innerText.includes('Destination Workspace') || l.innerText.includes('Saved in Workspace'));
      const catIdx = labels.findIndex((l) => l.innerText.includes('Entry Category') || l.innerText.includes('Type'));
      const destRect = destIdx >= 0 ? labels[destIdx].getBoundingClientRect() : null;
      const catRect = catIdx >= 0 ? labels[catIdx].getBoundingClientRect() : null;
      const wsSelect = form?.querySelector('select');
      const beforeVal = wsSelect?.value || '';
      const agriBtn = Array.from(form?.querySelectorAll('button.category-pill') || []).find((b) => b.innerText.includes('Agriculture'));
      if (agriBtn) agriBtn.click();
      const afterVal = wsSelect?.value || '';
      const fileInputs = form ? Array.from(form.querySelectorAll('input[type="file"]')) : [];
      const hasCamInput = fileInputs.some((i) => i.getAttribute('capture') === 'environment');
      const hasUploadInput = fileInputs.some((i) => !i.hasAttribute('capture') && (i.getAttribute('accept') || '').includes('image'));
      return { destBeforeCat: Boolean(destRect && catRect && destRect.top < catRect.top), preservedWsAfterAgri: Boolean(beforeVal && beforeVal === afterVal), hasCamInput, hasUploadInput };
    });
    check('Phase 6 Add Diary: Destination Workspace appears before Entry Category & Agriculture keeps workspace unchanged',
      addOrderCheck.destBeforeCat && addOrderCheck.preservedWsAfterAgri, JSON.stringify(addOrderCheck));
    check('Phase 6 Add Diary: Camera capture & Upload photo inputs remain intact',
      addOrderCheck.hasCamInput && addOrderCheck.hasUploadInput, JSON.stringify(addOrderCheck));

    await pageA.fillInput('form input[type="text"]', 'Morning Field Harvest');
    await pageA.tapButtonByText('Save to Diary');
    await pageA.waitFor(() => document.body.innerText.includes('Morning Field Harvest'), [], 15000);
    check('Account A created shared Family diary entry with Agriculture category in Family workspace', true);

    // Navigate to Members tab & switch to Details sub-tab if needed, open Invite Member modal
    await pageA.tapSelector('nav.bottom-nav button.nav-item:nth-child(4)');
    await pageA.waitFor(() => Boolean(document.body.innerText.match(/Group Details|Invite Member/i)));
    const hasInviteBtnImmediately = await pageA.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some((b) => b.innerText.includes('Invite Member'))
    );
    if (!hasInviteBtnImmediately) {
      await pageA.tapButtonByText('Group Details');
      await pageA.waitFor(() =>
        Array.from(document.querySelectorAll('button')).some((b) => b.innerText.includes('Invite Member'))
      );
    }

    await pageA.tapButtonByText('Invite Member');
    await pageA.waitFor(() => Boolean(document.querySelector('.modal-dialog')));

    // Generate 3 invitations (first is Never-expiring Editor shareable link) to exercise scrolling with Active Invitations
    let shareableInviteUrl = '';
    for (let i = 0; i < 3; i++) {
      const prevInpVal = await pageA.evaluate(() => document.querySelector('.modal-dialog input[readonly]')?.value || '');
      await pageA.evaluate(() => {
        const selects = Array.from(document.querySelectorAll('.modal-dialog select'));
        // selects: [0] relationship, [1] role, [2] expiry
        if (selects[0]) {
          selects[0].value = 'family';
          selects[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (selects[1]) {
          selects[1].value = 'editor';
          selects[1].dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (selects[2]) {
          selects[2].value = 'never';
          selects[2].dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await pageA.tapButtonByText('Generate Invitation');
      await pageA.waitFor((prevVal, expectedCount) => {
        const inp = document.querySelector('.modal-dialog input[readonly]');
        const dialogText = (document.querySelector('.modal-dialog')?.innerText || '').toLowerCase();
        return Boolean(inp && inp.value.includes('?invite=') && inp.value !== prevVal && dialogText.includes(`active invitations (${expectedCount})`));
      }, [prevInpVal, i + 1], 15000);
      if (i === 0) {
        shareableInviteUrl = await pageA.evaluate(() => document.querySelector('.modal-dialog input[readonly]').value);
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    check('Account A generated Never-expiring Editor invite link', shareableInviteUrl.includes('?invite=') && shareableInviteUrl.includes('&ws='));

    // Phase 4C: Verify InviteMemberModal scrolling & zero horizontal overflow at all 4 viewports
    for (const vp of VIEWPORTS) {
      await pageA.setViewport(vp.width, vp.height);
      await new Promise((r) => setTimeout(r, 150));

      const modalMetrics = await pageA.evaluate(() => {
        const dialog = document.querySelector('.modal-dialog');
        const bodyDiv = dialog?.children?.[1]; // Pinned header [0], Scroll body [1], Pinned footer [2]
        const footerDiv = dialog?.children?.[2];
        const footerRect = footerDiv?.getBoundingClientRect();
        const headerRect = dialog?.children?.[0]?.getBoundingClientRect();
        const closeBtn = footerDiv?.querySelector('button');
        const closeRect = closeBtn?.getBoundingClientRect();
        const activeListWrap = Array.from(bodyDiv?.querySelectorAll('div') || []).find((d) =>
          (d.style.maxHeight === '160px' || getComputedStyle(d).maxHeight === '160px')
        );

        const initialTop = bodyDiv.scrollTop;
        bodyDiv.scrollTop = bodyDiv.scrollHeight;
        const bottomScrollTop = bodyDiv.scrollTop;
        bodyDiv.scrollTop = 0;

        return {
          bodyLocked: document.body.style.overflow === 'hidden' && document.documentElement.style.overflow === 'hidden',
          dialogScrollWidth: Math.round(dialog.scrollWidth),
          dialogClientWidth: Math.round(dialog.clientWidth),
          bodyScrollHeight: Math.round(bodyDiv.scrollHeight),
          bodyClientHeight: Math.round(bodyDiv.clientHeight),
          didScrollDown: bottomScrollTop > initialTop,
          maxScrollTop: Math.round(bottomScrollTop),
          headerTop: Math.round(headerRect?.top ?? -1),
          closeBottom: Math.round(closeRect?.bottom ?? 9999),
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          docScrollWidth: document.documentElement.scrollWidth,
          nestedScrollTrapPresent: Boolean(activeListWrap)
        };
      });

      check(`Phase 4C Modal Scroll (${vp.name}): Body & HTML scroll locked`, modalMetrics.bodyLocked);
      check(`Phase 4C Modal Scroll (${vp.name}): No nested 160px Active Invitations scroll trap`, !modalMetrics.nestedScrollTrapPresent);
      check(`Phase 4C Modal Scroll (${vp.name}): Scroll container reaches top->bottom (scrollHeight=${modalMetrics.bodyScrollHeight} > clientHeight=${modalMetrics.bodyClientHeight})`,
        modalMetrics.bodyScrollHeight > modalMetrics.bodyClientHeight && modalMetrics.didScrollDown,
        JSON.stringify(modalMetrics));
      check(`Phase 4C Modal Scroll (${vp.name}): Zero horizontal overflow`,
        modalMetrics.dialogScrollWidth <= modalMetrics.dialogClientWidth + 1 && modalMetrics.docScrollWidth <= modalMetrics.viewportWidth,
        JSON.stringify(modalMetrics));
      check(`Phase 4C Modal Scroll (${vp.name}): Pinned header & Close footer inside viewport`,
        modalMetrics.headerTop >= 0 && modalMetrics.closeBottom <= modalMetrics.viewportHeight,
        JSON.stringify(modalMetrics));
    }

    // Close InviteMemberModal cleanly and assert scroll lock restored
    await pageA.tapSelector('.modal-dialog button[aria-label="Close"]');
    await pageA.waitFor(() => !document.querySelector('.modal-dialog'));
    const scrollRestored = await pageA.evaluate(() => document.body.style.overflow !== 'hidden');
    check('InviteMemberModal restores body overflow on Close', scrollRestored);

    // Keep Account A open on HomeView to observe Real-Time sync when Account B posts
    await pageA.tapSelector('nav.bottom-nav button.nav-item:nth-child(1)');
    await pageA.waitFor(() => Boolean(document.querySelector('.welcome-landscape-banner')));

    // =========================================================================
    // ACCOUNT B (INVITEE): Second Isolated Browser Context Opening Invite URL
    // =========================================================================
    const pageB = await browser.createIsolatedPage({ width: 390, height: 844 });
    const inviteTargetUrl = shareableInviteUrl.replace(/^https?:\/\/[^/]+/, APP_ORIGIN);
    await pageB.goto(inviteTargetUrl);
    await pageB.waitFor(() => Boolean(document.querySelector('.auth-switch-link')));

    await pageB.tapButtonByText('Create an Account');
    await pageB.waitFor(() => document.querySelectorAll('.auth-card input').length >= 4);
    await pageB.fillInput('.auth-card input[type="text"]', 'Priya Family Member');
    await pageB.fillInput('.auth-card input[type="email"]', 'invitee@ninaivo.test');
    await pageB.evaluate(() => {
      const pws = Array.from(document.querySelectorAll('.auth-card input[type="password"]'));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      pws.forEach((p) => {
        setter.call(p, 'InviteePass123!');
        p.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    await pageB.tapButtonByText('Register & Open');

    // Wait for JoinRequestModal to appear after registration + invitation validation
    await pageB.waitFor(() =>
      Boolean(document.body.innerText.includes('Accept & Join Workspace') && document.body.innerText.includes('My Family & Agriculture')),
      [], 25000);
    const joinModalDetails = await pageB.evaluate(() => ({
      hasWorkspace: document.body.innerText.includes('My Family & Agriculture'),
      hasEditorRole: Boolean(document.body.innerText.match(/Editor/i)),
      hasValidStatus: Boolean(document.body.innerText.match(/Valid Invitation/i)),
      hasAcceptBtn: Boolean(document.body.innerText.includes('Accept & Join Workspace'))
    }));
    check('Phase 4B/4D Account B sees JoinRequestModal with Family workspace, Editor role & Valid Invitation',
      joinModalDetails.hasWorkspace && joinModalDetails.hasEditorRole && joinModalDetails.hasValidStatus && joinModalDetails.hasAcceptBtn,
      JSON.stringify(joinModalDetails));

    await pageB.tapButtonByText('Accept & Join Workspace');
    await pageB.waitFor(() =>
      !document.body.innerText.includes('Accept & Join Workspace') &&
      document.body.innerText.includes('Morning Field Harvest'),
      [], 25000);

    check('Phase 4B Account B accepted invitation cleanly & automatically sees shared Family entry "Morning Field Harvest"', true);

    const bSeesOwnerPrivate = await pageB.evaluate(() => document.body.innerText.includes('Owner Private Reflection'));
    check('Phase 4B Privacy: Account B does NOT see Owner A Personal entry', !bSeesOwnerPrivate);

    // BottomNav verification for Account B right after accepting invitation!
    await pageB.setViewport(360, 800);
    await verifyBottomNavAcrossAllTabs(pageB, '360x800', 'Phase 4A Post-Invite-Accept');

    // Account B creates a new diary entry in the shared Family workspace
    await pageB.tapSelector('nav.bottom-nav button.nav-item:nth-child(3)'); // Add (+)
    await pageB.waitFor(() => Boolean(document.querySelector('form input[type="text"]')));
    await pageB.fillInput('form input[type="text"]', 'Evening Milk Collection');
    await pageB.tapButtonByText('Save to Diary');
    await pageB.waitFor(() => document.body.innerText.includes('Evening Milk Collection'), [], 15000);
    check('Account B created new entry in shared Family workspace', true);

    // Verify Account A receives Account B's entry in real time WITHOUT reloading Page A
    const aReceivedRealtime = await pageA.waitFor(
      () => document.body.innerText.includes('Evening Milk Collection'),
      [],
      20000
    ).then(() => true).catch(() => false);
    check('Phase 4B Real-Time Sync: Account A receives Account B entry automatically', aReceivedRealtime);

    // Phase 5 Real-Time Edit Sync: Account B opens DiaryView via Recent Entries -> View All, edits "Evening Milk Collection" -> Account A sees update live
    await pageB.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h3'));
      const recentH3 = headings.find((h) => h.innerText.includes('Recent Entries'));
      const viewAllBtn = recentH3?.parentElement?.parentElement?.querySelector('button');
      if (viewAllBtn) viewAllBtn.click();
    });
    await pageB.waitFor(() => Boolean(document.querySelector('article.diary-card button[aria-label="Edit"]')), [], 15000);
    await pageB.evaluate(() => {
      const card = Array.from(document.querySelectorAll('article.diary-card')).find((c) =>
        c.innerText.includes('Evening Milk Collection')
      );
      const editBtn = card?.querySelector('button[aria-label="Edit"], button[title="Edit"]');
      if (editBtn) editBtn.click();
    });
    await pageB.waitFor(() => Boolean(document.querySelector('.modal-dialog input[type="text"]')));
    await pageB.fillInput('.modal-dialog input[type="text"]', 'Evening Milk Collection (Edited)');
    await pageB.tapButtonByText('Update Entry');
    await pageB.waitFor(() => !document.querySelector('.modal-dialog'), [], 15000);
    const aReceivedEdit = await pageA.waitFor(
      () => document.body.innerText.includes('Evening Milk Collection (Edited)'),
      [],
      20000
    ).then(() => true).catch(() => false);
    check('Phase 5 Real-Time Sync: Account A receives Account B entry edit automatically', aReceivedEdit);

    // Phase 5 Workspace Switch Isolation on Account B: switch to Personal Diary -> no Family leakage
    await pageB.tapSelector('.header-left');
    await pageB.waitFor(() => document.body.innerText.includes('Personal Diary'));
    await pageB.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.compact-ws-row'));
      const pers = rows.find((r) => r.innerText.includes('Personal Diary'));
      if (pers) pers.click();
    });
    await pageB.waitFor(() => !document.querySelector('.modal-overlay'));
    await new Promise((r) => setTimeout(r, 400));
    const personalLeakedFamily = await pageB.evaluate(() => document.body.innerText.includes('Morning Field Harvest'));
    check('Phase 5 Workspace Switch Isolation: Switching Account B to Personal Diary hides shared Family entries', !personalLeakedFamily);

    // Verify Account A's Members view shows Account B joined as Editor
    await pageA.tapSelector('nav.bottom-nav button.nav-item:nth-child(4)');
    const aSeesInviteeMember = await pageA.waitFor(
      () => Boolean(document.body.innerText.includes('Priya Family Member')),
      [],
      15000
    ).then(() => true).catch(() => false);
    check('Phase 4B Real-Time Sync: Account A Members view shows Account B ("Priya Family Member")', aSeesInviteeMember);

    // Context C: Verify Replay attempt of already-used single-use invite fails gracefully
    const pageC = await browser.createIsolatedPage({ width: 390, height: 844 });
    await pageC.goto(inviteTargetUrl);
    await pageC.waitFor(() => Boolean(document.querySelector('.auth-switch-link')));
    await pageC.tapButtonByText('Create an Account');
    await pageC.waitFor(() => document.querySelectorAll('.auth-card input').length >= 4);
    await pageC.fillInput('.auth-card input[type="text"]', 'Third User');
    await pageC.fillInput('.auth-card input[type="email"]', 'third@ninaivo.test');
    await pageC.evaluate(() => {
      const pws = Array.from(document.querySelectorAll('.auth-card input[type="password"]'));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      pws.forEach((p) => {
        setter.call(p, 'ThirdPass123!');
        p.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    await pageC.tapButtonByText('Register & Open');
    await pageC.waitFor(() => Boolean(document.querySelector('nav.bottom-nav')), [], 25000);
    await new Promise((r) => setTimeout(r, 1200));
    const thirdUserJoinedFamily = await pageC.evaluate(() => document.body.innerText.includes('Morning Field Harvest'));
    check('Phase 4B Single-Use Replay: Third user CANNOT join using consumed invite link', !thirdUserJoinedFamily);

    // Zero "Missing or insufficient permissions" errors anywhere during E2E flow!
    check('Zero "Missing or insufficient permissions" console/page/dialog errors during entire E2E flow',
      browser.permissionErrors.length === 0,
      JSON.stringify(browser.permissionErrors));
    } catch (innerErr) {
      try {
        const diag = await pageA.evaluate(() => {
          const hdr = document.querySelector('.header-left');
          const r = hdr ? hdr.getBoundingClientRect() : null;
          const topEl = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
          return {
            hasOverlay: Boolean(document.querySelector('.modal-overlay')),
            overlayText: document.querySelector('.modal-overlay')?.innerText?.slice(0, 300) || null,
            headerRect: r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null,
            topElAtHeaderCenter: topEl ? `${topEl.tagName}.${topEl.className}` : null,
            bodyTextSample: document.body.innerText.slice(0, 500)
          };
        });
        console.error('DIAGNOSTIC PAGE A SNAPSHOT ON ERROR:', JSON.stringify(diag, null, 2));
        console.error('CONSOLE ERRORS:', JSON.stringify(browser.consoleErrors));
        console.error('PAGE ERRORS:', JSON.stringify(browser.pageErrors));
      } catch {}
      throw innerErr;
    }
  } finally {
    if (browser) browser.close();
    if (chromeProc) {
      try { chromeProc.kill(); } catch {}
    }
    if (viteProc) {
      try { viteProc.kill(); } catch {}
    }
    try { fs.rmSync(tempUserData, { recursive: true, force: true }); } catch {}
  }

  console.log('\n================================================================');
  console.log(`TOTAL CHROMIUM E2E ASSERTIONS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal E2E runner error:', err);
  process.exit(1);
});
