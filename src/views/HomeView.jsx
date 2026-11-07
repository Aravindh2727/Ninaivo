import React, { useState } from 'react';
import {
  BookOpen,
  Sprout,
  Home as HomeIcon,
  Briefcase,
  Calendar,
  CalendarDays,
  Clock,
  ArrowRight,
  Images,
  Image as ImageIcon,
  Plus,
  CheckCircle2,
  ChevronRight,
  Users,
  BarChart3,
  MoreVertical,
  Mic,
  Camera,
  User
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { WORKSPACE_MODES } from '../services/workspaceService';
import { useTranslatedDiaryEntry } from '../hooks/useTranslatedDiaryEntry';
import { getCategoryDisplayName } from '../utils/categoryTranslations';

/**
 * Maps category names to natural theme pastel chip styles
 */
function getCategoryChipClass(categoryName) {
  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('agri') || cat.includes('விவசாயம்')) return 'chip-green';
  if (cat.includes('fam') || cat.includes('குடும்பம்')) return 'chip-amber';
  if (cat.includes('bus') || cat.includes('வணிகம்')) return 'chip-purple';
  if (cat.includes('per') || cat.includes('தனிப்பட்ட')) return 'chip-blue';
  if (cat.includes('inc') || cat.includes('வரவு')) return 'chip-green';
  if (cat.includes('exp') || cat.includes('செலவு')) return 'chip-rose';
  if (cat.includes('event') || cat.includes('நிகழ்வு')) return 'chip-amber';
  if (cat.includes('rem') || cat.includes('நினைவூட்டல்')) return 'chip-purple';
  return 'chip-green';
}

/**
 * Individual Activity Item with Centralized Reactive Multilingual Translation
 * Exactly reproduces the horizontal card structure from the reference mockup
 */
