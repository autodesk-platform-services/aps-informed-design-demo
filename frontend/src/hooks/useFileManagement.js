import { useState, useCallback } from 'react';
import * as fileService from '../services/fileService';

/**
 * Custom hook for managing file trees (regular and data exchange files).
 * Handles file selection, expansion, and fetching.
 *
 * @param {string} selectedAccount - Currently selected account ID
 * @returns {Object} File management state and methods
 */
export const useFileManagement = (selectedAccount) => {
  // Regular files state
  const [fileTree, setFileTree] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Data exchange files state
  const [dxFileTree, setDxFileTree] = useState(null);
  const [selectedDxFile, setSelectedDxFile] = useState(null);
  const [expandedDxFiles, setExpandedDxFiles] = useState(new Set());
  const [loadingDxFiles, setLoadingDxFiles] = useState(false);

  // File details and thumbnails
  const [fileDetails, setFileDetails] = useState(null);
  const [loadingFileDetails, setLoadingFileDetails] = useState(false);
  const [fileThumbnail, setFileThumbnail] = useState(null);
  const [loadingFileThumbnail, setLoadingFileThumbnail] = useState(false);
  const [dxFileDetails, setDxFileDetails] = useState(null);
  const [loadingDxFileDetails, setLoadingDxFileDetails] = useState(false);
  const [dxFileThumbnail, setDxFileThumbnail] = useState(null);
  const [loadingDxFileThumbnail, setLoadingDxFileThumbnail] = useState(false);

  /**
   * Fetch regular files for a project.
   */
  const fetchFiles = useCallback(async (accessToken, projectId) => {
    if (!accessToken || !projectId || !selectedAccount) return;

    try {
      setLoadingFiles(true);
      const files = await fileService.fetchFiles(accessToken, projectId, selectedAccount);
      setFileTree(files.length > 0 ? files[0] : null);
    } catch (err) {
      setFileTree(null);
    } finally {
      setLoadingFiles(false);
    }
  }, [selectedAccount]);

  /**
   * Fetch data exchange files for a project.
   */
  const fetchDxFiles = useCallback(async (accessToken, projectId) => {
    if (!accessToken || !projectId || !selectedAccount) return;

    try {
      setLoadingDxFiles(true);
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const url = `${backendUrl}/api/acc/projects/${encodeURIComponent(projectId)}/files?hubId=${encodeURIComponent(selectedAccount)}&fileType=dx`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data exchange files');
      }

      const data = await response.json();
      const files = data.data || [];
      const fileTree = files.length > 0 ? files[0] : null;
      setDxFileTree(fileTree);

      // Auto-expand folders, especially "Data Exchanges" folder
      if (fileTree) {
        const expandFolders = (item, expandedSet) => {
          if (item && item.id) {
            expandedSet.add(item.id);
            const itemName = (item.name || '').toLowerCase();
            if (itemName.includes('data exchange')) {
              expandedSet.add(item.id);
            }
            if (item.children) {
              item.children.forEach(child => expandFolders(child, expandedSet));
            }
          }
        };
        const newExpanded = new Set();
        expandFolders(fileTree, newExpanded);
        setExpandedDxFiles(newExpanded);
      }
    } catch (err) {
      setDxFileTree(null);
    } finally {
      setLoadingDxFiles(false);
    }
  }, [selectedAccount]);

  /**
   * Toggle expansion state for a regular file/folder.
   */
  const handleFileToggleExpand = useCallback((fileId) => {
    setExpandedFiles(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(fileId)) {
        newExpanded.delete(fileId);
      } else {
        newExpanded.add(fileId);
      }
      return newExpanded;
    });
  }, []);

  /**
   * Toggle expansion state for a data exchange file/folder.
   */
  const handleDxFileToggleExpand = useCallback((fileId) => {
    setExpandedDxFiles(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(fileId)) {
        newExpanded.delete(fileId);
      } else {
        newExpanded.add(fileId);
      }
      return newExpanded;
    });
  }, []);

  /**
   * Select a regular file.
   */
  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
  }, []);

  /**
   * Select a data exchange file.
   */
  const handleDxFileSelect = useCallback((file) => {
    setSelectedDxFile(file);
  }, []);

  /**
   * Clear all file state.
   */
  const clearFiles = useCallback(() => {
    setFileTree(null);
    setSelectedFile(null);
    setExpandedFiles(new Set());
    setDxFileTree(null);
    setSelectedDxFile(null);
    setExpandedDxFiles(new Set());
    setFileDetails(null);
    setFileThumbnail(null);
    setDxFileDetails(null);
    setDxFileThumbnail(null);
  }, []);

  return {
    // Regular files
    fileTree,
    selectedFile,
    expandedFiles,
    loadingFiles,
    fileDetails,
    loadingFileDetails,
    fileThumbnail,
    loadingFileThumbnail,
    setFileTree,
    setSelectedFile,
    setExpandedFiles,
    setFileDetails,
    setLoadingFileDetails,
    setFileThumbnail,
    setLoadingFileThumbnail,

    // Data exchange files
    dxFileTree,
    selectedDxFile,
    expandedDxFiles,
    loadingDxFiles,
    dxFileDetails,
    loadingDxFileDetails,
    dxFileThumbnail,
    loadingDxFileThumbnail,
    setDxFileTree,
    setSelectedDxFile,
    setExpandedDxFiles,
    setDxFileDetails,
    setLoadingDxFileDetails,
    setDxFileThumbnail,
    setLoadingDxFileThumbnail,

    // Methods
    fetchFiles,
    fetchDxFiles,
    handleFileToggleExpand,
    handleDxFileToggleExpand,
    handleFileSelect,
    handleDxFileSelect,
    clearFiles,
  };
};
