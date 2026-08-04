import React from 'react';
import { setConfiguratorMode, useConfiguratorMode } from './mode';
import './ModeToggle.css';

/**
 * Switch between the full demo app and the single-page configurator.
 *
 * Renders in BOTH apps' menu bars — a one-way button would let you switch to the
 * other app and get stranded there with no way back.
 *
 * **When it is hidden.** Only in a build made to *be* the configurator, i.e. one
 * where `IND_CONFIGURATOR=true` at build time. That is what a customer shipping
 * their own configurator produces, and an "open the internal demo app" control
 * there would be confusing at best.
 *
 * This used to key off `NODE_ENV !== 'development'`, which conflated "a
 * production build" with "a customer's configurator build". They are not the same
 * thing: the packaged Electron desktop app is a production build of the *demo*,
 * and hiding the toggle there left the configurator with no route to it at all —
 * no toggle, and no address bar to pass `?configurator=1`. Development is always
 * exempt so the toggle stays available while working on either app.
 */
export default function ModeToggle() {
  // Hook first: React forbids calling hooks after a conditional return.
  const isConfigurator = useConfiguratorMode();
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isConfiguratorBuild = process.env.REACT_APP_IND_CONFIGURATOR === 'true';
  if (!isDevelopment && isConfiguratorBuild) return null;

  return (
    <div className="mode-toggle" title="Demo build only — hidden when IND_CONFIGURATOR=true at build time">
      <button
        type="button"
        className={`mode-toggle-btn${!isConfigurator ? ' is-active' : ''}`}
        onClick={() => setConfiguratorMode(false)}
        disabled={!isConfigurator}
      >
        Demo App
      </button>
      <button
        type="button"
        className={`mode-toggle-btn${isConfigurator ? ' is-active' : ''}`}
        onClick={() => setConfiguratorMode(true)}
        disabled={isConfigurator}
      >
        Demo Configurator
      </button>
    </div>
  );
}
