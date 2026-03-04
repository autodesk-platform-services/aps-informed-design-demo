/**
 * OSS (Object Storage Service) routes
 * Handles SVF file serving and uploads
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { get2LOToken } from '../utils/authUtils.js';

const router = express.Router();

// Create a sub-router for upload endpoint that needs raw body parser
const uploadRouter = express.Router();
uploadRouter.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));

// Proxy endpoint to serve SVF files and sub-resources from OSS for the viewer
// This handles requests for the main SVF file and any sub-resources (like 0.pf, 1.pf, etc.)
router.get('/svf/:bucketKey/*', async (req, res) => {
  const bucketKey = req.params.bucketKey;
  // Get the rest of the path (could be objectKey or objectKey/sub-resource)
  const pathParts = req.params[0] ? req.params[0].split('/') : [];
  const objectKey = pathParts.join('/'); // Reconstruct the full path including sub-resources
  
  if (!objectKey) {
    return res.status(400).json({ error: 'Object key is required' });
  }
  
  try {
    // Use 2LO token for OSS signed URL requests (required by OSS API)
    let bucketToken;
    try {
      bucketToken = await get2LOToken();
    } catch (err) {
      return res.status(500).json({ 
        error: 'Failed to get 2LO token for OSS access', 
        details: err.message 
      });
    }
    
    // Fetch the file from OSS using signed URL (legacy endpoint is deprecated)
    // Step 1: Get signed URL for reading the object
    const encodedObjectKey = encodeURIComponent(objectKey);
    const signedUrlEndpoint = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodedObjectKey}/signed`;
    
    const signedUrlResponse = await fetch(signedUrlEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bucketToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
      body: JSON.stringify({
        minutesExpiration: 60,
        singleUse: false
      }),
    });
    
    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text();
      return res.status(signedUrlResponse.status).json({ 
        error: 'Failed to get signed URL from OSS', 
        details: errorText 
      });
    }
    
    const signedUrlData = await signedUrlResponse.json();
    const signedUrl = signedUrlData.signedUrl;
    
    if (!signedUrl) {
      return res.status(500).json({ error: 'No signed URL returned from OSS' });
    }
    
    // Step 2: Fetch the file using the signed URL
    const fileResponse = await fetch(signedUrl, {
      method: 'GET',
    });
    
    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      
      // If the file doesn't exist (404), it might be a sub-resource that doesn't exist
      // Return 404 so the viewer knows the resource is not available
      if (fileResponse.status === 404) {
        return res.status(404).json({ 
          error: 'File not found in OSS', 
          details: `Object ${objectKey} not found in bucket ${bucketKey}` 
        });
      }
      
      return res.status(fileResponse.status).json({ 
        error: 'Failed to fetch file from OSS', 
        details: errorText,
        status: fileResponse.status
      });
    }
    
    // Get the file content
    const fileBuffer = await fileResponse.arrayBuffer();
    
    // Determine content type based on file extension
    let contentType = 'application/octet-stream';
    if (objectKey.endsWith('.json')) {
      contentType = 'application/json';
    } else if (objectKey.endsWith('.pf')) {
      contentType = 'application/octet-stream';
    } else if (objectKey.endsWith('.svf')) {
      contentType = 'application/octet-stream';
    }
    
    // Set appropriate headers for SVF file with CORS
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${objectKey.split('/').pop()}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Send the file
    res.send(Buffer.from(fileBuffer));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while serving SVF file', details: error.message });
  }
});

// Handle OPTIONS requests for CORS preflight
router.options('/svf/:bucketKey/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.status(200).end();
});

// Viewer proxy endpoint - redirects viewer requests to OSS with proper encoding
// This handles the case where SVF files are in OSS and the viewer requests them with forward slashes
// that need to be URL encoded (%2F) for OSS bucket access
// Based on: https://aps.autodesk.com/blog/speed-viewable-generation-when-using-design-automation-inventor
// The article shows redirecting to OSS API endpoint, but we need signed URLs for browser access
router.get('/viewer-proxy/:bucketKey/*', async (req, res) => {
  const bucketKey = decodeURIComponent(req.params.bucketKey);
  // Get the path the viewer is requesting (may contain forward slashes)
  // The viewer will request files like "bubble.json" or "output/1/result.svf"
  const objectPath = req.params[0] || '';
  
  if (!objectPath) {
    return res.status(400).json({ error: 'Object path is required' });
  }
  
  try {
    // Use 2LO token for OSS signed URL requests (required by OSS API)
    let bucketToken;
    try {
      bucketToken = await get2LOToken();
    } catch (err) {
      return res.status(500).json({ 
        error: 'Failed to get 2LO token for OSS access', 
        details: err.message 
      });
    }
    
    // When accessing objects from bucket, the object path cannot contain '/' - it needs to be URL encoded to '%2F'
    // The viewer requests files with forward slashes (e.g., "output/1/result.svf")
    // but in OSS the object key has %2F instead (e.g., "output%2F1%2Fresult.svf")
    // encodeURIComponent() will encode the forward slashes to %2F
    const encodedObjectKey = encodeURIComponent(objectPath);
    
    // Get signed URL for reading the object (required for browser access)
    const signedUrlEndpoint = `https://developer.api.autodesk.com/oss/v2/buckets/${encodeURIComponent(bucketKey)}/objects/${encodedObjectKey}/signed`;
    
    const signedUrlResponse = await fetch(signedUrlEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bucketToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
      body: JSON.stringify({
        minutesExpiration: 60,
        singleUse: false
      }),
    });
    
    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text();
      return res.status(signedUrlResponse.status).json({ 
        error: 'Failed to get signed URL from OSS', 
        details: errorText 
      });
    }
    
    const signedUrlData = await signedUrlResponse.json();
    const signedUrl = signedUrlData.signedUrl;
    
    if (!signedUrl) {
      return res.status(500).json({ error: 'No signed URL returned from OSS' });
    }
    
    // Redirect to the signed URL (as per article pattern, but with signed URL for browser access)
    res.redirect(signedUrl);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while serving file', details: error.message });
  }
});

// OSS Upload and Translate endpoint for SVF files - NO LONGER USED (removed Model Derivative translation)
// This endpoint is kept for backward compatibility but is not used
// Note: Uses uploadRouter which has express.raw() middleware for binary data
uploadRouter.post('/upload-and-translate', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  
  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'No file data received' });
  }
  
  try {
    const fileName = `model-${Date.now()}.svf`;
    const bucketKey = `informed-design-svf-${Date.now()}`;
    const objectKey = fileName;
    
    // Step 1: Create OSS bucket (or use existing)
    const createBucketUrl = `https://developer.api.autodesk.com/oss/v2/buckets`;
    const bucketResponse = await fetch(createBucketUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
      body: JSON.stringify({
        bucketKey: bucketKey,
        policyKey: 'temporary'
      }),
    });
    
    // Ignore 409 (bucket already exists) errors
    if (!bucketResponse.ok && bucketResponse.status !== 409) {
      const errorText = await bucketResponse.text();
      return res.status(bucketResponse.status).json({ error: 'Failed to create bucket', details: errorText });
    }
    
    // Step 2: Upload file to OSS
    const uploadUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'x-ads-region': 'US',
      },
      body: req.body,
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return res.status(uploadResponse.status).json({ error: 'Failed to upload file', details: errorText });
    }
    
    // Step 3: Translate the file using Model Derivative API
    const translateUrl = 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job';
    const base64Urn = Buffer.from(`urn:adsk.objects:os.object:${bucketKey}/${objectKey}`).toString('base64').replace(/=/g, '');
    
    const translateResponse = await fetch(translateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
      body: JSON.stringify({
        input: {
          urn: base64Urn
        },
        output: {
          formats: [{
            type: 'svf',
            views: ['2d', '3d']
          }]
        }
      }),
    });
    
    if (!translateResponse.ok) {
      const errorText = await translateResponse.text();
      return res.status(translateResponse.status).json({ error: 'Failed to start translation', details: errorText });
    }
    
    // Step 4: Poll for translation status
    const manifestUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${base64Urn}/manifest`;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const manifestResponse = await fetch(manifestUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-ads-region': 'US',
        },
      });
      
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        if (manifest.status === 'success') {
          // Translation complete, return the URN
          return res.json({ urn: base64Urn });
        } else if (manifest.status === 'failed') {
          return res.status(500).json({ error: 'Translation failed', details: manifest });
        }
      }
      
      attempts++;
    }
    
    return res.status(500).json({ error: 'Translation timeout' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Mount upload router before main router (so it handles /upload-and-translate with raw body parser)
router.use(uploadRouter);

export default router;

