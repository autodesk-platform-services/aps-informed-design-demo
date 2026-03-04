/**
 * Path manipulation utilities
 */

/**
 * Find common path prefix for flattening directory structure
 * @param {Array<string>} paths - Array of file paths
 * @returns {string} - The common path prefix
 */
export function findCommonPathPrefix(paths) {
  if (paths.length === 0) return '';
  if (paths.length === 1) {
    const lastSlash = paths[0].lastIndexOf('/');
    return lastSlash > 0 ? paths[0].substring(0, lastSlash + 1) : '';
  }
  
  // Find the shortest path
  const shortest = paths.reduce((a, b) => a.length < b.length ? a : b);
  
  // Find the last common directory
  let commonPrefix = '';
  const parts = shortest.split('/');
  
  for (let i = 0; i < parts.length - 1; i++) {
    const testPrefix = parts.slice(0, i + 1).join('/') + '/';
    if (paths.every(path => path.startsWith(testPrefix))) {
      commonPrefix = testPrefix;
    } else {
      break;
    }
  }
  
  return commonPrefix;
}

