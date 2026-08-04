/**
 * Format a date string based on the specified language.
 * @param {string} dateString - The date string to format
 * @param {string} language - The language code ('ja' for Japanese, defaults to English)
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, language = 'en') => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  if (language === 'ja') {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  } else {
    return date.toLocaleDateString('en-US');
  }
};

/**
 * Translate status values using the i18n translation function.
 * @param {string} status - The status value to translate
 * @param {Function} t - The translation function from i18n
 * @returns {string} Translated status or original if no translation exists
 */
export const translateStatus = (status, t) => {
  if (!status) return '';
  const statusUpper = status.toUpperCase();
  const statusKey = `status_${statusUpper}`;
  const translated = t(statusKey);
  return translated !== statusKey ? translated : status;
};

/**
 * Normalize dbId to ensure consistent types (convert to number if possible).
 * This ensures consistent dbId types throughout the app for proper selection.
 * @param {*} dbId - The dbId to normalize
 * @returns {number|*|null} Normalized dbId
 */
export const normalizeDbId = (dbId) => {
  if (dbId === undefined || dbId === null) return null;
  const num = Number(dbId);
  return isNaN(num) ? dbId : num;
};

/**
 * Extract constraints (min, max, pattern, enum) from validation code string.
 * @param {string} code - The validation code string
 * @returns {Object|null} Extracted constraints or null if none found
 */
export const extractConstraints = (code) => {
  if (!code || typeof code !== 'string') return null;

  const constraints = {};

  const minMatches = [
    code.match(/min\s*[=:]\s*(\d+\.?\d*)/i),
    code.match(/value\s*>=\s*(\d+\.?\d*)/i),
    code.match(/(\d+\.?\d*)\s*<=\s*value/i)
  ];
  for (const match of minMatches) {
    if (match) {
      constraints.min = parseFloat(match[1]);
      break;
    }
  }

  const maxMatches = [
    code.match(/max\s*[=:]\s*(\d+\.?\d*)/i),
    code.match(/value\s*<=\s*(\d+\.?\d*)/i),
    code.match(/(\d+\.?\d*)\s*>=\s*value/i)
  ];
  for (const match of maxMatches) {
    if (match) {
      constraints.max = parseFloat(match[1]);
      break;
    }
  }

  const patternMatch = code.match(/pattern\s*[=:]\s*['"]([^'"]+)['"]|match\(['"]([^'"]+)['"]\)/i);
  if (patternMatch) {
    constraints.pattern = patternMatch[1] || patternMatch[2];
  }

  const enumMatch = code.match(/enum\s*[=:]\s*\[([^\]]+)\]|choices\s*[=:]\s*\[([^\]]+)\]/i);
  if (enumMatch) {
    try {
      constraints.enum = JSON.parse(`[${enumMatch[1] || enumMatch[2]}]`);
    } catch (e) {
      // Ignore parse errors
    }
  }

  return Object.keys(constraints).length > 0 ? constraints : null;
};

/**
 * Snap a numeric value onto a parameter's allowed step.
 *
 * `parameters['Width'].increment = 5` means the release only accepts multiples
 * of 5, counted from its minimum — 300, 305, 310… The `step` attribute alone
 * does not enforce this: it governs the spinner arrows, and since the form sets
 * `noValidate` the browser will not reject a typed 1201 either. The evaluator
 * would catch it and answer "value was updated", so snapping here just gets to
 * the same place without the round trip.
 *
 * @param {number|string} value
 * @param {{min?: number, max?: number, increment?: number}} [constraints]
 * @returns {number|string} the snapped value, or the input unchanged if it is
 *   not a number or the parameter has no increment
 */
