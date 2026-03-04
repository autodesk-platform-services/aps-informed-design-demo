/**
 * Project (ACC) service
 */

import { apiRequestJson } from '../utils/apiClient';

/**
 * Fetches all projects for a given account (hub)
 * @param {string} accessToken - The access token
 * @param {string} hubId - The account/hub ID
 * @returns {Promise<Array>} - Array of project objects
 */
export const fetchProjects = async (accessToken, hubId) => {
  if (!hubId) {
    return [];
  }
  
  const data = await apiRequestJson(
    `/api/acc/accounts/${encodeURIComponent(hubId)}/projects`,
    {},
    accessToken
  );
  return data.data || [];
};

