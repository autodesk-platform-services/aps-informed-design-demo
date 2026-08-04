import { useState, useEffect, useCallback } from 'react';
import * as accountService from '../services/accountService';
import * as projectService from '../services/projectService';

/**
 * Custom hook for managing accounts and projects.
 * Handles fetching, selection, and auto-restore from localStorage.
 *
 * @param {boolean} isAuthenticated - Whether user is authenticated
 * @returns {Object} Accounts and projects state and methods
 */
export const useAccountsProjects = (isAuthenticated) => {
  const [accAccounts, setAccAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accProjects, setAccProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState(null);

  const fetchAccAccounts = useCallback(async (accessToken) => {
    try {
      setLoadingAccounts(true);
      const hubs = await accountService.fetchAccounts(accessToken);
      setAccAccounts(hubs);
      return hubs;
    } catch (err) {
      throw new Error(`Failed to load ACC accounts: ${err.message}`);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const fetchAccProjects = useCallback(async (accessToken, hubId) => {
    if (!hubId) {
      setAccProjects([]);
      setSelectedProject(null);
      setProjectsError(null);
      return;
    }

    try {
      setLoadingProjects(true);
      setProjectsError(null);
      const projects = await projectService.fetchProjects(accessToken, hubId);
      setAccProjects(projects);
      return projects;
    } catch (err) {
      // This used to swallow the error and just empty the list, which rendered
      // as a bare "No projects" — indistinguishable from a hub that genuinely
      // has none, and with no way to tell that a request had failed at all.
      setAccProjects([]);
      setSelectedProject(null);
      setProjectsError(err?.message || 'Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const handleAccountChange = useCallback(async (hubId) => {
    if (!hubId) {
      setSelectedAccount(null);
      setSelectedProject(null);
      setAccProjects([]);
      setProjectsError(null);
      localStorage.removeItem('saved_account_id');
      localStorage.removeItem('saved_project_id');
      return;
    }

    const isAccountChanging = selectedAccount && selectedAccount !== hubId;

    setSelectedAccount(hubId);
    setSelectedProject(null);
    setAccProjects([]);

    localStorage.setItem('saved_account_id', hubId);

    if (isAccountChanging) {
      localStorage.removeItem('saved_project_id');
      localStorage.removeItem('saved_folder_id');
    }

    const accessToken = localStorage.getItem('aps_access_token');
    if (accessToken && hubId) {
      await fetchAccProjects(accessToken, hubId);
    } else if (hubId) {
      // Projects were just cleared above, so returning quietly here leaves a
      // selected hub next to an empty "No projects" dropdown and no clue why.
      setProjectsError('Not signed in, or the session expired. Sign in again to load projects.');
    }
  }, [selectedAccount, fetchAccProjects]);

  const handleProjectChange = useCallback(async (projectId) => {
    setSelectedProject(projectId);
    localStorage.removeItem('saved_folder_id');

    if (projectId) {
      localStorage.setItem('saved_project_id', projectId);
    } else {
      localStorage.removeItem('saved_project_id');
    }
  }, []);

  // Auto-select saved account when accounts are loaded
  useEffect(() => {
    if (isAuthenticated && accAccounts.length > 0 && !selectedAccount) {
      const savedAccountId = localStorage.getItem('saved_account_id');
      if (savedAccountId) {
        const accountExists = accAccounts.find(acc => acc.id === savedAccountId || acc.hubId === savedAccountId);
        if (accountExists) {
          const accessToken = localStorage.getItem('aps_access_token');
          if (accessToken) {
            handleAccountChange(savedAccountId);
          }
        } else {
          localStorage.removeItem('saved_account_id');
        }
      }
    }
  }, [isAuthenticated, accAccounts, selectedAccount, handleAccountChange]);

  // Auto-select saved project when projects are loaded
  useEffect(() => {
    if (isAuthenticated && accProjects.length > 0 && selectedAccount && !selectedProject) {
      const savedProjectId = localStorage.getItem('saved_project_id');
      if (savedProjectId) {
        const projectExists = accProjects.find(proj => proj.id === savedProjectId || proj.projectId === savedProjectId);
        if (projectExists) {
          handleProjectChange(savedProjectId);
        } else {
          localStorage.removeItem('saved_project_id');
        }
      }
    }
  }, [isAuthenticated, accProjects, selectedAccount, selectedProject, handleProjectChange]);

  // Auto-fetch accounts when authenticated
  useEffect(() => {
    if (isAuthenticated && accAccounts.length === 0) {
      const accessToken = localStorage.getItem('aps_access_token');
      if (accessToken) {
        fetchAccAccounts(accessToken).catch(() => {
          // Silent fail - accounts might not be available
        });
      }
    }
  }, [isAuthenticated, accAccounts.length, fetchAccAccounts]);

  return {
    accAccounts,
    selectedAccount,
    loadingAccounts,
    accProjects,
    selectedProject,
    loadingProjects,
    projectsError,
    fetchAccAccounts,
    fetchAccProjects,
    handleAccountChange,
    handleProjectChange,
  };
};
