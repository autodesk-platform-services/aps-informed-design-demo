/**
 * Language selector component - dropdown to switch between English and Japanese
 */

import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

const LanguageSelector = () => {
  const { language, changeLanguage, t } = useI18n();
  const [showDropdown, setShowDropdown] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (!event.target.closest('.language-dropdown-menu') && 
            !event.target.closest('.language-selector-button')) {
          setShowDropdown(false);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
    }, 200);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [showDropdown]);

  const handleLanguageChange = (newLanguage) => {
    changeLanguage(newLanguage);
    setShowDropdown(false);
  };

  const currentLanguageName = language === 'ja' ? t('japanese') : t('english');

  return (
    <div className="language-selector-container" ref={menuRef}>
      <button 
        className="language-selector-button"
        onClick={() => setShowDropdown(!showDropdown)}
        title={t('language')}
      >
        <span className="language-icon">🌐</span>
        <span className="language-name">{currentLanguageName}</span>
        <span className="dropdown-arrow">▼</span>
      </button>
      {showDropdown && (
        <div 
          className="language-dropdown-menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: '#ffffff',
            border: '1px solid #E0E0E0',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            minWidth: '150px',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          <button
            className="language-dropdown-item"
            type="button"
            onClick={() => handleLanguageChange('en')}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: language === 'en' ? '#f0f0f0' : 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '0.9rem',
              color: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (language !== 'en') e.target.style.backgroundColor = '#f8f8f8';
            }}
            onMouseLeave={(e) => {
              if (language !== 'en') e.target.style.backgroundColor = 'transparent';
            }}
          >
            {language === 'en' && <span>✓</span>}
            <span>{t('english')}</span>
          </button>
          <button
            className="language-dropdown-item"
            type="button"
            onClick={() => handleLanguageChange('ja')}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: language === 'ja' ? '#f0f0f0' : 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '0.9rem',
              color: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: '1px solid #E0E0E0',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (language !== 'ja') e.target.style.backgroundColor = '#f8f8f8';
            }}
            onMouseLeave={(e) => {
              if (language !== 'ja') e.target.style.backgroundColor = 'transparent';
            }}
          >
            {language === 'ja' && <span>✓</span>}
            <span>{t('japanese')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;

