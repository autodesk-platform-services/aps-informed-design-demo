/**
 * Product (Informed Design) service
 */

import { apiRequestJson } from '../utils/apiClient';
import { formatAccessId } from '../utils/idUtils';

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

          try {
            const releasesResponse = await apiRequestJson(
              `/api/informed-design/releases?productId=${encodeURIComponent(productId)}&accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
              {},
              accessToken
            );

            if (Array.isArray(releasesResponse)) {
              allReleases = releasesResponse;
            } else if (releasesResponse.data && Array.isArray(releasesResponse.data)) {
              allReleases = releasesResponse.data;
            } else if (releasesResponse.releases && Array.isArray(releasesResponse.releases)) {
              allReleases = releasesResponse.releases;
            }

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
          } catch (releasesError) {
            // If releases fetch fails, continue with empty releases
          }

          return {
            ...product,
            defaultRelease,
            releases: allReleases,
          };
        } catch (error) {
          return { ...product, defaultRelease: null, releases: [] };
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
  
  if (Array.isArray(data)) {
    return data;
  } else if (data.data && Array.isArray(data.data)) {
    return data.data;
  } else if (data.releases && Array.isArray(data.releases)) {
    return data.releases;
  }
  return [];
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

