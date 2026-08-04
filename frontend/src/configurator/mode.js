import { useEffect, useState } from 'react';

/**
 * Which app to render: the single-page configurator, or the full demo app.
 *
 * `IND_CONFIGURATOR` in `frontend/.env` is a BUILD-time flag, so changing it
 * restarts the dev server — and because that kills webpack's websocket, the open
 * browser tab keeps showing the old bundle until you manually reload. That reads
 * as a broken toggle.
 *
 * So the flag can also be set at RUNTIME, which needs nothing but a refresh:
 *
 *     localhost:3000?configurator=1      -> configurator
 *     localhost:3000?configurator=0      -> full demo app
 *     localhost:3000?configurator=auto   -> clear the override, use .env again
 *
 * The choice sticks in localStorage, which matters because the OAuth callback
 * lands back on `/` with no query string — without persistence, signing in would
 * bounce you to whatever `.env` says.
 *
 * Precedence: URL param > remembered choice > .env — but a remembered choice is
 * only honoured while `.env` still says what it said when the choice was made.
 * Change IND_CONFIGURATOR and your edit wins; see `storedChoice`.
 */
const STORAGE_KEY = 'ind_configurator_mode';
const PARAM = 'configurator';

/** @returns {boolean|null} true/false, or null when the value isn't a boolean. */
const parseBool = (value) => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return null;
};

/** Values that mean "forget my override and follow .env again". */
const isReset = (value) =>
  ['', 'auto', 'default', 'reset', 'unset'].includes(String(value ?? '').trim().toLowerCase());

const envDefault = () => process.env.REACT_APP_IND_CONFIGURATOR === 'true';

/**
 * Read the remembered choice.
 *
 * Stored with the `.env` value it was made against, because a remembered click
 * used to outrank `.env` *forever*: set IND_CONFIGURATOR=true, restart, and you
 * still got whatever you last clicked, with nothing on screen to explain why.
 * Editing `.env` is a deliberate act and should win, so when the stored
 * `envDefault` no longer matches the current one the override is stale and gets
 * dropped. Within one `.env` setting the click still sticks — which is the whole
 * point, since the OAuth callback returns to `/` with no query string.
 *
 * Older builds stored a bare "true"/"false" with no record of the `.env` it was
 * made against. Such a value is DISCARDED rather than honoured: it is the exact
 * value causing the bug, and keeping it would mean anyone who had already
 * clicked the toggle never sees the fix. They lose one remembered click; the
 * next one is stored properly.
 *
 * @returns {boolean|null} the remembered choice, or null if there isn't a live one.
 */
const storedChoice = () => {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage unavailable (private mode)
  }
  if (raw === null) return null;

  if (parseBool(raw) !== null) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing more we can do */
    }
    return null;
  }

  try {
    const { choice, envDefault: envWhenChosen } = JSON.parse(raw);
    if (typeof choice !== 'boolean') return null;
    // `.env` changed since this choice was made — it no longer applies.
    if (envWhenChosen !== envDefault()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return choice;
  } catch {
    return null; // unparseable — treat as absent
  }
};

/** Persist a choice together with the `.env` default it was made against. */
const rememberChoice = (choice) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, envDefault: envDefault() }));
  } catch {
    /* storage unavailable — in-memory listeners still update the UI */
  }
};

/**
 * True when the configurator should render as the standalone customer template
 * (its own header, ids from .env, no pickers) rather than embedded in the demo app.
 *
 * Standalone means **this build is the configurator**, i.e. `IND_CONFIGURATOR=true`
 * at build time. That is the customer template: ids come from `.env`, which is why
 * ACC_PROJECT_ID / ACC_FOLDER_URN are documented as required alongside that flag.
 * `?standalone=1` forces the same view for checking the experience.
 *
 * Otherwise the configurator renders **embedded**, driven by the demo app's
 * account/project/folder pickers — in development and in the packaged desktop app
 * alike.
 *
 * This used to be `NODE_ENV !== 'development'`, which conflated "a production
 * build" with "a customer's configurator build" and broke the packaged Electron
 * app: it is a production build of the *demo*, so `isStandalone()` returned true,
 * `App` refused to embed the configurator (see `embedConfigurator`), and the
 * Demo Configurator toggle changed a flag that nothing could act on. It also meant
 * a development run silently ignored the ACC_* ids even with IND_CONFIGURATOR=true.
 * Keying off the build flag makes development and the packaged app behave the same.
 */
