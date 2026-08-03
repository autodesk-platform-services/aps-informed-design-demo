import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ConfiguratorApp from './configurator/ConfiguratorApp';
import { shouldUseConfigurator, isStandalone } from './configurator/mode';
import { I18nProvider } from './i18n/I18nContext';

// Which app to render. IND_CONFIGURATOR in frontend/.env is the default, but it
// can be overridden at runtime (?configurator=1, or the dev toggle in the menu
// bar) so switching needs only a refresh -- see configurator/mode.js.
// Standalone (production, or ?standalone=1) mounts the configurator directly --
// that's the customer template: no pickers, ids from .env. In development it
// mounts inside App instead, so the demo app's account/project/folder pickers
// choose what to configure (App reads the same flag to swap its body).
const useConfigurator = shouldUseConfigurator();
const Root = useConfigurator && isStandalone() ? ConfiguratorApp : App;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </React.StrictMode>
);

