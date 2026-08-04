/**
 * Output (Informed Design) service
 */

import { apiRequestJson, apiRequest } from '../utils/apiClient';

/**
 * Creates an output for a variant
 * @param {string} accessToken - The access token
 * @param {Object} outputData - The output data (variantId, outputType, representation, etc.)
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<Object>} - Created output response
 */
export const createOutput = async (accessToken, outputData, accessId) => {
  return await apiRequestJson(
    `/api/informed-design/outputs?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
    {
      method: 'POST',
      body: JSON.stringify(outputData),
    },
    accessToken
  );
};

/**
 * Gets output status
 * @param {string} accessToken - The access token
 * @param {string} outputId - The output ID
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<Object>} - Output status data
 */
export const getOutputStatus = async (accessToken, outputId, accessId) => {
  return await apiRequestJson(
    `/api/informed-design/outputs/${encodeURIComponent(outputId)}?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
    {},
    accessToken
  );
};

/**
 * Polls output status until completion or failure
 * @param {string} accessToken - The access token
 * @param {string} outputId - The output ID
 * @param {string} accessId - The formatted access ID
 * @param {Function} onStatusUpdate - Callback function called on each status update
 * @param {number} maxAttempts - Maximum number of polling attempts
 * @param {number} interval - Polling interval in milliseconds
 * @returns {Promise<Object|null>} - Final status data or null if failed/timed out
 */
export const pollOutputStatus = async (
  accessToken,
  outputId,
  accessId,
  onStatusUpdate = null,
  maxAttempts = 60,
  interval = 2000
) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const statusData = await getOutputStatus(accessToken, outputId, accessId);
      const status = statusData.status || statusData.state || statusData.Status || statusData.State;
      
      if (onStatusUpdate && typeof onStatusUpdate === 'function') {
        onStatusUpdate(status);
      }
      
      if (status === 'SUCCESS' || status === 'success' || status === 'Success') {
        return statusData;
      } else if (status === 'FAILURE' || status === 'failure' || status === 'Failure' || 
                 status === 'FAILED' || status === 'failed') {
        const errorMessage = statusData.error || statusData.message || 
                            statusData.errorMessage || statusData.error_message || 
                            'Output generation failed';
        throw new Error(errorMessage);
      }
      
      // If status is PENDING or IN_PROGRESS, continue polling
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (err) {
      if (attempt === maxAttempts - 1) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw new Error('Output generation timed out');
};

/**
 * Downloads an output file
 * @param {string} accessToken - The access token
 * @param {string} outputId - The output ID
 * @param {string} accessId - The formatted access ID
 * @returns {Promise<Blob>} - The file blob
 */
export const downloadOutput = async (accessToken, outputId, accessId) => {
  const response = await apiRequest(
    `/api/informed-design/outputs/${encodeURIComponent(outputId)}/download?accessId=${encodeURIComponent(accessId)}&accessType=ACC`,
    {},
    accessToken
  );
  
  if (!response.ok) {
    throw new Error('Failed to download output');
  }
  
  return await response.blob();
};

