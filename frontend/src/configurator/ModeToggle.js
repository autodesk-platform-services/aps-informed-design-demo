import React from 'react';
import { setConfiguratorMode, useConfiguratorMode } from './mode';
import './ModeToggle.css';

/**
 * Dev-only switch between the full demo app and the single-page configurator.
 *
 * Renders in BOTH apps' menu bars — a one-way button would let you switch to the
 * other app and get stranded there with no way back.
 *
 * Hidden outside development so it never reaches a customer build: this branch
 * ships as a configurator template, where an "open the internal demo app" control
 * would be confusing at best.
 */
export default function ModeToggle() {
  // Hook first: React forbids calling hooks after a conditional return.
  const isConfigurator = useConfiguratorMode();
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="mode-toggle" title="Development only — not shown in production builds">
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
