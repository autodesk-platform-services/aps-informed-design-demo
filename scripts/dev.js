#!/usr/bin/env node
/**
 * One-command dev launcher: starts the backend (:8080) and the frontend (:3000)
 * together, with prefixed output, and shuts both down on Ctrl-C.
 *
 * Editing frontend/.env restarts the frontend automatically, so toggling
 * IND_CONFIGURATOR takes effect without touching the terminal.
 *
 * Usage:  npm run dev   (from the repo root)
 *
 * Dependency-free on purpose — a freshly cloned template shouldn't need any
 * extra install beyond `npm install`.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const root = path.resolve(__dirname, '..');
const frontendDir = path.join(root, 'frontend');
const envFile = '.env';

// The frontend runs THROUGH the env shim (with-config-env.js) so the
// configurator's clean-named vars are mirrored to REACT_APP_* — this keeps the
// shim entirely out of the basic demo's own `npm start`, which is untouched.
const BACKEND = { name: 'backend', color: '\x1b[36m', cmd: npm, cwd: path.join(root, 'backend'), args: ['run', 'dev'] };
const FRONTEND = {
  name: 'frontend',
  color: '\x1b[32m',
  cmd: process.execPath, // node
  cwd: root,
  args: [path.join(__dirname, 'with-config-env.js'), 'react-scripts', 'start'],
};
const RESET = '\x1b[0m';

const running = new Map(); // service name -> child
let shuttingDown = false;

function prefix(name, color, chunk) {
  const tag = `${color}[${name}]${RESET} `;
  chunk
    .toString()
    .split('\n')
    .filter((line, i, arr) => line.length || i < arr.length - 1)
    .forEach((line) => process.stdout.write(tag + line + '\n'));
}

/**
 * `detached` puts the child in its own process group so killing -pid takes down
 * its whole subtree. Without it, SIGTERM to the shim leaves react-scripts alive,
 * still holding :3000 and serving a bundle built from the OLD .env.
 */
const intentional = new WeakSet(); // children we killed on purpose (restart / shutdown)

function start(svc) {
  const child = spawn(svc.cmd, svc.args, { cwd: svc.cwd, env: process.env, detached: !isWindows });
  running.set(svc.name, child);
  child.stdout.on('data', (d) => prefix(svc.name, svc.color, d));
  child.stderr.on('data', (d) => prefix(svc.name, svc.color, d));
  child.on('exit', (code) => {
    if (running.get(svc.name) === child) running.delete(svc.name);
    if (shuttingDown || intentional.has(child)) return;
    prefix(svc.name, svc.color, `exited with code ${code}. Shutting down.`);
    shutdown(code || 0);
  });
  return child;
}

/** Kill the child's entire process group and resolve once it's actually gone. */
function stop(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    intentional.add(child);
    child.once('exit', resolve);
    try {
      if (isWindows) child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      resolve();
    }
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  Promise.all([...running.values()].map(stop)).then(() => process.exit(code));
}

let restarting = false;
async function restartFrontend() {
  if (shuttingDown || restarting) return;
  restarting = true;
  prefix('dev', '\x1b[33m', `${envFile} changed — restarting frontend…`);
  await stop(running.get(FRONTEND.name));
  if (!shuttingDown) start(FRONTEND);
  restarting = false;
}

start(BACKEND);
start(FRONTEND);

// Watch the DIRECTORY, not the file: editors save via rename, which detaches a
// file watch after the first change.
let debounce = null;
fs.watch(frontendDir, (_event, filename) => {
  if (filename !== envFile) return;
  clearTimeout(debounce);
  debounce = setTimeout(restartFrontend, 250);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Starting backend (:8080) and frontend (:3000). Press Ctrl-C to stop both.');
console.log(`Editing frontend/${envFile} restarts the frontend automatically.\n`);
