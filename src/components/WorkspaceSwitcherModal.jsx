import React, { useState } from 'react';
import { 
  Sparkles, 
  Heart, 
  Briefcase, 
  Check, 
  Plus, 
  Trash2, 
  X, 
  Layers, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { WORKSPACE_MODES } from '../services/workspaceService';

export default function WorkspaceSwitcherModal({ isOpen, onClose, showToast }) {
  const { 
    workspaces, 
    currentWorkspace, 
    switchWorkspace, 
    createNewWorkspace, 
    removeWorkspace 
  } = useWorkspace();
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState(WORKSPACE_MODES.PERSONAL);
  const [newWsDesc, setNewWsDesc] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSelect = (ws) => {
    switchWorkspace(ws);
    showToast(`${t('activeWorkspace')}: ${ws.name}`);
    onClose();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) {
      alert('Please enter a workspace name');
      return;
    }

    setLoading(true);
    try {
      const created = await createNewWorkspace({
        name: newWsName.trim(),
        type: newWsType,
        description: newWsDesc.trim()
      });
      showToast(`Created workspace: ${created.name}`);
      setNewWsName('');
      setNewWsDesc('');
      setShowCreateForm(false);
      onClose();
    } catch (err) {
      alert('Error creating workspace: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, wsId, wsName) => {
    e.stopPropagation();
    if (workspaces.length <= 1) {
      alert('You must have at least one active workspace.');
      return;
    }
    if (window.confirm(`${t('deleteWorkspaceConfirm')} (${wsName})`)) {
      try {
        await removeWorkspace(wsId);
        showToast(`Workspace "${wsName}" removed.`);
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog compact-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '410px', padding: '14px 16px', borderRadius: '16px' }}>
        <div className="modal-header compact-modal-header" style={{ justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--chip-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
              <Layers size={16} />
            </div>
            <h2 className="modal-title compact-modal-title" style={{ fontSize: '0.92rem', fontWeight: 700 }}>{t('switchWorkspace')}</h2>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '3px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <p className="modal-body compact-modal-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.25 }}>
          {t('workspaceSwitcherDesc')}
        </p>

        {/* Workspaces List */}
        {!showCreateForm ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto', marginBottom: '10px', paddingRight: '2px' }}>
              {workspaces.map((ws) => {
                const isSelected = ws.id === currentWorkspace?.id;
                return (
                  <div
                    key={ws.id}
                    className={`compact-ws-row ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelect(ws)}
                    style={{
                      margin: 0,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                      background: isSelected ? 'var(--chip-green-bg)' : 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <div className="compact-ws-icon" style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--bg-card-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {getModeIcon(ws.type)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ws.name}
                          </span>
                          <span className="tag-pill" style={{ textTransform: 'capitalize', fontSize: '0.60rem', padding: '1px 5px' }}>
                            {ws.type}
                          </span>
                          {ws.ownerUid && ws.ownerUid !== currentUser?.uid && ws.type !== 'personal' && (
                            <span className="tag-pill" style={{ fontSize: '0.58rem', padding: '1px 5px', background: 'var(--chip-green-bg)', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                              {t('sharedDiaryBadge')}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ws.ownerUid && ws.ownerUid !== currentUser?.uid && ws.type !== 'personal'
                            ? `${t('sharedBy')} ${ws.ownerName || 'Owner'} • ${ws.settings?.description || `${ws.type} records`}`
                            : (ws.settings?.description || `${ws.type} diary records`)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '6px' }}>
                      {isSelected ? (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, ws.id, ws.name)}
                          title={t('deleteWorkspace')}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '3px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="btn-primary compact-btn"
              style={{ width: '100%', height: '36px', fontSize: '0.80rem', borderRadius: '10px' }}
              onClick={() => setShowCreateForm(true)}
            >
              <Plus size={15} />
              <span>{t('createWorkspace')}</span>
            </button>
          </>
        ) : (
          /* Create Workspace Form */
          <form onSubmit={handleCreate} className="screen-fade">
            <div className="compact-form-group" style={{ marginBottom: '8px' }}>
              <label className="compact-form-label" style={{ fontSize: '0.74rem' }}>{t('workspaceMode')}</label>
              <div className="mode-selector-grid" style={{ gap: '6px' }}>
                <button
                  type="button"
                  className={`mode-pill-btn ${newWsType === WORKSPACE_MODES.PERSONAL ? 'active' : ''}`}
                  onClick={() => setNewWsType(WORKSPACE_MODES.PERSONAL)}
                >
                  <Sparkles size={15} style={{ color: 'var(--primary)' }} />
                  <span className="mode-pill-title">{t('modePersonal')}</span>
                  <span className="mode-pill-desc">{t('privateDiary')}</span>
                </button>
                <button
                  type="button"
                  className={`mode-pill-btn ${newWsType === WORKSPACE_MODES.FAMILY ? 'active' : ''}`}
                  onClick={() => setNewWsType(WORKSPACE_MODES.FAMILY)}
                >
                  <Heart size={15} style={{ color: 'var(--accent-rose)' }} />
                  <span className="mode-pill-title">{t('modeFamily')}</span>
                  <span className="mode-pill-desc">{t('familyAndFarm')}</span>
                </button>
                <button
                  type="button"
                  className={`mode-pill-btn ${newWsType === WORKSPACE_MODES.BUSINESS ? 'active' : ''}`}
                  onClick={() => setNewWsType(WORKSPACE_MODES.BUSINESS)}
                >
                  <Briefcase size={15} style={{ color: 'var(--accent-cyan)' }} />
                  <span className="mode-pill-title">{t('modeBusiness')}</span>
                  <span className="mode-pill-desc">{t('tradeAndWork')}</span>
                </button>
              </div>
            </div>

            <div className="compact-form-group" style={{ marginBottom: '8px' }}>
              <label className="compact-form-label" style={{ fontSize: '0.74rem' }}>{t('workspaceName')} *</label>
              <input
                type="text"
                className="form-input compact-input"
                style={{ height: '36px', fontSize: '0.80rem' }}
                placeholder={newWsType === 'family' ? 'e.g. My Family & Agriculture' : newWsType === 'business' ? 'e.g. Retail Store Diary' : 'e.g. Personal Reflections'}
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                required
              />
            </div>

            <div className="compact-form-group" style={{ marginBottom: '10px' }}>
              <label className="compact-form-label" style={{ fontSize: '0.74rem' }}>{t('descriptionOptional')}</label>
              <input
                type="text"
                className="form-input compact-input"
                style={{ height: '36px', fontSize: '0.80rem' }}
                placeholder={t('shortNotePlaceholder')}
                value={newWsDesc}
                onChange={(e) => setNewWsDesc(e.target.value)}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '12px', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary compact-btn"
                style={{ height: '36px', fontSize: '0.80rem' }}
                onClick={() => setShowCreateForm(false)}
                disabled={loading}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="btn-primary compact-btn"
                style={{ height: '36px', fontSize: '0.80rem' }}
                disabled={loading}
              >
                <Plus size={15} />
                <span>{t('createWorkspace')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

