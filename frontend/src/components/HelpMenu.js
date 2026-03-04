/**
 * Help menu component with dropdown
 */

import React, { useState, useRef, useEffect } from 'react';

const HelpMenu = ({ onShowToken, onShowIds, onShowApsAppInfo }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (!event.target.closest('.user-dropdown-menu') && 
            !event.target.closest('.user-dropdown-item') && 
            !event.target.closest('.help-icon-button')) {
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

  return (
    <div className="help-menu-container" ref={menuRef}>
      <button 
        className="help-icon-button"
        onClick={() => setShowDropdown(!showDropdown)}
        title="Help"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span className="dropdown-arrow">▼</span>
      </button>
      {showDropdown && (
        <div className="user-dropdown-menu">
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
            Get my token
          </button>
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
            Show IDs
          </button>
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
              if (onShowApsAppInfo) {
                onShowApsAppInfo();
              }
            }}
          >
            APS App Info
          </button>
        </div>
      )}
    </div>
  );
};

export default HelpMenu;

