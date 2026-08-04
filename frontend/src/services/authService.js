/**
 * Authentication service for APS OAuth
 */

import { apiRequestJson } from '../utils/apiClient';

/**
 * Exchanges authorization code for access token
 * @param {string} code - The authorization code from OAuth callback
 * @param {string} redirectUri - The redirect URI used in authorization
 * @param {Object} customCredentials - Optional custom APS credentials (for app switching)
 * @returns {Promise<Object>} - Token response with access_token and refresh_token
 */
export const exchangeToken = async (code, redirectUri, customCredentials = null) => {
  // First, get the configured redirect URI from the backend
  let finalRedirectUri = redirectUri;
  try {
    const config = await apiRequestJson('/api/aps/config');
    if (config.redirectUri) {
      finalRedirectUri = config.redirectUri;
    }
  } catch (configError) {
    // If we can't get config, use provided redirectUri
  }
  
  // Fall back to current URL if not provided
  if (!finalRedirectUri) {
    finalRedirectUri = window.location.origin + window.location.pathname;
  }

  const requestBody = { code, redirectUri: finalRedirectUri };
  
  // Include custom credentials if provided (for app switching)
  if (customCredentials) {
    requestBody.customClientId = customCredentials.clientId;
    requestBody.customClientSecret = customCredentials.clientSecret;
  }

  return await apiRequestJson('/api/aps/token', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
};

/**
 * Sets custom APS app credentials (for app switching)
 * @param {Object} credentials - Object with appName, clientId, and clientSecret
 * @returns {Promise<Object>} - Response with success status
 */
export const setCustomApsCredentials = async (credentials) => {
  return await apiRequestJson('/api/aps/config', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
};

/**
 * Fetches the signed-in user's profile.
 *
 * Goes through the backend rather than calling APS from the browser. The old
 * direct call was to `developer.api.autodesk.com/userprofile/v1/users/@me`,
 * which now answers **410 Gone** for a valid token — that endpoint is retired.
 * (It still returns 401 for an *invalid* token, which is why the failure was
 * easy to misread as an auth problem.)
 *
 * The backend proxies `api.userprofile.autodesk.com/userinfo`, the OIDC UserInfo
 * endpoint, which returns snake_case claims (`name`, `given_name`,
 * `family_name`, `preferred_username`, `email`). Requires `user-profile:read`.
 *
 * @param {string} accessToken - The access token
 * @returns {Promise<Object>} - OIDC user claims
 */
export const fetchUserProfile = async (accessToken) => {
  if (!accessToken) {
    throw new Error('Access token is required to fetch the user profile');
  }

  return await apiRequestJson('/api/aps/user-profile', {}, accessToken);
};

/**
 * Gets basic user info from token (doesn't require special scopes)
 * @param {string} accessToken - The access token
 * @returns {Promise<Object>} - User info from token
 */
export const getUserInfo = async (accessToken) => {
  if (!accessToken) {
    throw new Error('Access token is required to get user info');
  }
  
  return await apiRequestJson('/api/aps/user-info', {}, accessToken);
};

/**
 * Gets APS configuration from backend
 * @returns {Promise<Object>} - APS configuration
 */
export const getApsConfig = async () => {
  return await apiRequestJson('/api/aps/config');
};

/**
 * Refreshes access token using refresh token
 * @param {string} refreshToken - The refresh token
 * @param {Object} customCredentials - Optional custom APS credentials (for app switching)
 * @returns {Promise<Object>} - Token response with access_token and refresh_token
 */
export const refreshToken = async (refreshToken, customCredentials = null) => {
  const requestBody = { refresh_token: refreshToken };
  
  // Include custom credentials if provided (for app switching)
  if (customCredentials) {
    requestBody.customClientId = customCredentials.clientId;
    requestBody.customClientSecret = customCredentials.clientSecret;
  }

  return await apiRequestJson('/api/aps/refresh', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
};
