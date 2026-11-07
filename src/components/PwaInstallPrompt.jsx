import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, Smartphone } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import NinaivoLogo from './NinaivoLogo';

export default function PwaInstallPrompt({ showToast, theme }) {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  useEffect(() => {
    // 1. Listen for PWA beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show install banner only if user hasn't dismissed it in this session
      const dismissed = sessionStorage.getItem('pdt_pwa_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    // 2. Listen for Service Worker update event
    const handleSwUpdate = () => {
      setSwUpdateAvailable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pdt-sw-update', handleSwUpdate);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pdt-sw-update', handleSwUpdate);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast && showToast('App installation started!');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('pdt_pwa_dismissed', 'true');
  };

  const handleReloadUpdate = () => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  return (
    <>
      {/* Service Worker Update Banner */}
      {swUpdateAvailable && (
        <div style={{
          position: 'fixed',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1100,
          background: 'var(--primary)',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '30px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.8rem',
          fontWeight: 600
        }}>
          <span>{t('newVersionAvailable')}</span>
          <button
            type="button"
            onClick={handleReloadUpdate}
            style={{
              background: '#ffffff',
              color: 'var(--primary)',
              border: 'none',
              borderRadius: '20px',
              padding: '3px 10px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={12} /> {t('reload')}
          </button>
        </div>
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && deferredPrompt && (
        <div style={{
          position: 'fixed',
          bottom: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: '420px',
          zIndex: 1050,
          background: 'var(--bg-card)',
          border: '1px solid var(--primary)',
          color: 'var(--text-main)',
          padding: '10px 14px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'fadeIn 200ms ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <NinaivoLogo 
              theme={theme}
              iconSize={32}
              showText={false}
            />
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block' }}>
                {t('installApp')}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {t('pwaInstallDesc')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
              onClick={handleInstallClick}
            >
              {t('install')}
            </button>
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              onClick={handleDismissInstall}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

