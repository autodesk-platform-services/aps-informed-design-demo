# AI Brief — Building a Product Configurator on Autodesk Informed Design

> **Hand this whole file to your AI assistant.** It is self-contained: architecture, exact API contracts, real captured payloads, and the behaviours that are not in the public API docs. An assistant that follows it can adapt the reference implementation in this repo or rebuild the same thing in another stack.
>
> **Read §4 before writing any form code.** Everything there was learned by watching real API traffic. Skipping it produces a configurator that looks correct and fails on real products.

---

## 1. What you are building

A single-page product configurator:

1. **Gallery** — every Informed Design product in one ACC folder, with thumbnails and a release picker.
2. **Configure view** — a form generated from the chosen release, and a live 3D preview beside it.
3. **Configure** — validate against the release's rules, create a variant, generate an SVF, load it in the Autodesk Viewer.
4. **Download** — any output type the release publishes (RFA, GLB, STEP, PDF, BOM…), for the variant currently on screen.

**Nothing about any specific product may be hard-coded.** Field names, types, limits, dropdown options, which fields are read-only, which are hidden — all come from the API at runtime. If you find yourself writing `if (name === 'Width')`, you have taken a wrong turn.

## 2. What the human must supply

Only this. Everything else is discoverable at runtime.

| Value | Where it comes from |
|---|---|
| APS Client ID + Secret | <https://aps.autodesk.com/myapps> |
| ACC project id | e.g. `b.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (the `b.` prefix is fine) |
| ACC folder urn | e.g. `urn:adsk.wipprod:fs.folder:co.XXXXXXXXXXXXXXXXXXXXXX` |
| Branding | company name, primary colour, logo file |

> ## ⚠️ PREREQUISITE — the APS app must be added to ACC
>
> **Creating an APS app is not enough.** The app has to be authorised inside ACC before it can see any Informed Design data:
>
> 1. Add it as a **custom integration** on the ACC account — Account Admin → Apps & Integrations → Custom Integrations → add the **Client ID**.
> 2. Make sure it has access to the **project** holding your products.
>
> Until this is done, every Informed Design call returns **401**, no matter how valid the token is. There is no error message that tells you this is the cause, and it is the single most common reason a correct integration appears broken.
>
> This is an **ACC administrator** action. If you are not one, you need someone who is — plan for it, because it can block you for days.

**Two more setup details, both of which also produce a bare 401:**

1. The APS app's **Callback URL** must exactly match your redirect URI (`http://localhost:3000` in dev), character for character.
2. The app type must be **Traditional Web App** — not Single Page App or Server Application. It cannot be changed after creation.

## 3. Architecture

```
Browser                        Your server                    Autodesk
────────                       ───────────                    ────────
configurator UI ── /api/… ───► thin proxy ── Bearer token ──► Informed Design API
```

The server exists so the **client secret never reaches the browser**. It forwards requests, adds the `Authorization` header, and normalises errors. Keep all configurator logic client-side; keep the proxy dumb.

**Auth: 3-legged OAuth (3LO).** Each user signs in with their own Autodesk account; their token is used for every call.

- **2-legged tokens do not work.** `/products` and `/releases` return 401.
- **Secure Service Accounts (SSA) are not implemented in this repo.** For a public-facing configurator where your customers have no Autodesk account, SSA is what you want — the server holds a service identity and your users never see Autodesk auth. The swap is contained to the auth layer: the server mints and caches its own token, the login flow disappears, and the browser stops sending `Authorization`. Confirm licensing/entitlement with Autodesk before designing around it.
- **Beware a false pass:** if your proxy caches responses, an unauthenticated run can be served earlier authenticated results and look like it worked. Verify against the upstream call, not your own 200.

### Required headers on every Autodesk call

```
Authorization: Bearer <token>
Content-Type:  application/json
x-ads-region:  US
```

### Access identity

Informed Design does not take an account id. It takes:

```
accessType = ACC
accessId   = <projectId without the "b." prefix>|<folderUrn>
```

## 4. The API, and what it actually does

Base: `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1`

### 4.1 Products and releases

```
GET /products?accessType=ACC&accessId=<accessId>
GET /releases/{releaseId}?accessId=<accessId>&accessType=ACC
```

Products carry their releases inline, so the gallery needs one call.

**Parse defensively.** List responses have appeared as a bare array and under `results`, `data`, `products` and `items`. Write one extractor that tries the known keys and then falls back to "the first array-valued property".

