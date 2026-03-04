/**
 * Token dialog component
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/I18nContext';

const TokenDialog = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const token = localStorage.getItem('aps_access_token') || t('tokenDialog.noToken');

  const handleCopy = async () => {
    if (token && token !== t('tokenDialog.noToken')) {
      try {
        await navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = token;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => {
            setCopied(false);
          }, 2000);
        } catch (fallbackErr) {
          alert(t('tokenDialog.copyError'));
        }
        document.body.removeChild(textArea);
      }
    }
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
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1A1A1A' }}>{t('tokenDialog.title')}</h3>
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
          gap: '16px',
          overflowY: 'auto'
        }}>
          <p className="token-label" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1A1A1A' }}>
            {t('tokenDialog.label')}
          </p>
          <div className="token-display" style={{
            background: '#f8f8f8',
            border: '1px solid #E0E0E0',
            borderRadius: '6px',
            padding: '16px',
            maxHeight: '200px',
            overflowY: 'auto',
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
              {token}
            </code>
          </div>
          <button 
            className="btn-copy-token"
            onClick={handleCopy}
            style={{
              padding: '12px 24px',
              background: copied ? '#28a745' : '#0696d7',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              alignSelf: 'flex-start'
            }}
          >
            {copied ? t('tokenDialog.copied') : t('tokenDialog.copy')}
          </button>
        </div>
      </div>
    </div>
  );

  if (!document.body) {
    return null;
  }
  
  return createPortal(dialogContent, document.body);
};

export default TokenDialog;

