# The demo app

[← back to the README](../README.md)

A live-action tour of the Informed Design API. Where the [configurator](CONFIGURATOR.md) hides Autodesk's model from an end customer, this one puts it on screen — so you can see what each call returns before writing code against it.

Turn it on with `IND_CONFIGURATOR=false` in `frontend/.env`.

---

## What it does

**Navigate the hierarchy** — accounts → projects → folders → products → releases → variants. Each step is a real API call, and the app shows you what came back.

**Work with products:**

- browse products in a folder, with thumbnails and metadata
- inspect a release's parameters — names, types, defaults, units, allowed values
- create a variant from a release, with the release's validation rules applied
- generate outputs in any format the release publishes
- download them, or view 3D output in the Autodesk Viewer

**Inspect everything:**

- **user menu → Show IDs** — every id in play (account, project, folder, product, release, variant), copyable. This is where you get the two IDs the standalone configurator needs.
- **user menu → Show Token** — the current access token, for trying calls yourself in curl or Postman.

## Why you would use it

- **Understand a response before coding.** Click through to the thing you care about and see the actual payload shape.
- **Find your IDs.** Faster than digging through ACC.
- **Check your setup.** If the demo app can list products, your APS app, ACC custom integration and permissions are all correct — so any later failure is in your code, not your configuration.
- **Compare behaviour.** When the configurator does something unexpected, the demo app shows what the same release looks like unprocessed.

## Where the code is

```
frontend/src/
  App.js              top-level state and the hierarchy navigation
  components/         ProductsTab, variant and output panels, dialogs
  services/           API clients (shared with the configurator)
  Viewer.js           Autodesk Viewer wrapper (shared)
```

The backend is shared too — see [the README](../README.md#how-it-fits-together).

[BUILD_GUIDE.md](BUILD_GUIDE.md) walks through how the demo app is put together, feature by feature.

## Notes

- Everything is scoped to the signed-in user's own ACC access — see [authentication](AUTHENTICATION.md).
- `App.js` is large and was mid-refactor when this repo was published. The [configurator](CONFIGURATOR.md) is the tidier read if you want a model to copy; the demo app is the better read if you want API coverage.

See also: [the configurator](CONFIGURATOR.md) · [authentication](AUTHENTICATION.md) · [packaging as a desktop app](ELECTRON_BUILD_GUIDE.md)
