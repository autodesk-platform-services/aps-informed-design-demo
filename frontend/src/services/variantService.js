/**
 * Variant (Informed Design) service
 */

import { apiRequestJson } from '../utils/apiClient';

/**
 * Fetches all variants for a release
 * @param {string} accessToken - The access token
 * @param {string} releaseId - The release ID
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<Array>} - Array of variant objects
 */
export const fetchVariants = async (accessToken, releaseId, accessId) => {
  const data = await apiRequestJson(
    `/api/informed-design/variants?accessType=ACC&accessId=${encodeURIComponent(accessId)}&releaseId=${encodeURIComponent(releaseId)}`,
    {},
    accessToken
  );
  
  if (Array.isArray(data)) {
    return data;
  } else if (data.data && Array.isArray(data.data)) {
    return data.data;
  } else if (data.variants && Array.isArray(data.variants)) {
    return data.variants;
  }
  return [];
};

/**
 * Fetches variant details
 * @param {string} accessToken - The access token
 * @param {string} variantId - The variant ID
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<Object>} - Variant details
 */
export const fetchVariantDetails = async (accessToken, variantId, accessId) => {
  return await apiRequestJson(
    `/api/informed-design/variants/${encodeURIComponent(variantId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
    {},
    accessToken
  );
};

/**
 * Creates a new variant
 * @param {string} accessToken - The access token
 * @param {Object} variantData - The variant data to create
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<Object>} - Created variant
 */
export const createVariant = async (accessToken, variantData, accessId) => {
  return await apiRequestJson(
    `/api/informed-design/variants?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
    {
      method: 'POST',
      body: JSON.stringify(variantData),
    },
    accessToken
  );
};

/**
 * Deletes a variant
 * @param {string} accessToken - The access token
 * @param {string} variantId - The variant ID
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<void>}
 */
export const deleteVariant = async (accessToken, variantId, accessId) => {
  await apiRequestJson(
    `/api/informed-design/variants/${encodeURIComponent(variantId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
    {
      method: 'DELETE',
    },
    accessToken
  );
};

/**
 * Fetches variant thumbnail
 * @param {string} accessToken - The access token
 * @param {string} variantId - The variant ID
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<string>} - Thumbnail URL
 */
export const fetchVariantThumbnail = async (accessToken, variantId, accessId) => {
  try {
    const response = await apiRequestJson(
      `/api/informed-design/variants/${encodeURIComponent(variantId)}/thumbnail?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
      {},
      accessToken
    );
    return response.downloadUrl || response.url || null;
  } catch (error) {
    return null;
  }
};

