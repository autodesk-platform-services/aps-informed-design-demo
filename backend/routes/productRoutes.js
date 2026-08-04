/**
 * Product routes (Informed Design)
 * Handles Products, Releases, and Product Thumbnails
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { cache, CACHE_TTL, getCacheKey, getCached, setCached } from '../utils/cache.js';
import { removeBPrefix } from '../utils/idUtils.js';

const router = express.Router();

// Products endpoint - fetches products for a project and folder
router.get('/projects/:projectId/folders/:folderId/products', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const projectId = req.params.projectId;
  const folderId = req.params.folderId;
  
  // Validate projectId and folderId
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  
  if (!folderId || typeof folderId !== 'string') {
    return res.status(400).json({ error: 'Invalid folder ID' });
  }
  
  try {
    // Format: accessId = projectId + '|' + folderUrn, accessType = 'ACC'
    // Remove "b." prefix from projectId if present
    const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
    const folderUrn = folderId; // folderId is already the URN
    const accessId = `${cleanProjectId}|${folderUrn}`;
    const accessType = 'ACC';
    
    // Check cache first
    const productsCacheKey = getCacheKey('api', 'products', projectId, folderId, accessType);
    let data = getCached(cache.api, productsCacheKey, CACHE_TTL.api, 'api');
    
    if (!data) {
      // Build URL with query parameters (accessType first, not URL encoded)
      const productsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/products?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}`;
      
      const response = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch products';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(response.status).json({ error: errorMessage });
      }
      
      data = await response.json();
      setCached(cache.api, productsCacheKey, data, CACHE_TTL.api);
    }
    
    // Extract products array from response - API may return products in different structures
    let productsList = [];
    if (Array.isArray(data)) {
      productsList = data;
    } else if (data.results && Array.isArray(data.results)) {
      productsList = data.results;
    } else if (data.data && Array.isArray(data.data)) {
      productsList = data.data;
    } else if (data.products && Array.isArray(data.products)) {
      productsList = data.products;
    } else if (data.items && Array.isArray(data.items)) {
      productsList = data.items;
    } else if (typeof data === 'object' && data !== null) {
      // Try to find any array property
      for (const key in data) {
        if (Array.isArray(data[key])) {
          productsList = data[key];
          break;
        }
      }
    }
    
    // Remove "b." prefix from product IDs in the response
    const processedData = removeBPrefix(productsList, ['id', 'productId', 'product_id']);
    
    // Return the processed products data as an array
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching products', details: error.message });
  }
});

// Single Product endpoint - fetches a single product by ID with full details including defaultRelease
router.get('/products/:productId', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const productId = req.params.productId;
  const { accessId, accessType } = req.query;
  
  if (!accessId || !accessType) {
    return res.status(400).json({ error: 'accessId and accessType are required' });
  }
  
  try {
    // Check cache first
    const productCacheKey = getCacheKey('api', 'product', productId, accessId, accessType);
    let data = getCached(cache.api, productCacheKey, CACHE_TTL.api, 'api');
    
    if (!data) {
      // Try the new endpoint first: /informed-design/v1/products/{productId}
      // If that fails with 404, fall back to the old endpoint: /industrialized-construction/informed-design/v1/products/{productId}
      let productUrl = `https://developer.api.autodesk.com/informed-design/v1/products/${encodeURIComponent(productId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
      
      
      
      let response = await fetch(productUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      // If 404, try the old endpoint path (some APIs might still use the old path)
      if (response.status === 404) {
        productUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/products/${encodeURIComponent(productId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
        response = await fetch(productUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        
        
        // For 404 errors, the product might not exist in that folder or the ID might be wrong
        // Return a structured error that the frontend can handle
        if (response.status === 404) {
          try {
            const errorData = JSON.parse(errorText);
            return res.status(404).json({ 
              error: 'Product not found',
              detail: errorData.detail || 'The product does not exist in the specified folder',
              productId: productId,
              accessId: accessId
            });
          } catch (parseError) {
            return res.status(404).json({ 
              error: 'Product not found',
              detail: errorText || 'The product does not exist in the specified folder',
              productId: productId
            });
          }
        }
        
        let errorMessage = 'Failed to fetch product';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(response.status).json({ error: errorMessage });
      }
      
      data = await response.json();
      
      // Log the full response to see what classification field is available
      
      
      
      // Try to find classification in the response
      const classification = data.classification || 
                           data.classificationName || 
                           data.classification_name ||
                           data.classificationId ||
                           data.classification_id ||
                           (data.data && data.data.classification) ||
                           (data.data && data.data.classificationName) ||
                           null;
      
      
      // If classification is nested, log the structure
      if (data.data) {
        
      }
      if (data.attributes) {
        
      }
      
      setCached(cache.api, productCacheKey, data, CACHE_TTL.api);
    }
    
    // Remove "b." prefix from product IDs in the response
    const processedData = removeBPrefix(data, ['id', 'productId', 'product_id']);
    
    // Log what we're returning
    
    
    // Return the processed product data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching product', details: error.message });
  }
});

// Releases endpoint - fetches all releases for a product
router.get('/releases', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const { productId, accessId, accessType } = req.query;
  
  if (!productId || !accessId || !accessType) {
    return res.status(400).json({ error: 'productId, accessId, and accessType are required' });
  }
  
  try {
    // Check cache first
    const releasesCacheKey = getCacheKey('api', 'releases', productId, accessId, accessType);
    let data = getCached(cache.api, releasesCacheKey, CACHE_TTL.api, 'api');
    
    if (!data) {
      const releasesUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/releases?productId=${encodeURIComponent(productId)}&accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
      
      const response = await fetch(releasesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch releases';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(response.status).json({ error: errorMessage });
      }
      
      data = await response.json();

      setCached(cache.api, releasesCacheKey, data, CACHE_TTL.api);
    }
    
    // Remove "b." prefix from release IDs in the response
    const processedData = removeBPrefix(data, ['id', 'releaseId', 'release_id']);
    
    // Return the processed releases data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching releases', details: error.message });
  }
});

// Release Details endpoint - fetches details for a specific release
router.get('/releases/:releaseId', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const releaseId = req.params.releaseId;
  const { accessId, accessType } = req.query;
  
  
  
  
  if (!accessId || !accessType) {
    return res.status(400).json({ error: 'accessId and accessType are required' });
  }
  
  try {
    // Check cache first
    const releaseCacheKey = getCacheKey('api', 'release', releaseId, accessId, accessType);
    let data = getCached(cache.api, releaseCacheKey, CACHE_TTL.api, 'api');
    
    if (data) {
    } else {
      
      // Try new endpoint first, fallback to old endpoint if 404
      let releaseUrl = `https://developer.api.autodesk.com/informed-design/v1/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
      
      
      
      const requestStartTime = Date.now();
      let response = await fetch(releaseUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      const requestDuration = Date.now() - requestStartTime;

      

      if (response.status === 404) {
        releaseUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
        const oldRequestStartTime = Date.now();
        response = await fetch(releaseUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        const oldRequestDuration = Date.now() - oldRequestStartTime;
        
      }

      if (!response.ok) {
        const errorText = await response.text();
        
        let errorMessage = 'Failed to fetch release';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(response.status).json({ error: errorMessage });
      }

      data = await response.json();

      
      // Check for nested data structure
      if (data.data) {
        
      }
      
      // Log outputSettings structure - try multiple possible locations
      if (data.data) {
        
        
      }
      
      const outputSettings = data.outputSettings || 
                            data.output_settings ||
                            (data.data && data.data.outputSettings) ||
                            (data.data && data.data.output_settings) ||
                            null;
      
      if (outputSettings) {
        
        
        
        if (Array.isArray(outputSettings)) {
          
          // Log each output setting
          outputSettings.forEach((output, index) => {
            
            const type = output.type || output.outputType || '';
            
            // Check if this is RFA
            if (String(type).toUpperCase() === 'RFA') {
              // RFA output found
            }
          });
          
          // Try to find RFA output setting and category
          const rfaOutput = outputSettings.find(output => {
            const type = output.type || output.outputType || '';
            return String(type).toUpperCase() === 'RFA';
          });
          
          if (rfaOutput) {
            
            
          } else {
            
          }
        } else {
        }
      } else {
        Object.keys(data).forEach(key => {
          if (key.toLowerCase().includes('output') || key.toLowerCase().includes('setting')) {
            
          }
        });
      }
      
      // Log family if available
      const family = data.family || 
                    data.familyName || 
                    data.family_name ||
                    (data.data && data.data.family) ||
                    null;
      
      setCached(cache.api, releaseCacheKey, data, CACHE_TTL.api);
    }
    
    // Remove "b." prefix from release IDs in the response
    const processedData = removeBPrefix(data, ['id', 'releaseId', 'release_id']);


    // Return the processed release data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching release', details: error.message });
  }
});

// Rules endpoint - fetches rules for a release using rulesKey
router.get('/rules/:rulesKey', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const rulesKey = req.params.rulesKey;
  
  if (!rulesKey) {
    return res.status(400).json({ error: 'rulesKey is required' });
  }
  
  try {
    // Check cache first
    const rulesCacheKey = getCacheKey('api', 'rules', rulesKey);
    let data = getCached(cache.api, rulesCacheKey, CACHE_TTL.api, 'api');
    
    if (!data) {
      const rulesUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/rules/${encodeURIComponent(rulesKey)}`;
      
      const response = await fetch(rulesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch rules';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(response.status).json({ error: errorMessage });
      }
      
      data = await response.json();
      setCached(cache.api, rulesCacheKey, data, CACHE_TTL.api);
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching rules', details: error.message });
  }
});

// Rules Evaluate endpoint - evaluates rules against input values
router.post('/rules:evaluate', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const { rules, inputs } = req.body;
  
  if (!rules) {
    return res.status(400).json({ error: 'rules is required' });
  }
  
  if (!inputs || !Array.isArray(inputs)) {
    return res.status(400).json({ error: 'inputs array is required' });
  }
  
  try {
    const evaluateUrl = 'https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/rules:evaluate';
    
    const requestBody = {
      rules: rules,
      inputs: inputs
    };
    
    const response = await fetch(evaluateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
      body: JSON.stringify(requestBody),
    });
    
    // Get the response text first (could be JSON or plain text)
    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = 'Failed to evaluate rules';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = responseText || errorMessage;
      }
      return res.status(response.status).json({ error: errorMessage });
    }
    
    const data = JSON.parse(responseText);

    // Check if the response contains an error property (even with 200 status)
    if (data.error && data.error.errors && data.error.errors.length > 0) {
      // Build a user-friendly error message from the error details
      const errorMessages = data.error.errors.map(err => {
        const paramName = err.parameter || err.field || 'Input';
        let message = err.detail || err.title || 'Validation failed';
        
        // Add value information if available
        if (err.value !== undefined && err.updatedValue !== undefined) {
          message = `${paramName}: ${message}. Value ${err.value} was updated to ${err.updatedValue}.`;
        } else if (err.value !== undefined) {
          message = `${paramName}: ${message} (value: ${err.value}).`;
        } else {
          message = `${paramName}: ${message}.`;
        }
        
        return message;
      });
      
      // Combine all error messages
      const combinedErrorMessage = errorMessages.join(' ');
      
      // Return the error to the frontend
      return res.status(200).json({
        valid: false,
        error: combinedErrorMessage,
        evaluatedInputs: data.evaluatedInputs,
        errorDetails: data.error
      });
    }
    
    // No errors - return success
    res.json({
      valid: true,
      evaluatedInputs: data.evaluatedInputs
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while evaluating rules', details: error.message });
  }
});

// Product Thumbnail endpoint - downloads and serves product thumbnail
router.get('/products/:productId/thumbnail', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const productId = req.params.productId;
  const { accessId, accessType } = req.query;
  
  if (!accessId || !accessType) {
    return res.status(400).json({ error: 'accessId and accessType are required' });
  }
  
  try {
    // Check cache first (disk + memory)
    const thumbnailCacheKey = getCacheKey('thumbnails', 'product', productId, accessId, accessType);
    let cachedThumbnail = getCached(cache.thumbnails, thumbnailCacheKey, CACHE_TTL.thumbnails, 'product-thumbnails');
    
    if (cachedThumbnail) {
      // Set appropriate headers for cached thumbnail
      res.setHeader('Content-Type', cachedThumbnail.contentType || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cachedThumbnail.buffer);
    }
    
    // Step 1: Fetch product to get default release ID
    const productsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/products?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}`;
    
    const productsResponse = await fetch(productsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!productsResponse.ok) {
      const errorText = await productsResponse.text();
      let errorMessage = 'Failed to fetch product';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(productsResponse.status).json({ error: errorMessage });
    }
    
    const productsData = await productsResponse.json();
    
    // Extract products array
    let productsList = [];
    if (Array.isArray(productsData)) {
      productsList = productsData;
    } else if (productsData.results && Array.isArray(productsData.results)) {
      productsList = productsData.results;
    } else if (productsData.data && Array.isArray(productsData.data)) {
      productsList = productsData.data;
    } else if (productsData.products && Array.isArray(productsData.products)) {
      productsList = productsData.products;
    }
    
    // Find the product by ID
    const product = productsList.find(p => {
      const pId = p.id || p.productId;
      return String(pId) === String(productId) || 
             String(pId).replace(/^b\./, '') === String(productId).replace(/^b\./, '');
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get default release ID from product
    const defaultReleaseId = product.defaultRelease?.id || 
                             product.defaultRelease?.releaseId || 
                             product.defaultRelease || 
                             product.defaultReleaseId || 
                             product.default_release_id || 
                             product.default_release;
    
    if (!defaultReleaseId) {
      return res.status(404).json({ error: 'Product has no default release' });
    }
    
    // Step 2: Fetch release to extract objectKey from thumbnails[0].thumbnail
    const releaseUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/releases/${encodeURIComponent(defaultReleaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
    
    const releaseResponse = await fetch(releaseUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!releaseResponse.ok) {
      const errorText = await releaseResponse.text();
      let errorMessage = 'Failed to fetch release';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(releaseResponse.status).json({ error: errorMessage });
    }
    
    const releaseData = await releaseResponse.json();
    
    // Extract objectKey from thumbnails[0].thumbnail
    const thumbnails = releaseData.thumbnails || releaseData.thumbnail || [];
    const thumbnail = Array.isArray(thumbnails) ? thumbnails[0] : thumbnails;
    const objectKey = thumbnail?.thumbnail || thumbnail?.objectKey || thumbnail?.key;
    
    if (!objectKey) {
      return res.status(404).json({ error: 'Thumbnail objectKey not found in release' });
    }
    
    // Step 3: Call download-url with objectKey as query parameter
    const downloadUrlEndpoint = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/products/${encodeURIComponent(productId)}/download-url?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}&objectKey=${encodeURIComponent(objectKey)}`;
    
    const downloadUrlResponse = await fetch(downloadUrlEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!downloadUrlResponse.ok) {
      const errorText = await downloadUrlResponse.text();
      let errorMessage = 'Failed to get thumbnail download URL';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(downloadUrlResponse.status).json({ error: errorMessage });
    }
    
    const downloadUrlData = await downloadUrlResponse.json();
    const downloadUrl = downloadUrlData.downloadUrl || downloadUrlData.url;
    
    if (!downloadUrl) {
      return res.status(404).json({ error: 'Thumbnail download URL not found in response' });
    }
    
    // Step 4: Download the thumbnail
    const thumbnailResponse = await fetch(downloadUrl, {
      method: 'GET',
    });
    
    if (!thumbnailResponse.ok) {
      return res.status(thumbnailResponse.status).json({ error: 'Failed to download thumbnail' });
    }
    
    const thumbnailBuffer = await thumbnailResponse.arrayBuffer();
    const contentType = thumbnailResponse.headers.get('content-type') || 'image/png';
    
    // Cache the thumbnail (disk + memory)
    setCached(cache.thumbnails, thumbnailCacheKey, {
      buffer: Buffer.from(thumbnailBuffer),
      contentType: contentType,
    }, CACHE_TTL.thumbnails, 'product-thumbnails');
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Return the thumbnail
    res.send(Buffer.from(thumbnailBuffer));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching thumbnail', details: error.message });
  }
});

export default router;

