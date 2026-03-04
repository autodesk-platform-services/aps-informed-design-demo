import React from 'react';
import LanguageSelector from './LanguageSelector';
import UserMenu from './UserMenu';
import { useI18n } from '../i18n/I18nContext';

/**
 * NavigationBar Component
 *
 * Top navigation bar with:
 * - Logo and app title
 * - Account and project dropdowns
 * - Language selector
 * - User menu
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.loadingAccounts - Loading state for accounts
 * @param {Array} props.accAccounts - List of ACC accounts
 * @param {string} props.selectedAccount - Currently selected account ID
 * @param {Function} props.handleAccountChange - Account selection handler
 * @param {boolean} props.loadingProjects - Loading state for projects
 * @param {Array} props.accProjects - List of projects for selected account
 * @param {string} props.selectedProject - Currently selected project ID
 * @param {Function} props.handleProjectChange - Project selection handler
 * @param {Object} props.userProfile - User profile information
 * @param {Function} props.handleLogout - Logout handler
 * @param {Function} props.setShowTokenDialog - Show token dialog handler
 * @param {Function} props.setShowIdsDialog - Show IDs dialog handler
 */
const NavigationBar = ({
  loadingAccounts,
  accAccounts,
  selectedAccount,
  handleAccountChange,
  loadingProjects,
  accProjects,
  selectedProject,
  handleProjectChange,
  userProfile,
  handleLogout,
  setShowTokenDialog,
  setShowIdsDialog,
}) => {
  const { t } = useI18n();

  return (
    <nav className="menu-bar">
      <div className="menu-bar-content">
        <div className="menu-bar-left">
          <div className="logo-small">
            <svg width="32" height="32" viewBox="0 0 965.0002 1024" xmlns="http://www.w3.org/2000/svg">
              <g>
                <path d="m156,.15l730,159.85h79.0002v864H137.0002c-28.7188,0-52-23.2812-52-52v-217.7079L154.4662,2.4109l1.5338-2.2609Z" fill="#3a3a3a"/>
                <path d="m156,0h686.0002c28.6996,0,52,23.3004,52,52v668H156V0h0Z" fill="#777676"/>
                <polygon points="0 814 156 720 156 0 0 94 0 814" fill="#d8d8d8"/>
              </g>
              <g>
                <path d="m358.4331,790.9248h37.8008v151.2021h-37.8008v-151.2021Z" fill="#fff"/>
                <path d="m549.2461,790.9248v151.2021h-40.8242l-49.2495-104.3301v104.3301h-32.1846v-151.2021h44.2812l45.7925,93.7451v-93.7451h32.1846Z" fill="#fff"/>
                <path d="m698.4814,851.1895v27.8643c0,38.8809-23.7607,63.0732-68.6895,63.0732h-49.4648v-151.2021h54.6494c42.3359,0,63.5049,24.1924,63.5049,60.2646Zm-37.8008-1.2959c0-21.1689-8.6406-31.7529-26.7842-31.7529h-15.7686v96.7695h12.5283c20.0879,0,30.0244-10.7998,30.0244-34.7764v-30.2402Z" fill="#fff"/>
              </g>
              <g>
                <path d="m574.8789,232.377v255.9302h51.2998v71.8198h-201.7803v-71.8198h50.7305v-255.9302h-50.7305v-71.25h201.7803v71.25h-51.2998Z" fill="#fff"/>
              </g>
            </svg>
          </div>
          <span className="app-title">Informed Design Demo</span>
        </div>
        <div className="menu-bar-center">
          {loadingAccounts ? (
            <span style={{ fontSize: '0.85rem', color: '#666666' }}>{t('loading')}</span>
          ) : accAccounts.length > 0 ? (
            <div className="header-selectors">
              <div className="header-selector">
                <select
                  id="acc-account-select"
                  value={selectedAccount || ''}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="header-dropdown"
                >
                  <option value="">{t('selectAccount')}</option>
                  {accAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.attributes?.name || account.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="header-selector">
                {loadingProjects ? (
                  <select className="header-dropdown" disabled>
                    <option>{t('loading')}</option>
                  </select>
                ) : selectedAccount && accProjects.length > 0 ? (
                  <select
                    id="acc-project-select"
                    value={selectedProject || ''}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="header-dropdown"
                  >
                    <option value="">{t('selectProject')}</option>
                    {accProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.attributes?.name || project.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select className="header-dropdown" disabled>
                    <option>{selectedAccount ? t('noProjects') : t('selectAccountFirst')}</option>
                  </select>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="menu-bar-right">
          <LanguageSelector />
          <UserMenu
            userProfile={userProfile}
            onLogout={handleLogout}
            onShowToken={() => setShowTokenDialog(true)}
            onShowIds={() => setShowIdsDialog(true)}
          />
        </div>
      </div>
    </nav>
  );
};

export default NavigationBar;
