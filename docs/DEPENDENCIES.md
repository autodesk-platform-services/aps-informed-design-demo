# Dependencies and `npm audit`

Where this repo stands on `npm audit`, and which findings are real for *you*
rather than for the build machine. Run the audits yourself:

```bash
npm audit                    # root — Electron packaging tooling
cd frontend && npm audit     # the React app
cd backend  && npm audit     # the Express API
```

## Node version

**Node 20.19 or newer** (22 LTS is a good choice). This is enforced by `engines`
in the root `package.json`.

`electron-builder` 26 is the first release that pulls a patched `tar`, and it
`require()`s an ESM-only module. On Node older than 20.19 that throws
`require of blake2.js ... not supported`, and `npm run build:electron` dies
before it starts.

## Lockfiles are not published

There are no `package-lock.json` files in this repo. They were generated against
a private npm mirror and their `resolved` URLs pointed at it, so publishing them
would have been useless to you and mildly disclosive for us.

The practical consequence: **a fresh `npm install` resolves transitive
dependencies itself.** Most of the transitive advisories you might read about are
already fixed by whatever npm picks today, and the versions that matter are the
ones *declared* in the three `package.json` files. If you want reproducible
installs, generate your own lockfiles against `registry.npmjs.org` and commit
them in your fork.

## Root — packaging tooling: clean

`electron` and `electron-builder` are the only root dependencies, and both are
`devDependencies` — they build and run the desktop shell and ship nothing into
the web app.

They were on `electron@^28` / `electron-builder@^24`, which between them reported
9 advisories (8 high, 1 critical) — three Electron issues, and the `node-tar`
cluster by way of `app-builder-lib`. Now on `electron@^43` /
`electron-builder@^26`: **0 vulnerabilities.**

## Backend: clean

`adm-zip` moved to `^0.6.0` for GHSA-xcpc-8h2w-3j85 (a crafted ZIP triggering a
4 GB allocation). 0.6.0 is nominally a breaking change, but it hardens path
handling during *extraction to disk*, and this repo only ever reads entries in
memory (`getEntries()` / `getData()` in `backend/routes/outputRoutes.js`), so
nothing here changes behaviour.

The `express` advisories (`body-parser`, `path-to-regexp`, `qs`) are transitive
and already satisfied by the current `express@^4` resolution.

## The react-scripts patch

`frontend/patches/react-scripts+5.0.1.patch` is applied automatically by
`patch-package` on `npm install` (via the frontend's `postinstall`).

It changes one thing. `react-scripts` 5.0.1 still drives webpack-dev-server
through the deprecated `onBeforeSetupMiddleware` / `onAfterSetupMiddleware`
options, so every `npm start` opened with two warnings:

```
[DEP_WEBPACK_DEV_SERVER_ON_BEFORE_SETUP_MIDDLEWARE] DeprecationWarning: ...
[DEP_WEBPACK_DEV_SERVER_ON_AFTER_SETUP_MIDDLEWARE]  DeprecationWarning: ...
```

They looked like a transient error rather than permanent noise, because
react-scripts clears the terminal once the compile succeeds and takes them with
it. The patch replaces both hooks with the supported `setupMiddlewares`,
preserving order exactly — what ran in the "before" hook is `unshift`ed so it
still precedes the built-in middlewares, what ran in the "after" hook is
`push`ed so it still follows them (including the proxy).

Verified by running the dev server on the original and patched code and
comparing: `/`, `/ws`, `/service-worker.js` and a proxied `/api/*` request behave
identically. The only difference is two fewer warnings.

There is no upstream fix to wait for — Create React App is unmaintained. If you
migrate off CRA, delete the patch and the `postinstall` with it. If the patch
ever fails to apply, `patch-package` warns but does **not** fail the install on
purpose: you get the deprecation warnings back, nothing worse.

## Frontend: 25 remaining, and why

`npm audit fix` takes the frontend from 49 to 25. What is left splits in two,
and neither part is a fix we can apply for you:

### 1. Create React App build tooling (24 of them)

`postcss`, `serialize-javascript`, `webpack-dev-server`, `sockjs`,
`resolve-url-loader`, `css-minimizer-webpack-plugin`, `uuid`. npm reports the fix
as `react-scripts@0.0.0`, which is npm's way of saying **no fixed version
exists** — Create React App is unmaintained.

These are all **build-time and dev-server** packages. None of them is in the
production bundle that `npm run build` emits, so none reaches anyone using the
app. Clearing them for real means migrating off CRA (Vite is the usual
destination), which is a bigger change than a sample app needs — but it is the
right move if you are starting from this as a base.

### 2. `xlsx` — a real runtime dependency, no npm fix

`xlsx` (SheetJS) `^0.18.5` carries a prototype-pollution and a ReDoS advisory,
and `npm audit` reports `fixAvailable: false`. That is accurate: SheetJS stopped
publishing to the npm registry at 0.18.5 and now distributes from
`https://cdn.sheetjs.com/`, so **no registry version fixes this.**

The options, none of them free:

- **Install from the SheetJS CDN** — the vendor's own upgrade path
  (`"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`). Fixes the
  advisory, but a non-registry URL dependency breaks installs behind a corporate
  npm mirror or an air-gapped registry.
- **Replace it** with a maintained library (`exceljs`, `write-excel-file`). This
  repo uses `xlsx` for both directions — multi-sheet export of variants and mid
  elements, and parsing an uploaded `.csv`/`.xlsx` for bulk variant creation — so
  it is a real change across several call sites, not a drop-in.
- **Accept it**, knowing the reachable path: both advisories require *parsing a
  malicious spreadsheet*, and the only file parsed is one the signed-in user
  picks themselves for bulk import.

This repo currently accepts it. Decide for your own deployment — if untrusted
users can upload spreadsheets, decide differently.
