import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('pdt_language') || 'en';
  });

  // Listen for language synchronization from user profile restoration
  useEffect(() => {
    const handleSync = (e) => {
      const incomingLang = e.detail?.language;
      if (incomingLang && (incomingLang === 'en' || incomingLang === 'ta') && incomingLang !== language) {
        setLanguageState(incomingLang);
        localStorage.setItem('pdt_language', incomingLang);
      }
    };

    window.addEventListener('ninaivo-sync-language', handleSync);
    return () => window.removeEventListener('ninaivo-sync-language', handleSync);
  }, [language]);

  const setLanguage = (lang) => {
    if (lang !== 'en' && lang !== 'ta') return;
    setLanguageState(lang);
    localStorage.setItem('pdt_language', lang);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ninaivo-language-changed', { detail: { language: lang } }));
    }
  };

  const t = (key) => {
    const langDict = translations[language] || translations.en;
    return langDict[key] || translations.en[key] || key;
  };

  const value = {
    language,
    setLanguage,
    t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
