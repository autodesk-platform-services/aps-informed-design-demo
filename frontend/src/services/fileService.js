/**
 * File (ACC) service
 */

import { apiRequestJson } from '../utils/apiClient';

/**
 * Fetches all files for a given project
 * @param {string} accessToken - The access token
 * @param {string} projectId - The project ID
 * @param {string} hubId - The account/hub ID
 * @returns {Promise<Array>} - Array of file objects with nested structure
 */
export const fetchFiles = async (accessToken, projectId, hubId) => {
  if (!projectId || !hubId) {
    return [];
  }
  
  const url = `/api/acc/projects/${encodeURIComponent(projectId)}/files?hubId=${encodeURIComponent(hubId)}`;
  
  const data = await apiRequestJson(
    url,
    {},
    accessToken
  );
  
  return data.data || [];
};
