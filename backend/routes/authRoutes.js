/**
 * Authentication routes (APS OAuth)
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Diagnostic endpoint to help debug APS configuration
router.get('/diagnose', (req, res) => {
  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;
  const redirectUri = process.env.APS_REDIRECT_URI || 'http://localhost:8080';
  
  const diagnostics = {
    clientId: {
      exists: !!clientId,
      length: clientId ? clientId.length : 0,
      preview: clientId ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 4)}` : 'N/A',
      isEmpty: clientId ? clientId.trim() === '' : true
    },
    clientSecret: {
      exists: !!clientSecret,
      length: clientSecret ? clientSecret.length : 0,
      isEmpty: clientSecret ? clientSecret.trim() === '' : true
    },
    redirectUri: {
      value: redirectUri,
      isEmpty: redirectUri ? redirectUri.trim() === '' : true
    },
    authorizationUrl: clientId && redirectUri ? 
      `https://developer.api.autodesk.com/authentication/v1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=data:read%20data:write` :
      'Cannot generate - missing credentials'
  };
  
  res.json(diagnostics);
});

// APS Configuration endpoint (returns client ID, redirect URI, and app name)
// Supports custom credentials from request body (for app switching)
router.get('/config', async (req, res) => {
  // Check for custom credentials in request (from app switching)
  // These would be sent as query params or headers, but for security we'll check session/cookies
  // For now, we'll use a POST endpoint for switching apps
  const clientId = process.env.APS_CLIENT_ID;
  const redirectUri = process.env.APS_REDIRECT_URI || 'http://localhost:8080';
  
  if (!clientId) {
    return res.status(500).json({ 
      error: 'APS_CLIENT_ID not configured',
      message: 'Please configure APS_CLIENT_ID in the backend .env file'
    });
  }
  
  if (typeof clientId !== 'string' || clientId.trim() === '') {
    return res.status(500).json({ 
      error: 'APS_CLIENT_ID is empty or invalid',
      message: 'Please check your .env file configuration'
    });
  }
  
  // Ensure redirect URI doesn't have trailing slash (APS is strict about this)
  let finalRedirectUri = redirectUri.trim();
  if (finalRedirectUri.endsWith('/')) {
    finalRedirectUri = finalRedirectUri.slice(0, -1);
  }
  
  // Get app name from environment variable
  const appName = process.env.APS_APP_NAME || null;
  
  res.json({
    clientId: clientId.trim(),
    redirectUri: finalRedirectUri,
    appName: appName
  });
});

// Endpoint to set custom APS app credentials (for app switching)
// Note: In a production app, these should be stored securely server-side
// For this demo, we'll just validate and return success
// The frontend will store and send these with requests
router.post('/config', async (req, res) => {
  const { appName, clientId, clientSecret } = req.body;
  
  if (!clientId || !clientSecret) {
    return res.status(400).json({ 
      error: 'Client ID and Client Secret are required'
    });
  }
  
  // Validate format (basic validation)
  if (typeof clientId !== 'string' || clientId.trim() === '') {
    return res.status(400).json({ error: 'Invalid Client ID format' });
  }
  
  if (typeof clientSecret !== 'string' || clientSecret.trim() === '') {
    return res.status(400).json({ error: 'Invalid Client Secret format' });
  }
  
  // Return success - frontend will store and use these credentials
  res.json({ 
    success: true,
    message: 'App credentials updated. Please re-authenticate.',
    appName: appName || null,
    clientId: clientId.trim()
  });
});

// APS Token exchange endpoint (securely exchanges authorization code for access token)
router.post('/token', async (req, res) => {
  // Validate input
  const { code, redirectUri: requestRedirectUri } = req.body;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Invalid authorization code provided' });
  }
  
  // Check for custom credentials in request body (from app switching)
  // Frontend will send these when custom credentials are set
  let clientId = req.body.customClientId || process.env.APS_CLIENT_ID;
  let clientSecret = req.body.customClientSecret || process.env.APS_CLIENT_SECRET;
  
  // Use redirect URI from request if provided, otherwise from env
  // This ensures it matches exactly what was used in the authorization request
  const redirectUri = requestRedirectUri || process.env.APS_REDIRECT_URI || 'http://localhost:8080';
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'APS credentials not configured' });
  }
  
  try {
    // Exchange authorization code for access token (3-legged OAuth)
    // Using v2/token to match v2/authorize endpoint used in frontend
    // Both endpoints must use the same version
    const tokenUrl = 'https://developer.api.autodesk.com/authentication/v2/token';
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'x-ads-region': 'US',
      },
      body: params.toString(),
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = 'Failed to exchange authorization code for token';
      let errorDetails = null;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.developerMessage || errorData.error_description || errorData.error || errorMessage;
        errorDetails = errorData;
      } catch (parseError) {
        errorMessage = responseText || errorMessage;
      }
      return res.status(response.status).json({ 
        error: errorMessage,
        details: errorDetails,
        statusCode: response.status
      });
    }
    
    const tokenData = JSON.parse(responseText);
    
    // Return token data to frontend (excluding client secret)
    res.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during token exchange', details: error.message });
  }
});

// APS Token refresh endpoint (refreshes access token using refresh token)
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token || typeof refresh_token !== 'string') {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  
  // Check for custom credentials in request body (from app switching)
  let clientId = req.body.customClientId || process.env.APS_CLIENT_ID;
  let clientSecret = req.body.customClientSecret || process.env.APS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'APS credentials not configured' });
  }
  
  try {
    // Refresh access token using refresh token
    const tokenUrl = 'https://developer.api.autodesk.com/authentication/v2/token';
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refresh_token);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'x-ads-region': 'US',
      },
      body: params.toString(),
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = 'Failed to refresh access token';
      let errorDetails = null;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.developerMessage || errorData.error_description || errorData.error || errorMessage;
        errorDetails = errorData;
      } catch (parseError) {
        errorMessage = responseText || errorMessage;
      }
      return res.status(response.status).json({ 
        error: errorMessage,
        details: errorDetails,
        statusCode: response.status
      });
    }
    
    const tokenData = JSON.parse(responseText);
    
    // Return token data to frontend
    res.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refresh_token, // Use new refresh token if provided, otherwise keep old one
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during token refresh', details: error.message });
  }
});

// User Info endpoint - extracts basic user info from token
router.get('/user-info', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    // Decode JWT token to get user info
    const parts = accessToken.split('.');
    if (parts.length === 3) {
      // Decode base64url (JWT uses base64url, not standard base64)
      const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64Url, 'base64').toString());
      
      // Return any user-identifying fields from the token
      // APS tokens typically have 'userid' which is often the user's email
      const userInfo = {
        email: payload.email || payload.user_name || payload.preferred_username || (payload.userid && payload.userid.includes('@') ? payload.userid : null) || null,
        name: payload.name || null,
        sub: payload.sub || null,
        userid: payload.userid || null,
        client_id: payload.client_id || null
      };
      
      res.json(userInfo);
    } else {
      res.status(400).json({ error: 'Invalid token format' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to decode token', details: error.message });
  }
});

// User Profile endpoint - proxies the APS OIDC UserInfo endpoint
router.get('/user-profile', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    // The OIDC UserInfo endpoint. Requires the `user-profile:read` scope and
    // returns snake_case claims: sub, name, given_name, family_name,
    // preferred_username, email, email_verified, picture, locale.
    //
    // This used to point at `/userprofile/v2/users/@me`, which does not exist —
    // it answers a bare nginx `403 Forbidden` (text/html), with none of the JSON
    // error body a real APS endpoint returns. That is easy to misread as a
    // permissions or scope problem, so if you see an HTML 403 from any APS host,
    // suspect the path before the token. `/userinfo` answers 401 for a bad
    // token, which is how you can tell it is a real route.
    const profileUrl = 'https://api.userprofile.autodesk.com/userinfo';

    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch user profile';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        // If it's HTML, extract just the title or use a generic message
        if (errorText.includes('<title>')) {
          const titleMatch = errorText.match(/<title>(.*?)<\/title>/i);
          errorMessage = titleMatch ? titleMatch[1] : '403 Forbidden';
        } else {
          errorMessage = errorText.substring(0, 100) || errorMessage;
        }
      }
      return res.status(response.status).json({ error: errorMessage });
    }
    
    const profileData = await response.json();
    res.json(profileData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching user profile', details: error.message });
  }
});

export default router;