A release looks like this (real, IDs redacted):

```json
{
  "id": "<release-guid>", "number": 1, "state": "ACTIVE",
  "isConfigurable": true,
  "rules": "<base64 key>",                // a key, not the rules themselves
  "layout": null,                         // the authored Form; often null
  "parameters": [
    { "name": "Width",  "type": "NUMERIC", "defaultValue": 1200, "unit": "mm", "isInput": true },
    { "name": "Height", "type": "NUMERIC", "defaultValue": 1500, "unit": "mm", "isInput": true },
    { "name": "Infill_Type", "type": "TEXT", "defaultValue": "\"Vision\"", "isInput": true },
    { "name": "Family_Type_Name", "type": "TEXT", "defaultValue": "\"FL120 UCW 1200 1500\"", "isInput": true }
  ],
  "outputSettings": [ { "type": "RFA", "representations": ["[Primary]"], … } ]
}
```

Note already:

- `type` is **UPPER CASE** (`NUMERIC`, `TEXT`). Compare case-insensitively — a case-sensitive check silently routes numerics down the text path and drops min/max.
- `unit` lives on the release's parameters, not on the product.
- **`isInput` is `true` for everything**, including computed read-only fields. It is not a usable signal for editability. Use the rules (§4.3).
- Text `defaultValue`s **include quote characters** (§4.4).
- `outputSettings` may be a **map or an array**. Handle both.
- `parameters[].label` may carry a display label; fall back to `name`.

### 4.2 Rules — a script, not data

`release.rules` is a key. Fetch it:

```
GET /rules/{rulesKey}
```

The response is only ever two fields:

```json
{ "lang": "javascript", "code": "parameters['Width'].min = 300;\n…" }
```

The `code` is JavaScript that assigns onto a `parameters` map. A real one:

```javascript
parameters['Width'].min = 300;
parameters['Width'].max = 3000;
parameters['Width'].increment = 5;
parameters['Height'].min = 300;
parameters['Height'].max = 5000;
parameters['Height'].increment = 5;

if ((parameters['Infill_Type'].value) == 'Vision') {
  parameters['Infill_Color'].visible = false;
  parameters['Infill_Color'].applicable = false;
} else {
  parameters['Infill_Color'].visible = true;
  parameters['Infill_Color'].applicable = true;
}

parameters['Family_Type_Name'].value = (['FL120 UCW',' ',parameters['Width'].value,' ',parameters['Height'].value].join(''));
parameters['Family_Type_Name'].readOnly = true;

parameters['Infill_Type'].values  = ['Vision', 'Opaque'];
parameters['Infill_Color'].values = ['Soft White', 'Warm Sand', /* … */];
parameters['Frame_Finish'].values = ['Dark Bronze', 'Champagne', 'Matte Black ', 'Match Infill'];
```

> ### ⚠️ Parse this PER PARAMETER
>
> The single most damaging shortcut is scanning the whole script for `min`/`max` and applying what you find to every field. Do that and every parameter inherits `Width`'s limits: text fields sprout "min 300 max 3000", and `Height` shows a maximum of 3000 when its real maximum is 5000.
>
> Match assignments of the form `parameters['NAME'].prop = <literal>` and key the results by name.

> ### ⚠️ Do NOT read `visible` / `applicable` from this script
>
> They are assigned **inside `if/else` branches**. A static scan just takes whichever branch appears last, which would hide `Infill_Color` permanently. Only §4.3 can resolve them.

Do not `eval()` the script. It is API-supplied code.

### 4.3 `rules:evaluate` — the authoritative source

```
POST /rules:evaluate
{ "rules": "<rulesKey>", "inputs": [ { "name": "Width", "value": 1200, "type": "NUMERIC" }, … ] }
```

This returns the resolved state of every parameter, conditionals included. **This, not the script, is what the form should render from.** Real response:

```json
{
  "evaluatedInputs": [
    { "name": "Width", "type": "NUMERIC", "visible": true, "readOnly": false,
      "label": "", "min": 300, "max": 3000, "increment": 5, "value": 1200 },
    { "name": "Infill_Type", "type": "TEXT", "value": "\"Vision\"", "visible": true,
      "readOnly": false, "label": "", "values": ["\"Vision\"", "\"Opaque\""] },
    { "name": "Infill_Color", "type": "TEXT", "value": "\"Soft White\"",
      "visible": false, "applicable": false, "readOnly": false, "label": "",
      "values": ["\"Soft White\"", "\"Warm Sand\""] },
    { "name": "Family_Type_Name", "type": "TEXT", "value": "\"FL120 UCW 1200 1500\"",
      "visible": true, "readOnly": true, "label": "" }
  ]
}
```

