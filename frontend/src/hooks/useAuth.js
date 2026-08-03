import { useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';

/**
 * Custom hook for authentication management.
 * Handles OAuth flow, token management, and user profile.
 *
 * @returns {Object} Authentication state and methods
 */
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Kept apart from `error`: a missing display name must not present itself as
  // a failed sign-in. Surfaced for diagnosis rather than swallowed.
  const [profileError, setProfileError] = useState(null);
  const [apsAppName, setApsAppName] = useState(null);
  const [apsClientId, setApsClientId] = useState(null);
  const [customApsCredentials, setCustomApsCredentials] = useState(() => {
    try {
      const stored = localStorage.getItem('custom_aps_credentials');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Fetch APS app name and client ID on mount
  useEffect(() => {
    const fetchAppInfo = async () => {
      try {
        if (customApsCredentials) {
          setApsAppName(customApsCredentials.appName || null);
          setApsClientId(customApsCredentials.clientId || null);
        } else {
          const config = await authService.getApsConfig();
          if (config.appName) {
            setApsAppName(config.appName);
          }
          if (config.clientId) {
            setApsClientId(config.clientId);
          }
        }
      } catch (error) {
        // Silently fail - use defaults
      }
    };
    fetchAppInfo();
  }, [customApsCredentials]);

  const fetchUserProfile = async (accessToken) => {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    const profile = await authService.fetchUserProfile(accessToken);
    setUserProfile(profile);
    setProfileError(null);
    setIsAuthenticated(true);
  };

  /**
   * Restore a session from a stored token.
   *
   * The profile call is how we check the token is still good, but "the profile
   * endpoint said no" and "this token is dead" are NOT the same thing, and
   * treating them as one caused three separate bugs. When the profile request
   * failed for any reason this used to delete the stored token, so a profile
   * outage silently pulled the token out from under everything else that reads
   * it: the ACC projects list quietly went empty, and the configurator sat on
   * "Loading products…" forever because its effect bails out when the token is
   * missing and leaves `products` at its not-loaded value.
   *
   * So only a genuine auth rejection (401, after apiClient has already tried a
   * refresh) clears the session. Anything else leaves the token alone and just
   * means we render without a display name.
   */
  const verifyTokenAndGetProfile = async (token) => {
    try {
      await fetchUserProfile(token);
    } catch (err) {
      if (err?.status === 401 || err?.requiresLogin) {
        localStorage.removeItem('aps_access_token');
        localStorage.removeItem('aps_refresh_token');
        localStorage.removeItem('aps_token_expires_at');
        setIsAuthenticated(false);
        return;
      }

      // The token is fine — we just have no profile to show. Stay signed in.
      setIsAuthenticated(true);
      setProfileError(err?.message || 'Failed to load user profile');
    }
  };

  const handleOAuthCallback = useCallback(async (code) => {
    try {
      setLoading(true);
      setError(null);

      window.history.replaceState({}, document.title, window.location.pathname);

      const redirectUri = window.location.origin + window.location.pathname;
      const data = await authService.exchangeToken(code, redirectUri, customApsCredentials);

      localStorage.setItem('aps_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('aps_refresh_token', data.refresh_token);
      }
      if (data.expires_in) {
        const expirationTime = Date.now() + (data.expires_in * 1000);
        localStorage.setItem('aps_token_expires_at', expirationTime.toString());
      }

      setIsAuthenticated(true);
      setError(null);

      try {
        await fetchUserProfile(data.access_token);
      } catch (err) {
        // Sign-in still succeeded; we just have no display name. Recorded
        // rather than swallowed so the reason is visible somewhere.
        setProfileError(err?.message || 'Failed to load user profile');
      }
    } catch (err) {
      localStorage.removeItem('aps_access_token');
      localStorage.removeItem('aps_refresh_token');
      localStorage.removeItem('aps_token_expires_at');

      const errorMessage = err.message || 'Unknown error';
      if (errorMessage.includes('authorization code is invalid') ||
        errorMessage.includes('authorization code has expired') ||
        errorMessage.includes('invalid or has expired')) {
        setError(null);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [customApsCredentials]);

  // Handle OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const errorParam = urlParams.get('error');
    const state = urlParams.get('state');

    const getStoredState = async () => {
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getOAuthState) {
        try {
          const stored = await window.electronAPI.getOAuthState();
          return stored;
        } catch (err) {
          return localStorage.getItem('aps_oauth_state') || sessionStorage.getItem('aps_oauth_state');
        }
      } else {
        return localStorage.getItem('aps_oauth_state') || sessionStorage.getItem('aps_oauth_state');
      }
    };

    const clearStoredState = async () => {
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.clearOAuthState) {
        await window.electronAPI.clearOAuthState();
      } else {
        localStorage.removeItem('aps_oauth_state');
        sessionStorage.removeItem('aps_oauth_state');
      }
    };

    const handleCallback = async () => {
      const hasUrlParams = code || errorParam || state;
      if (hasUrlParams) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (errorParam) {
        const errorDescription = urlParams.get('error_description') || errorParam;
        if (errorParam !== 'access_denied') {
          setError(`Authentication error: ${errorDescription}`);
        }
        await clearStoredState();
        return;
      }

      if (code && state) {
        const storedState = await getStoredState();
        if (!storedState) {
          await clearStoredState();
          handleOAuthCallback(code);
        } else if (state !== storedState) {
          setError('Security error: State parameter mismatch. This may occur if the redirect URI doesn\'t match or if you have multiple tabs open. Please clear your browser cache, close other tabs, and try logging in again.');
          await clearStoredState();
          return;
        } else {
          await clearStoredState();
          handleOAuthCallback(code);
        }
      } else if (code) {
        await clearStoredState();
        handleOAuthCallback(code);
      } else {
        const storedToken = localStorage.getItem('aps_access_token');
        if (storedToken) {
          const expiresAt = localStorage.getItem('aps_token_expires_at');
          if (expiresAt) {
            const expirationTime = parseInt(expiresAt, 10);
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;

            if (now >= expirationTime - fiveMinutes) {
              const refreshToken = localStorage.getItem('aps_refresh_token');
              if (refreshToken) {
                authService.refreshToken(refreshToken, customApsCredentials).then((tokenData) => {
                  localStorage.setItem('aps_access_token', tokenData.access_token);
                  if (tokenData.refresh_token) {
                    localStorage.setItem('aps_refresh_token', tokenData.refresh_token);
                  }
                  if (tokenData.expires_in) {
                    const newExpirationTime = Date.now() + (tokenData.expires_in * 1000);
                    localStorage.setItem('aps_token_expires_at', newExpirationTime.toString());
                  }
                  verifyTokenAndGetProfile(tokenData.access_token);
                }).catch(() => {
                  localStorage.removeItem('aps_access_token');
                  localStorage.removeItem('aps_refresh_token');
                  localStorage.removeItem('aps_token_expires_at');
                  setIsAuthenticated(false);
                });
                return;
              }
            }
          }

          verifyTokenAndGetProfile(storedToken);
        }
      }
    };

    handleCallback();

    const handleTokenExpired = () => {
      setIsAuthenticated(false);
      setError('Your session has expired. Please log in again.');
    };

    window.addEventListener('token-expired', handleTokenExpired);

    return () => {
      window.removeEventListener('token-expired', handleTokenExpired);
    };
  }, [customApsCredentials, handleOAuthCallback]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      let config;
      if (customApsCredentials) {
        config = {
          clientId: customApsCredentials.clientId,
          redirectUri: process.env.APS_REDIRECT_URI || 'http://localhost:8080',
          appName: customApsCredentials.appName || null
        };
      } else {
        config = await authService.getApsConfig();
      }

      if (!config.clientId || !config.redirectUri) {
        throw new Error('APS configuration not found. Please set APS_CLIENT_ID and APS_REDIRECT_URI environment variables.');
      }

      if (typeof config.clientId !== 'string' || config.clientId.trim() === '') {
        throw new Error('Invalid APS_CLIENT_ID. Please check your .env file.');
      }

      if (config.appName) {
        setApsAppName(config.appName);
      }

      const scope = 'data:read data:write data:create account:read user-profile:read';
      let redirectUri = config.redirectUri.trim();
      if (redirectUri.endsWith('/')) {
        redirectUri = redirectUri.slice(0, -1);
      }

      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.setOAuthState) {
        await window.electronAPI.setOAuthState(state);
      } else {
        localStorage.setItem('aps_oauth_state', state);
        sessionStorage.setItem('aps_oauth_state', state);
      }

      const clientIdToUse = customApsCredentials ? customApsCredentials.clientId : config.clientId;

      const params = new URLSearchParams();
      params.append('response_type', 'code');
      params.append('client_id', clientIdToUse);
      params.append('redirect_uri', redirectUri);
      params.append('scope', scope);
      params.append('state', state);

      const authUrl = `https://developer.api.autodesk.com/authentication/v2/authorize?${params.toString()}`;

      try {
        new URL(authUrl);
      } catch (urlError) {
        throw new Error(`Invalid authorization URL: ${urlError.message}`);
      }

      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron && window.electronAPI.isElectron()) {
        window.location.href = authUrl;
      } else {
        window.location.href = authUrl;
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aps_access_token');
    localStorage.removeItem('aps_refresh_token');
    localStorage.removeItem('saved_account_id');
    localStorage.removeItem('saved_project_id');
    localStorage.removeItem('saved_folder_id');
    localStorage.removeItem('saved_product_id');
    setIsAuthenticated(false);
    setUserProfile(null);
    setProfileError(null);

    window.location.href = 'https://accounts.autodesk.com/Authentication/LogOut';
  };

  return {
    isAuthenticated,
    userProfile,
    profileError,
    loading,
    error,
    apsAppName,
    apsClientId,
    customApsCredentials,
    setCustomApsCredentials,
    setError,
    handleLogin,
    handleLogout,
  };
};
