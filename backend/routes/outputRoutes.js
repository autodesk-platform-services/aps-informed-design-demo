/**
 * Output routes (Informed Design)
 * Handles Output creation, status, and downloads
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { cache, CACHE_TTL, getCacheKey, getCached, setCached } from '../utils/cache.js';
import { removeBPrefix } from '../utils/idUtils.js';

const router = express.Router();

// Create Output endpoint - creates an output for a variant
router.post('/', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  
  try {
    // Get variantId and outputs from request body
    // Get accessId and accessType from query parameters
    const { variantId, outputs } = req.body;
    const accessId = req.query.accessId;
    const accessType = req.query.accessType || 'ACC';
    
    if (!variantId) {
      return res.status(400).json({ error: 'Variant ID is required' });
    }
    
    if (!accessId) {
      return res.status(400).json({ error: 'Access ID is required as query parameter' });
    }
    
    if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
      return res.status(400).json({ error: 'Outputs array is required with at least one output containing type and settings.' });
    }
    
    // Validate that each output has type and settings
    for (const output of outputs) {
      if (!output.type) {
        return res.status(400).json({ error: 'Each output in the outputs array must have a type property' });
      }
      if (!output.settings || typeof output.settings !== 'object') {
        return res.status(400).json({ error: 'Each output in the outputs array must have a settings object' });
      }
    }
    
    // Create output from Informed Design API with accessType and accessId as query parameters
    const params = new URLSearchParams();
    params.append('accessType', accessType);
    params.append('accessId', accessId);
    const createOutputUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs?${params.toString()}`;
    
    // The request body should have variantId and outputs object with outputs array
    const requestBody = {
      variantId,
      outputs: outputs
    };
    
    const response = await fetch(createOutputUrl, {
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
      
      let errorMessage = 'Failed to create output';
      let errorDetails = null;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorData.title || errorMessage;
        errorDetails = errorData;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      
      // Logged like variant creation: the upstream body is the only thing that
      // says WHICH output setting was rejected.
      console.error(`[Outputs] create failed (${response.status}):`, errorText);
      console.error('[Outputs] request body was:', JSON.stringify(requestBody));

      return res.status(response.status).json({ error: errorMessage, details: errorDetails });
    }
    
    const data = await response.json();
    
    // Remove "b." prefix from output IDs if present
    const processedData = removeBPrefix(data, ['id', 'outputId', 'output_id']);
    
    // Return the processed output data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while creating output', details: error.message });
  }
});

// Get Outputs endpoint - gets outputs by outputsRequestId, outputId, or variantId
router.get('/', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  
  try {
    // Get outputsRequestId, outputId, or variantId from query parameters
    const outputsRequestId = req.query.outputsRequestId || req.query.outputRequestId;
    const outputId = req.query.outputId;
    const variantId = req.query.variantId;
    const accessId = req.query.accessId;
    const accessType = req.query.accessType || 'ACC';
    
    if (!accessId) {
      return res.status(400).json({ error: 'Access ID is required' });
    }
    
    if (!outputsRequestId && !outputId && !variantId) {
      return res.status(400).json({ 
        error: 'Either outputsRequestId, outputId, or variantId is required',
        details: 'Please provide one of: outputsRequestId, outputId, or variantId to fetch outputs'
      });
    }
    
    // Build URL based on what we have
    let getOutputsUrl;
    if (outputsRequestId) {
      // Get outputs by outputsRequestId
      getOutputsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs?outputsRequestId=${encodeURIComponent(outputsRequestId)}&accessType=${accessType}&accessId=${encodeURIComponent(accessId)}`;
    } else if (outputId) {
      // Get output by outputId
      getOutputsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs/${encodeURIComponent(outputId)}?accessType=${accessType}&accessId=${encodeURIComponent(accessId)}`;
    } else if (variantId) {
      // List outputs by variantId
      const params = new URLSearchParams();
      params.append('accessType', accessType);
      params.append('accessId', accessId);
      params.append('variantId', variantId);
      getOutputsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs?${params.toString()}`;
    }
    
    const response = await fetch(getOutputsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to get output';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(response.status).json({ error: errorMessage });
    }
    
    const data = await response.json();
    
    // Remove "b." prefix from output IDs if present
    const processedData = removeBPrefix(data, ['id', 'outputId', 'output_id']);
    
    // Return the processed output data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while getting output', details: error.message });
  }
});

// Get Output Status endpoint - gets the status of an output by outputId
router.get('/:outputId', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const outputId = req.params.outputId;
  const { accessId, accessType } = req.query;
  
  // Validate outputId
  if (!outputId || typeof outputId !== 'string') {
    return res.status(400).json({ error: 'Invalid output ID' });
  }
  
  if (!accessId) {
    return res.status(400).json({ error: 'Access ID is required' });
  }
  
  try {
    const finalAccessType = accessType || 'ACC';
    
    // Get output status from Informed Design API
    const getOutputUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs/${encodeURIComponent(outputId)}?accessType=${finalAccessType}&accessId=${encodeURIComponent(accessId)}`;
    
    const response = await fetch(getOutputUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to get output status';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(response.status).json({ error: errorMessage });
    }
    
    const data = await response.json();
    
    // Remove "b." prefix from output IDs if present
    const processedData = removeBPrefix(data, ['id', 'outputId', 'output_id']);
    
    // Return the processed output data
    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while getting output status', details: error.message });
  }
});

// Output Download endpoint - gets download URL for an output and serves the file
router.get('/:outputId/download', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const outputId = req.params.outputId;
  const { accessId, accessType, outputType } = req.query;
  
  // Validate outputId
  if (!outputId || typeof outputId !== 'string') {
    return res.status(400).json({ error: 'Invalid output ID' });
  }
  
  if (!accessId) {
    return res.status(400).json({ error: 'Access ID is required' });
  }
  
  try {
    const finalAccessType = accessType || 'ACC';
    
    // Check cache first for output files (especially thumbnails and GLBs)
    const isThumbnail = outputType && outputType.toUpperCase() === 'THUMBNAIL';
    const isGlb = outputType && outputType.toUpperCase() === 'GLB';
    const outputFileCacheKey = getCacheKey('outputFiles', outputId, accessId, finalAccessType, outputType || '');
    const cacheType = isGlb ? 'glbs' : 'outputFiles';
    const outputTtl = isGlb ? CACHE_TTL.variantGlb : (isThumbnail ? CACHE_TTL.thumbnails : CACHE_TTL.outputFiles);
    const cachedOutputFile = getCached(cache.outputFiles, outputFileCacheKey, outputTtl, cacheType);
    
    if (cachedOutputFile) {
      res.setHeader('Content-Type', cachedOutputFile.contentType);
      res.setHeader('Content-Length', cachedOutputFile.buffer.length);
      res.setHeader('X-Cache', 'HIT');
      if (cachedOutputFile.contentDisposition) {
        res.setHeader('Content-Disposition', cachedOutputFile.contentDisposition);
      }
      res.send(cachedOutputFile.buffer);
      return;
    }
    
    // Step 1: Get download request ID from /downloads endpoint with outputId in body
    const params = new URLSearchParams();
    params.append('accessType', finalAccessType);
    params.append('accessId', accessId);
    const downloadsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/downloads?${params.toString()}`;
    
    // outputIds should be in the request body as an array
    const requestBody = {
      outputIds: [outputId]
    };
    
    const downloadsResponse = await fetch(downloadsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
      body: JSON.stringify(requestBody),
    });
    
    
    if (!downloadsResponse.ok) {
      const errorText = await downloadsResponse.text();
      let errorMessage = 'Failed to get download request ID';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(downloadsResponse.status).json({ error: errorMessage });
    }
    
    const downloadsData = await downloadsResponse.json();
    
    // Extract download request ID from response
    const downloadRequestId = downloadsData.downloadRequestId || downloadsData.download_request_id || downloadsData.id || downloadsData.requestId || downloadsData.request_id;
    
    if (!downloadRequestId) {
      return res.status(500).json({ error: 'Failed to get download request ID from response' });
    }
    
    // Step 2: Use download request ID to get signed URL (with caching)
    const signedUrlCacheKey = getCacheKey('signedUrls', downloadRequestId, accessId, finalAccessType);
    let signedUrl = getCached(cache.signedUrls, signedUrlCacheKey, CACHE_TTL.signedUrls, 'signedUrls');
    
    if (!signedUrl) {
      const signedUrlParams = new URLSearchParams();
      signedUrlParams.append('accessType', finalAccessType);
      signedUrlParams.append('accessId', accessId);
      const signedUrlEndpoint = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/downloads/${encodeURIComponent(downloadRequestId)}?${signedUrlParams.toString()}`;
      
      const signedUrlResponse = await fetch(signedUrlEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      
      if (!signedUrlResponse.ok) {
        const errorText = await signedUrlResponse.text();
        let errorMessage = 'Failed to get signed URL';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(signedUrlResponse.status).json({ error: errorMessage });
      }
      
      const signedUrlData = await signedUrlResponse.json();
      
      // Extract signed URL from the first item in the outputs array
      if (signedUrlData.outputs && Array.isArray(signedUrlData.outputs) && signedUrlData.outputs.length > 0) {
        const firstOutput = signedUrlData.outputs[0];
        if (firstOutput.url) {
          signedUrl = firstOutput.url;
        }
      }
      
      if (!signedUrl) {
        return res.status(500).json({ error: 'No signed URL found in outputs array' });
      }
      
      setCached(cache.signedUrls, signedUrlCacheKey, signedUrl, CACHE_TTL.signedUrls);
    }
    
    // Step 3: Download the file from the signed URL
    const fileResponse = await fetch(signedUrl, {
      method: 'GET',
    });
    
    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      return res.status(fileResponse.status).json({ error: 'Failed to download file from signed URL', details: errorText });
    }
    
    // Get the file content and content type
    const fileBuffer = await fileResponse.arrayBuffer();
    let contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
    let contentDisposition = fileResponse.headers.get('content-disposition') || '';
    
    // Handle BOM files - ensure they're served as CSV
    if (outputType && outputType.toUpperCase() === 'BOM') {
      contentType = 'text/csv';
      
      // Update Content-Disposition to ensure .csv extension
      if (contentDisposition) {
        // Extract filename from existing Content-Disposition if present
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        let filename = 'bom.csv';
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
          // Remove existing extension and add .csv
          filename = filename.replace(/\.[^.]*$/, '') + '.csv';
        }
        contentDisposition = `attachment; filename="${filename}"`;
      } else {
        contentDisposition = 'attachment; filename="bom.csv"';
      }
    }
    
    const buffer = Buffer.from(fileBuffer);
    
    // Cache the output file (especially thumbnails and GLBs) to disk
    setCached(cache.outputFiles, outputFileCacheKey, {
      buffer,
      contentType,
      contentDisposition,
    }, outputTtl, cacheType);
    
    // Set appropriate headers and send the file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Cache', 'MISS');
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }
    
    // Send the file buffer
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while getting download URL', details: error.message });
  }
});

// SVF endpoint - polls for SVF and serves it as a resource for viewer
router.get('/:outputId/svf', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const outputId = req.params.outputId;
  const { accessId, accessType } = req.query;
  
  
  if (!outputId || typeof outputId !== 'string') {
    return res.status(400).json({ error: 'Invalid output ID' });
  }
  
  if (!accessId) {
    return res.status(400).json({ error: 'Access ID is required' });
  }
  
  try {
    const finalAccessType = accessType || 'ACC';
    
    // Poll for output status until SUCCESS
    const maxAttempts = 60;
    const pollInterval = 1000; // 1 second
    
    let statusData = null;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const getOutputUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs/${encodeURIComponent(outputId)}?accessType=${finalAccessType}&accessId=${encodeURIComponent(accessId)}`;
      
      const statusResponse = await fetch(getOutputUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      
      
      if (statusResponse.ok) {
        statusData = await statusResponse.json();
        const status = statusData.status || statusData.state || 'UNKNOWN';
        
        if (status === 'SUCCESS' || status === 'success' || status === 'Success') {
          break;
        } else if (status === 'FAILURE' || status === 'failure' || status === 'Failure' || status === 'FAILED' || status === 'failed') {
          return res.status(500).json({ error: 'Output generation failed', details: statusData });
        }
      } else {
        // If the API call fails, log the error and return early
        const errorText = await statusResponse.text();
        let errorMessage = 'Failed to get output status';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(statusResponse.status).json({ error: errorMessage, details: errorText });
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    if (!statusData) {
      return res.status(500).json({ error: 'Failed to get output status after polling' });
    }
    
    const status = statusData.status || statusData.state || 'UNKNOWN';
    if (status !== 'SUCCESS' && status !== 'success' && status !== 'Success') {
      return res.status(500).json({ error: `Output not ready: ${status}`, details: statusData });
    }
    
    // Use the downloads endpoint to get the SVF URL (same as download endpoint)
    // Step 1: Get download request ID from /downloads endpoint with outputId in body
    const params = new URLSearchParams();
    params.append('accessType', finalAccessType);
    params.append('accessId', accessId);
    const downloadsUrl = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/downloads?${params.toString()}`;
    
    const requestBody = {
      outputIds: [outputId]
    };
    
    const downloadsResponse = await fetch(downloadsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
      body: JSON.stringify(requestBody),
    });
    
    const downloadsStatusColor = downloadsResponse.ok ? '\x1b[32m' : '\x1b[31m';
    const downloadsBaseUrl = downloadsUrl.split('?')[0];
    
    if (!downloadsResponse.ok) {
      const errorText = await downloadsResponse.text();
      let errorMessage = 'Failed to get download request ID';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(downloadsResponse.status).json({ error: errorMessage });
    }
    
    const downloadsData = await downloadsResponse.json();
    const downloadRequestId = downloadsData.downloadRequestId || downloadsData.download_request_id || downloadsData.id || downloadsData.requestId || downloadsData.request_id;
    
    if (!downloadRequestId) {
      return res.status(500).json({ error: 'Failed to get download request ID from response' });
    }
    
    // Step 2: Use download request ID to get signed URL
    const signedUrlParams = new URLSearchParams();
    signedUrlParams.append('accessType', finalAccessType);
    signedUrlParams.append('accessId', accessId);
    const signedUrlEndpoint = `https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/downloads/${encodeURIComponent(downloadRequestId)}?${signedUrlParams.toString()}`;
    
    const signedUrlResponse = await fetch(signedUrlEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    const signedUrlStatusColor = signedUrlResponse.ok ? '\x1b[32m' : '\x1b[31m';
    const signedBaseUrl = signedUrlEndpoint.split('?')[0];
    
    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text();
      let errorMessage = 'Failed to get signed URL';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(signedUrlResponse.status).json({ error: errorMessage });
    }
    
    const signedUrlData = await signedUrlResponse.json();
    
    // Extract signed URL from the first item in the outputs array
    let downloadUrl = null;
    if (signedUrlData.outputs && Array.isArray(signedUrlData.outputs) && signedUrlData.outputs.length > 0) {
      const firstOutput = signedUrlData.outputs[0];
      downloadUrl = firstOutput.url;
    }
    
    if (!downloadUrl) {
      return res.status(500).json({ error: 'SVF URL not found in download response', details: signedUrlData });
    }
    
    // Download the ZIP file
    const zipResponse = await fetch(downloadUrl, {
      method: 'GET',
    });
    
    if (!zipResponse.ok) {
      return res.status(zipResponse.status).json({ error: 'Failed to download ZIP file', details: await zipResponse.text() });
    }
    
    const zipBuffer = await zipResponse.arrayBuffer();
    
    // Extract ZIP file
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(Buffer.from(zipBuffer));
    const zipEntries = zip.getEntries();
    
    // Store extracted files in memory (or cache) and serve them directly from server
    // This avoids OSS bucket creation permission issues
    // Find bubble.json first
    let bubbleJsonPath = null;
    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        const entryName = entry.entryName;
        if (entryName.endsWith('bubble.json') || entryName.endsWith('/bubble.json')) {
          bubbleJsonPath = entryName;
          break;
        }
      }
    }
    
    if (!bubbleJsonPath) {
      // Try to find bubble.json with different path patterns
      for (const entry of zipEntries) {
        if (!entry.isDirectory && entry.entryName.toLowerCase().includes('bubble.json')) {
          bubbleJsonPath = entry.entryName;
          break;
        }
      }
    }
    
    if (!bubbleJsonPath) {
      return res.status(500).json({ error: 'bubble.json not found in extracted ZIP file' });
    }
    
    // Store all extracted files in cache keyed by outputId
    // Use the existing cache utility
    const { cache, setCached, CACHE_TTL } = await import('../utils/cache.js');
    const svfFilesCacheKey = `svf-${outputId}`;
    const svfFiles = {};
    
    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        svfFiles[entry.entryName] = entry.getData();
      }
    }
    
    // Cache the SVF files (they're already in memory as Buffers)
    setCached(cache.svfFiles, svfFilesCacheKey, svfFiles, CACHE_TTL.svfFiles);
    
    // Return URL pointing to server endpoint that serves the files
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:8080';
    // Use the path as-is (with forward slashes) - the server endpoint will handle it
    const serverUrl = `${protocol}://${host}/api/informed-design/outputs/${encodeURIComponent(outputId)}/svf-files/${bubbleJsonPath}`;
    
    res.json({
      url: serverUrl,
      outputId: outputId,
      status: status,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while getting SVF', details: error.message });
  }
});

// SVF files endpoint - serves extracted SVF files from cache
// This endpoint serves the files that were extracted from the ZIP and cached
router.get('/:outputId/svf-files/*', requireAuth, async (req, res) => {
  const outputId = req.params.outputId;
  const filePath = req.params[0] || '';
  
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  try {
    // Get cached SVF files for this output
    const { cache, getCached, CACHE_TTL } = await import('../utils/cache.js');
    const svfFilesCacheKey = `svf-${outputId}`;
    const svfFiles = getCached(cache.svfFiles, svfFilesCacheKey, CACHE_TTL.svfFiles);
    
    if (!svfFiles) {
      return res.status(404).json({ error: 'SVF files not found. Please request the SVF endpoint first.' });
    }
    
    // Find the requested file (handle both forward slash and encoded paths)
    let fileData = svfFiles[filePath];
    if (!fileData) {
      // Try with decoded path
      const decodedPath = decodeURIComponent(filePath);
      fileData = svfFiles[decodedPath];
    }
    
    if (!fileData) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }
    
    // Determine content type based on file extension
    let contentType = 'application/octet-stream';
    if (filePath.endsWith('.json')) {
      contentType = 'application/json';
    } else if (filePath.endsWith('.pf')) {
      contentType = 'application/octet-stream';
    } else if (filePath.endsWith('.svf')) {
      contentType = 'application/octet-stream';
    }
    
    // Set appropriate headers for SVF file with CORS
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Send the file
    res.send(fileData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while serving SVF file', details: error.message });
  }
});

export default router;

