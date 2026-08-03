#!/usr/bin/env node
/**
 * Fetches the OAuth login URL from the backend and opens it in the default browser.
 * Backend must be running. Add http://localhost:8080/api/aps/callback to your APS app redirect URIs.
 *
 * Usage: node scripts/open-login-url.js [baseUrl]
 * Example: node scripts/open-login-url.js
 *          node scripts/open-login-url.js http://localhost:8080
 */

const baseUrl = process.argv[2] || 'http://localhost:8080';
const loginUrlEndpoint = `${baseUrl}/api/aps/login-url`;

async function main() {
  let res;
  try {
    res = await fetch(loginUrlEndpoint);
  } catch (err) {
    console.error('Could not reach backend at', baseUrl, '-', err.message);
    console.error('Make sure the backend is running (e.g. npm start in backend/).');
    process.exit(1);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Backend did not return JSON:', text.slice(0, 200));
    process.exit(1);
  }

  if (!res.ok) {
    console.error('Backend error:', data.error || data.message || res.status);
    if (data.message) console.error(data.message);
    process.exit(1);
  }

  const loginUrl = data.loginUrl;
  if (typeof loginUrl !== 'string' || !loginUrl.startsWith('http')) {
    console.error('Backend did not return a valid loginUrl:', data);
    process.exit(1);
  }

  const { execSync } = require('child_process');
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  execSync(`${open} "${loginUrl}"`, { stdio: 'inherit' });
  console.log('Opened login URL in browser. After signing in, the backend callback exchanges the code for a token.');
}

main();
