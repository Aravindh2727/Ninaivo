import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

/**
 * NinaivoLogo — Official Shared Branding Component
 * 
 * Renders the official Ninaivo N symbol from supplied assets with dynamic theme-based switching:
 * - Nature Fresh (Light Theme): uses /icons/ninaivo_app_icon_light.png with dark green brand text
 * - Forest Night (Dark Theme): uses /icons/ninaivo_app_icon_dark.png with light crisp brand text
 * 
 * Supports horizontal and vertical layouts, custom icon sizing, optional tagline, and localized branding.
 */
export default function NinaivoLogo({
  theme: themeProp,
  iconSize = 34,
  showText = true,
  showTagline = false,
  layout = 'horizontal', // 'horizontal' | 'vertical'
  taglineText,
  titleText,
  className = '',
  style = {}
}) {
  const { t } = useLanguage();

  // Dynamic Theme Detection (props -> DOM attribute -> localStorage -> default 'light')
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (themeProp) return themeProp;
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr) return attr;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('ninaivo_theme') || localStorage.getItem('pdt_theme') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (themeProp) {
      setCurrentTheme(themeProp);
      return;
    }

    // Observe documentElement data-theme attribute mutations for instant theme switching
    if (typeof document !== 'undefined') {
      const observer = new MutationObserver(() => {
        const attr = document.documentElement.getAttribute('data-theme');
        if (attr && (attr === 'light' || attr === 'dark')) {
          setCurrentTheme(attr);
        }
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      });

      return () => observer.disconnect();
    }
  }, [themeProp]);

  const isLight = currentTheme === 'light';
  const iconSrc = isLight 
    ? '/icons/ninaivo_app_icon_light.png' 
    : '/icons/ninaivo_app_icon_dark.png';

  const brandTitle = titleText || t('appTitle') || 'Ninaivo';
  const brandTagline = taglineText || (showTagline ? (t('appSubtitleTagline') || 'Your Life • Your Memories • Your Story') : null);

  const isVertical = layout === 'vertical';

  return (
    <div 
      className={`ninaivo-logo ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: isVertical ? 'center' : 'center',
        justifyContent: isVertical ? 'center' : 'flex-start',
        gap: isVertical ? '8px' : '8px',
        minWidth: 0,
        ...style
      }}
    >
      {/* Official Ninaivo Symbol */}
      <img
        src={iconSrc}
        alt="Ninaivo"
        width={iconSize}
        height={iconSize}
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          borderRadius: iconSize >= 48 ? '14px' : '9px',
          objectFit: 'contain',
          aspectRatio: '1 / 1',
          flexShrink: 0,
          boxShadow: isLight 
            ? '0 2px 8px rgba(20, 83, 45, 0.12)' 
            : '0 2px 8px rgba(0, 0, 0, 0.35)',
          transition: 'all 200ms ease'
        }}
      />

      {/* Brand Text & Tagline */}
      {showText && (
        <div 
          className="brand-meta"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isVertical ? 'center' : 'flex-start',
            textAlign: isVertical ? 'center' : 'left',
            minWidth: 0,
            overflow: 'hidden'
          }}
        >
          <span 
            className="ninaivo-title"
            style={{
              fontSize: iconSize >= 48 
                ? '1.25rem' 
                : 'clamp(0.84rem, 3.2vw, 0.98rem)',
              fontWeight: 800,
              color: 'var(--text-main)',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0
            }}
          >
            {brandTitle}
          </span>

          {showTagline && brandTagline && (
            <span 
              className="ninaivo-tagline"
              style={{
                fontSize: iconSize >= 48 
                  ? '0.74rem' 
                  : 'clamp(0.58rem, 2vw, 0.66rem)',
                color: 'var(--text-muted)',
                fontWeight: 500,
                marginTop: '2px',
                letterSpacing: '0.01em',
                whiteSpace: isVertical ? 'normal' : 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                maxWidth: isVertical ? '260px' : 'none'
              }}
            >
              {brandTagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