`Infill_Color` is `visible: false` because `Infill_Type` is `Vision` — the conditional, already resolved. Use `visible`, `readOnly`, `min`, `max`, `increment`, `values`, `label`, `value` from here, and fall back to the parsed script only before the first evaluation returns.

**When to call it.** On *committed* changes only: a blur, a dropdown selection, a spinner press. **Never per keystroke** — typing `1000` would be evaluated as `1`, then `10`, then `100`, each rejected as below the minimum before the user finished.

**Implementation trap:** you cannot call it from inside a change handler, because a parameter's visibility depends on the *other* parameters and the handler closes over the pre-change values. Bump a counter on commit and evaluate in an effect that runs afterwards, when the values are current.

#### "Input Value Updated" is not an error

Failures come back under `error.errors[]`, but so do *adjustments*:

```json
{ "error": { "title": "Invalid Inputs", "errors": [
  { "field": "inputs", "parameter": "Family_Type_Name",
    "title": "Input Value Updated",
    "detail": "Input value was updated after evaluating against the rule.",
    "value": "\"FL120 UCW 1200 1500\"", "updatedValue": "\"FL120 UCW 1205 1500\"" } ] } }
```

That is the engine reporting that it recomputed a value — normal, and it happens every time an input feeding a computed parameter changes. **Treat `title: "Input Value Updated"` as an outcome, not a rejection.** Render it as an error and the form looks broken for doing exactly what the rules say. Distinguish on `title`; only genuine errors should block or turn a field red.

### 4.4 Text parameters arrive quoted

Inventor text values include their quote characters. The API returns `"\"Vision\""` — the string `"Vision"`, quotes and all.

**Strip for display, restore on every outbound call.** Both directions matter:

- Show `Vision`, not `"Vision"`. Dropdown options need stripping too, or the current value won't match any option and the select renders blank.
- Send `"Vision"` back — to `rules:evaluate` **and** to variant creation. Send it bare and the evaluator canonicalises it and reports "value was updated" against every text field, which then renders as an error on all of them.

Remember which parameters arrived quoted, and re-wrap exactly those.

### 4.5 Read-only parameters

The rules mark computed parameters `readOnly = true` (`Family_Type_Name` above is derived from `Width` and `Height`).

- **Show them, don't let them be edited.**
- **Do not send them** when creating a variant — Informed Design computes them.
- **Do not include them in a generated variant name** — the client never updates them, so a name built from one embeds a stale value.
- After a successful configure, refresh them from the latest `evaluatedInputs`.

### 4.6 Creating a variant

```
POST /variants?releaseId=<id>&accessId=<accessId>&accessType=ACC
{ "name": "<variant name>", "inputs": [ { "name": "Width", "value": 1200 }, … ] }
```

