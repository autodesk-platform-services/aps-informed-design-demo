/**
 * Authentication middleware
 */

/**
 * Extract access token from Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} - The access token or null if not found
 */
export function getAccessToken(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Middleware to require authentication
 * Returns 401 if no valid token is provided
 */
export function requireAuth(req, res, next) {
  const accessToken = getAccessToken(req);
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  req.accessToken = accessToken;
  next();
}

