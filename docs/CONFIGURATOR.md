# The reference configurator

[← back to the README](../README.md)

A reference for what an end-customer-facing configurator can look like on Informed Design: a catalog of products, a form generated from each release's own rules, a live 3D preview, and downloads.

Take it as a starting point rather than a finished app. The valuable part is not the UI — it is the code that turns what the API returns into a form that behaves correctly. Those behaviours are documented in [AI_BRIEF.md](../AI_BRIEF.md).

---

## What it looks like

You land on a **product gallery** — every Informed Design product in one folder, with thumbnails and a release picker. Choose one and you get the configurator:

```
┌───────────────────────────────────────────────────────────────────────┐
│  Your Company / Products / FL-120 UCW (PRD)      Release 2            │
├──────────────────────┬────────────────────────────────────────────────┤
│ Name                 │                                                │
│ [FL-120 UCW_1200_…]  │                                                │
│ Width (mm)           │                                                │
│ [1200          ⌃⌄]   │              live 3D preview of                │
│ 300 to 3000 -        │              the configured variant            │
│ increments of 5      │                                                │
│ Infill Type          │                                                │
│ [Vision         ▾]   │                                                │
│ Family Type Name     │                                                │
│ [FL120 UCW 1200 1500]│                                                │
├──────────────────────┤                                                │
│ [ Configure ]  [ ⤓ ] │                                                │
└──────────────────────┴────────────────────────────────────────────────┘
```

- **The form is generated from the release.** Fields, types, limits, dropdown options, which fields are read-only and which are hidden all come from the API — nothing about any specific product is hard-coded.
- **The release's rules are enforced**, including cross-field rules. Nothing is created unless they pass.
- **Configure** creates a variant, generates an SVF and loads it in the Autodesk Viewer.
- **Download** offers every output type the release publishes (RFA, GLB, STEP, PDF, BOM…), and is disabled until a configuration exists.

## Two ways to run it

Same code path either way.

| | Embedded | Standalone |
|---|---|---|
| What it is | the configurator inside the demo app, driven by its pickers | the template you would build on — own header, no pickers |
| Turn on | `IND_CONFIGURATOR=false`, then the **Demo Configurator** toggle | `IND_CONFIGURATOR=true` |
| Where it gets the folder | whatever you selected in the demo app | `frontend/.env` |
| Good for | trying it against your own products in seconds | seeing the shippable shape |

**Which one you get depends on the build flag, not on dev vs production.**
`IND_CONFIGURATOR=true` means "this build *is* the configurator", so it renders
standalone and reads `ACC_PROJECT_ID` / `ACC_FOLDER_URN` from `.env` — in
development and in a packaged build alike. Leave the flag off and the configurator
renders embedded, driven by the demo app's pickers, again in both. `?standalone=1`
forces the standalone view for checking that experience:

```
localhost:3000?standalone=1
```

> This used to key off `NODE_ENV`, so a development run was *always* embedded and
> silently ignored the two `ACC_*` ids, while the packaged desktop app was always
> standalone — where the Demo Configurator toggle did nothing at all, because the
> demo app refuses to embed when standalone is on. Both are fixed; dev and the
> packaged app now behave identically.

**Which app renders** is decided by, in order: `?configurator=1` / `?configurator=0`
in the URL, then your last click on the **Demo App / Demo Configurator** toggle,
then `IND_CONFIGURATOR` from `.env`. The remembered click is scoped to the `.env`
value it was made against, so **editing `IND_CONFIGURATOR` always wins** — it
used to be outranked by a months-old toggle click with nothing to explain why.
`?configurator=auto` clears the remembered choice outright.

## Pointing it at your data

Only needed for **standalone** — embedded uses the demo app's selection.

Find the two IDs in the demo app: select your account, project and a folder containing Informed Design products, then **user menu → Show IDs**.

```bash
# frontend/.env
IND_CONFIGURATOR=true
ACC_PROJECT_ID=b.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx    # "b." prefix is fine
ACC_FOLDER_URN=urn:adsk.wipprod:fs.folder:co.XXXXXXXXXXXXXXXXXXXXXX
```

Saving `.env` restarts the frontend (~6s). Confirm which app loaded:

```
[frontend] IND_CONFIGURATOR=true — rendering the single-page configurator.
```

