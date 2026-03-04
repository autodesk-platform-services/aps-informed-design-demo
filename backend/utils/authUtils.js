/**
 * Authentication utilities
 */

/**
 * Get 2-legged OAuth token for OSS bucket operations
 * @returns {Promise<string>} - The 2LO access token
 */
export async function get2LOToken() {
  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('APS_CLIENT_ID and APS_CLIENT_SECRET must be set for 2LO token');
  }
  
  const tokenUrl = 'https://developer.api.autodesk.com/authentication/v2/token';
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', 'bucket:create bucket:read data:read data:write');
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'x-ads-region': 'US',
    },
    body: params.toString(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get 2LO token: ${response.status} ${errorText}`);
  }
  
  const tokenData = await response.json();
  return tokenData.access_token;
}

