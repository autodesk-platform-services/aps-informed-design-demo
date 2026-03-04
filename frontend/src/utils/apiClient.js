/**
 * API client utility for making backend API calls
 */

// Token refresh state to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise = null;

/**
 * Refreshes the access token using the refresh token
 * @returns {Promise<string|null>} - New access token or null if refresh failed
 */
const refreshAccessToken = async () => {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('aps_refresh_token');
      if (!refreshToken) {
        return null;
      }
      
      // Get custom credentials if set
      const customCredentials = localStorage.getItem('custom_aps_credentials');
      let credentials = null;
      if (customCredentials) {
        try {
          credentials = JSON.parse(customCredentials);
        } catch (e) {
          // Invalid JSON, ignore
        }
      }
      
      // Call refresh endpoint directly to avoid circular dependencies
      // Use getApiUrl helper but bypass apiRequestJson to avoid recursion
      const apiUrl = getApiUrl('/api/aps/refresh');
      
      const requestBody = { refresh_token: refreshToken };
      if (credentials) {
        requestBody.customClientId = credentials.clientId;
        requestBody.customClientSecret = credentials.clientSecret;
      }
      
      const refreshResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        let errorMessage = 'Failed to refresh token';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.developerMessage || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const tokenData = await refreshResponse.json();
      
      // Store new tokens
      localStorage.setItem('aps_access_token', tokenData.access_token);
      if (tokenData.refresh_token) {
        localStorage.setItem('aps_refresh_token', tokenData.refresh_token);
      }
      
      // Store expiration time (expires_in is in seconds)
      if (tokenData.expires_in) {
        const expirationTime = Date.now() + (tokenData.expires_in * 1000);
        localStorage.setItem('aps_token_expires_at', expirationTime.toString());
      }
      
      return tokenData.access_token;
    } catch (error) {
      // Refresh failed - clear tokens and trigger re-login
      localStorage.removeItem('aps_access_token');
      localStorage.removeItem('aps_refresh_token');
      localStorage.removeItem('aps_token_expires_at');
      
      // Dispatch custom event to trigger re-login
      window.dispatchEvent(new CustomEvent('token-expired'));
      
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
};

const getBackendUrl = () => {
  // Check if running in Electron and use the backend URL from Electron API
  // Try both window.electronAPI and window.__electronAPI (fallback)
  const electronAPI = (typeof window !== 'undefined' && window.electronAPI) 
    ? window.electronAPI 
    : (typeof window !== 'undefined' && window.__electronAPI) 
      ? window.__electronAPI 
      : null;
  
  if (electronAPI && electronAPI.getBackendUrl) {
    const url = electronAPI.getBackendUrl();
    return url;
  }
  // Fallback to environment variable or default
  const fallbackUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
  return fallbackUrl;
};

/**
 * Gets the URL to use for API requests
 * In development with proxy configured, use relative URLs
 * In Electron, always use absolute URLs with the backend URL
 * Otherwise, use absolute URLs with the backend URL
 */
const getApiUrl = (endpoint) => {
  // If endpoint already starts with http, use it as-is
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  
  // Check if running in Electron
  const electronAPI = (typeof window !== 'undefined' && window.electronAPI) 
    ? window.electronAPI 
    : (typeof window !== 'undefined' && window.__electronAPI) 
      ? window.__electronAPI 
      : null;
  const isElectron = electronAPI && electronAPI.isElectron && electronAPI.isElectron();
  
  // In development (web browser): use backend URL when set so requests hit the backend directly.
  // When REACT_APP_BACKEND_URL is set, use it to avoid depending on the dev-server proxy.
  if (process.env.NODE_ENV === 'development' && !isElectron) {
    if (process.env.REACT_APP_BACKEND_URL) {
      const backendUrl = getBackendUrl();
      return `${backendUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    }
    // No backend URL: rely on proxy; use relative URLs
    if (!endpoint.startsWith('/')) {
      return `/${endpoint}`;
    }
    return endpoint;
  }

  // In Electron or production, use absolute URLs
  const backendUrl = getBackendUrl();
  return `${backendUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

/**
 * Makes an authenticated API request to the backend
 * @param {string} endpoint - The API endpoint (relative to backend URL)
 * @param {Object} options - Fetch options (method, body, etc.)
 * @param {string} accessToken - The access token for authentication
 * @returns {Promise<Response>} - The fetch response
 */
export const apiRequest = async (endpoint, options = {}, accessToken) => {
  const url = getApiUrl(endpoint);
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Makes an authenticated API request and returns JSON
 * @param {string} endpoint - The API endpoint
 * @param {Object} options - Fetch options
 * @param {string} accessToken - The access token
 * @param {boolean} retryOn401 - Whether to retry with refreshed token on 401 (default: true)
 * @returns {Promise<Object>} - The parsed JSON response
 */
export const apiRequestJson = async (endpoint, options = {}, accessToken, retryOn401 = true) => {
  let response = await apiRequest(endpoint, options, accessToken);
  
  // Handle 401 Unauthorized - try to refresh token and retry
  if (response.status === 401 && retryOn401 && accessToken) {
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      // Retry the request with the new token
      const retryOptions = { ...options };
      if (retryOptions.headers) {
        retryOptions.headers = { ...retryOptions.headers };
      } else {
        retryOptions.headers = {};
      }
      retryOptions.headers['Authorization'] = `Bearer ${newToken}`;
      
      response = await apiRequest(endpoint, retryOptions, newToken);
    } else {
      // Refresh failed - throw error to trigger re-login
      const error = new Error('Authentication expired. Please log in again.');
      error.status = 401;
      error.requiresLogin = true;
      throw error;
    }
  }
  
  if (!response.ok) {
    let errorMessage = 'Request failed';
    let errorDetails = null;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.developerMessage || errorData.message || errorMessage;
      errorDetails = errorData;
    } catch (parseError) {
      const errorText = await response.text();
      errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
    }
    
    // Create error with more details
    const error = new Error(errorMessage);
    error.status = response.status;
    error.details = errorDetails;
    if (response.status === 401) {
      error.requiresLogin = true;
    }
    throw error;
  }
  
  return await response.json();
};

