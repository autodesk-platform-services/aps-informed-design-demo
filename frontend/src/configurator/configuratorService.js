/**
 * Configurator orchestration.
 *
 * Thin layer on top of the repo's existing services that runs the exact
 * Informed Design flow for a single, hard-coded account/project/folder:
 *
 *   load product + release  ->  create variant  ->  create GLB output
 *   ->  poll to SUCCESS  ->  hand a viewer URL to the Autodesk Viewer.
 *
 * Nothing here is configurator-specific plumbing you couldn't find in App.js;
 * it's just the minimal slice needed for one product form.
 */
import { formatAccessId } from '../utils/idUtils';
import {
  generateVariantName,
  sanitizeVariantName,
  extractParameterRules,
  isQuotedParameterValue,
  unquoteParameterValue,
  quoteParameterValue,
} from '../utils/helpers';
import { apiRequest, apiRequestJson } from '../utils/apiClient';
import * as productService from '../services/productService';
import * as outputService from '../services/outputService';
import { CONFIGURATOR_CONFIG } from './config';

const backendUrl = () => process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

/**
 * accessId = <projectId without "b.">|<folderUrn>, used on every ID call.
 *
 * `access` lets the caller supply the project/folder explicitly, which is how the
 * configurator works when embedded in the demo app and driven by its pickers.
 * Standalone (the customer template) passes nothing and falls back to `.env`.
 *
 * @param {{projectId?: string, folderUrn?: string}} [access]
 */
export const getAccessId = (access) => {
  const src = access && access.projectId && access.folderUrn ? access : CONFIGURATOR_CONFIG;
  return formatAccessId(src.projectId, src.folderUrn);
};

/** Resolve the effective project/folder for a call. */
const resolveAccess = (access) =>
  access && access.projectId && access.folderUrn
    ? access
    : { projectId: CONFIGURATOR_CONFIG.projectId, folderUrn: CONFIGURATOR_CONFIG.folderUrn };

/** A release exposes its parameters under one of several keys depending on API version. */
const extractInputs = (release) => {
  const r = (release && release.data) || release || {};
  return r.parameters || r.inputs || (r.data && (r.data.parameters || r.data.inputs)) || [];
};

/**
 * Load every product in the configured folder (each already carries its
 * `releases` and `defaultRelease`, so the product AND release pickers can be
 * populated from this single call — no per-product fetch).
 * @returns {Promise<Array>} products
 */
export async function loadProducts(token, access) {
  const { projectId, folderUrn } = resolveAccess(access);
  const products = await productService.fetchProducts(token, projectId, folderUrn);
  if (!products.length) {
    throw new Error('No Informed Design products were found in the configured folder.');
  }
  return products;
}

/**
 * Load a release's full details (its inputs + outputSettings) plus its validation
 * rules, so the form can enforce the same constraints as the full demo app.
 *
 * `release.rules` is a rulesKey (an identifier), not the code itself — the code is
 * fetched separately and is what `extractConstraints` reads min/max out of.
 * @returns {Promise<{release, inputs, rulesKey, validationCode}>}
 */
