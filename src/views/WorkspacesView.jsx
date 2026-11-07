import React, { useState } from 'react';
import { 
  Layers, 
  Sparkles, 
  Heart, 
  Briefcase, 
  Plus, 
  Check, 
  Trash2, 
  Users, 
  UserCheck, 
  ShieldCheck, 
  Tag, 
  Settings, 
  Calendar,
  Info
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { WORKSPACE_MODES } from '../services/workspaceService';
import { getCategoryDisplayName } from '../utils/categoryTranslations';
import CustomCategoryModal from '../components/CustomCategoryModal';

export default function WorkspacesView({ showToast }) {
  const { 
    workspaces, 
    currentWorkspace, 
    switchWorkspace, 
    createNewWorkspace, 
    removeWorkspace, 
    entries, 
    categories 
  } = useWorkspace();
  const { currentUser, userProfile } = useAuth();
  const { t, language } = useLanguage();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState(WORKSPACE_MODES.PERSONAL);
  const [newWsDesc, setNewWsDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    setLoading(true);
    try {
      const created = await createNewWorkspace({
        name: newWsName.trim(),
        type: newWsType,
        description: newWsDesc.trim()
      });
      showToast(`Workspace "${created.name}" created!`);
      setNewWsName('');
      setNewWsDesc('');
      setShowCreateForm(false);
    } catch (err) {
      alert('Error creating workspace: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (wsId, wsName) => {
    if (workspaces.length <= 1) {
      alert('You must have at least one workspace.');
      return;
    }
    if (window.confirm(`${t('deleteWorkspaceConfirm')} ("${wsName}")`)) {
      try {
        await removeWorkspace(wsId);
        showToast(`Workspace "${wsName}" deleted.`);
      } catch (err) {
        alert('Could not delete workspace: ' + err.message);
      }
    }
  };

  const getModeIcon = (type) => {
    switch (type) {
      case WORKSPACE_MODES.FAMILY:
        return <Heart size={16} style={{ color: 'var(--accent-rose)' }} />;
      case WORKSPACE_MODES.BUSINESS:
        return <Briefcase size={16} style={{ color: 'var(--accent-cyan)' }} />;
      default:
        return <Sparkles size={16} style={{ color: 'var(--primary)' }} />;
    }
  };

  return (
    <div className="screen-fade">
      {/* 1. Header Card */}
      <div className="card compact-form-card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div>
            <span className="card-subtitle" style={{ fontSize: '0.66rem' }}>{t('myWorkspaces')}</span>
            <h2 className="card-title" style={{ marginTop: '1px', fontSize: '0.96rem' }}>
              <Layers size={16} style={{ color: 'var(--primary)' }} />
              {t('workspaces')} ({workspaces.length})
            </h2>
          </div>
          <button
            type="button"
            className="filter-chip active"
            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <Plus size={12} style={{ display: 'inline', marginRight: '2px' }} />
            {showCreateForm ? t('cancel') : t('createWorkspace')}
          </button>
        </div>
      </div>

      {/* 2. Create Workspace Form Drawer Card */}
      {showCreateForm && (
        <div className="card compact-form-card" style={{ borderColor: 'var(--primary)', marginBottom: '10px', padding: '10px 12px', animation: 'fadeIn 200ms ease' }}>
          <div className="card-header" style={{ marginBottom: '8px' }}>
            <span className="card-title" style={{ fontSize: '0.86rem' }}>
              <Plus size={14} style={{ color: 'var(--primary)' }} />
              {t('createWorkspace')}
            </span>
          </div>

          <form onSubmit={handleCreate}>
            <div className="form-group compact-form-group">
              <label className="form-label compact-form-label">{t('workspaceMode')}</label>
              <div className="mode-selector-grid">
                <button
                  type="button"
                  className={`mode-pill-btn ${newWsType === WORKSPACE_MODES.PERSONAL ? 'active' : ''}`}
                  style={{ padding: '5px 8px' }}
                  onClick={() => setNewWsType(WORKSPACE_MODES.PERSONAL)}
                >
                  <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                  <span className="mode-pill-title" style={{ fontSize: '0.74rem' }}>{t('modePersonal')}</span>
                </button>
                <button
                  type="button"
                  className={`mode-pill-btn ${newWsType === WORKSPACE_MODES.FAMILY ? 'active' : ''}`}
                  style={{ padding: '5px 8px' }}
                  onClick={() => setNewWsType(WORKSPACE_MODES.FAMILY)}
                >
                  <Heart size={14} style={{ color: 'var(--accent-rose)' }} />
                  <span className="mode-pill-title" style={{ fontSize: '0.74rem' }}>{t('modeFamily')}</span>
                </button>
                <button
                  type="button"
                  className={`mode-pill-btn ${newWsType === WORKSPACE_MODES.BUSINESS ? 'active' : ''}`}
                  style={{ padding: '5px 8px' }}
                  onClick={() => setNewWsType(WORKSPACE_MODES.BUSINESS)}
                >
                  <Briefcase size={14} style={{ color: 'var(--accent-cyan)' }} />
                  <span className="mode-pill-title" style={{ fontSize: '0.74rem' }}>{t('modeBusiness')}</span>
                </button>
              </div>
            </div>

            <div className="form-group compact-form-group">
              <label className="form-label compact-form-label">{t('workspaceName')} *</label>
              <input
                type="text"
                className="form-input compact-input"
                placeholder={newWsType === 'family' ? t('placeholderFamily') : newWsType === 'business' ? t('placeholderBusiness') : t('placeholderPersonal')}
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                required
              />
            </div>

            <div className="form-group compact-form-group">
              <label className="form-label compact-form-label">{t('descriptionLabel')}</label>
              <input
                type="text"
                className="form-input compact-input"
                placeholder={t('workspaceDescPlaceholder')}
                value={newWsDesc}
                onChange={(e) => setNewWsDesc(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary compact-btn" disabled={loading} style={{ width: '100%', marginTop: '4px' }}>
              <Plus size={14} />
              <span>{t('createWorkspace')}</span>
            </button>
          </form>
        </div>
      )}

      {/* 3. Workspaces Roster List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        {workspaces.map((ws) => {
          const isSelected = ws.id === currentWorkspace?.id;
          return (
            <div 
              key={ws.id}
              className="card compact-form-card"
              onClick={() => {
                switchWorkspace(ws);
                showToast(`${t('activeWorkspace')}: ${ws.name}`);
              }}
              style={{
                margin: 0,
                padding: '10px 12px',
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                boxShadow: isSelected ? '0 0 12px var(--primary-glow)' : 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--bg-card-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getModeIcon(ws.type)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                      {ws.name}
                    </h3>
                    <span className="tag-pill" style={{ textTransform: 'capitalize', fontSize: '0.62rem', padding: '1px 5px' }}>
                      {ws.type} {t('workspace')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isSelected ? (
                    <span className="badge badge-success" style={{ fontSize: '0.64rem', padding: '1px 5px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Check size={11} strokeWidth={3} />
                      {t('active')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ws.id, ws.name);
                      }}
                      className="compact-action-btn delete"
                      title={t('deleteWorkspace')}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-color)', fontSize: '0.66rem', color: 'var(--text-dim)' }}>
                <span>{t('owner')}: {userProfile?.displayName || currentUser?.displayName || t('me')}</span>
                <span>{isSelected ? `${entries.length} ${t('notesRecorded')}` : t('clickToOpen')}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Workspace Categories Management Card */}
      <div className="card compact-form-card" style={{ padding: '10px 12px' }}>
        <div className="card-header" style={{ marginBottom: '6px' }}>
          <span className="card-title" style={{ fontSize: '0.86rem' }}>
            <Tag size={14} style={{ color: 'var(--primary)' }} />
            {t('manageCategoriesTitle')}
          </span>
          <button
            type="button"
            className="filter-chip"
            style={{ fontSize: '0.70rem', padding: '3px 8px' }}
            onClick={() => setShowCatModal(true)}
          >
            {t('manageTypes')} ({categories.length})
          </button>
        </div>

        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
          {t('customEntryTypesFor')} <strong>{currentWorkspace?.name}</strong>:
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {categories.map((c) => (
            <span 
              key={c.id} 
              className="tag-pill" 
              style={{ fontSize: '0.64rem', padding: '1px 6px', color: c.isCustom ? 'var(--primary)' : 'var(--text-dim)', borderColor: c.isCustom ? 'var(--primary)' : 'var(--border-color)' }}
            >
              {getCategoryDisplayName(c.name, language)} {c.isCustom ? '★' : ''}
            </span>
          ))}
        </div>
      </div>

      {/* Custom Category Modal */}
      <CustomCategoryModal
        isOpen={showCatModal}
        onClose={() => setShowCatModal(false)}
        showToast={showToast}
      />
    </div>
  );
}

