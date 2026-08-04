/**
 * Product (Informed Design) service
 */

import { apiRequestJson } from '../utils/apiClient';
import { formatAccessId } from '../utils/idUtils';

/**
 * Pull the array out of an Informed Design list response.
 *
 * The API is inconsistent about the envelope key across resources and versions
 * (bare array, `results`, `data`, `items`, or the resource name), so try the
 * known keys and then fall back to the first array-valued property. Returns
 * `{ list, shape }` — `shape` names where the array came from, for diagnostics.
 */
const extractList = (data, ...preferredKeys) => {
  if (Array.isArray(data)) return { list: data, shape: 'array' };
  if (!data || typeof data !== 'object') return { list: [], shape: typeof data };

  for (const key of [...preferredKeys, 'results', 'data', 'items']) {
    if (Array.isArray(data[key])) return { list: data[key], shape: key };
  }
  for (const key in data) {
    if (Array.isArray(data[key])) return { list: data[key], shape: `fallback:${key}` };
  }
  return { list: [], shape: `no-array(keys: ${Object.keys(data).join(',') || 'none'})` };
};

/**
 * Checks if a folder has at least one Informed Design product (lightweight, no releases fetch).
 * @param {string} accessToken - The access token
 * @param {string} projectId - The project ID
 * @param {string} folderId - The folder URN
 * @returns {Promise<boolean>} - True if the folder has at least one product
 */
export const folderHasProducts = async (accessToken, projectId, folderId) => {
  if (!projectId || !folderId || folderId === 'null') {
    return false;
  }
  try {
    const data = await apiRequestJson(
      `/api/informed-design/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/products`,
      {},
      accessToken
    );
    let productsList = [];
    if (Array.isArray(data)) {
      productsList = data;
    } else if (data?.results && Array.isArray(data.results)) {
      productsList = data.results;
    } else if (data?.data && Array.isArray(data.data)) {
      productsList = data.data;
    } else if (data?.products && Array.isArray(data.products)) {
      productsList = data.products;
    } else if (data?.items && Array.isArray(data.items)) {
      productsList = data.items;
    } else if (typeof data === 'object' && data !== null) {
      for (const key in data) {
        if (Array.isArray(data[key])) {
          productsList = data[key];
          break;
        }
      }
    }
    return productsList.length > 0;
  } catch {
    return false;
  }
};

/**
 * Fetches all products for a given project and folder
 * @param {string} accessToken - The access token
 * @param {string} projectId - The project ID
 * @param {string} folderId - The folder URN
 * @returns {Promise<Array>} - Array of product objects with releases
 */
export const fetchProducts = async (accessToken, projectId, folderId) => {
  if (!projectId || !folderId || folderId === 'null') {
    return [];
  }
  
  const data = await apiRequestJson(
    `/api/informed-design/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/products`,
    {},
    accessToken
  );
  
  // Extract products from response
  let productsList = [];
  if (Array.isArray(data)) {
    productsList = data;
  } else if (data.results && Array.isArray(data.results)) {
    productsList = data.results;
  } else if (data.data && Array.isArray(data.data)) {
    productsList = data.data;
  } else if (data.products && Array.isArray(data.products)) {
    productsList = data.products;
  } else if (data.items && Array.isArray(data.items)) {
    productsList = data.items;
  } else if (typeof data === 'object' && data !== null) {
    for (const key in data) {
      if (Array.isArray(data[key])) {
        productsList = data[key];
        break;
      }
    }
  }

  // Process products in batches to avoid ERR_INSUFFICIENT_RESOURCES (too many concurrent requests)
  const BATCH_SIZE = 5;
  const productsWithReleases = [];
  for (let i = 0; i < productsList.length; i += BATCH_SIZE) {
    const batch = productsList.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (product) => {
        try {
          const productId = product.id || product.productId;
          if (!productId) return { ...product, defaultRelease: null, releases: [] };

          const defaultReleaseId = product.defaultRelease || product.defaultReleaseId ||
                                    product.default_release_id || product.default_release;

          const accessId = formatAccessId(projectId, folderId);

          let allReleases = [];
          let defaultRelease = null;
          let releasesError = null;

          try {
            const releasesResponse = await apiRequestJson(
              `/api/informed-design/releases?productId=${encodeURIComponent(productId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
              {},
              accessToken
            );

            const { list, shape } = extractList(releasesResponse, 'releases');
            allReleases = list;
            if (allReleases.length === 0) {
              console.warn(
                `[fetchProducts] 0 releases for product ${productId} — response shape "${shape}":`,
                releasesResponse
              );
            }

            // Ascending by release number so the dropdown reads 1, 2, 3…
            allReleases.sort(
              (a, b) =>
                (a.number || a.releaseNumber || a.release_number || 0) -
                (b.number || b.releaseNumber || b.release_number || 0)
            );

            if (defaultReleaseId) {
              defaultRelease = allReleases.find(r =>
                (r.id || r.releaseId) === defaultReleaseId ||
                (r.id || r.releaseId) === `b.${defaultReleaseId}` ||
                `b.${r.id || r.releaseId}` === defaultReleaseId
              );
            }
            if (!defaultRelease && allReleases.length > 0) {
              defaultRelease = allReleases[0];
            }
          } catch (err) {
            // Keep going so one bad product doesn't blank the whole gallery, but
            // surface WHY — a silently-empty releases list is impossible to debug.
            releasesError = err.message || String(err);
            console.error(`[fetchProducts] releases failed for product ${productId}:`, err);
          }

          return {
            ...product,
            defaultRelease,
            // The default id the API actually designated. `defaultRelease` above
            // falls back to releases[0] purely to preselect something, so it must
            // NOT be used to decide the "★ default" marker or every product with
            // no designated default would star its first release.
            foundDefaultReleaseId: defaultReleaseId || null,
            releases: allReleases,
            releasesError,
          };
        } catch (error) {
          console.error('[fetchProducts] product processing failed:', error);
          return { ...product, defaultRelease: null, releases: [], releasesError: error.message || String(error) };
        }
      })
    );
    productsWithReleases.push(...batchResults);
  }

  return productsWithReleases;
};

/**
 * Fetches all releases for a product
 * @param {string} accessToken - The access token
 * @param {string} productId - The product ID
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<Array>} - Array of release objects
 */
export const fetchProductReleases = async (accessToken, productId, accessId) => {
  const data = await apiRequestJson(
    `/api/informed-design/releases?productId=${encodeURIComponent(productId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
    {},
    accessToken
  );
  
  return extractList(data, 'releases').list;
};

/**
 * Fetches release details
 * @param {string} accessToken - The access token
 * @param {string} releaseId - The release ID
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<Object>} - Release details
 */
export const fetchReleaseDetails = async (accessToken, releaseId, accessId) => {
  return await apiRequestJson(
    `/api/informed-design/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
    {},
    accessToken
  );
};

/**
 * Fetches product thumbnail
 * @param {string} accessToken - The access token
 * @param {string} productId - The product ID
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<string>} - Thumbnail URL
 */
export const fetchProductThumbnail = async (accessToken, productId, accessId) => {
  try {
    const response = await apiRequestJson(
      `/api/informed-design/products/${encodeURIComponent(productId)}/thumbnail?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
      {},
      accessToken
    );
    return response.downloadUrl || response.url || null;
  } catch (error) {
    return null;
  }
};

