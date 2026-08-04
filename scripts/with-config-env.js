#!/usr/bin/env node
/**
 * Env shim for Create React App.
 *
 * CRA only exposes variables prefixed with REACT_APP_ to the browser bundle.
 * This lets you keep SIMPLE, READABLE names in `frontend/.env` (e.g.
 * ACC_ACCOUNT_ID, YOUR_BRAND_NAME) with no prefix: it reads that file and
 * mirrors every var to a REACT_APP_<NAME> copy so CRA picks it up. You never
 * write the prefix; the app code reads the mirrored names internally.
 *
 * Every entry point goes through it, so `frontend/.env` behaves the same however
 * you start:
 *   - `npm run dev` from the root (via `scripts/dev.js`)
 *   - `cd frontend && npm start`
 *   - `cd frontend && npm run build`, and therefore the packaged Electron app
 *
 * That uniformity is the point. `start` and `build` used to be plain
 * `react-scripts` calls, which meant IND_CONFIGURATOR, ACC_PROJECT_ID,
 * ACC_FOLDER_URN and every YOUR_BRAND_* were invisible unless you happened to use
 * `npm run dev` — a documented setting silently doing nothing, depending only on
 * which command you typed. For the packaged app there was no working command at
 * all, so it could never be pointed at a folder or rebranded.
 *
 * `scripts/dev.js` invokes this shim directly rather than through
 * `frontend`'s npm script, so `npm run dev` does not run it twice.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..', 'frontend');
const env = { ...process.env };

// Mirror each var to REACT_APP_*. Highest precedence first, because the loop below
// only fills in what is still unset: the real environment (already in `env`) beats
// both files, `.env.local` beats `.env`. That order matches Create React App.
//
// The files used to be read `.env` first, which — with a fill-in-if-unset rule —
// silently meant `.env` won and `.env.local` was ignored for any key both defined.
// The comment here claimed the opposite.
for (const file of ['.env.local', '.env']) {
  const p = path.join(frontendDir, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!key) continue;
    if (env[key] === undefined) env[key] = val;
    // PORT is special to CRA; already-prefixed vars pass through untouched.
    if (key !== 'PORT' && !key.startsWith('REACT_APP_')) {
      const mirrored = `REACT_APP_${key}`;
      if (env[mirrored] === undefined) env[mirrored] = val;
    }
  }
}

// Say which app is about to render — the #1 source of "why am I seeing the
// other one?" confusion when toggling IND_CONFIGURATOR.
console.log(
  env.REACT_APP_IND_CONFIGURATOR === 'true'
    ? 'IND_CONFIGURATOR=true — rendering the single-page configurator.'
    : 'IND_CONFIGURATOR=false — rendering the full demo app.'
);

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('with-config-env: no command given');
  process.exit(1);
}

// Resolve the command from the frontend's local node_modules/.bin when possible,
// since this may be spawned without npm having put .bin on PATH.
const localBin = path.join(
  frontendDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? `${cmd}.cmd` : cmd
);
const bin = fs.existsSync(localBin) ? localBin : cmd;

const child = spawn(bin, args, {
  cwd: frontendDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code == null ? 0 : code));