No account ID is needed — Informed Design keys off `accessId = projectId|folderUrn` with `accessType=ACC`. Product and release aren't configured either; you pick them from the gallery.

## Rebranding

`frontend/.env`, no code changes — the values become CSS custom properties.

```bash
YOUR_BRAND_NAME=Your Company
YOUR_BRAND_TITLE=Product Configurator
YOUR_BRAND_LOGO=/logo-placeholder.svg    # a file in frontend/public/, not a URL
YOUR_BRAND_PRIMARY=#0696d7
YOUR_BRAND_ACCENT=#1a1a1a
YOUR_BRAND_BG=#f4f5f7
```

These names are deliberately un-prefixed. Create React App only exposes `REACT_APP_*`, so [scripts/with-config-env.js](../scripts/with-config-env.js) mirrors each to a `REACT_APP_` copy at start time.

## What the form does for you

All derived from the release at runtime. This is the part worth copying, and the part an AI will get wrong without [AI_BRIEF.md](../AI_BRIEF.md).

- **Per-parameter limits.** Each field gets its own min/max/increment. (Reading them per-parameter matters: a naive parse of the rules script gives every field the *first* limits it finds.)
- **Typed controls.** Numeric fields get a spinner that snaps to the release's increment and clamps to range; parameters with an allowed-value list become dropdowns.
- **Conditional visibility.** A field can be hidden by the rules based on another field's value. This cannot be read from the rules script — only `rules:evaluate` resolves it.
- **Read-only fields.** Computed by Informed Design, shown but not editable, excluded from the variant payload and from the generated name.
- **Quoting.** Text parameters arrive quoted (`"Vision"`). Quotes are stripped for display and restored on every outbound call.
- **Name sanitising.** The API rejects `< > : " / \ | ? * ` and more in variant names — and Inventor text values contain quotes, so generated names hit this immediately.
- **Validation gates configuration.** Nothing is created unless the release's rules pass. Validation runs on committed changes, never per keystroke.

## The code

| File | Lines | What it holds |
|---|---|---|
| [configuratorService.js](../frontend/src/configurator/configuratorService.js) | ~600 | every API call and every response quirk |
| [ConfiguratorApp.js](../frontend/src/configurator/ConfiguratorApp.js) | ~750 | state, the configure flow, the validation gate |
| [ConfiguratorForm.js](../frontend/src/configurator/ConfiguratorForm.js) | ~440 | turning parameters into fields |
| [helpers.js](../frontend/src/utils/helpers.js) | ~330 | rule parsing, name sanitising, increment snapping |
| [DebugPanel.js](../frontend/src/configurator/DebugPanel.js) | ~120 | dev-only raw payload inspector |

The API calls it makes, in order:

| # | Call | Why |
|---|---|---|
| 1 | `GET /products` (by project + folder) | the gallery; each product carries its releases |
| 2 | `GET /releases/{id}` | the parameters — names, types, defaults, units |
| 3 | `GET /rules/{rulesKey}` | limits, options, computed and read-only fields |
| 4 | `POST /rules:evaluate` | **the important one** — resolves the rules against current values |
| 5 | `POST /variants` → `POST /outputs` → poll → `GET …/svf` | build it and show it |

## Troubleshooting

| Symptom | Cause |
|---|---|
| "No Informed Design products were found" | wrong folder, or the folder has no published products |
| Form shows raw parameter names | that release publishes no labels — expected, it falls back to names |
| A field will not appear | the rules may be hiding it; open `?debug=1` → **POST /rules:evaluate** and check `visible` |
| Wrong limits on a field | check `?debug=1` → **rules (Input)** for that parameter's own min/max |
| "Bad Request" creating a variant | the full upstream error is printed in the backend log |
| Frontend ignores `.env` | watch for the `[frontend] IND_CONFIGURATOR=…` line on startup; hard-refresh if it disagrees |

**The debug panel** answers "what did the API actually say?" — run with `?debug=1` (development builds only) for the raw rules, evaluate and release payloads, with a copy button. It is off by default; `localStorage.setItem('cfg_debug','1')` keeps it on.

See also: [setup problems](../README.md#common-setup-problems) · [authentication](AUTHENTICATION.md) · [AI_BRIEF.md](../AI_BRIEF.md)
