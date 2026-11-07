import React, { useState } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useLanguage } from '../context/LanguageContext';
import { getCategoryDisplayName } from '../utils/categoryTranslations';

export default function CustomCategoryModal({ isOpen, onClose, showToast }) {
  const { categories, addCategory, editCategory, removeCategory } = useWorkspace();
  const { t, language } = useLanguage();

  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newCatName.trim()) return;

    try {
      await addCategory(newCatName.trim());
      showToast(`Added custom category: ${newCatName.trim()}`);
      setNewCatName('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleStartEdit = (cat) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = async (catId) => {
    if (!editingName.trim()) return;
    try {
      await editCategory(catId, editingName.trim());
      showToast('Category renamed successfully.');
      setEditingId(null);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDelete = async (catId, catName) => {
    if (window.confirm(`Delete custom category "${catName}"?`)) {
      try {
        await removeCategory(catId);
        showToast(`Category "${catName}" removed.`);
      } catch (err) {
        setErrorMsg(err.message);
      }
    }
  };

  const customCats = categories.filter(c => c.isCustom);
  const predefinedCats = categories.filter(c => !c.isCustom);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--chip-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Tag size={16} />
            </div>
            <h2 className="modal-title">{t('manageCategoriesTitle')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        <p className="modal-body" style={{ marginBottom: '14px' }}>
          {t('defineCustomTypesDesc')}
        </p>

        {errorMsg && (
          <div className="auth-alert auth-alert-error" style={{ marginBottom: '12px' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Add New Category Form */}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            className="form-input"
            style={{ height: '38px', fontSize: '0.82rem' }}
            placeholder={t('customTypePlaceholder')}
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 14px', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
            <Plus size={15} />
            <span>{t('addCategoryBtn')}</span>
          </button>
        </form>

        {/* Custom Categories Section */}
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
            {t('workspaceCustomTypes')} ({customCats.length})
          </span>

          {customCats.length === 0 ? (
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
              {t('noCustomCategories')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', maxHeight: '160px', overflowY: 'auto' }}>
              {customCats.map((cat) => (
                <div
                  key={cat.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                >
                  {editingId === cat.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, marginRight: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '30px', fontSize: '0.78rem', padding: '4px 8px' }}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat.id)}
                        style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {cat.name}
                    </span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {editingId !== cat.id && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        title="Rename"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id, cat.name)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Predefined Categories Section */}
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
            {t('builtInCategories')} ({predefinedCats.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {predefinedCats.map((cat) => (
              <span key={cat.id} className="tag-pill" style={{ color: 'var(--text-muted)' }}>
                {getCategoryDisplayName(cat.name, language)}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '18px', textAlign: 'right' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto', padding: '6px 14px', display: 'inline-flex' }}
            onClick={onClose}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

