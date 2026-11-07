import React, { useState, useEffect, Suspense, lazy } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import HomeView from './views/HomeView';
import DiaryView from './views/DiaryView';
import AddEntryView from './views/AddEntryView';
import LoginView from './views/LoginView';
import RegisterView from './views/RegisterView';
import ForgotPasswordView from './views/ForgotPasswordView';
import LogoutConfirmModal from './components/LogoutConfirmModal';
import DeleteAccountModal from './components/DeleteAccountModal';
import WorkspaceSwitcherModal from './components/WorkspaceSwitcherModal';
import NotificationsModal from './components/NotificationsModal';
import JoinRequestModal from './components/JoinRequestModal';
import ErrorBoundary from './components/ErrorBoundary';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import SyncStatusModal from './components/SyncStatusModal';
import NinaivoLogo from './components/NinaivoLogo';

// Code Splitting & Lazy Loaded Views for Performance Optimization
const CalendarView = lazy(() => import('./views/CalendarView'));
const AnalyticsView = lazy(() => import('./views/AnalyticsView'));
const PhotoGalleryView = lazy(() => import('./views/PhotoGalleryView'));
const WorkspacesView = lazy(() => import('./views/WorkspacesView'));
const MembersView = lazy(() => import('./views/MembersView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const BackupRestoreView = lazy(() => import('./views/BackupRestoreView'));
const ExportModal = lazy(() => import('./components/ExportModal'));

import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { CheckCircle2, BookOpen } from 'lucide-react';

function ViewFallback() {
  const { t } = useLanguage();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '35vh', gap: '12px' }}>
      <div className="spinner-sm" style={{ width: '28px', height: '28px', borderTopColor: 'var(--primary)' }} />
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('loadingView')}</span>
    </div>
  );
}

