/**
 * ACC (Autodesk Construction Cloud) routes
 * Handles Accounts (Hubs), Projects, and Folders
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCacheKey, getCached, setCached, cache, CACHE_TTL } from '../utils/cache.js';

const router = express.Router();

// ACC Accounts endpoint - fetches hubs (ACC accounts) for the authenticated user
router.get('/accounts', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  
  try {
    // Fetch hubs (ACC accounts) from APS Data Management API
    const hubsUrl = 'https://developer.api.autodesk.com/project/v1/hubs';
    
    const response = await fetch(hubsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch ACC accounts';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(response.status).json({ error: errorMessage });
    }
    
    const data = await response.json();
    
    // Return all hubs without filtering
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching ACC accounts', details: error.message });
  }
});

// ACC Projects endpoint - fetches projects for a specific hub (account)
router.get('/accounts/:hubId/projects', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const hubId = req.params.hubId;
  
  // Validate hubId
  if (!hubId || typeof hubId !== 'string') {
    return res.status(400).json({ error: 'Invalid hub ID' });
  }
  
  try {
    // Fetch projects for the hub from APS Data Management API
    const projectsUrl = `https://developer.api.autodesk.com/project/v1/hubs/${encodeURIComponent(hubId)}/projects`;
    
    const response = await fetch(projectsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch ACC projects';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(response.status).json({ error: errorMessage });
    }
    
    const data = await response.json();
    
    // Return the projects data
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching ACC projects', details: error.message });
  }
});

// ACC Folders endpoint - fetches folders for a specific project
router.get('/projects/:projectId/folders', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const projectId = req.params.projectId;
  
  // Validate projectId
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  
  try {
    // Get hubId from query parameter (frontend should pass it)
    const hubId = req.query.hubId;
    
    if (!hubId) {
      return res.status(400).json({ error: 'Hub ID is required. Please provide hubId as query parameter.' });
    }
    
    // Fetch projects for the hub to get the project with relationships
    const projectsUrl = `https://developer.api.autodesk.com/project/v1/hubs/${encodeURIComponent(hubId)}/projects`;
    
    const projectsResponse = await fetch(projectsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      let errorMessage = 'Failed to fetch projects';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(projectsResponse.status).json({ error: errorMessage });
    }
    
    const projectsData = await projectsResponse.json();
    const projects = projectsData.data || [];
    
    // Find the project that matches the projectId
    const project = projects.find(p => p.id === projectId || p.attributes?.extension?.data?.projectId === projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get the root folder ID from project relationships
    const rootFolderRel = project.relationships?.rootFolder?.data;
    if (!rootFolderRel || !rootFolderRel.id) {
      return res.status(404).json({ error: 'Root folder not found for project' });
    }
    
    const rootFolderId = rootFolderRel.id;
    
    // Fetch folders recursively starting from root folder
    async function fetchFoldersRecursive(folderId, parentPath = '') {
      const folderUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}`;
      
      const folderResponse = await fetch(folderUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (!folderResponse.ok) {
        return null;
      }
      
      const folderData = await folderResponse.json();
      const folder = folderData.data;
      
      // Get folder contents (subfolders and items)
      const contentsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/contents`;
      
      const contentsResponse = await fetch(contentsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      let children = [];
      if (contentsResponse.ok) {
        const contentsData = await contentsResponse.json();
        const contents = contentsData.data || [];
        
        // Filter for folders only and recursively fetch them
        const subfolders = contents.filter(item => item.type === 'folders');
        
        children = await Promise.all(
          subfolders.map(async (subfolder) => {
            const childFolder = await fetchFoldersRecursive(subfolder.id, `${parentPath}/${folder.attributes.name}`);
            return childFolder;
          })
        );
        
        // Filter out null results
        children = children.filter(child => child !== null);
      }
      
      return {
        id: folder.id,
        name: folder.attributes.name,
        path: parentPath ? `${parentPath}/${folder.attributes.name}` : folder.attributes.name,
        children: children,
      };
    }
    
    // Fetch the root folder and its children recursively
    const folderTree = await fetchFoldersRecursive(rootFolderId);
    
    if (!folderTree) {
      return res.status(404).json({ error: 'Failed to fetch folder structure' });
    }
    
    // Return as array with root folder
    res.json({
      data: [folderTree]
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching folders', details: error.message });
  }
});

// ACC Files endpoint - fetches files and folders recursively for a specific project
router.get('/projects/:projectId/files', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const projectId = req.params.projectId;
  
  // Validate projectId
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  
  try {
    // Get hubId from query parameter (frontend should pass it)
    const hubId = req.query.hubId;
    
    if (!hubId) {
      return res.status(400).json({ error: 'Hub ID is required. Please provide hubId as query parameter.' });
    }
    
    // Get fileType from query parameter (defaults to 'rvt' for backward compatibility)
    const fileType = req.query.fileType || 'rvt';
    
    // Fetch projects for the hub to get the project with relationships
    const projectsUrl = `https://developer.api.autodesk.com/project/v1/hubs/${encodeURIComponent(hubId)}/projects`;
    
    const projectsResponse = await fetch(projectsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      let errorMessage = 'Failed to fetch projects';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(projectsResponse.status).json({ error: errorMessage });
    }
    
    const projectsData = await projectsResponse.json();
    const projects = projectsData.data || [];
    
    // Find the project that matches the projectId
    const project = projects.find(p => p.id === projectId || p.attributes?.extension?.data?.projectId === projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get the root folder ID from project relationships
    const rootFolderRel = project.relationships?.rootFolder?.data;
    if (!rootFolderRel || !rootFolderRel.id) {
      return res.status(404).json({ error: 'Root folder not found for project' });
    }
    
    const rootFolderId = rootFolderRel.id;
    
    // Helper function to check if a file matches the desired file type
    function matchesFileType(file, fileName) {
      if (!fileName) return false;
      const lowerName = fileName.toLowerCase();
      
      if (fileType === 'dx') {
        // For data exchanges: be more lenient - include any file in a "Data Exchanges" folder
        // or files with .json, .dx extensions, or fileType === 'data-exchange'
        const extensionType = file.attributes?.extension?.type || '';
        return lowerName.endsWith('.json') ||
               lowerName.endsWith('.dx') ||
               file.attributes?.fileType === 'data-exchange' ||
               extensionType === 'json' ||
               extensionType === 'data-exchange' ||
               extensionType.includes('FDX') ||
               extensionType.includes('autodesk.bim360:FDX') ||
               (file.type || '').includes('FDX');
      } else {
        // Default: .rvt files
        return lowerName.endsWith('.rvt');
      }
    }
    
    // Helper function to check if a folder name suggests it's a data exchange folder
    function isDataExchangeFolder(folderName) {
      if (fileType !== 'dx') return false;
      if (!folderName) return false;
      const lowerName = folderName.toLowerCase();
      return lowerName.includes('data exchange') || 
             lowerName === 'data exchanges' ||
             lowerName === 'dataexchange' ||
             lowerName === 'dataexchanges';
    }
    
    // Helper function to check if a folder or its children contain matching files
    function hasMatchingFiles(item) {
      if (item.type === 'file') {
        return matchesFileType(item, item.name);
      }
      if (item.type === 'folder') {
        // For data exchanges, always include folders with "Data Exchange" in the name
        if (isDataExchangeFolder(item.name)) {
          return true;
        }
        // Check if any children contain matching files
        if (item.children) {
          return item.children.some(child => hasMatchingFiles(child));
        }
      }
      return false;
    }
    
    // Fetch files and folders recursively starting from root folder
    async function fetchFilesRecursive(folderId, parentPath = '', isRoot = false, parentFolderName = '') {
      const folderUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}`;
      
      const folderResponse = await fetch(folderUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (!folderResponse.ok) {
        return null;
      }
      
      const folderData = await folderResponse.json();
      const folder = folderData.data;
      
      // Get folder name - prefer displayName, then name, then id
      const folderName = folder.attributes?.displayName || folder.attributes?.name || folder.id;
      
      // Check if this is a "Data Exchanges" folder (for data exchange file type)
      const isDataExchangeParentFolder = fileType === 'dx' && isDataExchangeFolder(folderName);
      
      // Get folder contents (subfolders and items/files)
      const contentsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/contents`;
      
      const contentsResponse = await fetch(contentsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      let children = [];
      if (contentsResponse.ok) {
        const contentsData = await contentsResponse.json();
        const contents = contentsData.data || [];
        
        // Separate folders and files
        const subfolders = contents.filter(item => item.type === 'folders');
        const files = contents.filter(item => item.type === 'items');
        
        // Recursively fetch subfolders
        const folderChildren = await Promise.all(
          subfolders.map(async (subfolder) => {
            const childFolder = await fetchFilesRecursive(subfolder.id, parentPath ? `${parentPath}/${folderName}` : folderName, false, folderName);
            return childFolder;
          })
        );
        
        // Filter out null results
        // For data exchanges, also include folders with "Data Exchange" in the name
        const validFolderChildren = folderChildren.filter(child => {
          if (child === null) return false;
          // Always include if it has matching files
          if (hasMatchingFiles(child)) return true;
          // For data exchanges, always include folders with "Data Exchange" in the name
          if (fileType === 'dx' && isDataExchangeFolder(child.name)) return true;
          // For data exchanges, be more lenient - include folders that might contain data exchange files
          // (this helps preserve folder structure even if files haven't been found yet)
          if (fileType === 'dx' && child.children && child.children.length > 0) return true;
          return false;
        });
        
        
        // Add only matching files as children
        // For data exchanges, if we're in a "Data Exchanges" folder, include ALL files
        const fileChildren = files
          .filter(file => {
            const fileName = file.attributes?.displayName || file.attributes?.name || file.id;
            // If we're in a "Data Exchanges" folder, include all files
            if (fileType === 'dx' && isDataExchangeFolder(folderName)) {
              return true; // Include all files in Data Exchanges folder
            }
            return matchesFileType(file, fileName);
          })
          .map(file => {
            const fileName = file.attributes?.displayName || file.attributes?.name || file.id;
            // Store both the item ID and storage URN if available
            const storageId = file.relationships?.storage?.data?.id;
            const derivativeId = file.relationships?.derivatives?.data?.id;
            
            // Determine extension based on file type
            let extension = null;
            if (fileType === 'dx') {
              const lowerFileName = fileName.toLowerCase();
              if (lowerFileName.endsWith('.json')) {
                extension = '.json';
              } else if (lowerFileName.endsWith('.dx')) {
                extension = '.dx';
              } else if (file.attributes?.extension?.type === 'json') {
                extension = '.json';
              } else if (file.attributes?.extension?.type === 'data-exchange') {
                extension = '.dx';
              } else {
                // For files in Data Exchanges folder without clear extension, try to infer
                extension = file.attributes?.extension?.type || null;
              }
            } else {
              extension = fileName.toLowerCase().endsWith('.rvt') ? '.rvt' : null;
            }
            
            return {
              id: file.id, // This is the item ID
              storageId: storageId, // Storage URN if available
              derivativeId: derivativeId, // Derivative URN if available (for Model Derivative API)
              name: fileName,
              path: parentPath ? `${parentPath}/${folderName}/${fileName}` : `${folderName}/${fileName}`,
              type: 'file',
              extension: extension,
              attributes: {
                ...file.attributes,
                fileType: file.attributes?.fileType
              },
              children: [],
            };
          });
        
        children = [...validFolderChildren, ...fileChildren];
      }
      
      // Only return folder if it has .RVT files (either directly or in children)
      const folderItem = {
        id: folder.id,
        name: folderName,
        path: parentPath ? `${parentPath}/${folderName}` : folderName,
        type: 'folder',
        children: children,
      };
      
      // Always return root folder if it has children, otherwise only return if it contains matching files
      if (isRoot) {
        return folderItem; // Always return root folder, even if empty (frontend will handle empty case)
      }
      
      // For non-root folders, return if:
      // 1. They contain matching files, OR
      // 2. They are data exchange folders (for fileType=dx), OR
      // 3. For data exchanges, include folders with children (to preserve folder structure)
      if (hasMatchingFiles(folderItem) || isDataExchangeFolder(folderName) || (fileType === 'dx' && folderItem.children && folderItem.children.length > 0)) {
        return folderItem;
      }
      
      return null;
    }
    
    // Fetch the root folder and its children recursively
    const fileTree = await fetchFilesRecursive(rootFolderId, '', true);
    
    if (!fileTree) {
      return res.status(404).json({ error: 'Failed to fetch file structure' });
    }
    
    
    // If root folder has no children after filtering, return empty
    if (!fileTree.children || fileTree.children.length === 0) {
      return res.json({
        data: []
      });
    }
    
    // Return as array with root folder
    res.json({
      data: [fileTree]
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching files', details: error.message });
  }
});

// ACC RVT File Properties endpoint - fetches properties for a specific RVT file
router.get('/projects/:projectId/files/:fileId/properties', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const projectId = req.params.projectId;
  const fileId = req.params.fileId;
  
  // Validate inputs
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'Invalid file ID' });
  }
  
    try {
      // Get file details from Data Management API
      // Include versions in the response to get version data
      // Try with include=tip first, then try without if needed
      const fileUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(fileId)}?include=tip`;
      
      const fileResponse = await fetch(fileUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
    
    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      let errorMessage = 'Failed to fetch file properties';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(fileResponse.status).json({ error: errorMessage });
    }
    
    const fileData = await fileResponse.json();
    const file = fileData.data;
    const included = fileData.included || [];
    
    // Get version information if available
    let versionNumber = null;
    let description = file.attributes?.description || null;
    
    // Try multiple approaches to get version:
    // 1. Check tip relationship for version ID
    const versionId = file.relationships?.tip?.data?.id;
    
    // 2. Check refs relationship for version
    const refs = file.relationships?.refs?.data || [];
    const versionRef = refs.find(ref => ref.type === 'versions');
    const versionIdFromRefs = versionRef?.id;
    
    // 3. Check if version is in the relationships.versions
    const versionsRel = file.relationships?.versions?.data;
    const versionIdFromVersions = Array.isArray(versionsRel) ? versionsRel[0]?.id : (versionsRel?.id || null);
    
    // Use versionId from tip, refs, or versions relationship
    const finalVersionId = versionId || versionIdFromRefs || versionIdFromVersions;
    
    if (finalVersionId) {
      // Look for version in included array first (more efficient)
      const includedVersion = included.find(item => item.type === 'versions' && (item.id === finalVersionId || item.id === versionId || item.id === versionIdFromRefs || item.id === versionIdFromVersions));
      if (includedVersion) {
        // Try multiple sources for version number in order of preference:
        // 1. extension.data.revisionDisplayLabel (e.g., "V1", "V2")
        // 2. extension.data.revisionNumber
        // 3. attributes.versionNumber (format as "V1", "V2", etc.)
        // 4. attributes.displayName
        versionNumber = includedVersion.extension?.data?.revisionDisplayLabel || 
                       includedVersion.extension?.data?.revisionNumber ||
                       (includedVersion.attributes?.versionNumber !== undefined ? `V${includedVersion.attributes.versionNumber}` : null) ||
                       includedVersion.attributes?.displayName || 
                       null;
      }
      
      // If not found in included, fetch it separately
      if (!versionNumber) {
        try {
          const versionUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(finalVersionId)}`;
          const versionResponse = await fetch(versionUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'x-ads-region': 'US',
            },
          });
          
          if (versionResponse.ok) {
            const versionData = await versionResponse.json();
            const version = versionData.data;
            
            // Try multiple sources for version number in order of preference:
            // 1. revisionDisplayLabel (most user-friendly, from extension.data)
            // 2. revisionNumber (from extension.data)
            // 3. versionNumber (numeric version from attributes, format as "V1", "V2", etc.)
            // 4. displayName (fallback)
            versionNumber = version?.extension?.data?.revisionDisplayLabel || 
                           version?.extension?.data?.revisionNumber ||
                           (version?.attributes?.versionNumber !== undefined ? `V${version.attributes.versionNumber}` : null) ||
                           version?.attributes?.displayName || 
                           null;
          }
        } catch (versionError) {
          // If version fetch fails, continue without version number
        }
      }
    }
    
    // Also check if version info is directly on the file item (some ACC responses include it)
    if (!versionNumber && file.attributes?.versionNumber !== undefined) {
      versionNumber = `V${file.attributes.versionNumber}`;
    }
    if (!versionNumber && file.extension?.data?.revisionDisplayLabel) {
      versionNumber = file.extension.data.revisionDisplayLabel;
    }
    if (!versionNumber && file.extension?.data?.revisionNumber) {
      versionNumber = `V${file.extension.data.revisionNumber}`;
    }
    
    // If still no version, try fetching all versions for this item
    if (!versionNumber) {
      try {
        const versionsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(fileId)}/versions`;
        const versionsResponse = await fetch(versionsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        
        if (versionsResponse.ok) {
          const versionsData = await versionsResponse.json();
          const versions = versionsData.data || [];
          
          // Get the tip version (latest) or first version
          const tipVersion = versions.find(v => v.id === finalVersionId) || versions[0];
          
          if (tipVersion) {
            versionNumber = tipVersion.extension?.data?.revisionDisplayLabel || 
                           tipVersion.extension?.data?.revisionNumber ||
                           (tipVersion.attributes?.versionNumber !== undefined ? `V${tipVersion.attributes.versionNumber}` : null) ||
                           tipVersion.attributes?.displayName || 
                           null;
          } else if (versions.length > 0) {
            // Try all versions if tip version not found
            for (const v of versions) {
              const vNum = v.extension?.data?.revisionDisplayLabel || 
                          v.extension?.data?.revisionNumber ||
                          (v.attributes?.versionNumber !== undefined ? `V${v.attributes.versionNumber}` : null) ||
                          v.attributes?.displayName || 
                          null;
              if (vNum) {
                versionNumber = vNum;
                break;
              }
            }
          }
        }
      } catch (versionsError) {
        // Error fetching versions list
      }
    }
    
    // Extract properties from file attributes
    const properties = {
      name: file.attributes?.displayName || file.attributes?.name || fileId,
      id: file.id,
      type: file.type,
      createTime: file.attributes?.createTime,
      createUserName: file.attributes?.createUserName,
      lastModifiedTime: file.attributes?.lastModifiedTime,
      lastModifiedUserName: file.attributes?.lastModifiedUserName,
      fileType: file.attributes?.fileType,
      extension: file.attributes?.extension,
      storageSize: file.attributes?.storageSize,
      versionNumber: versionNumber || null, // Explicitly set to null if not found
      description: description || null, // Explicitly set to null if not found
    };
    
    res.json({ data: properties });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching file properties', details: error.message });
  }
});

// ACC RVT File Thumbnail endpoint - gets thumbnail preview for RVT file
router.get('/projects/:projectId/files/:fileId/thumbnail', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const projectId = req.params.projectId;
  const fileId = req.params.fileId;
  
  // Validate inputs
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'Invalid file ID' });
  }
  
  try {
    // Decode URL-encoded fileId (Express should do this, but be safe)
    const decodedFileId = decodeURIComponent(fileId);
    
    // Check disk cache first for ACC thumbnails
    const hubId = req.query.hubId;
    const thumbnailCacheKey = getCacheKey('acc-thumbnails', projectId, decodedFileId, hubId || '');
    const cachedThumbnail = getCached(cache.thumbnails, thumbnailCacheKey, CACHE_TTL.thumbnails, 'acc-thumbnails');
    
    if (cachedThumbnail) {
      res.setHeader('Content-Type', cachedThumbnail.contentType || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cachedThumbnail.buffer);
    }
    
    // For ACC files, Model Derivative API doesn't support ACC storage URNs directly
    // We need to download the file from ACC and upload it to OSS first, OR
    // Use the file item's storage relationship to get a download URL and use that
    // For now, let's try to get the file item and see if we can get a download URL
    
    // Step 1: Get file details
    let file = null;
    // If fileId is a storage URN, we need to search for the item that has that storage URN
    // Otherwise, fetch it directly as an item ID
    if (decodedFileId.startsWith('urn:adsk.wipprod')) {
      // fileId is a storage URN, we need to search for the item
      // Search for items in the project that have this storage URN
      // Note: ACC API doesn't have a direct search by storage URN, so we'll try to use it as item ID first
      // If that fails, we'll need to search through folder contents
    }
    
    const fileUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(decodedFileId)}`;
    
    const fileResponse = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    
    
    if (!fileResponse.ok) {
      // If fileId is a storage URN and we can't fetch it as an item, try to find the item by searching
      if (decodedFileId.startsWith('urn:adsk.wipprod')) {
        // The fileId is a storage URN, we need to find the item that has this storage URN
        // Search through the project's root folder to find the item
        
        // Get hubId from query parameter or try to get it from project
        let hubId = req.query.hubId;
        
        if (!hubId) {
          try {
            // Try to get hubId from project - search all hubs (this is not ideal but works as fallback)
            // For better performance, frontend should pass hubId as query parameter
            const hubsUrl = 'https://developer.api.autodesk.com/project/v1/hubs';
            const hubsResponse = await fetch(hubsUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'x-ads-region': 'US',
              },
            });
            
            if (hubsResponse.ok) {
              const hubsData = await hubsResponse.json();
              // Search through hubs to find the project
              for (const hub of hubsData.data || []) {
                try {
                  const projectsUrl = `https://developer.api.autodesk.com/project/v1/hubs/${encodeURIComponent(hub.id)}/projects`;
                  const projectsResponse = await fetch(projectsUrl, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                      'x-ads-region': 'US',
                    },
                  });
                  
                  if (projectsResponse.ok) {
                    const projectsData = await projectsResponse.json();
                    const project = projectsData.data?.find(p => p.id === projectId || p.attributes?.extension?.data?.projectId === projectId);
                    if (project) {
                      hubId = hub.id;
                      break;
                    }
                  }
                } catch (hubError) {
                  // Continue to next hub
                }
              }
            } else {
            }
          } catch (hubsError) {
          }
        }
        
        if (!hubId) {
          return res.status(400).json({ 
            error: 'File ID is a storage URN. Please provide hubId as query parameter to search for the item.',
          });
        }
        
        // Get the root folder ID from project
        const projectsUrl = `https://developer.api.autodesk.com/project/v1/hubs/${encodeURIComponent(hubId)}/projects`;
        const projectsResponse = await fetch(projectsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        
        if (!projectsResponse.ok) {
          return res.status(400).json({ 
            error: 'Failed to fetch projects to search for item',
          });
        }
        
        const projectsData = await projectsResponse.json();
        const project = projectsData.data?.find(p => p.id === projectId || p.attributes?.extension?.data?.projectId === projectId);
        
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
        
        const rootFolderId = project.relationships?.rootFolder?.data?.id;
        if (!rootFolderId) {
          return res.status(404).json({ error: 'Root folder not found' });
        }
        
        // Recursively search for the item with this storage URN
        const searchForItem = async (folderId, depth = 0) => {
          // Limit recursion depth to prevent infinite loops
          if (depth > 10) {
            return null;
          }
          
          try {
            const contentsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/contents`;
            const contentsResponse = await fetch(contentsUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'x-ads-region': 'US',
              },
            });
            
            if (!contentsResponse.ok) {
              return null;
            }
            
            const contentsData = await contentsResponse.json();
            const contents = contentsData.data || [];
            
            if (depth === 0) {
              // Log first few items to see their structure
              if (contents.length > 0) {
                const sampleItem = contents.find(i => i.type === 'items');
                if (sampleItem) {
                  
                }
              }
            }
            
            // Check items
            for (const item of contents) {
              if (item.type === 'items') {
                try {
                  // First, check if item.id matches the storage URN (in case item.id IS the storage URN)
                  // In ACC API, sometimes item.id in folder contents IS the storage URN
                  if (item.id === decodedFileId) {
                    // item.id is the storage URN, but we can't use it directly as an item ID
                    // We need to find the actual item that has this storage URN
                    // The item.id in folder contents might actually be the storage URN, not the item ID
                    // So we need to search for the item differently
                    // For now, let's check if we can get item details using the storage URN
                    // Actually, we can't - we need to find the item by its storage relationship
                    // Continue to check storage relationship below
                  }
                  
                  // Check storage relationship from folder contents (if available)
                  const storageId = item.relationships?.storage?.data?.id;
                  if (storageId === decodedFileId) {
                    
                    // Found matching storage URN, now get the item details
                    // item.id should be the actual item ID we can use
                    const itemUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(item.id)}`;
                    const itemResponse = await fetch(itemUrl, {
                      method: 'GET',
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'x-ads-region': 'US',
                      },
                    });
                    
                    if (itemResponse.ok) {
                      const itemData = await itemResponse.json();
                      return itemData.data; // Found it!
                    }
                  } else if (item.id === decodedFileId) {
                    // item.id matches storage URN - this means item.id IS the storage URN
                    // We need to check the storage relationship to confirm, then use item.id as item ID
                  }
                  
                  // If item.id is not the storage URN and storage relationship doesn't match,
                  // check by fetching item details
                  if (!storageId) {
                    const itemUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(item.id)}`;
                    const itemResponse = await fetch(itemUrl, {
                      method: 'GET',
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'x-ads-region': 'US',
                      },
                    });
                    
                    if (itemResponse.ok) {
                      const itemData = await itemResponse.json();
                      const fetchedStorageId = itemData.data?.relationships?.storage?.data?.id;
                      if (fetchedStorageId === decodedFileId) {
                        return itemData.data; // Found it!
                      }
                    }
                  }
                } catch (itemError) {
                  // Continue to next item
                }
              } else if (item.type === 'folders') {
                try {
                  // Recursively search subfolders
                  const found = await searchForItem(item.id, depth + 1);
                  if (found) {
                    return found;
                  }
                } catch (folderError) {
                  // Continue to next item
                }
              }
            }
            
            return null;
          } catch (error) {
            return null;
          }
        };
        
        try {
          const foundFile = await searchForItem(rootFolderId);
          if (foundFile) {
            // Use the found file
            file = foundFile;
          } else {
            
            return res.status(404).json({ 
              error: 'Item with this storage URN not found in project',
              details: 'The file may have been moved or deleted, or the storage URN is incorrect. The file tree should store item IDs, not storage URNs.',
              suggestion: 'The file tree is likely storing storage URNs (file.id) instead of item IDs. Check the file tree building code to ensure it stores the correct item ID from the ACC API response.'
            });
          }
        } catch (searchError) {
          return res.status(500).json({ 
            error: 'Error searching for item',
            details: searchError.message
          });
        }
      } else {
      
        const errorText = await fileResponse.text();
        let errorMessage = 'Failed to fetch file details';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(fileResponse.status).json({ error: errorMessage });
      }
    } else {
      // Successfully fetched file
      const fileData = await fileResponse.json();
      file = fileData.data;
      
    }
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // For ACC files, check if there's a derivatives relationship first
    // This contains the derivative URN that can be used with Model Derivative API
    const derivativesRel = file.relationships?.derivatives?.data;
    let urn = null;
    
    
    
    if (derivativesRel && derivativesRel.id) {
      // Use the derivative URN directly (it's already in the correct format for Model Derivative API)
      urn = derivativesRel.id;
    } else {
      // No derivative relationship found, try to get it from the file refs or version
      // First, check file refs relationship
      const fileRefsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(file.id)}/relationships/refs`;
      const fileRefsResponse = await fetch(fileRefsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (fileRefsResponse.ok) {
        const fileRefsData = await fileRefsResponse.json();
        const derivatives = fileRefsData.data?.find(ref => ref.type === 'derivatives');
        if (derivatives && derivatives.id) {
          urn = derivatives.id;
        }
      }
      
      // Also try to get it from the file version
      const versionId = file.relationships?.tip?.data?.id;
      let version = null;
      if (versionId && !urn) {
        
        // Fetch version details once to check for both derivatives and storage
        const versionUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`;
        const versionResponse = await fetch(versionUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        
        if (versionResponse.ok) {
          const versionData = await versionResponse.json();
          version = versionData.data;
          
          
          // Check if version has derivatives relationship
          if (version?.relationships?.derivatives?.data?.id) {
            urn = version.relationships.derivatives.data.id;
          }
          
          // If no derivative from relationships, check if version has OSS storage URN
          if (!urn) {
            const versionStorageId = version?.relationships?.storage?.data?.id;
            if (versionStorageId) {
              // If it's an OSS URN (urn:adsk.objects:os.object:...), we can use it
              if (versionStorageId.startsWith('urn:adsk.objects:os.object:')) {
                urn = Buffer.from(versionStorageId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
              } else {
                
              }
            }
          }
        }
        
        // Also check version refs (as a fallback)
        if (!urn) {
          const versionRefsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/relationships/refs`;
          const versionRefsResponse = await fetch(versionRefsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'x-ads-region': 'US',
            },
          });
          
          if (versionRefsResponse.ok) {
            const versionRefsData = await versionRefsResponse.json();
            
            const derivatives = versionRefsData.data?.find(ref => ref.type === 'derivatives');
            if (derivatives && derivatives.id) {
              urn = derivatives.id;
            }
          } else {
            const errorText = await versionRefsResponse.text();
            
          }
        }
      }
      
      // If still no derivative URN, try to use the fileId as storage URN (since fileId IS the storage URN)
      if (!urn) {
        // The fileId passed to this endpoint IS the storage URN
        // Since the file doesn't have a storage relationship, use the fileId directly
        const storageUrn = decodedFileId;
        
        // For ACC files, the storage ID is typically a URN like "urn:adsk.wipprod:dm.lineage:..."
        // Model Derivative API doesn't support these directly, but let's try anyway
        if (storageUrn.startsWith('urn:adsk.wipprod')) {
          // Try to convert it - but this likely won't work with Model Derivative API
          urn = Buffer.from(storageUrn).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          
          // Continue to try Model Derivative API - it will fail but at least we tried
        } else {
          // Not an ACC storage URN, use it directly
          urn = Buffer.from(storageUrn).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }
      }
    }
    
    if (!urn) {
      return res.status(400).json({ error: 'Failed to determine URN for file' });
    }
    
    // Step 3: Check if derivative already exists by checking manifest
    const manifestUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest`;
    
    const manifestResponse = await fetch(manifestUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    let hasDerivative = false;
    if (manifestResponse.ok) {
      const manifestData = await manifestResponse.json();
      if (manifestData.status === 'success' && manifestData.derivatives && manifestData.derivatives.length > 0) {
        hasDerivative = true;
      }
    } else if (manifestResponse.status === 404) {
      // Manifest doesn't exist yet - derivative needs to be created
      hasDerivative = false;
    } else {
      // Other error from manifest check
      const errorText = await manifestResponse.text();
      let errorMessage = 'Failed to check manifest';
      let errorDetails = null;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorMessage;
        errorDetails = errorData;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      
      // If it's a 400, it might be an invalid URN format - try to create derivative anyway
      if (manifestResponse.status === 400) {
        hasDerivative = false; // Try to create derivative
      } else {
        return res.status(manifestResponse.status).json({ error: errorMessage, details: errorDetails });
      }
    }
    
    // Step 4: If no derivative exists, create derivative job (SVF will include thumbnail)
    if (!hasDerivative) {
      const jobUrl = 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job';
      
      const jobBody = {
        input: {
          urn: urn
        },
        output: {
          formats: [
            {
              type: 'svf',
              views: ['2d', '3d']
            }
          ]
        }
      };
      
      const jobResponse = await fetch(jobUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobBody),
      });
      
      if (!jobResponse.ok) {
        const errorText = await jobResponse.text();
        let errorMessage = 'Failed to create derivative job';
        let errorDetails = null;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorMessage;
          errorDetails = errorData;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        
        
        // If the error is "urn is not supported", it means ACC storage URNs aren't supported
        
        
        if (errorDetails?.diagnostic === 'The input urn is not supported.' || errorMessage.includes('urn is not supported') || errorMessage.includes('input urn is not supported')) {
          
          // Try to download file from ACC and upload to OSS, then create derivative
          try {
            // Get file download URL from ACC
            const versionId = file.relationships?.tip?.data?.id;
            if (!versionId) {
              return res.status(400).json({ 
                error: 'ACC storage URNs are not supported by Model Derivative API',
                details: 'Cannot get file version for download. The file needs to be processed by ACC first.',
                suggestion: 'Open the file in ACC Docs to trigger processing, then try again.'
              });
            }
            
            // Get version download URL - use the storage download endpoint
            // The version ID contains the storage information
            const versionDownloadUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/downloadForm`;
            const downloadFormResponse = await fetch(versionDownloadUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'x-ads-region': 'US',
              },
            });
            
            let downloadUrl = null;
            if (downloadFormResponse.ok) {
              const downloadFormData = await downloadFormResponse.json();
              
              // Try to extract download URL from form data
              const formData = downloadFormData.data?.downloadForm?.formData || [];
              const downloadUrlField = formData.find(f => f.name === 'downloadUrl' || f.name === 'url');
              downloadUrl = downloadUrlField?.value;
            } else {
              const errorText = await downloadFormResponse.text();
              
            }
            
            // If download form doesn't work, try direct storage download
            if (!downloadUrl) {
              // Use the storage URN directly to get download URL
              // ACC storage download: GET /data/v1/projects/{project_id}/storage/{storage_id}/download
              const storageDownloadUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/storage/${encodeURIComponent(decodedFileId)}/download`;
              const storageDownloadResponse = await fetch(storageDownloadUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                  'x-ads-region': 'US',
                },
              });
              
              if (storageDownloadResponse.ok) {
                const storageDownloadData = await storageDownloadResponse.json();
                
                downloadUrl = storageDownloadData.data?.downloadUrl || storageDownloadData.data?.url;
              } else {
                const errorText = await storageDownloadResponse.text();
                
              }
            }
            
            if (!downloadUrl) {
              // ACC files cannot be downloaded directly via API - they need to be processed first
              // Return a clear error explaining this limitation
              return res.status(400).json({ 
                error: 'ACC files must be processed before thumbnails can be generated',
                details: 'ACC storage URNs are not supported by Model Derivative API, and ACC files cannot be downloaded via API. The file needs to be processed by ACC first.',
                suggestion: 'To generate thumbnails: 1) Open the file in ACC Docs (this triggers processing), 2) Wait for processing to complete (usually a few minutes), 3) Once processed, the file will have derivatives available and thumbnails will work. This is a limitation of the ACC API - files must be viewed/processed in ACC before derivatives become available.',
                fileId: decodedFileId,
                versionId: versionId
              });
            }
            
            // Download the file
            const fileDownloadResponse = await fetch(downloadUrl);
            if (!fileDownloadResponse.ok) {
              return res.status(400).json({ 
                error: 'Failed to download file from ACC',
                details: 'The file download failed. The file may need to be processed by ACC first.'
              });
            }
            
            const fileBuffer = await fileDownloadResponse.arrayBuffer();
            const fileName = file.attributes?.displayName || file.attributes?.name || 'file.rvt';
            
            // Upload to OSS
            const { get2LOToken } = await import('../utils/authUtils.js');
            const bucketToken = await get2LOToken();
            
            const bucketKey = `acc-thumbnails-${Date.now()}`;
            const objectKey = `${file.id}-${fileName}`;
            
            // Create bucket
            const createBucketUrl = `https://developer.api.autodesk.com/oss/v2/buckets`;
            const bucketResponse = await fetch(createBucketUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${bucketToken}`,
                'Content-Type': 'application/json',
                'x-ads-region': 'US',
              },
              body: JSON.stringify({
                bucketKey: bucketKey,
                policyKey: 'temporary'
              }),
            });
            
            if (!bucketResponse.ok && bucketResponse.status !== 409) {
              const errorText = await bucketResponse.text();
              return res.status(500).json({ error: 'Failed to create OSS bucket', details: errorText });
            }
            
            // Upload file
            const uploadUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}`;
            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${bucketToken}`,
                'Content-Type': 'application/octet-stream',
                'x-ads-region': 'US',
              },
              body: Buffer.from(fileBuffer),
            });
            
            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              return res.status(500).json({ error: 'Failed to upload file to OSS', details: errorText });
            }
            
            // Create OSS URN and use it for Model Derivative API
            const ossUrn = Buffer.from(`urn:adsk.objects:os.object:${bucketKey}/${objectKey}`).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            
            // Update the urn variable to use the OSS URN
            urn = ossUrn;
            hasDerivative = false; // Need to create derivative with new URN
            // Continue to create derivative job below
            
          } catch (downloadError) {
            return res.status(500).json({ 
              error: 'Failed to process ACC file',
              details: downloadError.message,
              suggestion: 'The file may need to be processed by ACC first. Try opening it in ACC Docs, then try again.'
            });
          }
        }
        
        return res.status(jobResponse.status).json({ error: errorMessage, details: errorDetails });
      }
      
      
      // Poll for job completion
      const maxAttempts = 120; // 2 minutes
      const pollInterval = 2000; // 2 seconds
      
      let attempts = 0;
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const pollManifestResponse = await fetch(manifestUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (pollManifestResponse.ok) {
          const pollManifestData = await pollManifestResponse.json();
          
          if (pollManifestData.status === 'success') {
            hasDerivative = true;
            break;
          } else if (pollManifestData.status === 'failed') {
            return res.status(500).json({ error: 'Derivative job failed', details: pollManifestData });
          }
        }
        
        attempts++;
      }
      
      if (!hasDerivative) {
        return res.status(504).json({ error: 'Derivative job timed out' });
      }
    }
    
    // Step 5: Get thumbnail
    // First, get the manifest to check for thumbnail derivatives and document GUIDs
    const finalManifestResponse = await fetch(manifestUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    let documentGuid = null;
    let manifestData = null;
    if (finalManifestResponse.ok) {
      manifestData = await finalManifestResponse.json();
      
      // Log manifest structure for debugging
      
      
      // Try to find a 3D view GUID from the manifest
      // For RVT files, we want the 3D view thumbnail, not the 2D view
      if (manifestData.derivatives && manifestData.derivatives.length > 0) {
        // Collect all viewables with their roles and GUIDs
        // Track which derivative (SVF vs other) each viewable belongs to
        const allViewables = [];
        const collectViewables = (item, path = '', depth = 0, parentOutputType = null) => {
          // Use item's outputType if available, otherwise inherit from parent
          const currentOutputType = item.outputType || parentOutputType;
          
          if (item.guid) {
            allViewables.push({
              guid: item.guid,
              role: item.role,
              type: item.type,
              outputType: currentOutputType,
              name: item.name,
              camera: item.camera,
              path: path,
              depth: depth,
              isSvf: currentOutputType === 'svf' || currentOutputType === 'svf2'
            });
          }
          if (item.children) {
            item.children.forEach((child, index) => {
              collectViewables(child, `${path}/${index}`, depth + 1, currentOutputType);
            });
          }
        };
        
        manifestData.derivatives.forEach((derivative, idx) => {
          collectViewables(derivative, `derivative[${idx}]`, 0, derivative.outputType);
        });
        
        
        // Look for 3D view - prioritize SVF derivatives (which contain 3D views)
        // For RVT files: SVF derivatives = 3D model, other derivatives = 2D sheets
        const find3DView = () => {
          // First, look for viewables within SVF derivatives (these are 3D views)
          // SVF derivatives have outputType "svf" or "svf2"
          const svfViewables = allViewables.filter(v => v.isSvf === true);
          
          if (svfViewables.length > 0) {
            // First priority: look for explicit role "3d" (exact match, case-insensitive)
            for (const viewable of svfViewables) {
              const role = (viewable.role || '').toLowerCase().trim();
              if (role === '3d') {
                return viewable.guid;
              }
            }
            
            // Second priority: look for "geometry" role (also indicates 3D)
            for (const viewable of svfViewables) {
              const role = (viewable.role || '').toLowerCase().trim();
              if (role === 'geometry') {
                return viewable.guid;
              }
            }
            
            // Third priority: look for views with cameras (3D views have cameras, 2D sheets don't)
            // AND explicitly exclude 2D roles
            for (const viewable of svfViewables) {
              const role = (viewable.role || '').toLowerCase().trim();
              const name = (viewable.name || '').toLowerCase();
              const is2D = role === '2d' || role === 'sheet' || role === 'view2d' || 
                          name.includes('sheet') || name.includes('plan') || name.includes('elevation');
              
              if (!is2D && viewable.camera) {
                return viewable.guid;
              }
            }
            
            // Fourth priority: exclude all known 2D indicators and pick first remaining
            for (const viewable of svfViewables) {
              const role = (viewable.role || '').toLowerCase().trim();
              const name = (viewable.name || '').toLowerCase();
              const is2D = role === '2d' || role === 'sheet' || role === 'view2d' || 
                          name.includes('sheet') || name.includes('plan') || name.includes('elevation') ||
                          name.includes('section') || name.includes('detail');
              
              if (!is2D) {
                return viewable.guid;
              }
            }
            
            // Last resort: try to find the viewable with the deepest nesting (3D views are often deeper)
            // Or look for one that doesn't have "sheet" in the name
            const nonSheetViewables = svfViewables.filter(v => {
              const name = (v.name || '').toLowerCase();
              return !name.includes('sheet') && !name.includes('plan');
            });
            
            if (nonSheetViewables.length > 0) {
              // Prefer viewables with cameras
              const withCamera = nonSheetViewables.filter(v => v.camera);
              if (withCamera.length > 0) {
                return withCamera[0].guid;
              }
              return nonSheetViewables[0].guid;
            }
            
            // Absolute last resort: use first SVF viewable (may still be 2D, but it's our best guess)
            return svfViewables[0].guid;
          }
          
          // If no SVF viewables found, fall back to general 3D detection
          // Look for explicit 3D roles in all viewables
          for (const viewable of allViewables) {
            const role = (viewable.role || '').toLowerCase();
            if (role === '3d' || role === 'geometry' || role === 'view3d' || role === '3dview') {
              return viewable.guid;
            }
          }
          
          // Look for views with cameras, excluding 2D
          for (const viewable of allViewables) {
            const role = (viewable.role || '').toLowerCase();
            const is2D = role === '2d' || role === 'sheet' || role === 'view2d' || 
                        (viewable.name && viewable.name.toLowerCase().includes('sheet'));
            
            if (!is2D && viewable.camera) {
              return viewable.guid;
            }
          }
          
          return null;
        };
        
        documentGuid = find3DView();
        
        if (!documentGuid && allViewables.length > 0) {
          // If no 3D view found, log a warning
        }
      }
    }
    
    // Try getting thumbnail - try multiple SVF viewables to find 3D view
    // Collect all SVF viewables to try in order of preference
    let svfViewablesToTry = [];
    if (manifestData && manifestData.derivatives) {
      const allViewablesForTrying = [];
      const collectForTrying = (item, parentOutputType = null) => {
        const currentOutputType = item.outputType || parentOutputType;
        const isSvf = currentOutputType === 'svf' || currentOutputType === 'svf2';
        
        if (item.guid && isSvf) {
          const role = (item.role || '').toLowerCase().trim();
          const name = (item.name || '').toLowerCase();
          const is2D = role === '2d' || role === 'sheet' || role === 'view2d' || 
                      name.includes('sheet') || name.includes('plan') || name.includes('elevation');
          
          allViewablesForTrying.push({
            guid: item.guid,
            role: item.role,
            name: item.name,
            hasCamera: !!item.camera,
            is2D: is2D,
            priority: role === '3d' ? 1 : (role === 'geometry' ? 2 : (item.camera && !is2D ? 3 : (!is2D ? 4 : 5)))
          });
        }
        
        if (item.children) {
          item.children.forEach(child => {
            collectForTrying(child, currentOutputType);
          });
        }
      };
      
      manifestData.derivatives.forEach(derivative => {
        collectForTrying(derivative, derivative.outputType);
      });
      
      // Sort by priority (lower number = higher priority)
      svfViewablesToTry = allViewablesForTrying
        .filter(v => v.priority <= 4) // Only try non-2D viewables
        .sort((a, b) => a.priority - b.priority);
    }
    
    // Build thumbnail URLs to try
    const thumbnailUrls = [];
    
    // Check if a specific view GUID was requested via query parameter
    const requestedViewGuid = req.query.viewGuid;
    const viewGuidToUse = requestedViewGuid || documentGuid;
    
    // First, try the selected GUID if we have one
    if (viewGuidToUse) {
      thumbnailUrls.push({
        url: `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/thumbnail?guid=${encodeURIComponent(viewGuidToUse)}&width=400`,
        guid: viewGuidToUse,
        source: 'selected'
      });
      thumbnailUrls.push({
        url: `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/thumbnail?guid=${encodeURIComponent(viewGuidToUse)}`,
        guid: viewGuidToUse,
        source: 'selected'
      });
    }
    
    // Then try all SVF viewables in priority order
    svfViewablesToTry.forEach(viewable => {
      if (viewable.guid !== viewGuidToUse) { // Don't duplicate the selected one
        thumbnailUrls.push({
          url: `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/thumbnail?guid=${encodeURIComponent(viewable.guid)}&width=400`,
          guid: viewable.guid,
          source: 'svf-priority'
        });
      }
    });
    
    // Last resort: try without GUID (may return 2D)
    if (thumbnailUrls.length === 0) {
      
      thumbnailUrls.push({
        url: `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/thumbnail?width=400`,
        guid: null,
        source: 'default'
      });
    }
    
    // Try getting thumbnail with retries (sometimes it takes a moment after derivative completes)
    let thumbnailAttempts = 0;
    const maxThumbnailAttempts = 5;
    const thumbnailRetryDelay = 1000; // 1 second
    
    for (const thumbnailUrlObj of thumbnailUrls) {
      const thumbnailUrl = thumbnailUrlObj.url;
      thumbnailAttempts = 0;
      
      while (thumbnailAttempts < maxThumbnailAttempts) {
        if (thumbnailAttempts > 0) {
          await new Promise(resolve => setTimeout(resolve, thumbnailRetryDelay));
        }
        
        const thumbnailResponse = await fetch(thumbnailUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        
        if (thumbnailResponse.ok) {
          const contentType = thumbnailResponse.headers.get('content-type');
          // Check if we got an actual image
          if (contentType && contentType.startsWith('image/')) {
            const thumbnailBuffer = await thumbnailResponse.arrayBuffer();
            if (thumbnailBuffer && thumbnailBuffer.byteLength > 0) {
              const buffer = Buffer.from(thumbnailBuffer);
              
              // Cache to disk
              setCached(cache.thumbnails, thumbnailCacheKey, {
                buffer: buffer,
                contentType: contentType,
              }, CACHE_TTL.thumbnails, 'acc-thumbnails');
              
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.setHeader('X-Cache', 'MISS');
              return res.send(buffer);
            }
          } else {
            // Might be JSON error response
            const responseText = await thumbnailResponse.text();
            try {
              const errorData = JSON.parse(responseText);
              if (errorData.error) {
                // If it's a 200 but with error, wait and retry
                if (thumbnailAttempts < maxThumbnailAttempts - 1) {
                  thumbnailAttempts++;
                  continue;
                }
              }
            } catch (e) {
              // Not JSON, might be HTML or other
            }
          }
        } else if (thumbnailResponse.status === 404 || thumbnailResponse.status === 202) {
          // 404 = thumbnail not ready yet, 202 = accepted but processing
          // Wait and retry
          if (thumbnailAttempts < maxThumbnailAttempts - 1) {
            thumbnailAttempts++;
            continue;
          }
        } else {
          // Other error status - try next URL
          break;
        }
        
        thumbnailAttempts++;
      }
    }
    
    // If all attempts failed, return error with details
    
    return res.status(404).json({ 
      error: 'Thumbnail not available. The file may need to be processed first, or thumbnails may not be available for this file type.',
      details: {
        fileId: decodedFileId,
        urn: urn ? 'present' : 'missing'
      }
    });
  } catch (error) {
    
    res.status(500).json({ 
      error: 'Internal server error while getting thumbnail', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ACC RVT File 3D Views endpoint - gets list of available 3D views
router.get('/projects/:projectId/files/:fileId/views', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const projectId = req.params.projectId;
  const fileId = req.params.fileId;
  
  // Validate inputs
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'Invalid file ID' });
  }
  
  try {
    const decodedFileId = decodeURIComponent(fileId);
    const hubId = req.query.hubId;
    
    if (!hubId) {
      return res.status(400).json({ error: 'Hub ID is required' });
    }
    
    // Get file item
    const fileUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(decodedFileId)}`;
    const fileResponse = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!fileResponse.ok) {
      return res.status(fileResponse.status).json({ error: 'Failed to fetch file' });
    }
    
    const fileData = await fileResponse.json();
    const file = fileData.data;
    
    // Get version ID from tip relationship
    const versionId = file.relationships?.tip?.data?.id;
    if (!versionId) {
      return res.json({ data: [] });
    }
    
    // Get derivatives relationship from version
    const versionUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`;
    const versionResponse = await fetch(versionUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!versionResponse.ok) {
      return res.json({ data: [] });
    }
    
    const versionData = await versionResponse.json();
    const version = versionData.data;
    const derivativesRel = version.relationships?.derivatives?.data;
    
    if (!derivativesRel || !derivativesRel.id) {
      return res.json({ data: [] });
    }
    
    // Get manifest
    const manifestUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(derivativesRel.id)}/manifest`;
    const manifestResponse = await fetch(manifestUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!manifestResponse.ok) {
      return res.json({ data: [] });
    }
    
    const manifestData = await manifestResponse.json();
    
    // Collect all viewables first (like the thumbnail endpoint does)
    const allViewables = [];
    const collectViewables = (item, path = '', depth = 0, parentOutputType = null) => {
      // Use item's outputType if available, otherwise inherit from parent
      const currentOutputType = item.outputType || parentOutputType;
      
      // Collect all items with GUIDs
      if (item.guid) {
        allViewables.push({
          guid: item.guid,
          role: item.role,
          type: item.type,
          outputType: currentOutputType,
          name: item.name,
          camera: item.camera,
          path: path,
          depth: depth,
          isSvf: currentOutputType === 'svf' || currentOutputType === 'svf2'
        });
      }
      
      if (item.children) {
        item.children.forEach((child, index) => {
          collectViewables(child, `${path}/${index}`, depth + 1, currentOutputType);
        });
      }
    };
    
    if (manifestData.derivatives && manifestData.derivatives.length > 0) {
      manifestData.derivatives.forEach((derivative, idx) => {
        collectViewables(derivative, `derivative[${idx}]`, 0, derivative.outputType);
      });
    }
    
    // Filter for 3D views - prioritize SVF derivatives (which contain 3D views)
    const svfViewables = allViewables.filter(v => v.isSvf === true);
    
    // Filter out resources and 2D views, but be less restrictive
    const filteredViewables = svfViewables.filter(viewable => {
      const role = (viewable.role || '').toLowerCase().trim();
      const name = (viewable.name || '').toLowerCase();
      const isResource = role === 'autodesk.cloudplatform.propertydatabase' || 
                        role === 'autodesk.aec.modeldata' ||
                        viewable.type === 'resource';
      
      // Only exclude obvious 2D indicators, but be more permissive
      const is2D = (role === '2d' || role === 'sheet' || role === 'view2d') && 
                  (name.includes('sheet') || name.includes('plan') || name.includes('elevation'));
      
      return !is2D && !isResource;
    });
    
    // Deduplicate by GUID and map to response format
    const guidMap = new Map();
    filteredViewables.forEach(viewable => {
      if (!guidMap.has(viewable.guid)) {
        const role = (viewable.role || '').toLowerCase().trim();
        guidMap.set(viewable.guid, {
          guid: viewable.guid,
          name: viewable.name || 'Untitled View',
          role: viewable.role || '3d',
          hasCamera: !!viewable.camera,
          priority: role === '3d' ? 1 : (role === 'geometry' ? 2 : (viewable.camera ? 3 : 4))
        });
      }
    });
    
    // Convert to array and sort by priority
    const result = Array.from(guidMap.values());
    result.sort((a, b) => a.priority - b.priority);
    
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while fetching views', details: error.message });
  }
});

// ACC RVT File SVF endpoint - gets SVF URL for viewing RVT file
router.get('/projects/:projectId/files/:fileId/svf', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const projectId = req.params.projectId;
  const fileId = req.params.fileId;
  
  
  // Validate inputs
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'Invalid file ID' });
  }
  
  try {
    // Step 1: Decode fileId and handle storage URNs
    const decodedFileId = decodeURIComponent(fileId);
    let file = null;
    
    // Step 1a: Try to fetch file directly with relationships included
    const fileUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(decodedFileId)}?include=derivatives,tip,storage`;
    
    const fileResponse = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!fileResponse.ok) {
      // If fileId is a storage URN, search for the item
      if (decodedFileId.startsWith('urn:adsk.wipprod')) {
        
        // Get hubId from query params (needed for root folder lookup)
        const hubId = req.query.hubId;
        if (!hubId) {
          return res.status(400).json({ error: 'hubId query parameter required for storage URN lookup' });
        }
        
        // Get root folder
        const rootFolderUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/root`;
        const rootFolderResponse = await fetch(rootFolderUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        
        if (!rootFolderResponse.ok) {
          return res.status(404).json({ error: 'Failed to find root folder' });
        }
        
        const rootFolderData = await rootFolderResponse.json();
        const rootFolderId = rootFolderData.data.id;
        
        // Search for item recursively
        const searchForItem = async (folderId, depth = 0) => {
          if (depth > 10) {
            return null;
          }
          
          try {
            const contentsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/contents`;
            const contentsResponse = await fetch(contentsUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'x-ads-region': 'US',
              },
            });
            
            if (!contentsResponse.ok) {
              return null;
            }
            
            const contentsData = await contentsResponse.json();
            const contents = contentsData.data || [];
            
            // Check items
            for (const item of contents) {
              if (item.type === 'items') {
                const itemStorageId = item.relationships?.storage?.data?.id;
                // Check if item.id or storage relationship matches
                if (item.id === decodedFileId || itemStorageId === decodedFileId) {
                  // Fetch full item details
                  const itemUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(item.id)}`;
                  const itemResponse = await fetch(itemUrl, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                      'x-ads-region': 'US',
                    },
                  });
                  
                  if (itemResponse.ok) {
                    const itemData = await itemResponse.json();
                    const foundFile = itemData.data;
                    
                    // If we found the file by storage URN, make sure we have relationships
                    // Fetch with include parameter to get all relationships
                    if (foundFile && !foundFile.relationships?.derivatives) {
                      const fileWithRelationsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(foundFile.id)}?include=derivatives,tip,storage`;
                      const fileWithRelationsResponse = await fetch(fileWithRelationsUrl, {
                        method: 'GET',
                        headers: {
                          'Authorization': `Bearer ${accessToken}`,
                          'Content-Type': 'application/json',
                          'x-ads-region': 'US',
                        },
                      });
                      
                      if (fileWithRelationsResponse.ok) {
                        const fileWithRelationsData = await fileWithRelationsResponse.json();
                        return fileWithRelationsData.data;
                      }
                    }
                    
                    return foundFile;
                  } else {
                  }
                }
              } else if (item.type === 'folders') {
                // Recursively search subfolders
                const found = await searchForItem(item.id, depth + 1);
                if (found) return found;
              }
            }
            
            return null;
          } catch (err) {
            return null;
          }
        };
        
        file = await searchForItem(rootFolderId);
        
        if (!file) {
          return res.status(404).json({ error: 'File not found in project structure', fileId: decodedFileId });
        } else {
        }
      } else {
        const errorText = await fileResponse.text();
        let errorMessage = 'Failed to fetch file details';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.developerMessage || errorData.error || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        return res.status(fileResponse.status).json({ error: errorMessage });
      }
    } else {
      const fileData = await fileResponse.json();
      file = fileData.data;
      
      // If relationships are in included array, merge them into file.relationships
      if (fileData.included && Array.isArray(fileData.included)) {
        if (!file.relationships) {
          file.relationships = {};
        }
        
        // Process included items and add to relationships
        fileData.included.forEach(item => {
          if (item.type === 'derivatives' && item.id) {
            if (!file.relationships.derivatives) {
              file.relationships.derivatives = {};
            }
            if (!file.relationships.derivatives.data) {
              file.relationships.derivatives.data = { id: item.id, type: item.type };
            }
          } else if (item.type === 'versions' && item.id) {
            if (!file.relationships.tip) {
              file.relationships.tip = {};
            }
            if (!file.relationships.tip.data) {
              file.relationships.tip.data = { id: item.id, type: item.type };
            }
            
            // CRITICAL: Extract derivatives and storage from the version's relationships!
            // For data exchange files, the version in included array has derivatives and storage
            if (item.relationships) {
              
              // Extract derivatives from version
              if (item.relationships.derivatives?.data?.id) {
                if (!file.relationships.derivatives) {
                  file.relationships.derivatives = {};
                }
                file.relationships.derivatives.data = item.relationships.derivatives.data;
                // Also extract the meta.link with scopes if available
                if (item.relationships.derivatives.meta?.link?.href) {
                  file.relationships.derivatives.meta = item.relationships.derivatives.meta;
                }
              }
              
              // Extract storage from version (OSS storage URN)
              if (item.relationships.storage?.data?.id) {
                // Store version storage separately or add to file relationships
                // For data exchange, we'll use this when checking version storage
                if (!file.relationships.versionStorage) {
                  file.relationships.versionStorage = {};
                }
                file.relationships.versionStorage.data = item.relationships.storage.data;
              }
            }
          } else if (item.type === 'storage' && item.id) {
            if (!file.relationships.storage) {
              file.relationships.storage = {};
            }
            if (!file.relationships.storage.data) {
              file.relationships.storage.data = { id: item.id, type: item.type };
            }
          }
        });
      }
      
      // If fileId is a wipprod URN and we got a file, but it might not have relationships
      // Check if we need to search for the actual file item
      if (decodedFileId.startsWith('urn:adsk.wipprod') && (!file.relationships || !file.relationships.tip)) {
        // The file we got might not be the actual file item - search for it
        const hubId = req.query.hubId;
        if (hubId) {
          // Get root folder and search
          const rootFolderUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/root`;
          const rootFolderResponse = await fetch(rootFolderUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'x-ads-region': 'US',
            },
          });
          
          if (rootFolderResponse.ok) {
            const rootFolderData = await rootFolderResponse.json();
            const rootFolderId = rootFolderData.data.id;
            
            // Search for item with this storage URN
            const searchForItem = async (folderId, depth = 0) => {
              if (depth > 10) return null;
              
              try {
                const contentsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/contents`;
                const contentsResponse = await fetch(contentsUrl, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'x-ads-region': 'US',
                  },
                });
                
                if (!contentsResponse.ok) return null;
                
                const contentsData = await contentsResponse.json();
                const contents = contentsData.data || [];
                
                for (const item of contents) {
                  if (item.type === 'items') {
                    const itemStorageId = item.relationships?.storage?.data?.id;
                    if (itemStorageId === decodedFileId || item.id === decodedFileId) {
                      // Fetch full item details
                      const itemUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(item.id)}?include=derivatives,tip,storage`;
                      const itemResponse = await fetch(itemUrl, {
                        method: 'GET',
                        headers: {
                          'Authorization': `Bearer ${accessToken}`,
                          'Content-Type': 'application/json',
                          'x-ads-region': 'US',
                        },
                      });
                      
                      if (itemResponse.ok) {
                        const itemData = await itemResponse.json();
                        return itemData.data;
                      }
                    }
                  } else if (item.type === 'folders') {
                    const found = await searchForItem(item.id, depth + 1);
                    if (found) return found;
                  }
                }
                
                return null;
              } catch (err) {
                return null;
              }
            };
            
            const actualFile = await searchForItem(rootFolderId);
            if (actualFile) {
              file = actualFile;
            }
          }
        }
      }
    }
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Step 1b: Get storage relationship or use derivative URN
    let objectId = null;
    let urn = null;
    
    // Check if this is a data exchange file (FDX) - these may not support SVF derivatives
    const fileTypeCheck = file.type || '';
    const fileExtensionCheck = file.attributes?.extension?.type || '';
    const fileNameCheck = file.attributes?.displayName || file.attributes?.name || '';
    const fileTypeAttrCheck = file.attributes?.fileType || '';
    const isDataExchangeCheck = fileTypeCheck.includes('FDX') || 
                          fileTypeCheck.includes('data-exchange') ||
                          fileTypeCheck.includes('autodesk.bim360:FDX') ||
                          fileTypeCheck === 'items:autodesk.bim360:FDX' ||
                          fileExtensionCheck.includes('FDX') ||
                          fileExtensionCheck.includes('autodesk.bim360:FDX') ||
                          fileExtensionCheck === 'data-exchange' ||
                          fileExtensionCheck === 'json' ||
                          fileNameCheck.toLowerCase().endsWith('.dx') ||
                          fileNameCheck.toLowerCase().endsWith('.json') ||
                          fileTypeAttrCheck === 'data-exchange' ||
                          (file.attributes?.fileType && file.attributes.fileType === 'data-exchange');
    
    // Check for derivative URN first (preferred) - check both derivatives and tip relationships
    // IMPORTANT: Check AFTER processing included data, as derivatives might be in included version
    const derivativesRel = file.relationships?.derivatives?.data;
    const tipRel = file.relationships?.tip?.data;
    
    // Check for derivatives first - data exchange files might have derivatives
    // Use the same comprehensive approach as the thumbnail endpoint
    // For data exchange files, the derivative URN should be an OSS URN (not ACC storage)
    
    // Log file data for data exchange files
    if (isDataExchangeCheck) {
      // Data exchange file detected
    }
    
    // Use derivative URN if available (even if wipprod - ACC has already processed it)
    // ACC provides derivative URNs that work with Model Derivative API, even if they're wipprod URNs
    if (derivativesRel && derivativesRel.id) {
      urn = derivativesRel.id;
    }
    
    // If we don't have a URN yet, try other sources
    if (!urn) {
      // No derivative relationship found, try to get it from the file refs or version
      // First, check file refs relationship
      const fileRefsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(file.id)}/relationships/refs`;
      const fileRefsResponse = await fetch(fileRefsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (fileRefsResponse.ok) {
        const fileRefsData = await fileRefsResponse.json();
        const derivatives = fileRefsData.data?.find(ref => ref.type === 'derivatives');
        if (derivatives && derivatives.id) {
          urn = derivatives.id;
        }
      }
      
      // Also try to get it from the file version
      const versionId = tipRel?.id || file.relationships?.tip?.data?.id;
      let version = null;
      
      if (isDataExchangeCheck) {
      }
      
      if (versionId && !urn) {
        // Fetch version details first to check for derivatives and storage
        const versionUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`;
        const versionResponse = await fetch(versionUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        
        if (versionResponse.ok) {
          const versionData = await versionResponse.json();
          version = versionData.data;
          
          if (isDataExchangeCheck) {
          }
          
          // Check if version has derivatives relationship (highest priority)
          if (version?.relationships?.derivatives?.data?.id) {
            urn = version.relationships.derivatives.data.id;
            if (isDataExchangeCheck) {
            }
          }
        } else {
          if (isDataExchangeCheck) {
          }
        }
        
        // Check version refs for derivatives
        if (!urn) {
          const versionRefsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/relationships/refs`;
          const versionRefsResponse = await fetch(versionRefsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'x-ads-region': 'US',
            },
          });
          
          if (versionRefsResponse.ok) {
            const versionRefsData = await versionRefsResponse.json();
            if (isDataExchangeCheck) {
            }
            const derivatives = versionRefsData.data?.find(ref => ref.type === 'derivatives');
            if (derivatives && derivatives.id) {
              // Use the derivative URN directly (validation happens in final check)
              urn = derivatives.id;
              if (isDataExchangeCheck) {
              }
            }
          } else {
            if (isDataExchangeCheck) {
            }
          }
        }
        
        // For data exchange files, check if version has OSS storage URN
        // This is the key - processed data exchange files have OSS storage on the version
        // First check if we already extracted it from included data
          if (!urn && isDataExchangeCheck) {
          // Check version storage from included data first (already extracted)
          const versionStorageFromIncluded = file.relationships?.versionStorage?.data?.id;
          if (versionStorageFromIncluded && versionStorageFromIncluded.startsWith('urn:adsk.objects:os.object:')) {
            urn = Buffer.from(versionStorageFromIncluded).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          } else if (version) {
            // Fallback: check version from API call
            const versionStorageId = version?.relationships?.storage?.data?.id;
            if (isDataExchangeCheck) {
            }
            if (versionStorageId) {
              if (versionStorageId.startsWith('urn:adsk.objects:os.object:')) {
              // Version has OSS storage URN - encode it for Model Derivative API
              urn = Buffer.from(versionStorageId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                if (isDataExchangeCheck) {
                }
              } else if (versionStorageId.startsWith('urn:adsk.wipprod')) {
                // Version still has wipprod storage - can't use it directly
                if (isDataExchangeCheck) {
                }
                // Don't set urn, will fall through to error handling
              } else {
                if (isDataExchangeCheck) {
                }
              }
            } else {
              if (isDataExchangeCheck) {
              }
            }
          }
        }
      }
    }
    
    // For data exchange files, if we still don't have a URN, try checking all versions
    // Derivatives might be on a non-tip version
    if (!urn && isDataExchangeCheck) {
      try {
        const versionsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(file.id)}/versions`;
        const versionsResponse = await fetch(versionsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        
        if (versionsResponse.ok) {
          const versionsData = await versionsResponse.json();
          const versions = versionsData.data || [];
          
          // Check each version for derivatives (start with most recent)
          for (const versionItem of versions.reverse()) {
            if (urn) break; // Found one, stop searching
            
            const versionId = versionItem.id;
            if (!versionId) continue;
            
            // Check version refs for derivatives
          const versionRefsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/relationships/refs`;
          const versionRefsResponse = await fetch(versionRefsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'x-ads-region': 'US',
            },
          });
          
          if (versionRefsResponse.ok) {
            const versionRefsData = await versionRefsResponse.json();
            const derivatives = versionRefsData.data?.find(ref => ref.type === 'derivatives');
            if (derivatives && derivatives.id) {
              urn = derivatives.id;
                break;
              }
            }
            
            // Also check version relationships directly
            if (!urn) {
              const versionUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`;
              const versionResponse = await fetch(versionUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                  'x-ads-region': 'US',
                },
              });
              
              if (versionResponse.ok) {
                const versionData = await versionResponse.json();
                const versionDerivatives = versionData.data?.relationships?.derivatives?.data?.id;
                if (versionDerivatives) {
                  urn = versionDerivatives;
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        // If checking versions fails, continue with normal flow
      }
    }
    
    if (!urn) {
      // Get storage relationship - the storage ID is the object ID
      const storageRel = file.relationships?.storage?.data;
      if (!storageRel || !storageRel.id) {
        return res.status(404).json({ error: 'Storage not found for file' });
      }
      
      // The storage ID is the object ID we need
      objectId = storageRel.id;
    
      // Step 1c: Translate object ID to URN (base64 encode) if not already a URN
      if (objectId.startsWith('urn:adsk.objects:os.object:')) {
        // Already an OSS URN, encode it
        urn = Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } else if (objectId.startsWith('urn:adsk.wipprod')) {
        // ACC storage URN - Model Derivative API doesn't support these directly
        // But let's try to encode it and see if derivatives exist (same as thumbnail endpoint)
        // The Model Derivative API will tell us if it's not supported
        urn = Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } else {
        // Regular storage ID, encode it
        urn = Buffer.from(objectId).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        if (isDataExchangeCheck) {
        }
      }
    }
    
    if (!urn) {
      if (isDataExchangeCheck) {
      }
      return res.status(400).json({ error: 'Failed to determine URN for file' });
    }
    
        if (isDataExchangeCheck) {
      try {
        const decoded = Buffer.from(urn.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    } catch (e) {
      }
    }
    
    // Don't reject wipprod URNs early - let the Model Derivative API tell us if it's not supported
    // This matches the thumbnail endpoint behavior - try the URN and handle errors from the API
    
    // Helper function to find 3D view GUID from manifest
    const find3DViewGuid = (manifestData) => {
      if (!manifestData || !manifestData.derivatives || !Array.isArray(manifestData.derivatives)) {
        return null;
      }
      
      // Collect all viewables with their roles and GUIDs
      const allViewables = [];
      const collectViewables = (item, path = '', depth = 0, parentOutputType = null) => {
        const currentOutputType = item.outputType || parentOutputType;
        
        // For SVF2, the derivative itself might be a viewable if it has a GUID
        // Also collect items with type 'geometry' or 'view' (these are viewables)
        // Skip resources like 'Autodesk.CloudPlatform.PropertyDatabase'
        if (item.guid) {
          const isResource = item.role === 'Autodesk.CloudPlatform.PropertyDatabase' || 
                           item.role === 'Autodesk.AEC.ModelData' ||
                           item.type === 'resource';
          
          if (!isResource) {
            allViewables.push({
              guid: item.guid,
              role: item.role || item.type,
              type: item.type,
              outputType: currentOutputType,
              name: item.name,
              camera: item.camera,
              path: path,
              depth: depth,
              isSvf: currentOutputType === 'svf' || currentOutputType === 'svf2'
            });
          }
        }
        
        // For SVF2 derivatives, also check if the derivative itself should be treated as a viewable
        // Some SVF2 files have the viewable at the derivative level
        if (depth === 0 && (currentOutputType === 'svf2' || item.overrideOutputType === 'svf2')) {
          // Check if this derivative has a GUID and looks like a viewable
          if (item.guid && !item.role) {
            // Derivative with GUID but no role - might be the viewable itself
            allViewables.push({
              guid: item.guid,
              role: 'derivative',
              type: item.type || 'geometry',
              outputType: currentOutputType,
              name: item.name,
              camera: item.camera,
              path: path,
              depth: depth,
              isSvf: true
            });
          }
        }
        
        if (item.children) {
          item.children.forEach((child, index) => {
            collectViewables(child, `${path}/${index}`, depth + 1, currentOutputType);
          });
        }
      };
      
      manifestData.derivatives.forEach((derivative, idx) => {
        collectViewables(derivative, `derivative[${idx}]`, 0, derivative.outputType);
      });
      
      if (allViewables.length > 0) {
      }
      
      // Look for 3D view - prioritize SVF derivatives (which contain 3D views)
      const svfViewables = allViewables.filter(v => v.isSvf === true);
      
      if (svfViewables.length > 0) {
        // First priority: look for explicit role "3d" (exact match, case-insensitive)
        for (const viewable of svfViewables) {
          const role = (viewable.role || '').toLowerCase().trim();
          if (role === '3d') {
            return viewable.guid;
          }
        }
        
        // Second priority: look for "geometry" role (also indicates 3D)
        for (const viewable of svfViewables) {
          const role = (viewable.role || '').toLowerCase().trim();
          if (role === 'geometry') {
            return viewable.guid;
          }
        }
        
        // Third priority: look for views with cameras (3D views have cameras, 2D sheets don't)
        // AND explicitly exclude 2D roles
        for (const viewable of svfViewables) {
          const role = (viewable.role || '').toLowerCase().trim();
          const name = (viewable.name || '').toLowerCase();
          const is2D = role === '2d' || role === 'sheet' || role === 'view2d' || 
                      name.includes('sheet') || name.includes('plan') || name.includes('elevation');
          
          if (!is2D && viewable.camera) {
            return viewable.guid;
          }
        }
        
        // Fourth priority: exclude all known 2D indicators and pick first remaining
        for (const viewable of svfViewables) {
          const role = (viewable.role || '').toLowerCase().trim();
          const name = (viewable.name || '').toLowerCase();
          const is2D = role === '2d' || role === 'sheet' || role === 'view2d' || 
                      name.includes('sheet') || name.includes('plan') || name.includes('elevation') ||
                      name.includes('section') || name.includes('detail');
          
          if (!is2D) {
            return viewable.guid;
          }
        }
        
        // Last resort: try to find the viewable with the deepest nesting (3D views are often deeper)
        const nonSheetViewables = svfViewables.filter(v => {
          const name = (v.name || '').toLowerCase();
          return !name.includes('sheet') && !name.includes('plan');
        });
        
        if (nonSheetViewables.length > 0) {
          // Prefer viewables with cameras
          const withCamera = nonSheetViewables.filter(v => v.camera);
          if (withCamera.length > 0) {
            return withCamera[0].guid;
          }
          return nonSheetViewables[0].guid;
        }
        
        // Absolute last resort: use first SVF viewable (may still be 2D, but it's our best guess)
        return svfViewables[0].guid;
      }
      
      // If no SVF viewables found, fall back to general 3D detection
      for (const viewable of allViewables) {
        const role = (viewable.role || '').toLowerCase();
        if (role === '3d' || role === 'geometry' || role === 'view3d' || role === '3dview') {
          return viewable.guid;
        }
      }
      
      // Look for views with cameras, excluding 2D
      for (const viewable of allViewables) {
        const role = (viewable.role || '').toLowerCase();
        const is2D = role === '2d' || role === 'sheet' || role === 'view2d' || 
                    (viewable.name && viewable.name.toLowerCase().includes('sheet'));
        
        if (!is2D && viewable.camera) {
          return viewable.guid;
        }
      }
      
      return null;
    };
    
    // Step 4: Check if derivative already exists
    // Extract scopes from derivatives meta.link if available
    let scopesParam = '';
    const derivativesMeta = file.relationships?.derivatives?.meta?.link?.href;
    if (derivativesMeta) {
      try {
        const url = new URL(derivativesMeta);
        const scopes = url.searchParams.get('scopes');
        if (scopes) {
          scopesParam = `?scopes=${encodeURIComponent(scopes)}`;
        }
      } catch (e) {
      }
    }
    
    const manifestUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest${scopesParam}`;
    
    
    const manifestResponse = await fetch(manifestUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    
    // If manifest exists, return the SVF URL with 3D view GUID
    if (manifestResponse.ok) {
      let manifestData;
      try {
        manifestData = await manifestResponse.json();
      } catch (parseError) {
        return res.status(500).json({ error: 'Failed to parse manifest response' });
      }
      
      // Find the SVF derivative
      const svfDerivative = manifestData.derivatives?.find(d => d.outputType === 'svf' || d.outputType === 'svf2' || d.overrideOutputType === 'svf2');
      
      if (svfDerivative) {
        // SVF derivative found
      } else {
        // No SVF derivative found
      }
      
      if (svfDerivative && (svfDerivative.overrideOutputType === 'svf2' || svfDerivative.outputType === 'svf2')) {
        // SVF2: For SVF2 files, return the URN with 'urn:' prefix
        // The viewer's Document.load() expects the URN with 'urn:' prefix for SVF2
        const urnWithPrefix = `urn:${urn}`;
        
        // Return the URN with prefix - the viewer will use Document.load(urnWithPrefix) which handles SVF2 correctly
        return res.json({ url: urnWithPrefix, isUrn: true });
      }
      
      // For SVF (not SVF2), find the 3D view GUID
      // Allow override via query parameter
      const requestedViewGuid = req.query.viewGuid;
      const viewGuid = requestedViewGuid || find3DViewGuid(manifestData);
      
      if (viewGuid) {
        // SVF: use the GUID in the path
        // For wipprod URNs with scopes, return the URN directly instead of bubble.json URL
        // The viewer will handle the URN and use the token with proper scopes
        if (scopesParam) {
          // Return URN with prefix - viewer will use Document.load() with the URN
          const urnWithPrefix = `urn:${urn}`;
          return res.json({ url: urnWithPrefix, isUrn: true });
        } else {
          // No scopes needed, use bubble.json URL
        const baseUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest/${encodeURIComponent(viewGuid)}`;
        const bubbleUrl = `${baseUrl}/bubble.json`;
        return res.json({ url: bubbleUrl });
        }
      } else {
        // Fallback: For SVF2, the bubble.json might be at the root without a GUID
        const svfDerivative = manifestData.derivatives?.find(d => d.outputType === 'svf' || d.outputType === 'svf2' || d.overrideOutputType === 'svf2');
        if (svfDerivative) {
          if (svfDerivative.overrideOutputType === 'svf2' || svfDerivative.outputType === 'svf2') {
            // SVF2: use root manifest URL (no GUID needed)
            const baseUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest`;
            const bubbleUrl = `${baseUrl}/bubble.json${scopesParam}`;
            
            return res.json({ url: bubbleUrl });
          } else if (svfDerivative.children && svfDerivative.children.length > 0) {
            // For SVF, try to find first non-resource child with a GUID
            const viewable = svfDerivative.children.find(c => 
              c.guid && 
              c.type !== 'resource' && 
              c.role !== 'Autodesk.CloudPlatform.PropertyDatabase' && 
              c.role !== 'Autodesk.AEC.ModelData'
            );
            if (viewable && viewable.guid) {
              const baseUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest/${encodeURIComponent(viewable.guid)}`;
              const bubbleUrl = `${baseUrl}/bubble.json${scopesParam}`;
              return res.json({ url: bubbleUrl });
            }
          }
        }
        // Last resort: return root manifest URL (works for some SVF2 files)
        const baseUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest`;
        const bubbleUrl = `${baseUrl}/bubble.json${scopesParam}`;
        return res.json({ url: bubbleUrl });
      }
    } else {
      // Manifest check failed
      const errorText = await manifestResponse.text();
      
      // If it's a 400, the URN is not supported by Model Derivative API
      if (manifestResponse.status === 400) {
        return res.status(400).json({ 
          error: 'This file type does not support 3D viewing',
          isDataExchange: isDataExchangeCheck 
        });
      }
      // If it's 404, derivatives don't exist yet - we'll try to create them below
      if (manifestResponse.status === 404) {
      }
    }
    
    // Step 5: If no derivative exists, create one
    // For data exchange files, we'll try to create derivatives if manifest doesn't exist
    // Some data exchange files can be translated by Model Derivative API
    
    const jobUrl = 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job';
    
    const jobBody = {
      input: {
        urn: urn
      },
      output: {
        formats: [
          {
            type: 'svf',
            views: ['2d', '3d']
          }
        ]
      }
    };
    
    
    const jobResponse = await fetch(jobUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobBody),
    });
    
    
    if (!jobResponse.ok) {
      const errorText = await jobResponse.text();
      let errorMessage = 'Failed to create derivative job';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.developerMessage || errorData.error || errorMessage;
      } catch (parseError) {
        errorMessage = errorText || errorMessage;
      }
      return res.status(jobResponse.status).json({ 
        error: errorMessage,
        isDataExchange: isDataExchangeCheck 
      });
    }
    
    
    // Poll for job completion
    const maxAttempts = 120; // 2 minutes
    const pollInterval = 2000; // 2 seconds
    
    let attempts = 0;
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const pollManifestResponse = await fetch(manifestUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (pollManifestResponse.ok) {
        const pollManifestData = await pollManifestResponse.json();
        
        // Check if job is complete
        if (pollManifestData.status === 'success') {
          const viewGuid = find3DViewGuid(pollManifestData);
          
          if (viewGuid) {
            const baseUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest/${encodeURIComponent(viewGuid)}`;
            return res.json({ url: `${baseUrl}/bubble.json` });
          } else {
            // Fallback: if no 3D view found, try to find any SVF viewable
            const findSvfDerivative = (derivatives) => {
              if (!derivatives || !Array.isArray(derivatives)) return null;
              for (const derivative of derivatives) {
                if (derivative.outputType === 'svf' || derivative.outputType === 'svf2') {
                  return derivative;
                }
                if (derivative.children) {
                  const childSvf = findSvfDerivative(derivative.children);
                  if (childSvf) return childSvf;
                }
              }
              return null;
            };
            
            const svfDerivative = findSvfDerivative(pollManifestData.derivatives);
            if (svfDerivative && svfDerivative.children && svfDerivative.children.length > 0) {
              const viewable = svfDerivative.children[0];
              const baseUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest/${encodeURIComponent(viewable.guid)}`;
              return res.json({ url: `${baseUrl}/bubble.json` });
            }
          }
        } else if (pollManifestData.status === 'failed') {
          return res.status(500).json({ error: 'Derivative job failed', details: pollManifestData });
        }
      }
      
      attempts++;
    }
    
    return res.status(504).json({ error: 'Derivative job timed out' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while getting SVF URL', details: error.message });
  }
});

// ACC RVT File MID Elements endpoint - gets all elements with MID/ prefix properties using Model Derivative API
router.get('/projects/:projectId/files/:fileId/mid-elements', requireAuth, async (req, res) => {
  const accessToken = req.accessToken;
  const projectId = req.params.projectId;
  const fileId = req.params.fileId;
  const hubId = req.query.hubId;
  
  
  try {
    // Decode URL-encoded fileId
    const decodedFileId = decodeURIComponent(fileId);
    let file = null;
    let objectId = null;
    let urn = null;
    
    // Step 1a: Try to fetch file directly with relationships included (like SVF endpoint)
    const fileUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(decodedFileId)}?include=derivatives,tip,storage`;
    
    const fileResponse = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-region': 'US',
      },
    });
    
    if (!fileResponse.ok) {
      // If fileId is a storage URN, search for the item
      if (decodedFileId.startsWith('urn:adsk.wipprod')) {
        
        // Get hubId from query params (needed for root folder lookup)
        if (!hubId) {
          return res.status(400).json({ error: 'hubId query parameter required for storage URN lookup' });
        }
        
        // Get root folder
        const rootFolderUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/root`;
        const rootFolderResponse = await fetch(rootFolderUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        
        if (!rootFolderResponse.ok) {
          return res.status(404).json({ error: 'Failed to find root folder' });
        }
        
        const rootFolderData = await rootFolderResponse.json();
        const rootFolderId = rootFolderData.data.id;
        
        // Search for item recursively
        const searchForItem = async (folderId, depth = 0) => {
          if (depth > 10) {
            return null;
          }
          
          try {
            const contentsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/contents`;
            const contentsResponse = await fetch(contentsUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'x-ads-region': 'US',
              },
            });
            
            if (!contentsResponse.ok) {
              return null;
            }
            
            const contentsData = await contentsResponse.json();
            const contents = contentsData.data || [];
            
            // Check items
            for (const item of contents) {
              if (item.type === 'items') {
                const itemStorageId = item.relationships?.storage?.data?.id;
                // Check if item.id or storage relationship matches
                if (item.id === decodedFileId || itemStorageId === decodedFileId) {
                  // Fetch full item details
                  const itemDetailUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(item.id)}`;
                  const itemDetailResponse = await fetch(itemDetailUrl, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                      'x-ads-region': 'US',
                    },
                  });
                  
                  if (itemDetailResponse.ok) {
                    const itemDetailData = await itemDetailResponse.json();
                    return itemDetailData.data;
                  }
                }
              } else if (item.type === 'folders') {
                // Recursively search subfolders
                const found = await searchForItem(item.id, depth + 1);
                if (found) return found;
              }
            }
          } catch (err) {
          }
          
          return null;
        };
        
        file = await searchForItem(rootFolderId);
        if (!file) {
          return res.status(404).json({ error: 'File not found in project structure' });
        }
        
        // For files found via search, we need to fetch with includes to get derivatives and storage (same as RVT files)
        const fileWithIncludesUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(file.id)}?include=derivatives,tip,storage`;
        const fileWithIncludesResponse = await fetch(fileWithIncludesUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        
        if (fileWithIncludesResponse.ok) {
          const fileWithIncludesData = await fileWithIncludesResponse.json();
          // Extract derivatives and storage from included array (same as RVT files - no scopes)
          if (fileWithIncludesData.included && Array.isArray(fileWithIncludesData.included)) {
            fileWithIncludesData.included.forEach(item => {
              if (item.type === 'versions' && item.id) {
                if (item.relationships?.derivatives?.data?.id) {
                  if (!file.relationships) {
                    file.relationships = {};
                  }
                  if (!file.relationships.derivatives) {
                    file.relationships.derivatives = {};
                  }
                  file.relationships.derivatives.data = item.relationships.derivatives.data;
                  // Also extract meta.link for scopes (like SVF endpoint does)
                  if (item.relationships.derivatives.meta?.link) {
                    file.relationships.derivatives.meta = item.relationships.derivatives.meta;
                  }
                }
                
                // Extract storage from version (OSS storage URN)
                if (item.relationships?.storage?.data?.id) {
                  if (!file.relationships) {
                    file.relationships = {};
                  }
                  if (!file.relationships.storage) {
                    file.relationships.storage = {};
                  }
                  file.relationships.storage.data = item.relationships.storage.data;
                }
              }
            });
          }
        }
      } else {
        const errorText = await fileResponse.text();
        return res.status(fileResponse.status).json({ error: 'Failed to fetch file', details: errorText });
      }
    } else {
      const fileData = await fileResponse.json();
      file = fileData.data;
      
      // CRITICAL: Extract derivatives and storage from included array (like SVF endpoint does)
      // For data exchange files, the version in included array has derivatives and storage
      if (fileData.included && Array.isArray(fileData.included)) {
        fileData.included.forEach(item => {
          if (item.type === 'versions' && item.id) {
            // Extract derivatives from version (including meta.link for scopes, like SVF endpoint)
            if (item.relationships?.derivatives?.data?.id) {
              if (!file.relationships) {
                file.relationships = {};
              }
              if (!file.relationships.derivatives) {
                file.relationships.derivatives = {};
              }
              file.relationships.derivatives.data = item.relationships.derivatives.data;
              // Also extract meta.link for scopes (like SVF endpoint does)
              if (item.relationships.derivatives.meta?.link) {
                file.relationships.derivatives.meta = item.relationships.derivatives.meta;
              }
            }
            
            // Extract storage from version (OSS storage URN)
            if (item.relationships?.storage?.data?.id) {
              if (!file.relationships) {
                file.relationships = {};
              }
              if (!file.relationships.storage) {
                file.relationships.storage = {};
              }
              file.relationships.storage.data = item.relationships.storage.data;
            }
          }
        });
      }
    }
    
    // Step 1b: Get URN - Priority: derivative URN > version ref > storage URN
    // Check derivatives relationship first
    const derivativesRel = file.relationships?.derivatives?.data;
    if (derivativesRel && derivativesRel.id) {
      urn = derivativesRel.id;
    } else {
      // No derivative relationship found, try to get it from the file refs or version
      // First, check file refs relationship
      const fileRefsUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(file.id)}/relationships/refs`;
      const fileRefsResponse = await fetch(fileRefsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'x-ads-region': 'US',
        },
      });
      
      if (fileRefsResponse.ok) {
        const fileRefsData = await fileRefsResponse.json();
        const derivatives = fileRefsData.data?.find(ref => ref.type === 'derivatives');
        if (derivatives && derivatives.id) {
          urn = derivatives.id;
        }
      }
      
      // Also try to get it from the file version (check derivatives relationship directly, like SVF endpoint)
      const versionId = file.relationships?.tip?.data?.id;
      let version = null;
      if (versionId && !urn) {
        const versionUrl = `https://developer.api.autodesk.com/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`;
        const versionResponse = await fetch(versionUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-ads-region': 'US',
          },
        });
        
        if (versionResponse.ok) {
          version = (await versionResponse.json()).data;
          
          // Check derivatives relationship directly (like SVF endpoint does)
          const versionDerivatives = version.relationships?.derivatives?.data;
          if (versionDerivatives && versionDerivatives.id) {
            urn = versionDerivatives.id;
          } else {
            // Fallback to checking refs
            const versionRefs = version.relationships?.refs?.data || [];
            const derivativeRef = versionRefs.find(ref => ref.type === 'derivatives');
            if (derivativeRef && derivativeRef.id) {
              urn = derivativeRef.id;
            }
          }
        }
      }
    }
    
    if (!urn) {
      return res.status(400).json({ error: 'Failed to determine URN for file' });
    }
    
    
    // Extract scopes from derivatives meta.link if available (like SVF endpoint does)
    let scopesParam = '';
    const derivativesMeta = file.relationships?.derivatives?.meta?.link?.href;
    if (derivativesMeta) {
      try {
        const url = new URL(derivativesMeta);
        const scopes = url.searchParams.get('scopes');
        if (scopes) {
          scopesParam = `?scopes=${encodeURIComponent(scopes)}`;
        }
      } catch (e) {
      }
    }
    
    // Step 1: Get metadata to find model GUID (with scopes if available, like SVF endpoint)
    const metadataUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/metadata${scopesParam}`;
    
    const metadataResponse = await fetch(metadataUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      return res.status(metadataResponse.status).json({ 
        error: 'Failed to fetch model metadata', 
        details: errorText 
      });
    }
    
    const metadata = await metadataResponse.json();
    
    // The metadata API can return different structures:
    // 1. { data: { type: '...', metadata: { guid1: {...}, guid2: {...} } } } - object with GUID keys
    // 2. { data: { type: '...', metadata: [{ guid: '...', ... }, { guid: '...', ... }] } } - array with guid property (SVF2)
    // 3. { type: '...', metadata: { guid1: {...}, guid2: {...} } }
    // The model GUIDs are either the keys of the metadata object OR the 'guid' property of array elements
    let modelGuids = [];
    if (metadata.data?.metadata) {
      if (Array.isArray(metadata.data.metadata)) {
        // Structure: { data: { metadata: [{ guid: '...', ... }, ...] } } - SVF2 format
        modelGuids = metadata.data.metadata
          .map((item, index) => {
            // Try to find guid in various possible locations
            const guid = item.guid || item.id || item.name || (item.objectid ? String(item.objectid) : null);
            return guid || String(index);
          })
          .filter(guid => guid && guid !== 'undefined');
      } else if (typeof metadata.data.metadata === 'object') {
        // Structure: { data: { metadata: { guid1: {...}, guid2: {...} } } } - object format
        modelGuids = Object.keys(metadata.data.metadata);
      }
    } else if (metadata.metadata && typeof metadata.metadata === 'object') {
      if (Array.isArray(metadata.metadata)) {
        // Structure: { metadata: [{ guid: '...', ... }, ...] }
        modelGuids = metadata.metadata
          .map((item, index) => item.guid || item.id || item.name || String(index))
          .filter(guid => guid && guid !== 'undefined');
      } else {
        // Structure: { metadata: { guid1: {...}, guid2: {...} } }
        modelGuids = Object.keys(metadata.metadata);
      }
    } else if (metadata.data && typeof metadata.data === 'object') {
      // Fallback: check if metadata.data itself contains GUIDs (unlikely but possible)
      // But exclude 'type' and 'metadata' keys as they're not GUIDs
      const dataKeys = Object.keys(metadata.data);
      modelGuids = dataKeys.filter(key => key !== 'type' && key !== 'metadata');
    }
    
    if (modelGuids.length === 0) {
      return res.status(404).json({ error: 'No model GUIDs found in metadata' });
    }
    
    const modelGuid = modelGuids[0]; // Use first model GUID (the 3D view)
    
    // Extract all object IDs from the metadata tree structure
    // The metadata contains a hierarchical tree with object IDs we can query individually
    const objectIds = [];
    const extractObjectIds = (node) => {
      if (!node) return;
      
      // Check for objectid in various possible field names
      const objId = node.objectid || node.id || node.dbId || node.object_id || node.objectId;
      if (objId !== undefined && objId !== null) {
        const numId = Number(objId);
        if (!isNaN(numId) && numId >= 0) {
          objectIds.push(numId);
        }
      }
      
      // Recursively check children and objects arrays
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(extractObjectIds);
      }
      if (node.objects && Array.isArray(node.objects)) {
        node.objects.forEach(extractObjectIds);
      }
    };
    
    // Extract from the metadata structure
    if (metadata.data?.metadata) {
      if (Array.isArray(metadata.data.metadata)) {
        metadata.data.metadata.forEach(item => {
          if (item.objectTree) extractObjectIds(item.objectTree);
          if (item.objects) extractObjectIds({ objects: item.objects });
        });
      } else if (typeof metadata.data.metadata === 'object') {
        Object.values(metadata.data.metadata).forEach(item => {
          if (item && typeof item === 'object') {
            if (item.objectTree) extractObjectIds(item.objectTree);
            if (item.objects) extractObjectIds({ objects: item.objects });
            // Also check if the item itself has children
            extractObjectIds(item);
          }
        });
      }
    } else if (metadata.metadata) {
      if (Array.isArray(metadata.metadata)) {
        metadata.metadata.forEach(item => {
          if (item.objectTree) extractObjectIds(item.objectTree);
          if (item.objects) extractObjectIds({ objects: item.objects });
        });
      } else if (typeof metadata.metadata === 'object') {
        Object.values(metadata.metadata).forEach(item => {
          if (item && typeof item === 'object') {
            if (item.objectTree) extractObjectIds(item.objectTree);
            if (item.objects) extractObjectIds({ objects: item.objects });
            extractObjectIds(item);
          }
        });
      }
    }
    
    // Remove duplicates and sort
    const uniqueObjectIds = [...new Set(objectIds)].sort((a, b) => a - b);

    // Query properties for each object ID individually (or all if no IDs found)
    // Use forceget=true to ensure we get all properties including custom ones
    const forcegetParam = scopesParam ? `${scopesParam}&forceget=true` : `?forceget=true`;
    const propertiesUrl = uniqueObjectIds.length > 0
      ? `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/metadata/${encodeURIComponent(modelGuid)}/properties${forcegetParam}&objectid=${uniqueObjectIds.slice(0, 100).join(',')}`
      : `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/metadata/${encodeURIComponent(modelGuid)}/properties${forcegetParam}`;

    try {
      const propertiesResponse = await fetch(propertiesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!propertiesResponse.ok) {
        return res.status(propertiesResponse.status).json({ 
          error: 'Failed to fetch properties from SVF database',
          details: await propertiesResponse.text()
        });
      }
      
      const propertiesData = await propertiesResponse.json();

      // Process all properties to find MID elements
      const midElements = [];
      
      // Try multiple possible locations for the collection
      let collection = propertiesData.data?.collection || [];
      if (collection.length === 0 && propertiesData.collection) {
        collection = propertiesData.collection;
      }
      if (collection.length === 0 && propertiesData.data?.objects) {
        collection = Array.isArray(propertiesData.data.objects) ? propertiesData.data.objects : [propertiesData.data.objects];
      }
      if (collection.length === 0 && propertiesData.objects) {
        collection = Array.isArray(propertiesData.objects) ? propertiesData.objects : [propertiesData.objects];
      }

      for (const obj of collection) {
        const objId = obj.objectid || obj.id || obj.objectId || obj.object_id || obj.dbId;
        
        // Extract all properties using the same methods as the Viewer component
        const midProperties = [];
        let allProperties = [];
        
        // Method 1: Direct properties array
        if (obj.properties && Array.isArray(obj.properties)) {
          allProperties = allProperties.concat(obj.properties);
        }
        
        // Method 2: Categories structure
        if (obj.categories && Array.isArray(obj.categories)) {
          obj.categories.forEach(category => {
            const categoryName = category.name || category.displayName || 'General';
            if (category.properties && Array.isArray(category.properties)) {
              category.properties.forEach(prop => {
                allProperties.push({
                  ...prop,
                  category: categoryName
                });
              });
            }
          });
        }
        
        // Method 3: Check data section directly
        if (obj.data) {
          if (Array.isArray(obj.data)) {
            allProperties = allProperties.concat(obj.data);
          } else if (typeof obj.data === 'object') {
            if (obj.data.properties && Array.isArray(obj.data.properties)) {
              allProperties = allProperties.concat(obj.data.properties);
            }
            if (obj.data.categories && Array.isArray(obj.data.categories)) {
              obj.data.categories.forEach(category => {
                if (category.properties && Array.isArray(category.properties)) {
                  allProperties = allProperties.concat(category.properties);
                }
              });
            }
            // Check all keys in data object for property-like structures
            Object.keys(obj.data).forEach(key => {
              const value = obj.data[key];
              if (Array.isArray(value)) {
                value.forEach(item => {
                  if (item && typeof item === 'object' && (item.displayName || item.name || item.value)) {
                    allProperties.push(item);
                  }
                });
              } else if (value && typeof value === 'object' && (value.displayName || value.name || value.value)) {
                allProperties.push(value);
              }
            });
          }
        }
        
        // Method 4: Look for a "Data" key in the obj object (like Viewer does with props.Data)
        if (obj.Data) {
          const dataSection = obj.Data;
          if (Array.isArray(dataSection)) {
            allProperties = allProperties.concat(dataSection);
          } else if (dataSection.properties && Array.isArray(dataSection.properties)) {
            allProperties = allProperties.concat(dataSection.properties);
          } else if (typeof dataSection === 'object') {
            // Treat each key-value pair as a potential property (this is where MID/ properties often are)
            Object.keys(dataSection).forEach(key => {
              const value = dataSection[key];
              allProperties.push({
                displayName: key,
                name: key,
                displayValue: value,
                value: value,
                category: 'Data'
              });
            });
          }
        }
        
        // Method 5: Properties object with Data category (most common structure)
        if (obj.properties && typeof obj.properties === 'object' && !Array.isArray(obj.properties)) {
          // Check Data category first (where MID properties are typically stored)
          if (obj.properties.Data && typeof obj.properties.Data === 'object') {
            Object.keys(obj.properties.Data).forEach(key => {
              const value = obj.properties.Data[key];
              allProperties.push({
                displayName: key,
                name: key,
                displayValue: value,
                value: value,
                category: 'Data'
              });
            });
          }
          
          // Also check all other categories
          Object.keys(obj.properties).forEach(categoryKey => {
            if (categoryKey === 'Data') return; // Already processed
            const categoryProps = obj.properties[categoryKey];
            if (categoryProps && typeof categoryProps === 'object') {
              Object.keys(categoryProps).forEach(key => {
                const value = categoryProps[key];
                allProperties.push({
                  displayName: key,
                  name: key,
                  displayValue: value,
                  value: value,
                  category: categoryKey
                });
              });
            }
          });
        }
        
        // Now check all collected properties for MID/ prefix (matching Viewer logic)
        const midMatches = allProperties.filter(prop => {
          if (!prop) return false;
          // Check both property name and value for MID/ prefix (case-sensitive like Viewer)
          const propName = prop.displayName || prop.name || prop.attributeName || prop.key || '';
          const propValue = prop.displayValue || prop.value || prop.attributeValue || '';
          const nameStr = String(propName);
          const valueStr = String(propValue);
          const hasMidPrefix = nameStr.startsWith('MID/') || valueStr.startsWith('MID/');
          return hasMidPrefix;
        });
        
        if (midMatches.length > 0) {
          midProperties.push(...midMatches);
          midElements.push({
            dbId: objId,
            name: obj.name || `Element ${objId}`,
            properties: midProperties,
            allProperties: allProperties,
          });
        }
      }

      return res.json({ 
        data: midElements,
        total: midElements.length,
      });
      
    } catch (err) {
      console.error(`[Backend] Error fetching properties from SVF database:`, err.message);
      throw err;
    }
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error while fetching MID elements', 
      details: error.message 
    });
  }
});

export default router;
