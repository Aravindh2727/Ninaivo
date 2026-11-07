import React from 'react';
import { LogOut, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LogoutConfirmModal({ isOpen, onCancel, onConfirm }) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-rose)' }}>
            <LogOut size={18} />
          </div>
          <h2 className="modal-title">{t('signOutConfirmTitle')}</h2>
        </div>

        <p className="modal-body">
          {t('signOutConfirmDesc')}
        </p>

        <div className="modal-actions">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={onCancel}
          >
            {t('staySignedIn')}
          </button>
          <button 
            type="button" 
            className="btn-danger" 
            onClick={onConfirm}
          >
            <LogOut size={15} />
            {t('confirmSignOut')}
          </button>
        </div>
      </div>
    </div>
  );
}

