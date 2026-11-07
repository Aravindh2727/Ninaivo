import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Clean browser console output: suppress noisy SDK fallbacks, deprecations, and extension notices
if (typeof window !== 'undefined') {
  const origWarn = console.warn;
  console.warn = (...args) => {
    const msg = args.map(a => (typeof a === 'object' && a?.message ? a.message : String(a))).join(' ');
    if (
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('apple-mobile-web-app-capable') ||
      msg.includes('beforeinstallprompt')
    ) {
      return;
    }
    origWarn.apply(console, args);
  };

  const origError = console.error;
  console.error = (...args) => {
    const msg = args.map(a => (typeof a === 'object' && a?.message ? a.message : String(a))).join(' ');
    if (
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('beforeinstallprompt')
    ) {
      return;
    }
    origError.apply(console, args);
  };
}

// URL parameters override for automated UI testing, staging and screenshots
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true') {
      const demoUser = {
        uid: 'demo-user-42',
        email: 'aravindh@example.com',
        displayName: 'Aravindh',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        metadata: {
          creationTime: new Date(Date.now() - 14 * 86400000).toISOString(),
          lastSignInTime: new Date().toISOString()
        }
      };
      localStorage.setItem('pdt_demo_session', JSON.stringify(demoUser));
    }
    if (params.get('theme')) {
      const th = params.get('theme');
      localStorage.setItem('pdt_theme', th);
      document.documentElement.setAttribute('data-theme', th);
    }
    if (params.get('lang')) {
      localStorage.setItem('pdt_language', params.get('lang'));
    }
  } catch (e) {
    console.warn('URL params initialization note:', e);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register PWA Service Worker in browser environments
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('pdt-sw-update', { detail: { registration: reg } }));
            }
          });
        }
      });
    }).catch((err) => {
      console.warn('PWA Service Worker registration warning:', err);
    });
  });
}

