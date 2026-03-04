/**
 * Variant routes (Informed Design)
 * Handles Variants CRUD operations
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { cache, CACHE_TTL, getCacheKey, getCached, setCached, invalidateCached } from '../utils/cache.js';
import { removeBPrefix } from '../utils/idUtils.js';

const router = express.Router();

// Variants endpoint - fetches variants for a specific release
router.get('/', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  
  try {
    // Get releaseId, accessId and accessType from query parameters
    const releaseId = req.query.releaseId;
    const accessId = req.query.accessId;
    const accessType = req.query.accessType || 'ACC';
    
    
    if (!releaseId || typeof releaseId !== 'string') {
      return res.status(400).json({ error: 'Release ID is required' });
    }
    
    if (!accessId) {
      return res.status(400).json({ error: 'Access ID is required' });
    }
    
    // Normalize releaseId for cache key so GET and POST use the same key (e.g. strip "b." if present)
    const normalizedReleaseId = typeof releaseId === 'string' && releaseId.startsWith('b.') ? releaseId.substring(2) : releaseId;
    const variantsCacheKey = getCacheKey('api', 'variants', normalizedReleaseId, accessId, accessType);
    let data = getCached(cache.api, variantsCacheKey, CACHE_TTL.api, 'api');
    
    if (!data) {
      // Fetch variants from Informed Design API
      const variantsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/variants?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}&releaseId=${encodeURIComponent(releaseId)}`;
      
      const response = await fetch(variantsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch variants';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(response.status).json({ error: errorMessage });
      }
      
      data = await response.json();
      setCached(cache.api, variantsCacheKey, data, CACHE_TTL.api);
    }
    
    // Remove "b." prefix from variant IDs if present
    const processedData = removeBPrefix(data, ['id', 'variantId', 'variant_id']);
    
    // Return the processed variants data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching variants', details: error.message });
  }
});

// Variant Details endpoint - fetches details for a specific variant
router.get('/:variantId', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const variantId = req.params.variantId;
  const { accessId, accessType } = req.query;
  
  if (!accessId || !accessType) {
    return res.status(400).json({ error: 'accessId and accessType are required' });
  }
  
  try {
    // Check cache first – variant details (including parameters/inputs) don’t change after creation
    const variantCacheKey = getCacheKey('api', 'variant', variantId, accessId, accessType);
    let data = getCached(cache.api, variantCacheKey, CACHE_TTL.variantParameters, 'api');

    if (!data) {
      const variantUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/variants/${encodeURIComponent(variantId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;

      const response = await fetch(variantUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch variant details';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(response.status).json({ error: errorMessage });
      }

      data = await response.json();
      setCached(cache.api, variantCacheKey, data, CACHE_TTL.variantParameters);
    }
    
    // Remove "b." prefix from variant IDs if present
    const processedData = removeBPrefix(data, ['id', 'variantId', 'variant_id']);
    
    // Return the processed variant data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching variant details', details: error.message });
  }
});

// Create Variant endpoint - creates a new variant
router.post('/', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  
  try {
    // Get releaseId, accessId and accessType from query parameters
    const releaseId = req.query.releaseId;
    const accessId = req.query.accessId;
    const accessType = req.query.accessType || 'ACC';
    
    if (!releaseId) {
      return res.status(400).json({ error: 'Release ID is required' });
    }
    
    if (!accessId) {
      return res.status(400).json({ error: 'Access ID is required' });
    }
    
    // Get inputs and name from request body
    const { inputs, name } = req.body;
    
    if (!inputs || !Array.isArray(inputs)) {
      return res.status(400).json({ error: 'Inputs array is required' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Variant name is required' });
    }
    
    // Ensure inputs only have name and value (not key)
    const formattedInputs = inputs.map(input => {
      return {
        name: input.name || input.key,
        value: input.value
      };
    });
    
    // Create variant in Informed Design API
    const variantUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/variants?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}`;
    
    const requestBody = {
      releaseId: releaseId,
      name: name,
      inputs: formattedInputs
    };
    
    const response = await fetch(variantUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      
      let errorMessage = 'Failed to create variant';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(response.status).json({ error: errorMessage });
    }
    
    const data = await response.json();
    
    // Remove "b." prefix from variant ID if present
    const processedData = removeBPrefix(data, ['id', 'variantId', 'variant_id']);
    
    // Invalidate variants list cache so the next GET returns the new variant (use same normalized key as GET)
    const normalizedReleaseId = typeof releaseId === 'string' && releaseId.startsWith('b.') ? releaseId.substring(2) : releaseId;
    const variantsCacheKey = getCacheKey('api', 'variants', normalizedReleaseId, accessId, accessType);
    invalidateCached(cache.api, variantsCacheKey, 'api');
    
    // Return the created variant data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while creating variant', details: error.message });
  }
});

// Delete Variant endpoint - deletes a variant
router.delete('/:variantId', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const variantId = req.params.variantId;
  const { accessId, accessType } = req.query;
  
  if (!accessId || !accessType) {
    return res.status(400).json({ error: 'accessId and accessType are required' });
  }
  
  try {
    const variantUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/variants/${encodeURIComponent(variantId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
    
    const response = await fetch(variantUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to delete variant';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(response.status).json({ error: errorMessage });
    }

    // Invalidate cached variant details so we don’t serve stale params after delete
    const variantCacheKey = getCacheKey('api', 'variant', variantId, accessId, accessType);
    invalidateCached(cache.api, variantCacheKey, 'api');

    // Return success response
    res.json({ success: true, message: 'Variant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while deleting variant', details: error.message });
  }
});

// Variant Thumbnail endpoint - creates, polls, downloads and caches variant thumbnail
router.get('/:variantId/thumbnail', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const variantId = req.params.variantId;
  const { accessId, accessType, releaseId, representation } = req.query;
  
  if (!accessId || !accessType) {
    return res.status(400).json({ error: 'accessId and accessType are required' });
  }
  
  if (!releaseId) {
    return res.status(400).json({ error: 'releaseId is required' });
  }
  
  try {
    // Check cache first (disk + memory)
    let cachedThumbnail = null;
    try {
      const thumbnailCacheKey = getCacheKey('thumbnails', 'variant', variantId, releaseId, accessId, accessType, representation || '[Primary]');
      cachedThumbnail = getCached(cache.thumbnails, thumbnailCacheKey, CACHE_TTL.thumbnails, 'product-thumbnails');
    } catch (cacheError) {
      // Cache is optional, continue without it
    }
    
    if (cachedThumbnail) {
      res.setHeader('Content-Type', cachedThumbnail.contentType || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cachedThumbnail.buffer);
    }
    
    // Step 1: Check if variant already has a thumbnail output
    const params = new URLSearchParams();
    params.append('accessType', accessType);
    params.append('accessId', accessId);
    if (representation) {
      params.append('representation', representation);
    }
    
    const outputsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs?${params.toString()}`;
    
    let thumbnailOutputId = null;
    const outputsResponse = await fetch(outputsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (outputsResponse.ok) {
      try {
        const outputsData = await outputsResponse.json();
        const outputs = outputsData.results || outputsData.data || (Array.isArray(outputsData) ? outputsData : []);
        
        // Find existing thumbnail output for this variant
        const thumbnailOutput = outputs.find(output => {
          const outputVariantId = output.variantId || output.variant_id;
          const outputType = output.type || output.outputType;
          return String(outputVariantId) === String(variantId) && 
                 outputType && outputType.toUpperCase() === 'THUMBNAIL';
        });
        
        if (thumbnailOutput) {
          thumbnailOutputId = thumbnailOutput.id || thumbnailOutput.outputId || thumbnailOutput.output_id;
        }
      } catch (parseError) {
        // Parse error - continue (might be able to create new output)
      }
    }
    
    // Step 2: If no thumbnail output exists, create one
    if (!thumbnailOutputId) {
      // Fetch release to get representation
      const releaseUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/releases/${encodeURIComponent(releaseId)}?accessId=${encodeURIComponent(accessId)}&accessType=${accessType}`;
      const releaseResponse = await fetch(releaseUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (!releaseResponse.ok) {
        const errorText = await releaseResponse.text().catch(() => '');
        return res.status(releaseResponse.status).json({ 
          error: 'Failed to fetch release',
          details: errorText
        });
      }
      
      let releaseData;
      try {
        releaseData = await releaseResponse.json();
      } catch (parseError) {
        return res.status(500).json({ 
          error: 'Failed to parse release response',
          details: parseError.message
        });
      }
      
      const representations = releaseData.representations || [];
      const representationToUse = representation || (representations.length > 0 ? representations[0].name : '[Primary]');
      
      // Create thumbnail output
      const createOutputUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}`;
      const createOutputResponse = await fetch(createOutputUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
        body: JSON.stringify({
          variantId: variantId,
          outputs: [{
            type: 'THUMBNAIL',
            settings: {
              representation: representationToUse
            }
          }]
        }),
      });
      
      if (!createOutputResponse.ok) {
        const errorText = await createOutputResponse.text();
        let errorMessage = 'Failed to create thumbnail output';
        let errorDetails = null;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
          errorDetails = errorData;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(createOutputResponse.status).json({ 
          error: errorMessage,
          details: errorDetails,
          variantId: variantId,
          releaseId: releaseId
        });
      }
      
      let createOutputData;
      try {
        const responseText = await createOutputResponse.text();
        createOutputData = JSON.parse(responseText);
      } catch (parseError) {
        return res.status(500).json({ 
          error: 'Failed to parse create output response',
          details: parseError.message
        });
      }
      
      // The create response might have outputs array with the created output
      if (createOutputData.outputs && Array.isArray(createOutputData.outputs) && createOutputData.outputs.length > 0) {
        thumbnailOutputId = createOutputData.outputs[0].id || createOutputData.outputs[0].outputId || createOutputData.outputs[0].output_id;
      } else if (createOutputData.results && Array.isArray(createOutputData.results) && createOutputData.results.length > 0) {
        // Try results array
        thumbnailOutputId = createOutputData.results[0].id || createOutputData.results[0].outputId || createOutputData.results[0].output_id;
      } else {
        // Try direct properties
        thumbnailOutputId = createOutputData.id || createOutputData.outputId || createOutputData.output_id;
      }
      
      if (!thumbnailOutputId) {
        return res.status(500).json({ 
          error: 'Failed to get output ID from create response',
          details: 'Response structure unexpected',
          responseData: createOutputData
        });
      }
    }
    
    // Step 3: Poll output status until SUCCESS (with shorter timeout for thumbnails)
    let statusData = null;
    const maxAttempts = 30; // 30 seconds for thumbnails (they're usually quick)
    const pollInterval = 1000; // 1 second
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs/${encodeURIComponent(thumbnailOutputId)}?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}`;
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (statusResponse.ok) {
        try {
          statusData = await statusResponse.json();
        } catch (parseError) {
          // Continue to next attempt
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          }
          break;
        }
        
        const status = statusData.status || statusData.state || statusData.data?.status || statusData.data?.state;
        
        if (status === 'SUCCESS' || status === 'success' || status === 'Success') {
          break;
        } else if (status === 'FAILED' || status === 'failed' || status === 'Failed' || status === 'ERROR' || status === 'error') {
          return res.status(500).json({ 
            error: 'Thumbnail generation failed',
            status: status,
            outputId: thumbnailOutputId
          });
        }
      }
      
      // Wait before next poll (except on last attempt)
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    if (!statusData) {
      return res.status(500).json({ error: 'Failed to get output status' });
    }
    
    const finalStatus = statusData.status || statusData.state || statusData.data?.status || statusData.data?.state;
    if (finalStatus !== 'SUCCESS' && finalStatus !== 'success' && finalStatus !== 'Success') {
      // Return 202 with outputId so frontend can poll separately if needed
      return res.status(202).json({ 
        error: 'Thumbnail generation still in progress', 
        status: finalStatus,
        outputId: thumbnailOutputId
      });
    }
    
    // Step 4: Get download URL
    const downloadsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/downloads?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}`;
    const downloadsResponse = await fetch(downloadsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
      body: JSON.stringify({
        outputIds: [thumbnailOutputId]
      }),
    });
    
    if (!downloadsResponse.ok) {
      const errorText = await downloadsResponse.text().catch(() => '');
      return res.status(downloadsResponse.status).json({ 
        error: 'Failed to get download request',
        details: errorText
      });
    }
    
    let downloadsData;
    try {
      downloadsData = await downloadsResponse.json();
    } catch (parseError) {
      return res.status(500).json({ 
        error: 'Failed to parse downloads response',
        details: parseError.message
      });
    }
    
    const downloadRequestId = downloadsData.downloadRequestId || downloadsData.download_request_id || downloadsData.id;
    
    if (!downloadRequestId) {
      return res.status(500).json({ 
        error: 'Failed to get download request ID',
        responseData: downloadsData
      });
    }
    
    // Step 5: Get signed URL
    const signedUrlResponse = await fetch(
      `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/downloads/${encodeURIComponent(downloadRequestId)}?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      }
    );
    
    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text().catch(() => '');
      return res.status(signedUrlResponse.status).json({ 
        error: 'Failed to get signed URL',
        details: errorText
      });
    }
    
    let signedUrlData;
    try {
      signedUrlData = await signedUrlResponse.json();
    } catch (parseError) {
      return res.status(500).json({ 
        error: 'Failed to parse signed URL response',
        details: parseError.message
      });
    }
    
    const outputs = signedUrlData.outputs || [];
    const signedUrl = outputs.length > 0 ? outputs[0].url : null;
    
    if (!signedUrl) {
      return res.status(500).json({ 
        error: 'No signed URL in response',
        responseData: signedUrlData
      });
    }
    
    // Step 6: Download thumbnail
    const thumbnailResponse = await fetch(signedUrl, {
      method: 'GET',
    });
    
    if (!thumbnailResponse.ok) {
      return res.status(thumbnailResponse.status).json({ error: 'Failed to download thumbnail' });
    }
    
    const thumbnailBuffer = await thumbnailResponse.arrayBuffer();
    const contentType = thumbnailResponse.headers.get('content-type') || 'image/png';
    
    // Cache the thumbnail (disk + memory) - wrap in try-catch since cache is optional
    try {
      const thumbnailCacheKey = getCacheKey('thumbnails', 'variant', variantId, releaseId, accessId, accessType, representation || '[Primary]');
      setCached(cache.thumbnails, thumbnailCacheKey, {
        buffer: Buffer.from(thumbnailBuffer),
        contentType: contentType,
      }, CACHE_TTL.thumbnails, 'product-thumbnails');
    } catch (cacheError) {
      // Cache is optional, continue without it
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Cache', 'MISS');
    
    // Return the thumbnail
    res.send(Buffer.from(thumbnailBuffer));
  } catch (error) {
    console.error('[Variant Thumbnail] Error:', {
      variantId,
      releaseId,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error while fetching variant thumbnail', 
        details: error.message,
        variantId: variantId,
        releaseId: releaseId
      });
    }
  }
});

// Variant Outputs endpoint - fetches outputs for a specific variant (kept for backward compatibility)
router.get('/:variantId/outputs', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const variantId = req.params.variantId;
  const { accessId, accessType, representation } = req.query;
  
  if (!accessId || !accessType) {
    return res.status(400).json({ error: 'accessId and accessType are required' });
  }
  
  try {
    // Build URL with query parameters
    const params = new URLSearchParams();
    params.append('accessType', accessType);
    params.append('accessId', accessId);
    if (representation) {
      params.append('representation', representation);
    }
    
    const outputsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs?${params.toString()}`;
    
    const response = await fetch(outputsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch outputs';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(response.status).json({ error: errorMessage });
    }
    
    const data = await response.json();
    
    // Filter outputs by variantId if provided
    let filteredData = data;
    if (variantId && data.results && Array.isArray(data.results)) {
      filteredData = {
        ...data,
        results: data.results.filter(output => {
          const outputVariantId = output.variantId || output.variant_id;
          return String(outputVariantId) === String(variantId);
        })
      };
    }
    
    // Remove "b." prefix from output IDs if present
    const processedData = removeBPrefix(filteredData, ['id', 'outputId', 'output_id', 'variantId', 'variant_id']);
    
    // Return the processed outputs data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching outputs', details: error.message });
  }
});

export default router;