export async function loadReleaseInputs(token, releaseId, access) {
  const release = await productService.fetchReleaseDetails(token, releaseId, getAccessId(access));
  const r = (release && release.data) || release || {};
  const rulesKey = r.rules || (release.data && release.data.rules) || null;

  // The release points at two dataset keys, not one. `rules` is the authored
  // Input script; `layout` is the authored Form — where the per-field labels
  // live. Both decode to <document>.json/<section-id>, so both are fetched
  // through the same endpoint.
  const layoutKey = r.layout || (release.data && release.data.layout) || null;
  let rawLayout = null;
  let layoutError = null;
  if (layoutKey) {
    try {
      rawLayout = await apiRequestJson(
        `/api/informed-design/rules/${encodeURIComponent(layoutKey)}`,
        {},
        token
      );
    } catch (err) {
      // Non-fatal: without the form we fall back to parameter names for labels.
      layoutError = err.message || String(err);
      console.warn('[configurator] could not load form layout:', err);
    }
  }

  let validationCode = null;
  let rawRules = null;      // kept verbatim for the debug panel
  let rulesError = null;
  if (rulesKey) {
    try {
      const rules = await apiRequestJson(
        `/api/informed-design/rules/${encodeURIComponent(rulesKey)}`,
        {},
        token
      );
      rawRules = rules;
      validationCode = extractValidationCode(rules);
    } catch (err) {
      // Non-fatal: without rules we still render the form, just unconstrained.
      rulesError = err.message || String(err);
      console.warn('[configurator] could not load validation rules:', err);
    }
  }

  // The rules carry per-parameter settings (min/max/increment/readOnly) keyed by
  // name. Resolve them here, once, so the form and the variant payload agree on
  // which parameters are read-only instead of each re-deriving it.
  const paramRules = extractParameterRules(typeof validationCode === 'string' ? validationCode : '');
  const inputs = extractInputs(release).map((param) => {
    const rules = paramRules[param.name || param.key];
    // Remember whether the API issued this value quoted, so the exact same shape
    // can be restored on write while the form shows the bare string.
    const quoted = isQuotedParameterValue(param.defaultValue);
    return {
      ...param,
      ...(quoted ? { defaultValue: unquoteParameterValue(param.defaultValue), quoted: true } : null),
      ...(rules ? { rules, readOnly: Boolean(rules.readOnly) } : null),
    };
  });

  return {
    release, inputs, rulesKey, validationCode, rawRules, rulesError,
    layoutKey, rawLayout, layoutError,
  };
}

/**
 * Rules responses put the code at the root, per-input, or one level down. Mirrors
 * the lookup order in App.js.
 * @returns {string|Object|null} code string, or a { [inputName]: code } map
 */
function extractValidationCode(rules) {
  if (!rules) return null;
  if (rules.code) return rules.code;

  if (Array.isArray(rules.inputs)) {
    const byInput = {};
    rules.inputs.forEach((input) => {
      const key = input.name || input.key;
      if (input.code && key) byInput[key] = input.code;
    });
    if (Object.keys(byInput).length) return byInput;
  }

  return (rules.data && rules.data.code) || (rules.rules && rules.rules.code) || null;
}

/**
 * Evaluate the whole form against the release's rules.
 *
 * The rules code references every parameter (e.g. `parameters['Width'].value`), so
 * ALL inputs must be sent, not just the one that changed — a partial payload makes
 * the evaluation fail for reasons unrelated to the edit.
 *
 * @returns {Promise<{valid, error, errorsByInput}>} errorsByInput maps input name
 *   -> { error, updatedValue } so each field can show its own message.
 */
