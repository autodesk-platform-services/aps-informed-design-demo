import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ConfiguratorApp from './configurator/ConfiguratorApp';
import { useConfiguratorMode, isStandalone } from './configurator/mode';
import { I18nProvider } from './i18n/I18nContext';

/**
 * Which app to render. IND_CONFIGURATOR in frontend/.env is the default, and it
 * can be overridden at runtime (?configurator=1, or the toggle in the menu bar)
 * -- see configurator/mode.js.
 *
 * Standalone (a configurator build, or ?standalone=1) mounts the configurator
 * directly: that's the customer template, no pickers, ids from .env. Otherwise it
 * mounts inside App, so the demo app's account/project/folder pickers choose what
 * to configure (App reads the same flag to swap its body).
 *
 * This reads the mode through the HOOK rather than computing it once at module
 * load. It used to be a module-level `const`, which meant the menu-bar toggle
 * could flip the stored mode while the chosen root stayed put for the lifetime of
 * the page — the toggle appeared to do nothing. Development hid it, because there
 * the root is always `App` and `App` swaps its own body reactively.
 */
function Root() {
  const useConfigurator = useConfiguratorMode();
  return useConfigurator && isStandalone() ? <ConfiguratorApp /> : <App />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </React.StrictMode>
);