export const snapToIncrement = (value, constraints) => {
  const increment = constraints && constraints.increment;
  if (!increment || increment <= 0) return value;

  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || Number.isNaN(num)) return value;

  const base = typeof constraints.min === 'number' ? constraints.min : 0;
  let snapped = base + Math.round((num - base) / increment) * increment;

  // Clamp into range. Stepping back a single increment was not enough: an entry
  // well past the maximum (4000 against a max of 3000) landed on 3995 — snapped
  // to the grid but still out of bounds. Take the largest on-step value that
  // fits instead.
  if (typeof constraints.max === 'number' && snapped > constraints.max) {
    snapped = base + Math.floor((constraints.max - base) / increment) * increment;
  }
  if (typeof constraints.min === 'number' && snapped < constraints.min) snapped = constraints.min;

  // Increments like 0.1 accumulate float error; keep the precision of the step.
  const decimals = (String(increment).split('.')[1] || '').length;
  return decimals ? parseFloat(snapped.toFixed(decimals)) : snapped;
};

/**
 * Inventor text parameters arrive as quoted expressions: the API returns
 * `"Vision"` with the quote characters embedded in the value. Those quotes are
 * syntax, not content — the rules compare against `'Vision'` — so a form field
 * must not show them. They are restored on the way back out (see
 * `runConfiguration`) so the API receives values in the shape it issued.
 */
const QUOTED_STRING = /^"([\s\S]*)"$/;

/** True when a value is a quoted Inventor string expression. */
export const isQuotedParameterValue = (value) =>
  typeof value === 'string' && QUOTED_STRING.test(value);

/** `"Vision"` -> `Vision`. Non-quoted values pass through untouched. */
export const unquoteParameterValue = (value) =>
  isQuotedParameterValue(value) ? value.replace(QUOTED_STRING, '$1') : value;

/** `Vision` -> `"Vision"`, for sending back in the shape the API issued. */
export const quoteParameterValue = (value) =>
  typeof value === 'string' ? `"${value}"` : value;

/**
 * Parse an Informed Design rule script into per-parameter settings.
 *
 * The rules are JavaScript that assigns onto a `parameters` map, keyed by name:
 *   parameters['Width'].min = 300;
 *   parameters['Height'].max = 5000;
 *   parameters['Family_Type_Name'].readOnly = true;
 *
 * `extractConstraints` below scans the whole script for the FIRST `min`/`max`
 * and returns it for any parameter, so every field inherited Width's limits —
 * text parameters showed "min 300 max 3000", and Height showed 3000 instead of
 * its own 5000. Reading the assignments per parameter is what fixes that.
 *
 * `values` gives a parameter its allowed list, which is what turns a field into
 * a dropdown:
 *   parameters['Infill_Type'].values = ['Vision', 'Opaque'];
 *
 * `visible` and `applicable` are deliberately NOT collected: the rules assign
 * them inside if/else branches, so a static scan just takes whichever branch
 * happens to come last. Evaluating those correctly needs rules:evaluate. The
 * same caveat applies to any property assigned conditionally — the assignments
 * read here are the top-level ones.
 *
 * @param {string} code - the rule script
 * @returns {Object} { [parameterName]: { min, max, increment, readOnly, values } }
 */

