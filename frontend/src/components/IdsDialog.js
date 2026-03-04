/**
 * IDs dialog component - displays Account ID, Project ID, Folder URN, Variant ID, and Product ID
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { removeBPrefix } from '../utils/idUtils';
import { useI18n } from '../i18n/I18nContext';

const IdsDialog = ({ 
  isOpen, 
  onClose, 
  selectedAccount, 
  selectedProject, 
  selectedFolder, 
  selectedProduct, 
  selectedReleaseId,
  expandedVariantId 
}) => {
  const { t } = useI18n();
  const [copiedButtons, setCopiedButtons] = useState({});
  const [copyAllCopied, setCopyAllCopied] = useState(false);

  const handleCopy = async (label, value, buttonKey) => {
    if (value && value !== t('idsDialog.notSelected') && value !== t('idsDialog.notAvailable')) {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedButtons(prev => ({ ...prev, [buttonKey]: true }));
        setTimeout(() => {
          setCopiedButtons(prev => ({ ...prev, [buttonKey]: false }));
        }, 2000);
      } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopiedButtons(prev => ({ ...prev, [buttonKey]: true }));
          setTimeout(() => {
            setCopiedButtons(prev => ({ ...prev, [buttonKey]: false }));
          }, 2000);
        } catch (fallbackErr) {
          alert(t('idsDialog.copyError', { label }));
        }
        document.body.removeChild(textArea);
      }
    }
  };

  const handleCopyAll = async () => {
    const allIds = [];
    const accountIdRaw = selectedAccount || t('idsDialog.notSelected');
    const accountId = accountIdRaw !== t('idsDialog.notSelected') ? removeBPrefix(accountIdRaw) : accountIdRaw;
    const projectIdRaw = selectedProject || t('idsDialog.notSelected');
    const projectId = projectIdRaw !== t('idsDialog.notSelected') ? removeBPrefix(projectIdRaw) : projectIdRaw;
    
    allIds.push(`${t('idsDialog.accountId')}: ${accountId}`);
    allIds.push(`${t('idsDialog.projectId')}: ${projectId}`);
    if (selectedFolder) {
      allIds.push(`${t('idsDialog.folderUrn')}: ${selectedFolder}`);
    }
    if (selectedProduct) {
      const productId = selectedProduct.id || selectedProduct.productId || t('idsDialog.notAvailable');
      allIds.push(`${t('idsDialog.productId')}: ${productId}`);
    }
    if (selectedProduct && selectedReleaseId) {
      allIds.push(`${t('idsDialog.releaseId')}: ${selectedReleaseId}`);
    }
    if (expandedVariantId) {
      allIds.push(`${t('idsDialog.variantId')}: ${expandedVariantId}`);
    }
    
    const allIdsText = allIds.join('\n');
    
    try {
      await navigator.clipboard.writeText(allIdsText);
      setCopyAllCopied(true);
      setTimeout(() => {
        setCopyAllCopied(false);
      }, 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = allIdsText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopyAllCopied(true);
        setTimeout(() => {
          setCopyAllCopied(false);
        }, 2000);
      } catch (fallbackErr) {
        alert(t('idsDialog.copyAllError'));
      }
      document.body.removeChild(textArea);
    }
  };

  const IdField = ({ label, value, buttonKey }) => {
    const isCopied = copiedButtons[buttonKey];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1A1A1A' }}>{label}:</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', minWidth: 0 }}>
          <code style={{
            flex: 1,
            minWidth: 0,
            background: '#f8f8f8',
            border: '1px solid #E0E0E0',
            borderRadius: '6px',
            padding: '12px',
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
            fontSize: '0.85rem',
            color: '#1A1A1A',
            wordBreak: 'break-all',
            overflowWrap: 'break-word'
          }}>
            {value}
          </code>
          <button
            onClick={() => handleCopy(label, value, buttonKey)}
            style={{
              padding: '8px',
              background: isCopied ? '#28a745' : '#0696d7',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px'
            }}
            title={t('copy', { label })}
          >
            {isCopied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  };
  
  if (!isOpen) {
    return null;
  }

  const accountIdRaw = selectedAccount || 'Not selected';
  const accountId = accountIdRaw !== 'Not selected' ? removeBPrefix(accountIdRaw) : accountIdRaw;
  const projectIdRaw = selectedProject || 'Not selected';
  const projectId = projectIdRaw !== 'Not selected' ? removeBPrefix(projectIdRaw) : projectIdRaw;

  const dialogContent = (
    <div 
      className="ids-dialog-overlay"
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
        className="ids-dialog-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div className="ids-dialog-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid #E0E0E0'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1A1A1A' }}>{t('idsDialog.title')}</h3>
          <button 
            className="ids-dialog-close"
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
        <div className="ids-dialog-body" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto'
        }}>
          <IdField label={t('idsDialog.accountId')} value={accountId} buttonKey="account" />
          <IdField label={t('idsDialog.projectId')} value={projectId} buttonKey="project" />
          {selectedFolder && (
            <IdField label={t('idsDialog.folderUrn')} value={selectedFolder} buttonKey="folder" />
          )}
          {selectedProduct && (
            <IdField 
              label={t('idsDialog.productId')} 
              value={selectedProduct.id || selectedProduct.productId || t('idsDialog.notAvailable')} 
              buttonKey="product" 
            />
          )}
          {selectedProduct && selectedReleaseId ? (
            <IdField label={t('idsDialog.releaseId')} value={selectedReleaseId} buttonKey="release" />
          ) : null}
          {expandedVariantId && (
            <IdField label={t('idsDialog.variantId')} value={expandedVariantId} buttonKey="variant" />
          )}
          
          <div style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid #E0E0E0' }}>
            <button
              className="btn-copy-all-ids"
              onClick={handleCopyAll}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: copyAllCopied ? '#28a745' : '#0696d7',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {copyAllCopied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {t('idsDialog.allCopied')}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  {t('idsDialog.copyAll')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!document.body) {
    return null;
  }
  
  return createPortal(dialogContent, document.body);
};

export default IdsDialog;