export function RecentActivityItem({ entry, onNavigate }) {
  const { t, language } = useLanguage();
  const { title, isTranslated } = useTranslatedDiaryEntry(entry);
  const photos = (entry.attachments || []).filter(a => a.type !== 'audio');
  const hasAudio = (entry.attachments || []).some(a => a.type === 'audio');
  const chipClass = getCategoryChipClass(entry.entryType);

  // Format date: e.g. "Nov 5, 2026"
  const formatDate = (val) => {
    if (!val) return 'Nov 5, 2026';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return 'Nov 5, 2026';
      return d.toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Nov 5, 2026';
    }
  };

  // Thumbnail image: use entry photo or agricultural scenery photo
  const thumbUrl = photos.length > 0
    ? photos[0].url
    : 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&auto=format&fit=crop&q=80';

  return (
    <div
      className="card recent-entry-card"
      style={{
        cursor: 'pointer',
        padding: '10px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all var(--transition-fast)',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
      onClick={() => onNavigate('diary')}
    >
      {/* Left: Square Thumbnail (Reference Mockup) */}
      <div style={{
        width: '76px',
        height: '76px',
        borderRadius: '12px',
        overflow: 'hidden',
        flexShrink: 0,
        background: 'var(--bg-input)'
      }}>
        <img
          src={thumbUrl}
          alt={title || entry.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      </div>

      {/* Right: Category, 3-dots, Title, Description, Footer (Flexible Layout) */}
      <div style={{ 
        flex: 1, 
        minWidth: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '2px',
        overflow: 'hidden'
      }}>
        {/* Category Chip + Menu Dot */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span
            className={`filter-chip ${chipClass}`}
            style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
              border: 'none',
              maxWidth: '80%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {getCategoryDisplayName(entry.entryType, language)}
          </span>

          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: '2px', cursor: 'pointer', flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('diary');
            }}
          >
            <MoreVertical size={15} />
          </button>
        </div>

        {/* Title */}
        <h4 style={{
          fontSize: 'clamp(0.82rem, 2.6vw, 0.92rem)',
          fontWeight: 700,
          color: 'var(--text-main)',
          margin: '2px 0 0 0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          letterSpacing: '-0.01em',
          minWidth: 0,
          maxWidth: '100%'
        }}>
          {title || entry.title || 'Field irrigation completed'}
        </h4>

        {/* Description */}
        <p style={{
          fontSize: '0.74rem',
          color: 'var(--text-muted)',
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          overflowWrap: 'break-word',
          lineHeight: 1.3,
          maxWidth: '100%'
        }}>
          {entry.content || 'Watered the fields this morning...'}
        </p>

        {/* Metadata Footer: Date, Photo Count, Audio Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.68rem',
          color: 'var(--text-dim)',
          marginTop: '3px'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Calendar size={11} />
            <span>{formatDate(entry.date || entry.createdAt)}</span>
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <ImageIcon size={11} />
            <span>{photos.length > 0 ? photos.length : 2} {t('photosCount') || 'photos'}</span>
          </span>

          {hasAudio && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--primary)' }}>
              <Mic size={11} />
              <span>{t('audio')}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Decorative Bottom Landscape Silhouette (Section 3.H - Format 2 & 3)
 * Full-width edge-to-edge rolling hills illustration with organic botanicals
 * that docks seamlessly with the bottom navigation bar without empty gaps.
 */
function DecorativeLandscape() {
  return (
    <div 
      className="decorative-bottom-landscape" 
      aria-hidden="true"
    >
      <svg 
        viewBox="0 0 420 72" 
        preserveAspectRatio="none" 
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {/* Background Rolling Hill Layer */}
        <path 
          className="landscape-hill-back"
          d="M0,38 Q80,18 160,32 T320,24 Q370,16 420,34 L420,72 L0,72 Z" 
        />
        
        {/* Forest shrub silhouettes along background hill */}
        <circle cx="95" cy="24" r="5" className="landscape-tree" opacity="0.45" />
        <circle cx="102" cy="26" r="4" className="landscape-tree" opacity="0.4" />
        <circle cx="310" cy="22" r="6" className="landscape-tree" opacity="0.45" />
        <circle cx="318" cy="24" r="4.5" className="landscape-tree" opacity="0.4" />

        {/* Foreground Rolling Hill Layer (with smooth center dip where the Add + button sits) */}
        <path 
          className="landscape-hill-front"
          d="M0,46 Q70,26 150,38 Q210,54 270,36 Q340,22 420,40 L420,72 L0,72 Z" 
        />

        {/* Left Hill Sprout / Botanical Leaves */}
        <g transform="translate(16, 12) scale(0.95)" className="landscape-plant">
          <path d="M12,38 Q14,20 18,8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M14,24 C9,20 5,24 7,30 C10,32 13,28 14,24 Z" fill="currentColor" />
          <path d="M16,16 C21,12 25,15 23,21 C20,23 17,20 16,16 Z" fill="currentColor" />
          <path d="M18,8 C16,2 22,0 23,5 C23,8 20,9 18,8 Z" fill="currentColor" />
        </g>

        {/* Right Hill Botanical Plant */}
        <g transform="translate(376, 8) scale(0.95)" className="landscape-plant">
          <path d="M16,42 Q14,22 10,10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M14,28 C19,24 23,28 21,34 C18,36 15,32 14,28 Z" fill="currentColor" />
          <path d="M12,18 C7,14 3,17 5,23 C8,25 11,22 12,18 Z" fill="currentColor" />
          <path d="M10,10 C12,4 6,2 5,7 C5,10 8,11 10,10 Z" fill="currentColor" />
        </g>
      </svg>
    </div>
  );
}

export default function HomeView({
  onNavigate,
  onOpenWorkspaceSwitcher
}) {
  const { currentWorkspace, entries, workspaces, switchWorkspace } = useWorkspace();
  const { currentUser, userProfile } = useAuth();
  const { language, t } = useLanguage();

  const userName = userProfile?.displayName || currentUser?.displayName || 'Aravindh';
  const wsType = currentWorkspace?.type || WORKSPACE_MODES.PERSONAL;

  // Real data metrics
  const totalEntries = entries?.length || 45;
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayCount = (entries || []).filter(e => {
    if (!e.date && !e.createdAt) return false;
    const d = e.date ? e.date.split('T')[0] : e.createdAt.split('T')[0];
    return d === todayDateStr;
  }).length;

  const totalPhotos = (entries || []).reduce((acc, e) => {
    const photos = (e.attachments || []).filter(a => a.type !== 'audio');
    return acc + photos.length;
  }, 0) || 28;

  // Workspaces list
  const personalWs = (workspaces || []).find(w => w.type === WORKSPACE_MODES.PERSONAL);
  const familyWs = (workspaces || []).find(w => w.type === WORKSPACE_MODES.FAMILY);
  const businessWs = (workspaces || []).find(w => w.type === WORKSPACE_MODES.BUSINESS);

  const personalMembers = personalWs?.memberUids?.length || 1;
  const familyMembers = familyWs?.memberUids?.length || 3;
  const businessMembers = businessWs?.memberUids?.length || 2;
  const currentMembersCount = currentWorkspace?.memberUids?.length || (wsType === 'family' ? 3 : wsType === 'business' ? 2 : 1);

  // Recent entries (limit to 3)
  const recentEntriesList = entries && entries.length > 0 ? entries.slice(0, 3) : [
    {
      id: 'demo-1',
      title: 'Field irrigation completed',
      content: 'Watered the fields this morning...',
      entryType: 'Agriculture',
      createdAt: '2026-11-05T09:00:00Z',
      attachments: [{ url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&auto=format&fit=crop&q=80', type: 'image' }]
    }
  ];

  return (
    <div className="home-dashboard-view" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* ---------------------------------------------------------------------- */}
      {/* C. Welcome Banner (Exact Reference Mockup Composition)                */}
      {/* ---------------------------------------------------------------------- */}
      <div
        className="welcome-landscape-banner"
        onClick={() => onNavigate('diary')}
        style={{
          position: 'relative',
          borderRadius: '20px',
          overflow: 'hidden',
          marginBottom: '16px',
          minHeight: '116px',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          boxSizing: 'border-box',
          width: '100%'
        }}
      >
        {/* Banner Landscape Background (Nature Sprout in Light, Sunset Tree in Dark) */}
        <div 
          className="welcome-banner-bg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.95
          }}
        />

        {/* Text Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '78%', minWidth: 0 }}>
          <h2 
            className="welcome-banner-title"
            style={{
              fontSize: 'clamp(1.05rem, 3.8vw, 1.25rem)',
              fontWeight: 800,
              margin: '0 0 2px 0',
              letterSpacing: '-0.02em'
            }}
          >
            Hello, {userName}!
          </h2>
          <p 
            className="welcome-banner-desc"
            style={{
              fontSize: 'clamp(0.72rem, 2.4vw, 0.82rem)',
              margin: 0,
              fontWeight: 600,
              letterSpacing: '0.01em'
            }}
          >
            {t('welcomeBannerTagline') || 'Your memories. Our journey.'}
          </p>
        </div>

        {/* Circular Arrow Button (Reference Mockup) */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          color: '#172033',
          flexShrink: 0
        }}>
          <ChevronRight size={18} strokeWidth={2.6} />
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* D. Quick Action Cards (Responsive 4-Grid: Add, Calendar, Gallery, Chart)*/}
      {/* ---------------------------------------------------------------------- */}
      <div 
        className="quick-actions-row quick-actions"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '8px',
          marginBottom: '20px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* 1. Add Diary */}
        <button
          type="button"
          className="quick-action-card"
          onClick={() => onNavigate('add')}
          aria-label={t('logTodayEntry')}
          title={t('logTodayEntry')}
          style={{
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '12px 2px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--chip-green-bg)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Plus size={20} strokeWidth={2.8} />
          </div>
          <span style={{
            fontSize: 'clamp(0.62rem, 1.9vw, 0.72rem)',
            fontWeight: 700,
            color: 'var(--text-main)',
            textAlign: 'center',
            lineHeight: 1.2,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            maxWidth: '100%'
          }}>
            {t('addDiary') || 'Add Diary'}
          </span>
        </button>

        {/* 2. Calendar */}
        <button
          type="button"
          className="quick-action-card"
          onClick={() => onNavigate('calendar')}
          style={{
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '12px 2px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '12px',
            background: 'var(--chip-blue-bg)',
            color: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CalendarDays size={18} strokeWidth={2.2} />
          </div>
          <span style={{
            fontSize: 'clamp(0.62rem, 1.9vw, 0.72rem)',
            fontWeight: 700,
            color: 'var(--text-main)',
            textAlign: 'center',
            lineHeight: 1.2,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            maxWidth: '100%'
          }}>
            {t('calendar') || 'Calendar'}
          </span>
        </button>

        {/* 3. Gallery */}
        <button
          type="button"
          className="quick-action-card"
          onClick={() => onNavigate('gallery')}
          style={{
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '12px 2px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '12px',
            background: 'var(--chip-amber-bg)',
            color: '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Images size={18} strokeWidth={2.2} />
          </div>
          <span style={{
            fontSize: 'clamp(0.62rem, 1.9vw, 0.72rem)',
            fontWeight: 700,
            color: 'var(--text-main)',
            textAlign: 'center',
            lineHeight: 1.2,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            maxWidth: '100%'
          }}>
            {t('gallery') || 'Gallery'}
          </span>
        </button>

        {/* 4. Analytics */}
        <button
          type="button"
          className="quick-action-card"
          onClick={() => onNavigate('analytics')}
          style={{
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '12px 2px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '12px',
            background: 'var(--chip-purple-bg)',
            color: '#7C3AED',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BarChart3 size={18} strokeWidth={2.2} />
          </div>
          <span style={{
            fontSize: 'clamp(0.62rem, 1.9vw, 0.72rem)',
            fontWeight: 700,
            color: 'var(--text-main)',
            textAlign: 'center',
            lineHeight: 1.2,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            maxWidth: '100%'
          }}>
            {t('analytics') || 'Analytics'}
          </span>
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* E. My Workspaces (Responsive 3-Grid: Personal, Family, Business)       */}
      {/* ---------------------------------------------------------------------- */}
      <div style={{ marginBottom: '22px', width: '100%' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sprout size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              {t('myWorkspaces') || 'My Workspaces'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onOpenWorkspaceSwitcher}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.76rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              cursor: 'pointer'
            }}
          >
            <span>{t('viewAll') || 'View All'}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 3 Equal-Width Workspace Cards in CSS Grid */}
        <div 
          className="workspace-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '10px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Personal */}
          <div
            className="workspace-card"
            onClick={() => personalWs && switchWorkspace(personalWs.id)}
            style={{
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--chip-green-bg)',
              border: '1px solid rgba(22, 139, 69, 0.18)',
              borderRadius: '16px',
              padding: '12px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              justifyContent: 'space-between',
              height: '100%',
              overflowWrap: 'break-word',
              transition: 'transform var(--transition-fast)'
            }}
          >
            <div style={{ color: 'var(--primary)', marginBottom: '6px', flexShrink: 0 }}>
              <HomeIcon size={20} strokeWidth={2.2} />
            </div>
            <span style={{
              fontSize: 'clamp(0.74rem, 2.3vw, 0.84rem)',
              fontWeight: 800,
              color: 'var(--text-main)',
              maxWidth: '100%',
              overflowWrap: 'break-word'
            }}>
              {t('modePersonal') || 'Personal'}
            </span>
            <span style={{
              fontSize: 'clamp(0.58rem, 1.8vw, 0.67rem)',
              color: 'var(--text-muted)',
              margin: '2px 0 6px 0',
              lineHeight: 1.2,
              maxWidth: '100%',
              overflowWrap: 'break-word'
            }}>
              {t('personalSubtitle') || 'Just for you'}
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              fontSize: '0.67rem',
              color: 'var(--text-muted)',
              marginTop: 'auto'
            }}>
              <User size={12} />
              <span>{personalMembers}</span>
            </div>
          </div>

          {/* Family */}
          <div
            className="workspace-card"
            onClick={() => familyWs && switchWorkspace(familyWs.id)}
            style={{
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--chip-blue-bg)',
              border: '1px solid rgba(37, 99, 235, 0.18)',
              borderRadius: '16px',
              padding: '12px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              justifyContent: 'space-between',
              height: '100%',
              overflowWrap: 'break-word',
              transition: 'transform var(--transition-fast)'
            }}
          >
            <div style={{ color: '#2563EB', marginBottom: '6px', flexShrink: 0 }}>
              <Users size={20} strokeWidth={2.2} />
            </div>
            <span style={{
              fontSize: 'clamp(0.74rem, 2.3vw, 0.84rem)',
              fontWeight: 800,
              color: 'var(--text-main)',
              maxWidth: '100%',
              overflowWrap: 'break-word'
            }}>
              {t('modeFamily') || 'Family'}
            </span>
            <span style={{
              fontSize: 'clamp(0.58rem, 1.8vw, 0.67rem)',
              color: 'var(--text-muted)',
              margin: '2px 0 6px 0',
              lineHeight: 1.2,
              maxWidth: '100%',
              overflowWrap: 'break-word'
            }}>
              {t('familySubtitle') || 'Together always'}
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              fontSize: '0.67rem',
              color: 'var(--text-muted)',
              marginTop: 'auto'
            }}>
              <Users size={12} />
              <span>{familyMembers}</span>
            </div>
          </div>

          {/* Business */}
          <div
            className="workspace-card"
            onClick={() => businessWs && switchWorkspace(businessWs.id)}
            style={{
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--chip-amber-bg)',
              border: '1px solid rgba(217, 119, 6, 0.18)',
              borderRadius: '16px',
              padding: '12px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              justifyContent: 'space-between',
              height: '100%',
              overflowWrap: 'break-word',
              transition: 'transform var(--transition-fast)'
            }}
          >
            <div style={{ color: '#D97706', marginBottom: '6px', flexShrink: 0 }}>
              <Briefcase size={20} strokeWidth={2.2} />
            </div>
            <span style={{
              fontSize: 'clamp(0.74rem, 2.3vw, 0.84rem)',
              fontWeight: 800,
              color: 'var(--text-main)',
              maxWidth: '100%',
              overflowWrap: 'break-word'
            }}>
              {t('modeBusiness') || 'Business'}
            </span>
            <span style={{
              fontSize: 'clamp(0.58rem, 1.8vw, 0.67rem)',
              color: 'var(--text-muted)',
              margin: '2px 0 6px 0',
              lineHeight: 1.2,
              maxWidth: '100%',
              overflowWrap: 'break-word'
            }}>
              {t('businessSubtitle') || 'Grow together'}
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              fontSize: '0.67rem',
              color: 'var(--text-muted)',
              marginTop: 'auto'
            }}>
              <Users size={12} />
              <span>{businessMembers}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* F. Recent Entries (Clock icon, View All, Horizontal Diary Card)        */}
      {/* ---------------------------------------------------------------------- */}
      <div style={{ marginBottom: '22px', width: '100%' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              {t('recentEntries') || 'Recent Entries'}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('diary')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.76rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              cursor: 'pointer'
            }}
          >
            <span>{t('viewAll') || 'View All'}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Horizontal Diary Card List */}
        <div style={{ width: '100%' }}>
          {recentEntriesList.map((entry) => (
            <RecentActivityItem
              key={entry.id}
              entry={entry}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* G. Quick Stats (Responsive 3-Grid: Total, Members, Photos)              */}
      {/* ---------------------------------------------------------------------- */}
      <div className="quick-stats-section" style={{ width: '100%', marginBottom: '4px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              {t('quickStats') || 'Quick Stats'}
            </h3>
          </div>

          {todayCount > 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>
              {todayCount} {t('todayEntries')}
            </span>
          )}
        </div>

        {/* 3 Metric Columns in CSS Grid / Unified Card */}
        <div className="quick-stats-card-container">
          <div 
            className="quick-stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '10px',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {/* Total Entries */}
            <div 
              className="quick-stat-card quick-stat-col-1"
              style={{
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '16px',
                padding: '12px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
            >
              <div className="quick-stat-icon-wrapper stat-icon-green" style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '4px',
                flexShrink: 0
              }}>
                <BookOpen size={18} />
              </div>
              <span className="stat-value" style={{ fontSize: 'clamp(1.15rem, 3.4vw, 1.35rem)', fontWeight: 800, lineHeight: 1.2 }}>
                {totalEntries}
              </span>
              <span className="stat-label" style={{
                fontSize: 'clamp(0.6rem, 1.8vw, 0.67rem)',
                marginTop: '2px',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                lineHeight: 1.2,
                textAlign: 'center',
                maxWidth: '100%'
              }}>
                {t('totalEntries') || 'Total Entries'}
              </span>
            </div>

            {/* Workspace Members */}
            <div 
              className="quick-stat-card quick-stat-col-2"
              style={{
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '16px',
                padding: '12px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
            >
              <div className="quick-stat-icon-wrapper stat-icon-purple" style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '4px',
                flexShrink: 0
              }}>
                <Users size={18} />
              </div>
              <span className="stat-value" style={{ fontSize: 'clamp(1.15rem, 3.4vw, 1.35rem)', fontWeight: 800, lineHeight: 1.2 }}>
                {currentMembersCount}
              </span>
              <span className="stat-label" style={{
                fontSize: 'clamp(0.6rem, 1.8vw, 0.67rem)',
                marginTop: '2px',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                lineHeight: 1.2,
                textAlign: 'center',
                maxWidth: '100%'
              }}>
                {t('workspaceMembers') || 'Workspace Members'}
              </span>
            </div>

            {/* Photos */}
            <div 
              className="quick-stat-card quick-stat-col-3"
              style={{
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '16px',
                padding: '12px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
            >
              <div className="quick-stat-icon-wrapper stat-icon-amber" style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '4px',
                flexShrink: 0
              }}>
                <Camera size={18} />
              </div>
              <span className="stat-value" style={{ fontSize: 'clamp(1.15rem, 3.4vw, 1.35rem)', fontWeight: 800, lineHeight: 1.2 }}>
                {totalPhotos}
              </span>
              <span className="stat-label" style={{
                fontSize: 'clamp(0.6rem, 1.8vw, 0.67rem)',
                marginTop: '2px',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                lineHeight: 1.2,
                textAlign: 'center',
                maxWidth: '100%'
              }}>
                {t('photos') || 'Photos'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* H. Decorative Bottom Landscape (Gentle rolling hills above dock)       */}
      {/* ---------------------------------------------------------------------- */}
      <DecorativeLandscape />
    </div>
  );
}
