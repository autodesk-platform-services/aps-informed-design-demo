/**
 * Folder (ACC) service
 */

import { apiRequestJson } from '../utils/apiClient';

/**
 * Fetches all folders for a given project
 * @param {string} accessToken - The access token
 * @param {string} projectId - The project ID
 * @param {string} hubId - The account/hub ID
 * @returns {Promise<Array>} - Array of folder objects with nested structure
 */
export const fetchFolders = async (accessToken, projectId, hubId) => {
  if (!projectId || !hubId) {
    return [];
  }
  
  const data = await apiRequestJson(
    `/api/acc/projects/${encodeURIComponent(projectId)}/folders?hubId=${encodeURIComponent(hubId)}`,
    {},
    accessToken
  );
  return data.data || [];
};

