/**
 * Cache utilities for API responses and file downloads.
 * Provides persistent disk-backed caching with configurable TTLs.
 * 
 * @module cache
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const THUMBNAILS_CACHE_DIR = path.join(CACHE_DIR, 'thumbnails');
const GLBS_CACHE_DIR = path.join(CACHE_DIR, 'glbs');
const ACC_THUMBNAILS_CACHE_DIR = path.join(CACHE_DIR, 'acc-thumbnails');
const API_CACHE_DIR = path.join(CACHE_DIR, 'api');
const SIGNED_URLS_CACHE_DIR = path.join(CACHE_DIR, 'signed-urls');

[THUMBNAILS_CACHE_DIR, GLBS_CACHE_DIR, ACC_THUMBNAILS_CACHE_DIR, API_CACHE_DIR, SIGNED_URLS_CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * In-memory cache maps for different data types.
 * @type {Object<string, Map>}
 */
export const cache = {
  api: new Map(),
  thumbnails: new Map(),
  downloadUrls: new Map(),
  outputFiles: new Map(),
  signedUrls: new Map(),
  svfFiles: new Map(),
};

/**
 * Cache expiration times in milliseconds.
 * @type {Object<string, number>}
 */
export const CACHE_TTL = {
  api: 5 * 60 * 1000,
  variantParameters: 7 * 24 * 60 * 60 * 1000,
  variantGlb: 7 * 24 * 60 * 60 * 1000,
  thumbnails: 7 * 24 * 60 * 60 * 1000,
  downloadUrls: 10 * 60 * 1000,
  outputFiles: 7 * 24 * 60 * 60 * 1000,
  signedUrls: 30 * 60 * 1000,
  svfFiles: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Generates a cache key from type and parts.
 * @param {string} type - Cache type identifier
 * @param {...string} parts - Additional parts to include in the key
 * @returns {string} Cache key in format "type:part1:part2:..."
 */
export function getCacheKey(type, ...parts) {
  return `${type}:${parts.join(':')}`;
}

/**
 * Converts a cache key to a safe filename using SHA-256 hash.
 * @param {string} key - Cache key
 * @returns {string} Hashed filename
 * @private
 */
function getCacheFileName(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Gets the file system path for a cached item.
 * @param {string} key - Cache key
 * @param {string} cacheType - Type of cache (determines directory and extension)
 * @returns {string} Full file path
 * @private
 */
function getCacheFilePath(key, cacheType) {
  const fileName = getCacheFileName(key);
  let cacheDir;
  let ext = '';
  
  if (cacheType === 'thumbnails' || cacheType === 'product-thumbnails') {
    cacheDir = THUMBNAILS_CACHE_DIR;
  } else if (cacheType === 'acc-thumbnails') {
    cacheDir = ACC_THUMBNAILS_CACHE_DIR;
  } else if (cacheType === 'glbs') {
    cacheDir = GLBS_CACHE_DIR;
    ext = '.glb';
  } else if (cacheType === 'outputFiles') {
    const isGlb = key.toLowerCase().includes('glb') || key.toLowerCase().includes('outputtype:glb');
    cacheDir = GLBS_CACHE_DIR;
    ext = isGlb ? '.glb' : '';
  } else if (cacheType === 'api') {
    cacheDir = API_CACHE_DIR;
    ext = '.json';
  } else if (cacheType === 'signedUrls') {
    cacheDir = SIGNED_URLS_CACHE_DIR;
    ext = '.json';
  } else {
    cacheDir = THUMBNAILS_CACHE_DIR;
  }

  return path.join(cacheDir, `${fileName}${ext}`);
}

/**
 * Retrieves cached data from memory or disk.
 * Checks memory first, then falls back to disk cache.
 * Automatically removes expired entries.
 * 
 * @param {Map} cacheMap - The cache map to check
 * @param {string} key - Cache key
 * @param {number} ttl - Time to live in milliseconds
 * @param {string} [cacheType='thumbnails'] - Type of cache (determines storage format)
 * @returns {*} Cached data or null if not found/expired
 */
export function getCached(cacheMap, key, ttl, cacheType = 'thumbnails') {
  const entry = cacheMap.get(key);
  if (entry) {
    const age = Date.now() - entry.timestamp;
    if (age <= ttl) {
      return entry.data;
    }
    cacheMap.delete(key);
  }
  
  try {
    const cacheFilePath = getCacheFilePath(key, cacheType);

    if (cacheType === 'api' || cacheType === 'signedUrls') {
      if (fs.existsSync(cacheFilePath)) {
        const stored = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        const age = Date.now() - stored.timestamp;
        if (age <= ttl && stored.data !== undefined) {
          cacheMap.set(key, { data: stored.data, timestamp: stored.timestamp, ttl });
          return stored.data;
        }
        try {
          fs.unlinkSync(cacheFilePath);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }
      }
      return null;
    }

    const metadataPath = `${cacheFilePath}.meta`;
    if (fs.existsSync(cacheFilePath) && fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const age = Date.now() - metadata.timestamp;

      if (age <= ttl) {
        const buffer = fs.readFileSync(cacheFilePath);
        const data = {
          buffer: buffer,
          contentType: metadata.contentType,
          contentDisposition: metadata.contentDisposition,
        };
        cacheMap.set(key, { data, timestamp: metadata.timestamp, ttl });
        return data;
      }
      try {
        fs.unlinkSync(cacheFilePath);
        fs.unlinkSync(metadataPath);
      } catch (unlinkError) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    // Disk read failed, return null to trigger regeneration
  }

  return null;
}

/**
 * Stores data in both memory and disk cache.
 * Binary data (buffers) are stored as files with metadata.
 * JSON data (API responses, signed URLs) are stored as JSON files.
 * 
 * @param {Map} cacheMap - The cache map to store in
 * @param {string} key - Cache key
 * @param {*} data - Data to cache (object with buffer property for binary, or any JSON-serializable value)
 * @param {number} ttl - Time to live in milliseconds
 * @param {string} [cacheType='thumbnails'] - Type of cache (determines storage format)
 */
export function setCached(cacheMap, key, data, ttl, cacheType = 'thumbnails') {
  const timestamp = Date.now();
  cacheMap.set(key, { data, timestamp, ttl });

  const isBinary = data && data.buffer && Buffer.isBuffer(data.buffer);
  if (isBinary) {
    try {
      const cacheFilePath = getCacheFilePath(key, cacheType);
      const metadataPath = `${cacheFilePath}.meta`;
      fs.writeFileSync(cacheFilePath, data.buffer);
      fs.writeFileSync(metadataPath, JSON.stringify({
        timestamp,
        contentType: data.contentType || 'application/octet-stream',
        contentDisposition: data.contentDisposition || null,
        ttl: ttl,
      }));
    } catch (error) {
      // Disk write failed, but memory cache is still active
    }
    return;
  }

  const jsonType = (cacheType === 'api' || cacheType === 'signedUrls')
    ? cacheType
    : (cacheMap === cache.api ? 'api' : cacheMap === cache.signedUrls ? 'signedUrls' : null);
  if (jsonType && data !== undefined && data !== null) {
    try {
      const cacheFilePath = getCacheFilePath(key, jsonType);
      fs.writeFileSync(cacheFilePath, JSON.stringify({ timestamp, ttl, data }), 'utf8');
    } catch (error) {
      // Disk write failed, but memory cache is still active
    }
  }
}

/**
 * Removes a cached entry from both memory and disk.
 * Use this when cached data becomes invalid (e.g., after deletion).
 * 
 * @param {Map} cacheMap - The cache map to remove from
 * @param {string} key - Cache key to invalidate
 * @param {string} [cacheType='api'] - Type of cache (must be 'api' or 'signedUrls' for disk deletion)
 */
export function invalidateCached(cacheMap, key, cacheType = 'api') {
  cacheMap.delete(key);
  if (cacheType !== 'api' && cacheType !== 'signedUrls') {
    return;
  }
  try {
    const cacheFilePath = getCacheFilePath(key, cacheType);
    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }
  } catch (error) {
    // Ignore disk deletion errors
  }
}
