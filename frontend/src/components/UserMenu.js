/**
 * User menu component with dropdown
 */

import React, { useState, useRef, useEffect } from 'react';
import { getUserInfo } from '../services/authService';
import { useI18n } from '../i18n/I18nContext';

const UserMenu = ({ userProfile, onLogout, onShowToken, onShowIds }) => {
  const { t } = useI18n();
  const [showDropdown, setShowDropdown] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const menuRef = useRef(null);
  
  // Fetch user info from token if profile is not available
  useEffect(() => {
    if (!userProfile) {
      const token = localStorage.getItem('aps_access_token');
      if (token) {
        getUserInfo(token).then(info => {
          setUserInfo(info);
        }).catch(() => {
          // Silent fail - userInfo is optional
        });
      }
    }
  }, [userProfile]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (!event.target.closest('.user-dropdown-menu') && 
            !event.target.closest('.user-dropdown-item') && 
            !event.target.closest('.user-profile-button')) {
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

  // Get user name - try profile first, then userInfo from token
  const userName = userProfile?.name || userProfile?.userName || userProfile?.email
    || userInfo?.email || userInfo?.name 
    || (userInfo?.userid && userInfo.userid.includes('@') ? userInfo.userid : null)
    || (userInfo?.sub && userInfo.sub.includes('@') ? userInfo.sub : null)
    || userInfo?.userid
    || t('user');

  return (
    <div className="user-menu-container" ref={menuRef}>
      <button 
        className="user-profile-button"
        onClick={() => setShowDropdown(!showDropdown)}
        title={userName}
      >
        <span className="user-name">
          {userName}
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>
      {showDropdown && (
        <div className="user-dropdown-menu">
          {onShowToken && (
            <button
              className="user-dropdown-item"
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDropdown(false);
                if (onShowToken) {
                  onShowToken();
                }
              }}
            >
              {t('getMyToken')}
            </button>
          )}
          {onShowIds && (
            <button
              className="user-dropdown-item"
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDropdown(false);
                if (onShowIds) {
                  onShowIds();
                }
              }}
            >
              {t('showIds')}
            </button>
          )}
          <button
            className="user-dropdown-item"
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDropdown(false);
              if (onLogout) {
                onLogout();
              }
            }}
          >
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;

