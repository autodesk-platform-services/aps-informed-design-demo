/**
 * APS Apps dialog component - allows viewing and switching APS apps
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/I18nContext';

const ApsAppsDialog = ({ isOpen, onClose, appName, clientId, onSwitchApp }) => {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    appName: appName || '',
    clientId: clientId || '',
    clientSecret: ''
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens/closes or props change
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        appName: appName || '',
        clientId: clientId || '',
        clientSecret: ''
      });
      setIsEditing(false);
      setError(null);
    }
  }, [isOpen, appName, clientId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const handleSwitchApp = async () => {
    if (!formData.appName || !formData.clientId || !formData.clientSecret) {
      setError(t('apsAppsDialog.allFieldsRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (onSwitchApp) {
        await onSwitchApp({
          appName: formData.appName,
          clientId: formData.clientId,
          clientSecret: formData.clientSecret
        });
      }
      setIsEditing(false);
      setFormData(prev => ({ ...prev, clientSecret: '' })); // Clear secret after saving
    } catch (err) {
      setError(err.message || t('apsAppsDialog.switchError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      appName: appName || '',
      clientId: clientId || '',
      clientSecret: ''
    });
    setError(null);
  };
  
  if (!isOpen) {
    return null;
  }
  
  const dialogContent = (
    <div 
      className="token-dialog-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '20px'
      }}
    >
      <div 
        className="token-dialog-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div className="token-dialog-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid #E0E0E0'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1A1A1A' }}>{t('apsAppsDialog.title')}</h3>
          <button 
            className="token-dialog-close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              color: '#666',
              cursor: 'pointer',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px'
            }}
          >
            ×
          </button>
        </div>
        <div className="token-dialog-body" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          overflowY: 'auto'
        }}>
          {!isEditing ? (
            <>
              <div>
                <p className="token-label" style={{ margin: '0 0 8px 0', fontSize: '0.95rem', fontWeight: 600, color: '#1A1A1A' }}>
                  {t('apsAppsDialog.currentApp')}:
                </p>
                <div className="token-display" style={{
                  background: '#f8f8f8',
                  border: '1px solid #E0E0E0',
                  borderRadius: '6px',
                  padding: '16px',
                  wordBreak: 'break-all'
                }}>
                  <code className="token-value" style={{
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
                    fontSize: '0.85rem',
                    color: '#1A1A1A',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {appName || 'Not configured'}
                  </code>
                </div>
              </div>
              
              <div>
                <p className="token-label" style={{ margin: '0 0 8px 0', fontSize: '0.95rem', fontWeight: 600, color: '#1A1A1A' }}>
                  {t('apsAppsDialog.clientId')}:
                </p>
                <div className="token-display" style={{
                  background: '#f8f8f8',
                  border: '1px solid #E0E0E0',
                  borderRadius: '6px',
                  padding: '16px',
                  wordBreak: 'break-all'
                }}>
                  <code className="token-value" style={{
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
                    fontSize: '0.85rem',
                    color: '#1A1A1A',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {clientId || 'Not configured'}
                  </code>
                </div>
              </div>

              <button 
                className="btn-copy-token"
                onClick={() => setIsEditing(true)}
                style={{
                  padding: '12px 24px',
                  background: '#0696d7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                {t('apsAppsDialog.switchApp')}
              </button>
            </>
          ) : (
            <>
              {error && (
                <div style={{
                  padding: '12px',
                  background: '#fee',
                  border: '1px solid #fcc',
                  borderRadius: '6px',
                  color: '#c33'
                }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.95rem', fontWeight: 600, color: '#1A1A1A' }}>
                  {t('apsAppsDialog.appName')}:
                </label>
                <input
                  type="text"
                  name="appName"
                  value={formData.appName}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E0E0E0',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit'
                  }}
                  placeholder={t('apsAppsDialog.appName')}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.95rem', fontWeight: 600, color: '#1A1A1A' }}>
                  APS Client ID:
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E0E0E0',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit'
                  }}
                  placeholder={t('apsAppsDialog.clientId')}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.95rem', fontWeight: 600, color: '#1A1A1A' }}>
                  {t('apsAppsDialog.clientSecret')}:
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={formData.clientSecret}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E0E0E0',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit'
                  }}
                  placeholder={t('apsAppsDialog.clientSecret')}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn-copy-token"
                  onClick={handleSwitchApp}
                  disabled={saving || !formData.appName || !formData.clientId || !formData.clientSecret}
                  style={{
                    padding: '12px 24px',
                    background: saving || !formData.appName || !formData.clientId || !formData.clientSecret ? '#ccc' : '#0696d7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: saving || !formData.appName || !formData.clientId || !formData.clientSecret ? 'not-allowed' : 'pointer',
                    flex: 1
                  }}
                >
                  {saving ? t('switching') : t('apsAppsDialog.switchApp')}
                </button>
                <button 
                  className="btn-copy-token"
                  onClick={handleCancel}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    background: '#f5f5f5',
                    color: '#1A1A1A',
                    border: '1px solid #E0E0E0',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    flex: 1
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (!document.body) {
    return null;
  }
  
  return createPortal(dialogContent, document.body);
};

export default ApsAppsDialog;