export function isStandalone() {
  if (envDefault()) return true;
  try {
    return parseBool(new URLSearchParams(window.location.search).get('standalone')) === true;
  } catch {
    return false;
  }
}

export function shouldUseConfigurator() {
  if (typeof window === 'undefined') return envDefault();

  // 1. Explicit URL override — remember it so it survives the OAuth redirect.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has(PARAM)) {
      const raw = params.get(PARAM);
      if (isReset(raw)) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        const parsed = parseBool(raw);
        if (parsed !== null) {
          rememberChoice(parsed);
          return parsed;
        }
      }
    }
  } catch {
    // Malformed URL or storage unavailable — fall through to the next source.
  }

  // 2. Previously remembered choice, unless .env has changed since.
  const stored = storedChoice();
  if (stored !== null) return stored;

  // 3. Build-time default from .env.
  return envDefault();
}

const CHANGE_EVENT = 'ind-configurator-mode-change';

/**
 * Notify listeners in THIS tab. The native `storage` event only fires in *other*
 * tabs, so a same-tab write needs its own signal.
 */
const announce = () => {
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* pre-DOM environment */
  }
};

/**
 * Switch apps at runtime.
 *
 * Deliberately does NOT reload. A full page load remounts useAuth, which
 * re-verifies the token against the APS userprofile endpoint and flashes (or
 * sticks on) the login screen — switching views shouldn't cost you your session.
 * Embedded, this just re-renders the products panel; App stays mounted and auth
 * state is untouched.
 *
 * @param {boolean} useConfigurator
 */
export function setConfiguratorMode(useConfigurator) {
  rememberChoice(Boolean(useConfigurator));
  announce();
}

/**
 * Subscribe to mode changes. Covers same-tab writes (custom event) and other-tab
 * writes (native `storage`).
 * @param {() => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeMode(listener) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * Current mode as reactive state, so a toggle re-renders in place instead of
 * reloading the page (which would cost the user their session).
 */
export function useConfiguratorMode() {
  const [mode, setMode] = useState(shouldUseConfigurator);
  useEffect(() => subscribeMode(() => setMode(shouldUseConfigurator())), []);
  return mode;
}

/* ---------------------------------------------------------------------------
 * Configure focus
 *
 * True while the embedded configurator's full-page configure view is open. The
 * demo app's menu bar uses it to strip itself back to what a customer's own
 * configurator would show: the account/project pickers give way to the product
 * being configured, and the demo-only controls (mode toggle, language, user
 * menu) drop out entirely. "<- Products" remains the way back.
 *
 * The context rides along with the flag so the bar can render the product name
 * and release badge -- they used to sit at the top of the left panel, which is
 * the one column that needs its vertical space.
 *
 * A tiny event bus rather than context: NavigationBar and ConfiguratorApp sit in
 * different subtrees, and this avoids threading a prop through App.js.
 * ------------------------------------------------------------------------- */
const FOCUS_EVENT = 'ind-configurator-focus-change';
let configureFocus = false;
let configureContext = null; // { productName, releaseLabel, isDefaultRelease }

/**
 * @param {boolean} active
 * @param {{productName?: string, releaseLabel?: string, isDefaultRelease?: boolean}} [context]
 */
export function setConfigureFocus(active, context = null) {
  const next = Boolean(active);
  const nextContext = next ? context : null;
  // Compared by value: this is called from an effect that re-runs whenever the
  // product or release changes, and an unconditional dispatch would re-render
  // the whole menu bar on every pass.
  if (next === configureFocus && JSON.stringify(nextContext) === JSON.stringify(configureContext)) return;
  configureFocus = next;
  configureContext = nextContext;
  try {
    window.dispatchEvent(new Event(FOCUS_EVENT));
  } catch {
    /* pre-DOM environment */
  }
}

/** @returns {{active: boolean, context: object|null}} */
export function useConfigureFocus() {
  const [focus, setFocus] = useState({ active: configureFocus, context: configureContext });
  useEffect(() => {
    const onChange = () => setFocus({ active: configureFocus, context: configureContext });
    window.addEventListener(FOCUS_EVENT, onChange);
    return () => window.removeEventListener(FOCUS_EVENT, onChange);
  }, []);
  return focus;
}
