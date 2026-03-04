/**
 * ID manipulation utilities
 */

/**
 * Recursively removes "b." prefix from all IDs in an object or array
 * @param {any} obj - The object or array to process
 * @param {Array<string>} idKeys - Array of keys that contain IDs (default: common ID keys)
 * @returns {any} - The processed object or array
 */
export function removeBPrefix(obj, idKeys = ['id', 'productId', 'product_id', 'releaseId', 'release_id', 'variantId', 'variant_id', 'outputId', 'output_id', 'projectId', 'project_id', 'accountId', 'account_id', 'folderId', 'folder_id']) {
  if (Array.isArray(obj)) {
    return obj.map(item => removeBPrefix(item, idKeys));
  } else if (obj !== null && typeof obj === 'object') {
    const processed = {};
    for (const [key, value] of Object.entries(obj)) {
      if (idKeys.includes(key)) {
        // Remove "b." prefix if present
        processed[key] = typeof value === 'string' && value.startsWith('b.') 
          ? value.substring(2) 
          : value;
      } else if (typeof value === 'object') {
        processed[key] = removeBPrefix(value, idKeys);
      } else {
        processed[key] = value;
      }
    }
    return processed;
  }
  return obj;
}

