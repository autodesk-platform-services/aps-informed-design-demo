# Autodesk Informed Design — Demo App & Reference Configurator

Two working demos on the [Autodesk Informed Design API](https://aps.autodesk.com/autodesk-informed-design-api), in one repo, sharing one backend and one login. Both are meant to be read, run, copied and rewritten.

| | [**Demo app**](docs/DEMO_APP.md) | [**Reference configurator**](docs/CONFIGURATOR.md) |
|---|---|---|
| Shows | how to use the API | what you can build on it |
| On screen | accounts, projects, folders, products, releases, variants, outputs, IDs, tokens | a product catalog, a form, a 3D preview, downloads |
| Written for | you, the developer | your end customer |
| Turn on | `IND_CONFIGURATOR=false` | `IND_CONFIGURATOR=true` |

Which one loads is that single setting in `frontend/.env`, and in development you can flip between them from the menu bar without signing in again.

> **Handing this to an AI assistant?** Give it [AI_BRIEF.md](AI_BRIEF.md) — a self-contained brief with the API contracts and the behaviours that are not in the public docs. It is written to be pasted whole into Claude Code, Cursor, Copilot or similar.

---

## Quickstart

**Prerequisites:** Node.js **20.19+** (22 LTS is a good choice), npm 7+, an APS app, and an ACC project containing Informed Design products.

> Older Node runs the web app fine but cannot package the desktop build — `electron-builder` 26 needs 20.19+. See [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

```bash
git clone <this-repo> && cd ind-demo
npm install                     # installs root, frontend and backend
```

**1. Create an APS app** at [aps.autodesk.com/myapps](https://aps.autodesk.com/myapps).

- Application type must be **Traditional Web App** — this cannot be changed later.
- Set the **Callback URL** to `http://localhost:3000`.

**2. Add the app to ACC** — Account Admin → Apps & Integrations → **Custom Integrations** → add your **Client ID**, and give it access to the project holding your products.

> Creating the APS app is not enough on its own. Without this every Informed Design call returns 401, and it takes an ACC administrator. ([more](docs/AUTHENTICATION.md#prerequisite-the-aps-app-must-be-added-to-acc))

**3. Backend credentials** — `cp backend/.env.example backend/.env` and fill in:

```bash
APS_CLIENT_ID=your_client_id
APS_CLIENT_SECRET=your_client_secret
APS_REDIRECT_URI=http://localhost:3000
```

**4. Frontend config** — `cp frontend/.env.example frontend/.env`. The defaults start the demo app, which is where you find the IDs the configurator needs.

**5. Run it:**

```bash
npm run dev     # backend on :8080, frontend on :3000
```

Sign in with your Autodesk account. If the demo app lists your products, everything above is correct.

> `.env` files are gitignored, and a pre-commit hook blocks credentials from being committed. **Never commit real credentials** — history is forever, and deleting the file later does not remove it. Rotate anything that leaks.

**Then:** [set up the configurator](docs/CONFIGURATOR.md) · [tour the demo app](docs/DEMO_APP.md)

---

## How it fits together

```
Browser                         Backend (:8080)                 Autodesk
────────                        ───────────────                 ────────
demo app / configurator ──────► routes/*.js ── Bearer token ──► Informed Design API
                                holds the client secret         ACC / Data Management
```

The backend exists so the client secret never reaches the browser. It is a thin proxy — it forwards, caches briefly, and normalises errors. Both demos share it, along with the API clients and the viewer, so signing in once serves either.

```
backend/              Express proxy
  routes/             productRoutes (products, releases, rules), variantRoutes, outputRoutes
frontend/src/
  components/         the DEMO APP
  configurator/       the REFERENCE CONFIGURATOR
  services/           shared API clients
  Viewer.js           shared Autodesk Viewer wrapper
scripts/dev.js        runs backend + frontend, watches frontend/.env
```

---

## Common setup problems

Almost every first-run failure is one of these.

| Symptom | Cause |
|---|---|
| `401` on `/products` or `/releases` | the app is **not added to ACC** (quickstart step 2), or you are using a 2-legged token — Informed Design requires 3LO |
| "The requested resource does not exist" at login | the APS app is the **wrong type** — it must be Traditional Web App. Cannot be changed; create a new app. |
| Login loop / bounced back to sign-in | **Callback URL** must match `APS_REDIRECT_URI` character for character — trailing slash and case included |
| "No Informed Design products were found" | wrong folder, or the folder has no published products |

`GET /api/aps/diagnose` reports what the backend thinks your setup is and hands back a ready-made authorization URL. If pasting that URL into a browser fails the same way the app does, the problem is your APS app configuration rather than this code.

Configurator-specific issues are in [docs/CONFIGURATOR.md](docs/CONFIGURATOR.md#troubleshooting).

---

## Authentication

This repo uses **3-legged OAuth only** — every user signs in with their own Autodesk account. **Secure Service Accounts (SSA) are not wired up**, and for a public-facing configurator SSA is very likely what you want instead.

[docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) covers both, with links to the SSA documentation and what would change here.

---

## Docs

| | |
|---|---|
| [AI_BRIEF.md](AI_BRIEF.md) | **the one to hand an AI** — API contracts and the non-obvious behaviours |
| [docs/DEMO_APP.md](docs/DEMO_APP.md) | the API demo — what it does and why you would use it |
| [docs/CONFIGURATOR.md](docs/CONFIGURATOR.md) | the reference configurator — setup, branding, how the form works |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | 3LO today, the SSA path, and the ACC prerequisite |
| [docs/BUILD_GUIDE.md](docs/BUILD_GUIDE.md) | how the demo app is put together, feature by feature |
| [docs/ELECTRON_BUILD_GUIDE.md](docs/ELECTRON_BUILD_GUIDE.md) | packaging as a desktop app |
| [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) | the required Node version, and what `npm audit` reports and why |

## Licence and support

Sample code, provided as-is, to illustrate Informed Design API usage. Not a supported Autodesk product. Review it before using anything here in production.

Official API docs: <https://aps.autodesk.com/en/docs/informed-design/v1/>
