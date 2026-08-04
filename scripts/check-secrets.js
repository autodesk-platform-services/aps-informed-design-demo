#!/usr/bin/env node
/**
 * Blocks commits that contain credentials.
 *
 * A .gitignore only ever covers the filenames someone thought of — a stray
 * `.env.bak` or `.env.save` slips straight past a rule that lists `.env`. So
 * this checks CONTENT instead: what a line looks like, not what the file is
 * called.
 *
 * Runs from .githooks/pre-commit on staged changes. Also runnable over the whole
 * working tree with `npm run check:secrets`.
 *
 * Deliberate override: `git commit --no-verify`. If something does leak, rotate
 * the credential — deleting the file does not remove it from history.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/** Files whose very presence is a mistake, whatever is inside them. */
const FORBIDDEN_PATHS = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[^/]+$/, // .env.bak, .env.local, .env.save… but not .env.example
  /(^|\/)[^/]*\.(pem|pfx|p12|keystore|jks)$/,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
];

/**
 * Values that are obviously not real. Without these the repo's own docs and
 * .env.example would fail the check, and a guardrail that cries wolf gets
 * disabled — which is worse than not having one.
 */
const PLACEHOLDER = /^(|["']?)(your[_-]?|my[_-]?|example|placeholder|changeme|dummy|fake|test|xxx+|\.\.\.|<.*>|\$\{.*\}|%.*%)/i;

const SECRET_PATTERNS = [
  {
    name: 'APS client secret',
    // The one credential this app needs, so the one most likely to slip out.
    re: /\bAPS_CLIENT_SECRET\s*[:=]\s*["']?([^\s"'#]{8,})/i,
  },
  {
    name: 'secret-looking assignment',
    // Anchored at end-of-line and limited to literal-shaped values, so ordinary
    // code that merely *mentions* a secret — `const clientSecret =
    // process.env.APS_CLIENT_SECRET;` — does not trip it. Trailing `;` `,` `)`
    // all fail the anchor, which is most of the difference.
    re: /(?:^|\s)(?:export\s+)?[A-Za-z0-9_]*(?:SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CLIENT_?SECRET|AUTH_?TOKEN)[A-Za-z0-9_]*\s*[:=]\s*(?:"([^"]{12,})"|'([^']{12,})'|([A-Za-z0-9_\-+/=.]{12,}))\s*$/i,
  },
  { name: 'private key block', re: /(-----BEGIN [A-Z ]*PRIVATE KEY-----)/ },
  { name: 'AWS access key id', re: /\b(AKIA[0-9A-Z]{16})\b/ },
  { name: 'Slack token', re: /\b(xox[abprs]-[0-9A-Za-z-]{10,})/ },
  { name: 'GitHub token', re: /\b((?:ghp|gho|ghu|ghs|ghr|github_pat)_[0-9A-Za-z_]{20,})/ },
  {
    name: 'bearer token literal',
    re: /\bBearer\s+([A-Za-z0-9_\-.]{30,})/,
  },
];

/** Lines a scanner should not judge: its own rules, and explicit opt-outs. */
const IGNORE_LINE = /allow-?secret|pragma:\s*allowlist|check-secrets/i;

function scanText(text, file) {
  const findings = [];
  text.split('\n').forEach((line, i) => {
    if (IGNORE_LINE.test(line)) return;
    for (const { name, re } of SECRET_PATTERNS) {
      const m = line.match(re);
      if (!m) continue;
      // Whichever alternative matched (quoted, single-quoted, or bare).
      const value = (m.slice(1).find((g) => g !== undefined) || '').trim();
      if (PLACEHOLDER.test(value)) continue;
      // A value with no variety is a description, not a credential
      // ("SECRET=redacted", "PASSWORD=see 1password").
      if (/^[a-z_ -]+$/.test(value)) continue;
      // A reference to a value, not the value: `process.env.X`, `creds.secret`.
      if (/^(process|req|res|ctx|config|opts|options|creds|credentials|customCredentials|form|formData|data|body|env)\b/i.test(value)) continue;
      if (/process\.env/.test(value)) continue;
      // Real credentials mix character classes; `averyveryverylongword` does not.
      if (value.length < 20 && !(/[a-z]/.test(value) && /[A-Z0-9]/.test(value))) continue;
      findings.push({
        file,
        line: i + 1,
        kind: name,
        preview: line.trim().slice(0, 60).replace(value.slice(4), '…'),
      });
      break;
    }
  });
  return findings;
}

function stagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function stagedContent(file) {
  try {
    return execSync(`git show :${JSON.stringify(file)}`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (/^(node_modules|\.git|build|dist|coverage)$/.test(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const scanAll = process.argv.includes('--all');

/**
 * In --all mode, skip what git ignores. Your own untracked `.env` holding a real
 * secret is correct and expected — flagging it would train you to ignore this
 * tool. Only things git could actually publish are of interest.
 */
function ignoredByGit(candidates) {
  if (!candidates.length) return new Set();
  try {
    const out = execSync('git check-ignore --stdin', {
      input: candidates.join('\n'),
      encoding: 'utf8',
    });
    return new Set(out.split('\n').filter(Boolean));
  } catch {
    return new Set(); // exit 1 simply means "nothing ignored"
  }
}

let files;
if (scanAll) {
  const all = walk(process.cwd()).map((f) => path.relative(process.cwd(), f));
  const ignored = ignoredByGit(all);
  files = all.filter((f) => !ignored.has(f));
} else {
  files = stagedFiles();
}

const blockedPaths = files.filter((f) => FORBIDDEN_PATHS.some((re) => re.test(f)));
const findings = [];

for (const file of files) {
  if (/\.(png|jpe?g|gif|svg|ico|pdf|zip|woff2?|ttf|eot|mp4)$/i.test(file)) continue;
  const text = scanAll
    ? (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
    : stagedContent(file);
  if (text.includes('\0')) continue; // binary
  findings.push(...scanText(text, file));
}

if (!blockedPaths.length && !findings.length) {
  if (scanAll) console.log(`check-secrets: scanned ${files.length} files, nothing found.`);
  process.exit(0);
}

console.error('\n\x1b[31m✖ check-secrets: refusing to commit\x1b[0m\n');

if (blockedPaths.length) {
  console.error('  These files hold credentials by definition and must never be tracked:');
  blockedPaths.forEach((f) => console.error(`    ${f}`));
  console.error('\n  Fix:  git rm --cached <file>      (keeps your local copy)\n');
}

if (findings.length) {
  console.error('  Credential-shaped content in staged changes:');
  findings.forEach((f) => console.error(`    ${f.file}:${f.line}  [${f.kind}]  ${f.preview}`));
  console.error('\n  Fix:  move the value into an untracked .env and commit a placeholder.');
  console.error('        If it is genuinely not a secret, add "allow-secret" to the line.\n');
}

console.error('  Override (be sure):  git commit --no-verify');
console.error('  If a real credential has already been pushed, ROTATE IT — deleting');
console.error('  the file does not remove it from history.\n');

process.exit(1);
