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
 * Generate a variant name from product and form data.
 * @param {Object} product - The product object
 * @param {Object} formData - The form data with parameter values
 * @param {Array} parameters - Array of parameter definitions
 * @returns {string} Generated variant name
 */
export const generateVariantName = (product, formData, parameters) => {
  const productName = product?.name || product?.productName || 'Product';
  const parameterValues = parameters.map(param => {
    const key = param.key || param.name;
    const value = formData[key];
    return value !== undefined && value !== null && value !== ''
      ? String(value)
      : (param.defaultValue !== undefined ? String(param.defaultValue) : '');
  }).filter(val => val !== '');

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
