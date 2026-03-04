/**
 * Utility functions for ID manipulation
 */

/**
 * Removes the "b." prefix from an ID if present
 * @param {string} id - The ID to process
 * @returns {string} - The ID without the "b." prefix
 */
export const removeBPrefix = (id) => {
  if (typeof id === 'string' && id.startsWith('b.')) {
    return id.substring(2);
  }
  return id;
};

/**
 * Formats accessId for Informed Design API calls
 * Format: {projectId}|{folderUrn}
 * Removes "b." prefix from projectId before combining
 * @param {string} projectId - The project ID
 * @param {string} folderUrn - The folder URN
 * @returns {string} - Formatted accessId
 */
export const formatAccessId = (projectId, folderUrn) => {
  const cleanProjectId = removeBPrefix(projectId);
  return `${cleanProjectId}|${folderUrn}`;
};

/**
 * Recursively removes "b." prefix from all IDs in an object or array
 * @param {any} obj - The object or array to process
 * @returns {any} - The processed object or array
 */
export const removeBPrefixRecursive = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => removeBPrefixRecursive(item));
  } else if (obj !== null && typeof obj === 'object') {
    const processed = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'id' || key === 'variantId' || key === 'variant_id' || 
          key === 'productId' || key === 'product_id' || 
          key === 'releaseId' || key === 'release_id' ||
          key === 'outputId' || key === 'output_id' ||
          key === 'projectId' || key === 'project_id' ||
          key === 'accountId' || key === 'account_id' ||
          key === 'folderId' || key === 'folder_id') {
        processed[key] = typeof value === 'string' && value.startsWith('b.') 
          ? value.substring(2) 
          : value;
      } else if (typeof value === 'object') {
        processed[key] = removeBPrefixRecursive(value);
      } else {
        processed[key] = value;
      }
    }
    return processed;
  }
  return obj;
};

