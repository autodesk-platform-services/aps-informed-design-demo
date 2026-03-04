/**
 * Account (ACC Hub) service
 */

import { apiRequestJson } from '../utils/apiClient';

/**
 * Fetches all ACC accounts (hubs) for the authenticated user
 * @param {string} accessToken - The access token
 * @returns {Promise<Array>} - Array of account objects
 */
export const fetchAccounts = async (accessToken) => {
  const data = await apiRequestJson('/api/acc/accounts', {}, accessToken);
  return data.data || [];
};