function AppContent() {
  const { currentUser, userProfile, loading: authLoading, logout, deleteAccount } = useAuth();
  const { 
    currentWorkspace, 
    workspaces, 
    entries, 
    categories,
    incomingInviteData 
  } = useWorkspace();
  const { t } = useLanguage();

  // Auth screen state (for unauthenticated visitors)
  const [authView, setAuthView] = useState('login'); // 'login' | 'register' | 'forgot_password'

  // Demo session state for instant local testing if no network or prior to signup
  const [demoUserSession, setDemoUserSession] = useState(() => {
    const saved = localStorage.getItem('pdt_demo_session');
    return saved ? JSON.parse(saved) : null;
  });

  const effectiveUser = currentUser || demoUserSession;

  // Theme state (Dark / Light) - Default to 'light' (Nature Fresh)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ninaivo_theme') || localStorage.getItem('pdt_theme') || 'light';
  });

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'diary' | 'calendar' | 'analytics' | 'gallery' | 'add' | 'members' | 'workspaces' | 'settings' | 'profile'

  // Modals
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Centralized Header Panel State (mutual exclusivity: null | 'notifications' | 'network')
  const [activePanel, setActivePanel] = useState(null);

  const handleTogglePanel = (panelName) => {
    setActivePanel((prev) => (prev === panelName ? null : panelName));
  };

  const handleClosePanel = () => {
    setActivePanel(null);
  };

  // Auto-open JoinRequestModal if URL invite link is detected
  useEffect(() => {
    if (incomingInviteData) {
      setShowJoinModal(true);
    }
  }, [incomingInviteData]);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Sync theme attribute to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ninaivo_theme', theme);
    localStorage.setItem('pdt_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      showToast(next === 'dark' ? 'Forest Night (Dark Mode)' : 'Nature Fresh (Light Mode)');
      return next;
    });
  };

  // Enable demo mode session
  const handleExploreDemo = () => {
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
    setDemoUserSession(demoUser);
    localStorage.setItem('pdt_demo_session', JSON.stringify(demoUser));
    showToast('Logged into Workspace in Demo Mode!');
  };

  // Handle Logout Confirmation
  const handleConfirmLogout = async () => {
    try {
      if (currentUser) {
        await logout();
      }
      setDemoUserSession(null);
      localStorage.removeItem('pdt_demo_session');
      setShowLogoutModal(false);
      setActiveTab('home');
      showToast('Signed out successfully.');
    } catch (err) {
      showToast('Error signing out: ' + err.message);
    }
  };

  // Handle Account Deletion
  const handleConfirmDeleteAccount = async (currentPassword) => {
    if (currentUser) {
      await deleteAccount(currentPassword);
    }
    setDemoUserSession(null);
    localStorage.removeItem('pdt_demo_session');
    setShowDeleteModal(false);
    setActiveTab('home');
    showToast('Your account and profile have been removed.');
  };

  const handleResetData = () => {
    if (window.confirm('Reset all tracker workspaces and diary entries to default initial state?')) {
      const uid = effectiveUser?.uid || 'demo-user-42';
      localStorage.removeItem(`pdt_workspaces_${uid}`);
      localStorage.removeItem(`pdt_last_active_ws_${uid}`);
      localStorage.removeItem('pdt_project');
      localStorage.removeItem('pdt_members');
      localStorage.removeItem('pdt_entries');
      showToast('Workspaces reset to defaults.');
      window.location.reload();
    }
  };

  const handleExportData = () => {
    const exportBundle = {
      user: {
        uid: effectiveUser?.uid,
        email: effectiveUser?.email,
        displayName: userProfile?.displayName || effectiveUser?.displayName
      },
      currentWorkspace,
      workspaces,
      entries,
      categories,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ninaivo-backup-${currentWorkspace?.name ? currentWorkspace.name.toLowerCase().replace(/\s+/g, '-') : 'all'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported Ninaivo backup JSON!');
  };

  // Loading Screen while Firebase Auth initializes
  if (authLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <NinaivoLogo 
              theme={theme}
              iconSize={60} 
              showText={true} 
              showTagline={true} 
              layout="vertical"
              taglineText={t('tagline') || 'Your Life. Your Memories. Your Story.'}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '12px' }}>
            <div className="spinner-sm" style={{ borderTopColor: 'var(--primary)' }} />
            <span>{t('connectingWorkspace')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated Route Guard: Show Auth Views
  if (!effectiveUser) {
    return (
      <div className="app-container">
        {toastMessage && (
          <div className="toast-notice">
            <CheckCircle2 size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span>{toastMessage}</span>
          </div>
        )}

        {authView === 'login' && (
          <LoginView
            theme={theme}
            onSwitchToRegister={() => setAuthView('register')}
            onSwitchToForgotPassword={() => setAuthView('forgot_password')}
            onExploreDemo={handleExploreDemo}
          />
        )}

        {authView === 'register' && (
          <RegisterView
            theme={theme}
            onSwitchToLogin={() => setAuthView('login')}
            onExploreDemo={handleExploreDemo}
          />
        )}

        {authView === 'forgot_password' && (
          <ForgotPasswordView
            theme={theme}
            onSwitchToLogin={() => setAuthView('login')}
          />
        )}
      </div>
    );
  }

  // Authenticated Protected Views
  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-notice">
          <CheckCircle2 size={16} style={{ color: 'var(--accent-emerald)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Workspace Switcher, Language & Notifications */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        activePanel={activePanel}
        onClosePanel={handleClosePanel}
        onTogglePanel={handleTogglePanel}
        onOpenWorkspaceSwitcher={() => {
          handleClosePanel();
          setShowWorkspaceSwitcher(true);
        }}
        onOpenNotifications={() => handleTogglePanel('notifications')}
      />

      {/* Main Content Body */}
      <main className={`app-content ${activeTab === 'home' ? 'home-view-active' : ''}`}>
        {activeTab === 'home' && (
          <HomeView
            onNavigate={(tab) => {
              handleClosePanel();
              setActiveTab(tab);
            }}
            onOpenWorkspaceSwitcher={() => {
              handleClosePanel();
              setShowWorkspaceSwitcher(true);
            }}
            onOpenExportModal={() => {
              handleClosePanel();
              setShowExportModal(true);
            }}
          />
        )}

        {activeTab === 'diary' && (
          <DiaryView
            onNavigate={(tab) => setActiveTab(tab)}
            showToast={showToast}
          />
        )}

        {activeTab === 'calendar' && (
          <Suspense fallback={<ViewFallback />}>
            <CalendarView
              onNavigate={(tab) => setActiveTab(tab)}
              onBack={() => setActiveTab('home')}
            />
          </Suspense>
        )}

        {activeTab === 'analytics' && (
          <Suspense fallback={<ViewFallback />}>
            <AnalyticsView
              onNavigate={(tab) => setActiveTab(tab)}
              onBack={() => setActiveTab('home')}
            />
          </Suspense>
        )}

        {activeTab === 'gallery' && (
          <Suspense fallback={<ViewFallback />}>
            <PhotoGalleryView
              onBack={() => setActiveTab('home')}
            />
          </Suspense>
        )}

        {activeTab === 'add' && (
          <AddEntryView
            onDone={() => setActiveTab('diary')}
            showToast={showToast}
          />
        )}

        {activeTab === 'members' && (
          <Suspense fallback={<ViewFallback />}>
            <MembersView
              onOpenWorkspaceSwitcher={() => setShowWorkspaceSwitcher(true)}
              showToast={showToast}
            />
          </Suspense>
        )}

        {activeTab === 'workspaces' && (
          <Suspense fallback={<ViewFallback />}>
            <WorkspacesView
              showToast={showToast}
            />
          </Suspense>
        )}

        {activeTab === 'settings' && (
          <Suspense fallback={<ViewFallback />}>
            <SettingsView
              theme={theme}
              onToggleTheme={toggleTheme}
              onResetData={handleResetData}
              onExportData={handleExportData}
              onOpenExportModal={() => setShowExportModal(true)}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenProfile={() => setActiveTab('profile')}
              onTriggerLogout={() => setShowLogoutModal(true)}
              onOpenWorkspaceSwitcher={() => setShowWorkspaceSwitcher(true)}
              onOpenSyncStatus={() => handleTogglePanel('network')}
            />
          </Suspense>
        )}

        {activeTab === 'profile' && (
          <Suspense fallback={<ViewFallback />}>
            <ProfileView
              onBack={() => setActiveTab('settings')}
              onTriggerLogout={() => setShowLogoutModal(true)}
              onTriggerDeleteAccount={() => setShowDeleteModal(true)}
              showToast={showToast}
            />
          </Suspense>
        )}

        {activeTab === 'backup_restore' && (
          <Suspense fallback={<ViewFallback />}>
            <BackupRestoreView
              onBack={() => setActiveTab('settings')}
              showToast={showToast}
            />
          </Suspense>
        )}
      </main>

      {/* Bottom Navigation Only — Strict Zero Side Drawer */}
      <BottomNav
        activeTab={
          ['analytics', 'gallery', 'diary'].includes(activeTab) 
            ? 'home' 
            : ['profile', 'backup_restore'].includes(activeTab) 
            ? 'settings' 
            : activeTab
        }
        onSelectTab={(tabId) => {
          handleClosePanel();
          setActiveTab(tabId);
        }}
      />

      {/* Workspace Switcher Modal */}
      <WorkspaceSwitcherModal
        isOpen={showWorkspaceSwitcher}
        onClose={() => setShowWorkspaceSwitcher(false)}
        showToast={showToast}
      />

      {/* Export Modal (PDF & Excel) */}
      <Suspense fallback={null}>
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          showToast={showToast}
        />
      </Suspense>

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={activePanel === 'notifications'}
        onClose={handleClosePanel}
      />

      {/* Join Request Modal */}
      <JoinRequestModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        showToast={showToast}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onConfirmDelete={handleConfirmDeleteAccount}
      />

      {/* Synchronization Status & Offline Modal */}
      <SyncStatusModal
        isOpen={activePanel === 'network'}
        onClose={handleClosePanel}
        showToast={showToast}
      />

      {/* PWA Install Banner & Service Worker Update Alert */}
      <PwaInstallPrompt showToast={showToast} theme={theme} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <AppContent />
          </WorkspaceProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
