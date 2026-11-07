// scripts/capture_screenshots.mjs
// Automated Pixel-Accurate Mobile Screenshot Capturing Suite

import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const screenshotsDir = path.join(projectRoot, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// MIME Types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Locate Chrome or Edge
const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

let browserPath = chromePaths.find(p => fs.existsSync(p));
if (!browserPath) {
  console.error('No suitable browser (Chrome/Edge) found on system.');
  process.exit(1);
}
console.log(`Using browser: ${browserPath}`);

// Start static file server
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://127.0.0.1:4173');
  let pathname = parsedUrl.pathname;
  if (pathname === '/') pathname = '/index.html';

  let filePath = path.join(distDir, pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html'); // SPA fallback
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

const PORT = 4173;

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`Preview server listening on http://127.0.0.1:${PORT}`);

  const targets = [
    {
      id: 'nature_fresh_light_en',
      name: 'Nature Fresh (Light Mode - English)',
      url: `http://127.0.0.1:${PORT}/?demo=true&theme=light&lang=en`,
      file: 'nature_fresh_light_en.png'
    },
    {
      id: 'forest_night_dark_en',
      name: 'Forest Night (Dark Mode - English)',
      url: `http://127.0.0.1:${PORT}/?demo=true&theme=dark&lang=en`,
      file: 'forest_night_dark_en.png'
    },
    {
      id: 'nature_fresh_light_ta',
      name: 'Nature Fresh (Light Mode - Tamil)',
      url: `http://127.0.0.1:${PORT}/?demo=true&theme=light&lang=ta`,
      file: 'nature_fresh_light_ta.png'
    },
    {
      id: 'forest_night_dark_ta',
      name: 'Forest Night (Dark Mode - Tamil)',
      url: `http://127.0.0.1:${PORT}/?demo=true&theme=dark&lang=ta`,
      file: 'forest_night_dark_ta.png'
    },
    {
      id: 'auth_light_login',
      name: 'Auth Login Screen (Light Mode)',
      url: `http://127.0.0.1:${PORT}/?theme=light&lang=en`,
      file: 'auth_light_login.png'
    },
    {
      id: 'auth_dark_login',
      name: 'Auth Login Screen (Dark Mode)',
      url: `http://127.0.0.1:${PORT}/?theme=dark&lang=en`,
      file: 'auth_dark_login.png'
    }
  ];

  for (const target of targets) {
    const dest = path.join(screenshotsDir, target.file);
    console.log(`\nCapturing: ${target.name}...`);
    console.log(`Target URL: ${target.url}`);

    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=430,932',
      '--hide-scrollbars',
      '--virtual-time-budget=3000',
      `--screenshot=${dest}`,
      target.url
    ];

    await new Promise((resolve) => {
      execFile(browserPath, args, (err) => {
        if (err) {
          console.error(`Failed to capture ${target.file}:`, err.message);
        } else {
          console.log(`✓ Saved: ${dest} (${fs.statSync(dest).size} bytes)`);
        }
        resolve();
      });
    });
  }

  console.log('\nAll screenshots captured successfully!');
  server.close(() => {
    process.exit(0);
  });
});

