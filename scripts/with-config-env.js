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
 * Used by frontend/package.json:
 *     "start": "node ../scripts/with-config-env.js react-scripts start"
 *     "build": "node ../scripts/with-config-env.js react-scripts build"
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..', 'frontend');
const env = { ...process.env };

// Read .env then .env.local (local overrides), mirroring each var to REACT_APP_*.
for (const file of ['.env', '.env.local']) {
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
