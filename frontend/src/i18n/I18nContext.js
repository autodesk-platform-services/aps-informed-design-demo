import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const I18nContext = createContext();

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export const I18nProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get language from localStorage or default to English
    try {
      const savedLanguage = localStorage.getItem('app_language');
      // Validate that the saved language is supported
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ja')) {
        return savedLanguage;
      }
    } catch (err) {
      // If localStorage is not available, default to English
    }
    // Default to English
    return 'en';
  });

  useEffect(() => {
    // Save language preference to localStorage whenever it changes
    try {
      localStorage.setItem('app_language', language);
    } catch (err) {
      // If localStorage is not available, silently fail
    }
  }, [language]);

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        let enValue = translations.en;
        for (const enK of keys) {
          if (enValue && typeof enValue === 'object' && enK in enValue) {
            enValue = enValue[enK];
          } else {
            return key; // Return key if not found in English either
          }
        }
        value = enValue;
        break;
      }
    }
    
    // Replace parameters in string (e.g., {value} -> actual value)
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }
    
    return value || key;
  };

  const changeLanguage = (newLanguage) => {
    if (translations[newLanguage]) {
      setLanguage(newLanguage);
    }
  };

  return (
    <I18nContext.Provider value={{ language, t, changeLanguage }}>
      {children}
    </I18nContext.Provider>
  );
};

