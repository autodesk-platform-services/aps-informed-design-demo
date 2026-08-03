import { useState, useEffect, useCallback } from 'react';
import * as folderService from '../services/folderService';

/*
 * Tree helpers live at module scope on purpose. They are pure functions of their
 * arguments — they close over no state — and defining them inside the hook gave
 * them a new identity on every render, which is what made the effects below
 * either lie about their dependencies or risk re-running forever.
 */

/**
 * Whether `folderId` exists anywhere in the tree.
 */
const findFolderInTree = (folder, folderId) => {
  if (!folder) return false;
  if (folder.id === folderId) return true;
  if (folder.children) {
    return folder.children.some((child) => findFolderInTree(child, folderId));
  }
  return false;
};

/**
 * Add every ancestor of `targetId` to `expandedSet`, so a restored selection is
 * visible rather than buried in a collapsed branch. Mutates `expandedSet`.
 */
const expandParentFolders = (folder, targetId, expandedSet) => {
  if (!folder || !folder.children) return false;

  for (const child of folder.children) {
    if (child.id === targetId) {
      expandedSet.add(folder.id);
      return true;
    }
    const found = expandParentFolders(child, targetId, expandedSet);
    if (found) {
      expandedSet.add(folder.id);
      return true;
    }
  }
  return false;
};

/**
 * Custom hook for managing folder tree and selection.
 * Handles folder structure, selection, and expansion state.
 *
 * @param {string} selectedAccount - Currently selected account ID
 * @param {string} selectedProject - Currently selected project ID
 * @returns {Object} Folders state and methods
 */
export const useFolders = (selectedAccount, selectedProject) => {
  const [folders, setFolders] = useState([]);
  const [folderTree, setFolderTree] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [loadingFolders, setLoadingFolders] = useState(false);

  /**
   * Fetch folders for the current project and build tree structure.
   */
  const fetchFolders = useCallback(async (accessToken, projectId) => {
    if (!projectId || !selectedAccount) {
      setFolders([]);
      setSelectedFolder(null);
      return;
    }

    try {
      setLoadingFolders(true);
      const foldersList = await folderService.fetchFolders(accessToken, projectId, selectedAccount);
      setFolders(foldersList);

      // Build folder tree structure
      if (foldersList.length > 0) {
        // The root folder contains children like "Photos", "Plans", "Project Files", etc.
        // We need to find "Project Files" and only show its contents
        const rootFolder = foldersList[0];
        const projectFilesFolder = rootFolder.children?.find(
          child => child.name === 'Project Files' || child.attributes?.name === 'Project Files'
        );

        if (projectFilesFolder) {
          // Show only the children of Project Files, not Project Files itself
          // But we need to render them as a tree starting from Project Files
          setFolderTree(projectFilesFolder);
          // Auto-expand Project Files folder
          setExpandedFolders(new Set([projectFilesFolder.id]));
        } else if (rootFolder.name === 'Project Files' || rootFolder.attributes?.name === 'Project Files') {
          // If the root folder itself is "Project Files", use it directly
          setFolderTree(rootFolder);
          setExpandedFolders(new Set([rootFolder.id]));
        } else {
          // Fallback: if we can't find Project Files, show root folder's children
          // This shouldn't happen, but handle it gracefully
          setFolderTree({ ...rootFolder, children: rootFolder.children || [] });
        }
      } else {
        setFolderTree(null);
      }
    } catch (err) {
      setFolders([]);
      // Don't clear selectedFolder on error - preserve it if it was set
    } finally {
      setLoadingFolders(false);
    }
  }, [selectedAccount]);

  /**
   * Select a folder and save to localStorage.
   */
  const handleFolderSelect = useCallback((folderId) => {
    setSelectedFolder(folderId);

    // Save folder selection to localStorage
    if (folderId) {
      localStorage.setItem('saved_folder_id', folderId);
    } else {
      localStorage.removeItem('saved_folder_id');
    }
  }, []);

  /**
   * Toggle folder expansion state.
   */
  const toggleFolder = useCallback((folderId) => {
    setExpandedFolders(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(folderId)) {
        newExpanded.delete(folderId);
      } else {
        newExpanded.add(folderId);
      }
      return newExpanded;
    });
  }, []);

  /**
   * Clear all folder state.
   */
  const clearFolders = useCallback(() => {
    setFolders([]);
    setFolderTree(null);
    setSelectedFolder(null);
    setExpandedFolders(new Set());
  }, []);

  /**
   * Auto-restore saved folder selection.
   */
  const restoreSavedFolder = useCallback(() => {
    const savedFolderId = localStorage.getItem('saved_folder_id');
    if (savedFolderId && folderTree) {
      // Check if the folder exists in the tree
      const folderExists = findFolderInTree(folderTree, savedFolderId);
      if (folderExists) {
        setSelectedFolder(savedFolderId);
        return savedFolderId;
      } else {
        localStorage.removeItem('saved_folder_id');
      }
    }
    return null;
  }, [folderTree]);


  // Auto-fetch folders when selectedProject changes
  useEffect(() => {
    if (selectedProject) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken && selectedAccount) {
        fetchFolders(accessToken, selectedProject);
      }
    }
  }, [selectedProject, selectedAccount, fetchFolders]);

  // Auto-select saved folder when folders are loaded
  useEffect(() => {
    if (folderTree && selectedProject) {
      const savedFolderId = localStorage.getItem('saved_folder_id');
      if (savedFolderId && selectedFolder !== savedFolderId) {
        // Check if folder exists in tree
        if (findFolderInTree(folderTree, savedFolderId)) {
          // Restore folder selection
          setSelectedFolder(savedFolderId);

          // Expand parent folders. Updated from the previous value rather than
          // from `expandedFolders` captured in scope, so this effect does not
          // have to depend on the state it writes — which would re-run it on
          // every expand.
          setExpandedFolders((prev) => {
            const newExpanded = new Set(prev);
            expandParentFolders(folderTree, savedFolderId, newExpanded);
            return newExpanded;
          });
        } else {
          // Saved folder doesn't exist, clear it
          localStorage.removeItem('saved_folder_id');
          if (selectedFolder === savedFolderId) {
            setSelectedFolder(null);
          }
        }
      }
    }
  }, [folderTree, selectedProject, selectedFolder]);

  return {
    // State
    folders,
    folderTree,
    selectedFolder,
    expandedFolders,
    loadingFolders,

    // Setters (for direct manipulation if needed)
    setFolders,
    setFolderTree,
    setSelectedFolder,
    setExpandedFolders,

    // Methods
    fetchFolders,
    handleFolderSelect,
    toggleFolder,
    clearFolders,
    restoreSavedFolder,
  };
};