export async function evaluateRules(token, { rulesKey, inputs, formValues }) {
  if (!rulesKey) return { valid: true, error: null, errorsByInput: {} };

  const payloadInputs = inputs
    .map((param) => {
      const key = param.name || param.key;
      if (!key || key.startsWith('_')) return null;

      const provided = formValues[key];
      let value =
        provided !== undefined && provided !== null && provided !== ''
          ? provided
          : param.defaultValue !== undefined
          ? param.defaultValue
          : null;

      // The API is strict about types: a numeric parameter sent as a string fails.
      const type = String(param.type || '').toLowerCase();
      if (value !== null && value !== '') {
        if (['number', 'integer', 'float', 'numeric'].includes(type)) {
          value = typeof value === 'string' ? parseFloat(value) : value;
        } else if (type === 'boolean') {
          value = typeof value === 'string' ? value === 'true' : Boolean(value);
        }
      }

      // Restore the quoting the API issued. The form holds these stripped for
      // display; sent bare, the evaluator canonicalises `Vision` back to
      // `"Vision"` and reports it as an updated value, which the form then shows
      // as an error against every text parameter.
      if (param.quoted && typeof value === 'string') value = quoteParameterValue(value);

      return { name: key, value, type: param.type };
    })
    .filter((i) => i && i.name);

  const result = await apiRequestJson(
    '/api/informed-design/rules:evaluate',
    { method: 'POST', body: JSON.stringify({ rules: rulesKey, inputs: payloadInputs }) },
    token
  );

  // `evaluatedInputs` is the authoritative per-parameter state AFTER the rules
  // have run: visible/applicable with the conditionals already resolved,
  // readOnly, min/max/increment, the allowed `values`, an optional label, and
  // the computed value. Reading it beats parsing the rule script, which cannot
  // resolve a branch like "hide Infill_Color when Infill_Type is Vision".
  const evaluated = {};
  (result.evaluatedInputs || []).forEach((e) => {
    if (!e || !e.name) return;
    const settings = {};
    ['visible', 'applicable', 'readOnly'].forEach((k) => {
      if (e[k] !== undefined) settings[k] = e[k];
    });
    ['min', 'max', 'increment'].forEach((k) => {
      if (e[k] !== undefined && e[k] !== null) settings[k] = e[k];
    });
    if (e.label) settings.label = e.label;                       // "" means none
    if (Array.isArray(e.values) && e.values.length) {
      settings.values = e.values.map(unquoteParameterValue);      // issued quoted
    }
    if (e.value !== undefined) settings.value = unquoteParameterValue(e.value);
    evaluated[e.name] = settings;
  });

  // Collect per-field errors from whichever envelope the backend used.
  const errorsByInput = {};
  const updates = {};
  const rawErrors =
    (result.errorDetails && result.errorDetails.errors) ||
    (result.error && result.error.errors) ||
    [];

  rawErrors.forEach((e) => {
    const key = e.parameter || e.field;
    if (!key) return;

    // "Input Value Updated" is the engine reporting that it recomputed or
    // snapped a value — an outcome, not a rejection. Adopt it instead of
    // painting the field red: a computed read-only parameter such as
    // Family_Type_Name changes every time Width does, so treating that as an
    // error made the form look broken for doing exactly what the rules say.
    if (String(e.title || '').toLowerCase() === 'input value updated' && e.updatedValue !== undefined) {
      updates[key] = unquoteParameterValue(e.updatedValue);
      return;
    }

    let message = e.detail || e.title || 'Validation failed';
    if (e.value !== undefined && e.updatedValue !== undefined) {
      message = `${message} Value ${e.value} was updated to ${e.updatedValue}.`;
    }
    errorsByInput[key] = { error: message, updatedValue: e.updatedValue };
  });

  const valid = Object.keys(errorsByInput).length === 0;
  const topLevelError =
    typeof result.error === 'string' ? result.error : valid ? null : 'Validation failed';

  return {
    valid,
    error: valid ? null : topLevelError,
    errorsByInput,
    evaluated,
    updates,
    raw: result,               // verbatim, for the debug panel
    sent: payloadInputs,
  };
}

/**
 * Fetch a product's thumbnail as an object URL usable in <img src>.
 * The endpoint returns image bytes and needs a Bearer header, so we fetch a
 * blob rather than pointing <img> at the URL directly. Returns null if none.
 * Remember to URL.revokeObjectURL() the result when done.
 */
