# Authentication

[← back to the README](../README.md)

**This repo uses 3-legged OAuth (3LO) only. Secure Service Accounts (SSA) are not wired up.**

Worth reading before you design around this sample, because 3LO is very likely the wrong model for the thing you are building.

---

## What this repo does

Every user signs in with their own Autodesk account, and every API call carries that user's token.

1. User clicks sign in and is redirected to Autodesk
2. Autodesk redirects back with an authorization code
3. The **backend** exchanges that code for a token — this is the only step that uses the client secret, and it never happens in the browser
4. The token is held in the browser and sent with each `/api/…` call, which the backend forwards to Autodesk

That is right for an internal tool, where the people using it already have Autodesk accounts and their own ACC permissions should apply.

## Why it is probably wrong for a configurator

A customer browsing your website does not have an Autodesk account and should not be asked for one. A public-facing configurator needs a **service identity**: your server talks to Informed Design as itself, and your users never see Autodesk auth.

That is what SSA is for.

## Secure Service Accounts (SSA)

Generally available. Authenticates with a private key and a JWT assertion, so there is no login prompt and no refresh token to manage.

| | |
|---|---|
| [Overview](https://aps.autodesk.com/en/docs/ssa/v1/developers_guide/overview/) | what SSA is and how the JWT assertion flow works |
| [Getting started](https://aps.autodesk.com/en/docs/ssa/v1/tutorials/getting-started-with-ssa/task1-create-an-ssa) | create an SSA, provision it to a hub, get a token |
| [Service account management](https://aps.autodesk.com/en/docs/ssa/v1/tutorials/service-account-management) | REST reference — accounts, keys, token exchange |
| [Known issues](https://aps.autodesk.com/en/docs/ssa/v1/developers_guide/known-issues) | **read before committing** — per-API limitations and workarounds |
| [GA announcement](https://aps.autodesk.com/blog/update-secure-service-accounts-ssa-goes-ga) | background |

### What it would change here

SSA issues a *three-legged* token for the service identity. Downstream that is the same kind of token this repo already uses, so the Informed Design calls, the proxy and the entire configurator stay as they are. **Only the way the backend obtains a token changes.**

| | 3LO (this repo) | SSA |
|---|---|---|
| Token represents | the signed-in Autodesk user | your service account |
| Login | browser redirect to Autodesk | none — server-side only |
| Token lives | browser `localStorage` | server-side only, never sent to the browser |
| Permissions | that user's ACC access | whatever the service account is provisioned for |

Roughly: drop the login flow and `useAuth`, have the backend mint and cache its own token, and stop sending `Authorization` from the frontend. The frontend/backend split here already assumes the backend holds the secret and proxies every call, so the change is contained to the auth layer.

**Confirm the SSA licensing and entitlement model with Autodesk before designing around it.**

## Prerequisite: the APS app must be added to ACC

**Creating an APS app is not enough.** It has to be authorised inside ACC before it can read any Informed Design data:

1. Add it as a **custom integration** on the ACC account — Account Admin → Apps & Integrations → Custom Integrations → add the **Client ID**.
2. Make sure it has access to the **project** holding your products.

Until that is done every Informed Design call returns **401**, however valid the token is, and nothing in the error says why. It is the most common reason a correct integration looks broken.

This is an **ACC administrator** action. If you are not one, find who is early — it can block you for days.

## Other things that will catch you out

- **2-legged tokens do not work** for Informed Design. `/products` and `/releases` return 401.
- **The APS app must be a Traditional Web App.** Not Single Page App, not Server Application. This cannot be changed after creation — you have to make a new app.
- **Callback URL must match `APS_REDIRECT_URI` character for character** — trailing slash and case included.
- **Beware a false pass.** If your proxy caches responses, an unauthenticated run can be served earlier authenticated results and look like it worked. Check the upstream call, not your own 200.

`GET /api/aps/diagnose` reports what the backend thinks your setup is and returns a ready-made authorization URL. If pasting that URL into a browser fails the same way the app does, the problem is the APS app configuration rather than this code.

## Handling the secret

- It lives **server-side only**, in `backend/.env`, which is gitignored. It must never reach the browser or the repo.
- **Never copy `.env` to `.env.bak`/`.env.old`** — a classic way for a credential to end up committed, because the ignore list names files rather than matching a shape. A pre-commit hook blocks it ([scripts/check-secrets.js](../scripts/check-secrets.js)), and `npm run check:secrets` scans the whole tree.
- If a credential is ever committed, **rotate it**. Deleting the file does not remove it from history.

See also: [the demo app](DEMO_APP.md) · [the configurator](CONFIGURATOR.md)