> ### ⚠️ Variant names reject a set of characters
>
> ```
> < > : " / \ | ? * `  \n \r \t NUL FF  ¢ ™ $ ®
> ```
>
> Regex from the API's own 400: `^[^<>:"\/|?*`\n\r\t\0\f¢™$®]*$`
>
> This bites immediately, because **text parameter values contain quotes** (§4.4). Any generated name built by joining parameter values — `Product_1200_"Vision"_"Soft White"` — is rejected. Sanitize names, and sanitize again at the point of sending in case a user typed their own.

The real 400, for reference:

```json
{ "title": "Bad Request", "errors": [ { "title": "invalid_format",
  "detail": "String contains one or more disallowed characters: …",
  "field": "name" } ] }
```

**Surface upstream errors properly.** Informed Design returns `title` and `Detail` plus a per-field `errors[]`. If your proxy only looks for `developerMessage`/`error`/`message`, every failure collapses to a generic string and you will debug blind. Forward the whole upstream body.

### 4.7 Outputs and the viewer

```
POST /outputs { "variantId": "<id>", "outputs": [ { "type": "SVF", "settings": { … } } ] }
GET  /outputs/{outputId}            → poll until status is SUCCESS
GET  /outputs/{outputId}/svf        → a URL for the Autodesk Viewer
GET  /outputs/{outputId}/download   → bytes, for every other type
```

- **SVF** is the viewer format. Generate it for the preview; exclude it from the user-facing download list.
- **PDF, DWG and IDW take no `representation`.** Others do. Asking for one where it doesn't belong, or omitting one where it does, fails.
- `outputSettings` being a map *or* an array matters here: handle both, or PDF goes up with no `templatePath` and returns "Bad Request".

## 5. Form behaviour to implement

| Behaviour | Rule |
|---|---|
| Field type | `NUMERIC` → number input; a parameter with `values` → dropdown; otherwise text. Compare types case-insensitively. |
| Limits | per parameter, from `evaluatedInputs` (§4.2 warning) |
| Increment | snap typed values to the step, anchored at `min`; clamp into range. Clamp properly — stepping back one increment from 4000 with max 3000 lands on 3995, still invalid. |
| Labels | `evaluatedInputs.label` → `parameters[].label` → parameter name. Don't append the unit if the label already contains it. |
| Visibility | hide when `visible === false` |
| Read-only | §4.5 |
| Validation | gates configuration — no variant, no output, no downloads unless the rules pass. Run on commit, not per keystroke. |
| Downloads | only for the configuration currently on screen; invalidate on any edit |

**Two UI traps that produce a dead button:**

1. Don't disable the submit while validating. Clicking it blurs the focused field, the blur starts validation, the button goes disabled mid-click, and the form never submits. Disable only while actually generating.
2. If you put `min`/`max` on number inputs, set `noValidate` on the form. Otherwise the browser's constraint validation silently refuses to submit — the click fires, no submit event follows, and the only feedback is a native tooltip that bypasses your own error handling.

## 6. Build order

1. Proxy + 3LO login. Verify a token reaches `/products`.
2. Gallery from `/products`. Thumbnails need a Bearer header, so fetch as a blob.
3. `/releases/{id}` → render fields from `parameters` (types, defaults, units).
4. `/rules/{key}` → per-parameter limits and value lists.
5. `rules:evaluate` on commit → make it authoritative; visibility and read-only now work.
6. Configure: validate → `/variants` → `/outputs` → poll → viewer. Fit the camera on load, or a larger variant opens off-screen.
7. Downloads for the active configuration.

### Acceptance checks

- A text parameter displays unquoted and round-trips without a validation error.
- Two numeric parameters with *different* maximums each show their own.
- A parameter the rules hide is absent, and returns when the controlling value changes.
- A computed read-only parameter is visible, uneditable, and absent from the variant payload.
- A product whose name or values contain quotes creates a variant successfully.
- Typing a four-digit number triggers no validation until blur.
- Configure with an invalid value creates nothing and says why.

## 7. Reference implementation

Working code for all of the above:

| File | What to look at |
|---|---|
| `frontend/src/configurator/configuratorService.js` | every call and every response quirk |
| `frontend/src/configurator/ConfiguratorApp.js` | state, configure flow, validation gate |
| `frontend/src/configurator/ConfiguratorForm.js` | parameters → fields |
| `frontend/src/utils/helpers.js` | rule parsing, name sanitising, increment snapping |
| `frontend/src/configurator/DebugPanel.js` | dev-only raw payload viewer — run with `?debug=1` |
| `backend/routes/productRoutes.js` | products, releases, rules, evaluate |
| `backend/routes/variantRoutes.js` | variant creation and error forwarding |

When something renders wrongly, the first question is always *what did the API actually say* — `?debug=1` answers it with the raw rules, evaluate and release payloads.

## 8. Known gaps

- **`release.layout` is `null`** on releases tested so far. This is where the authored Inventor **Form** lives — field labels and ordering. Until it is populated, labels come from `parameters[].label` and ordering follows `parameters[]`.
- **SSA is not implemented** (§3).
- **`applicable`** is returned by the evaluator but unused here. A parameter that is visible but not applicable is still sent on the variant.
- Rules can set `visible`/`values` **inside conditionals**; only `rules:evaluate` resolves those. The static parser handles top-level assignments only, as a pre-first-evaluation fallback.

## 9. Security

- The client secret lives **server-side only**, in an untracked `.env`. It must never reach the browser or the repo.
- Never copy `.env` to `.env.bak`/`.env.old` "for safety" — those names are not in the ignore list, and that is a classic way for a credential to end up committed. `scripts/check-secrets.js` runs as a pre-commit hook and blocks it.
- If a credential is ever committed, **rotate it**. Deleting the file does not remove it from history.