export async function fetchProductThumbnailUrl(token, productId, access) {
  try {
    const resp = await apiRequest(
      `/api/informed-design/products/${encodeURIComponent(productId)}/thumbnail` +
        `?accessId=${encodeURIComponent(getAccessId(access))}&accessType=ACC`,
      {},
      token
    );
    if (!resp.ok) return null;
    const blob = await resp.blob();
    if (!blob || blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** Output types that take no `representation` — the API rejects it for these. */
const NO_REPRESENTATION = ['PDF', 'DWG', 'IDW'];

/** Coerce a representation entry (string or object) to its name. */
const repName = (rep) =>
  rep && typeof rep === 'object' ? rep.name ?? rep.id ?? String(rep) : rep;

/**
 * Derive the output `settings` for one output type from the release's
 * outputSettings. Mirrors the normalization App.js does: representations[] ->
 * representation, drop metadata-only keys, drop null/undefined.
 *
 * @param {string} [type] - output type; defaults to the configured preview type
 * @param {string} [representation] - explicit representation to request
 */
function buildOutputSettings(release, type, representation) {
  type = (type || CONFIGURATOR_CONFIG.outputType || 'SVF').toUpperCase();
  const all = outputSettingsOf(release);
  let settings = {};

  if (Array.isArray(all)) {
    // Array shape: the entry's own fields ARE the settings (minus the type
    // discriminators), optionally with a nested `settings` object that wins.
    // Missing this branch sent PDF up with no templatePath at all.
    const entry = all.find((s) => {
      const t = s.type || s.outputType || s.format;
      return t && String(t).toUpperCase() === type;
    });
    if (entry) {
      const { type: _t, outputType: _o, format: _f, settings: nested, ...rest } = entry;
      settings = { ...rest, ...(nested || {}) };
      delete settings.type;
      delete settings.outputType;
      delete settings.format;
    }
  } else if (all && typeof all === 'object') {
    settings = { ...(all[type] || all[type.toLowerCase()] || {}) };
  }

  if (representation) {
    settings.representation = representation;
    delete settings.representations;
  } else if (Array.isArray(settings.representations) && settings.representations.length) {
    settings.representation = repName(settings.representations[0]);
    delete settings.representations;
  } else if (!settings.representation) {
    settings.representation = '[Primary]';
  }
  settings.representation = repName(settings.representation);

  // PDF/DWG/IDW take no representation at all.
  if (NO_REPRESENTATION.includes(type)) delete settings.representation;

  // PDF wants a single templatePath, not templatePaths[].
  if (type === 'PDF' && settings.templatePaths !== undefined) {
    settings.templatePath = Array.isArray(settings.templatePaths)
      ? settings.templatePaths[0]
      : settings.templatePaths;
    delete settings.templatePaths;
  }
  if (type === 'PDF' && Array.isArray(settings.templatePath)) {
    settings.templatePath = settings.templatePath[0];
  }

  const metadataKeys = [
    'isPublic', 'category', 'family', 'behavior',
    'categoryName', 'category_name', 'familyName', 'family_name',
  ];
  const cleaned = {};
  for (const key in settings) {
    if (!metadataKeys.includes(key) && settings[key] != null) cleaned[key] = settings[key];
  }
  return cleaned;
}

/**
 * Output types deliberately hidden from the download panel:
 *  - SVF is the viewer format, already on screen; not a deliverable.
 *  - BCD is excluded everywhere in this repo (see ProductsTab.js).
 */
const HIDDEN_DOWNLOAD_TYPES = ['SVF', 'SVF2', 'BCD'];

/**
 * Best available human-readable message for an API failure.
 *
 * The backend forwards the upstream body as `err.details`, but its top-level
 * `error` is often just the generic title ("Bad Request"). The useful text is in
 * `Detail`/`detail` or the per-field `errors[]`, so prefer those.
 */
export function describeApiError(err) {
  const d = err && err.details;
  if (d && typeof d === 'object') {
    const parts = [];
    const detail = d.Detail || d.detail || d.developerMessage;
    if (detail) parts.push(String(detail));

    const list = d.errors || (d.error && d.error.errors);
    if (Array.isArray(list)) {
      list.forEach((e) => {
        const field = e.parameter || e.field || e.name;
        const text = e.detail || e.Detail || e.title || e.message;
        if (text) parts.push(field ? `${field}: ${text}` : String(text));
      });
    }
    if (parts.length) return [...new Set(parts)].join(' — ');
  }
  return (err && err.message) || 'Request failed';
}

/** True when this output type takes a `representation`. */
export const typeNeedsRepresentation = (type) =>
  !NO_REPRESENTATION.includes(String(type || '').toUpperCase());

const outputSettingsOf = (release) => {
  const r = (release && release.data) || release || {};
  return r.outputSettings || r.output_settings || {};
};

/**
 * Every output type the release publishes, taken as-is from
 * `release.outputSettings` (so DWG and DWG3D stay distinct, matching
 * ProductsTab.js). Handles both the map and array shapes.
 *
 * This is the raw list, viewer formats included; `downloadOutputTypes` filters
 * it for the download panel.
 *
 * Note it is NOT consulted before requesting the preview: older products don't
 * list SVF even though the service can still generate one, so runConfiguration
 * asks regardless and lets the API decide.
 *
 * @returns {string[]}
 */
function releaseOutputTypes(release) {
  const all = outputSettingsOf(release);
  let types = [];

  if (Array.isArray(all)) {
    types = [...new Set(all.map((s) => s.type || s.outputType || s.format).filter(Boolean))];
  } else if (all && typeof all === 'object') {
    types = Object.keys(all);
  }

  return types.filter((t) => t && t !== 'Unknown');
}

/**
 * The output types offered for download — the published list minus the ones
 * that aren't deliverables.
 *
 * @returns {string[]}
 */
export function downloadOutputTypes(release) {
  return releaseOutputTypes(release)
    .filter((t) => !HIDDEN_DOWNLOAD_TYPES.includes(t.toUpperCase()))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Representations available for one output type.
 *
 * Returns [] for types that take none (PDF/DWG/IDW). Otherwise falls back to
 * ['[Primary]'] when the release declares none, same as ProductsTab.js.
 *
 * @returns {string[]}
 */
export function representationsForType(release, type) {
  if (!type || !typeNeedsRepresentation(type)) return [];

  const all = outputSettingsOf(release);
  const found = new Set();

  const collect = (settings) => {
    if (!settings) return;
    if (Array.isArray(settings.representations)) {
      settings.representations.forEach((rep) => {
        const n = repName(rep);
        if (n) found.add(String(n));
      });
    } else if (settings.representation) {
      const n = repName(settings.representation);
      if (n) found.add(String(n));
    } else if (settings.settings) {
      collect(settings.settings);
    }
  };

  if (Array.isArray(all)) {
    all.forEach((s) => {
      const t = s.type || s.outputType || s.format;
      if (t && String(t).toUpperCase() === String(type).toUpperCase()) collect(s);
    });
  } else if (all && typeof all === 'object') {
    collect(all[type] || all[String(type).toUpperCase()] || all[String(type).toLowerCase()]);
  }

  if (found.size === 0) found.add('[Primary]');
  return Array.from(found);
}

/** File extension per output type — mirrors getExtensionFromOutputType in App.js. */
const EXTENSIONS = {
  GLB: 'glb', THUMBNAIL: 'png', PDF: 'pdf', BOM: 'csv', STL: 'stl', STEP: 'step',
  INV: 'inv', SAT: 'sat', DWG3D: 'dwg', DWG: 'dwg', IDW: 'idw', RFA: 'rfa',
};

/**
 * Generate one output for an existing variant, wait for it, and return the file.
 *
 * Kept separate from runConfiguration: downloads act on the variant that is
 * ALREADY on screen, so no new variant is created.
 *
 * @returns {Promise<{blob: Blob, fileName: string, outputId: string}>}
 */
export async function generateDownload(
  token,
  { variantId, variantName, release, type, representation, access },
  onStatus
) {
  const accessId = getAccessId(access);
  const notify = (s) => typeof onStatus === 'function' && onStatus(s);
  const upper = (type || '').toUpperCase();

  notify('Requesting…');
  const settings = buildOutputSettings(release, upper, representation);
  // The API is picky about settings per type; log what we actually sent so a 400
  // is diagnosable from the console without re-running.
  console.log('[configurator] createOutput', { type: upper, representation, settings });
  const outputResp = await outputService.createOutput(
    token,
    { variantId, outputs: [{ type: upper, settings }] },
    accessId
  );
  const first = outputResp.outputs && outputResp.outputs[0];
  const outputId = first && (first.id || first.outputId);
  if (!outputId) throw new Error(`${upper}: output creation did not return an id.`);

  notify('Generating…');
  await outputService.pollOutputStatus(token, outputId, accessId, (s) => notify(`Generating… (${s})`), 90, 2000);

  notify('Downloading…');
  const blob = await outputService.downloadOutput(token, outputId, accessId);

  const ext = EXTENSIONS[upper] || upper.toLowerCase();
  const safe = String(variantName || 'variant').replace(/[^\w.-]+/g, '_');
  const repPart = representation ? `_${String(representation).replace(/[^\w.-]+/g, '_')}` : '';
  return { blob, fileName: `${safe}${repPart}.${ext}`, outputId };
}

/**
 * Create a variant from the form values, generate a GLB, wait for it, and
 * return a URL the Autodesk Viewer can load.
 *
 * @param {(status:string)=>void} onStatus - progress callback (optional)
 * @returns {Promise<{svfUrl, variantId, variantName, outputId, previewUnavailable, previewError}>}
 *   `svfUrl` is null and `previewUnavailable`/`previewError` are set when the
 *   API refuses to generate the preview. The variant still exists and its
 *   downloads still work.
 */
export async function runConfiguration(token, { product, releaseId, release, inputs, formValues, variantName, access }, onStatus) {
  const accessId = getAccessId(access);
  const notify = (s) => typeof onStatus === 'function' && onStatus(s);

  // 1. Map form values -> variant inputs (fall back to each input's default).
  // Read-only parameters are computed by the rules (e.g. Family_Type_Name is
  // derived from Width and Height), so they are not ours to send — the value we
  // hold is only ever a stale copy of what the rules will recompute anyway.
  const variantInputs = inputs
    .filter((param) => !param.readOnly)
    .map((param) => {
      const key = param.name || param.key;
      const provided = formValues[key];
      const value = provided !== undefined && provided !== '' ? provided : param.defaultValue;
      // The form holds these unquoted; re-wrap the ones the API issued quoted.
      return { name: key, value: param.quoted ? quoteParameterValue(value) : value };
    });
  // Sanitized at the boundary, not just in the generator: a name the user typed
  // by hand goes through here too, and the API 400s on characters like `"`.
  const name = sanitizeVariantName(variantName || generateVariantName(product, formValues, inputs));

  // 2. Create the variant (backend reads releaseId from the query string).
  notify('Creating variant…');
  const variant = await apiRequestJson(
    `/api/informed-design/variants?releaseId=${encodeURIComponent(releaseId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
    { method: 'POST', body: JSON.stringify({ inputs: variantInputs, name }) },
    token
  );
  const variantId = variant.id || variant.variantId;
  if (!variantId) throw new Error('Variant creation did not return an id.');

  // 3. Request the 3D output (SVF by default) for the new variant.
  //
  // Deliberately NOT gated on the release's `outputSettings`. SVF is always
  // worth asking for: the list a release publishes is not a reliable statement
  // of what can be generated, and refusing to ask because the list is missing
  // SVF would deny a preview that the service may well produce.
  //
  // The API is the authority, so let it answer. What must not happen is the
  // whole run being lost when it says no: the variant already exists by this
  // point, and its downloads are worth keeping even with no preview. So a
  // failure here degrades to "no preview" rather than throwing.
  //
  // Nothing is substituted for it either — the viewer loads an SVF bundle
  // through the backend's /svf endpoint, and whether it can be handed a GLB
  // instead is unverified.
  const outputType = (CONFIGURATOR_CONFIG.outputType || 'SVF').toUpperCase();
  notify('Generating 3D model…');
  try {
    const outputResp = await outputService.createOutput(
      token,
      { variantId, outputs: [{ type: outputType, settings: buildOutputSettings(release) }] },
      accessId
    );
    const first = outputResp.outputs && outputResp.outputs[0];
    const outputId = first && (first.id || first.outputId);
    if (!outputId) throw new Error('Output creation did not return an output id.');

    // 4. Poll until the model is ready.
    await outputService.pollOutputStatus(token, outputId, accessId, (s) => notify(`Generating 3D model… (${s})`), 90, 2000);

    // 5. Point the viewer at the backend's /svf endpoint (it unzips the bundle).
    const svfUrl =
      `${backendUrl()}/api/informed-design/outputs/${encodeURIComponent(outputId)}/svf` +
      `?accessId=${encodeURIComponent(accessId)}&accessType=ACC`;

    return { svfUrl, variantId, variantName: name, outputId };
  } catch (err) {
    console.warn(`[configurator] ${outputType} preview unavailable for this variant:`, err, err.details);
    return {
      svfUrl: null,
      variantId,
      variantName: name,
      outputId: null,
      previewUnavailable: outputType,
      previewError: describeApiError(err),
    };
  }
}