/** Items of a JS array literal: quoted strings, or an all-numeric list. */
const parseListLiteral = (raw) => {
  const bracketed = raw.match(/^\[([\s\S]*)\]$/);
  if (!bracketed) return undefined;
  const body = bracketed[1];

  const strings = [];
  const item = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = item.exec(body)) !== null) {
    // Values are kept verbatim — trailing spaces and all — because the API
    // expects back exactly the string its rules published.
    strings.push((m[1] !== undefined ? m[1] : m[2]).replace(/\\(['"\\])/g, '$1'));
  }
  if (strings.length) return strings;

  const parts = body.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length && parts.every((p) => /^-?\d+(\.\d+)?$/.test(p))) return parts.map(parseFloat);
  return undefined;
};

export const extractParameterRules = (code) => {
  if (!code || typeof code !== 'string') return {};

  // parameters['NAME'].prop = <literal>
  const assignment = /parameters\s*\[\s*['"]([^'"]+)['"]\s*\]\s*\.\s*([A-Za-z_]\w*)\s*=\s*([^;\n]+)/g;
  const wanted = new Set(['min', 'max', 'increment', 'readOnly', 'values', 'label']);
  const rules = {};

  let match;
  while ((match = assignment.exec(code)) !== null) {
    const [, name, prop, rawValue] = match;
    if (!wanted.has(prop)) continue;

    const raw = rawValue.trim().replace(/;$/, '');
    let value;
    if (prop === 'values') value = parseListLiteral(raw);
    else if (prop === 'label') {
      const quoted = raw.match(/^['"]([\s\S]*)['"]$/);
      value = quoted ? quoted[1] : undefined;
    }
    else if (/^(true|false)$/i.test(raw)) value = raw.toLowerCase() === 'true';
    else if (/^-?\d+(\.\d+)?$/.test(raw)) value = parseFloat(raw);

    // An expression rather than a static setting (e.g. a computed `.value`).
    if (value === undefined) continue;

    rules[name] = { ...rules[name], [prop]: value };
  }

  return rules;
};

/**
 * Characters the Informed Design API rejects in a variant name. Taken verbatim
 * from the regex in its own 400 response:
 *   ^[^<>:"\/|?*`\n\r\t\0\f¢™$®]*$
 *
 * This matters because Inventor text parameters arrive already quoted — a value
 * comes back as `"Vision"`, quotes included — so any product with a text
 * parameter builds an auto-name containing `"` and the create call 400s.
 */
const DISALLOWED_NAME_CHARS = /[<>:"\\/|?*`\n\r\t\0\f¢™$®]/g;

/**
 * Strip the characters the API forbids in a variant name.
 * @param {string} name
 * @returns {string} name safe to send as a variant name
 */
export const sanitizeVariantName = (name) =>
  String(name ?? '').replace(DISALLOWED_NAME_CHARS, '').replace(/\s+/g, ' ').trim();

/**
 * Read-only parameters never contribute to a variant name.
 *
 * Informed Design computes them and owns their value; this client does not
 * update them, so including one would pin a stale reading into a name that
 * otherwise tracks every edit. Enforced here rather than at the call sites so
 * it holds for every caller.
 */
const isNameable = (param) => !param.readOnly && !(param.rules && param.rules.readOnly);

/**
 * Generate a variant name from product and form data. Computed entirely client
 * side — nothing about the name comes from the API.
 * @param {Object} product - The product object
 * @param {Object} formData - The form data with parameter values
 * @param {Array} parameters - Array of parameter definitions
 * @returns {string} Generated variant name
 */
export const generateVariantName = (product, formData, parameters) => {
  const productName = sanitizeVariantName(product?.name || product?.productName || 'Product');
  const parameterValues = (parameters || []).filter(isNameable).map(param => {
    const key = param.key || param.name;
    const value = formData[key];
    return value !== undefined && value !== null && value !== ''
      ? String(value)
      : (param.defaultValue !== undefined ? String(param.defaultValue) : '');
  // Sanitize before filtering, so a value made up entirely of disallowed
  // characters drops out instead of leaving a doubled separator.
  }).map(sanitizeVariantName).filter(val => val !== '');

  return parameterValues.length > 0
    ? `${productName}_${parameterValues.join('_')}`
    : productName;
};

/**
 * Save a file with system save dialog (uses File System Access API if available).
 * @param {Blob} blob - The file blob to save
 * @param {string} suggestedFileName - Suggested filename for the save dialog
 */
export const saveFileWithDialog = async (blob, suggestedFileName) => {
  const showSaveFilePicker = window.showSaveFilePicker;
  if (showSaveFilePicker && typeof showSaveFilePicker === 'function') {
    try {
      const fileHandle = await showSaveFilePicker({
        suggestedName: suggestedFileName,
        types: [{
          description: 'Excel files',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          },
        }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        // User cancelled or error occurred, fall back to download
      }
    }
  }

  // Fallback to download approach
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = suggestedFileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
};
