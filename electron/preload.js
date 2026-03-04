const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Get app version
    getAppVersion: () => process.versions.electron,
    
    // Get platform info
    getPlatform: () => process.platform,
    
    // Check if running in Electron
    isElectron: () => true,
    
    // Get backend URL (always localhost in Electron)
    getBackendUrl: () => 'http://localhost:8080',
    
    // Open external URL (for OAuth) - uses IPC to communicate with main process
    openExternal: (url) => {
      ipcRenderer.invoke('open-external', url);
    },
    
    // Store OAuth state (persists across origins in Electron)
    setOAuthState: (state) => {
      ipcRenderer.invoke('set-oauth-state', state);
    },
    
    // Get OAuth state
    getOAuthState: () => {
      return ipcRenderer.invoke('get-oauth-state');
    },
    
    // Clear OAuth state
    clearOAuthState: () => {
      ipcRenderer.invoke('clear-oauth-state');
    }
  });
  
  console.log('Preload script loaded successfully');
  console.log('electronAPI exposed to window');
} catch (error) {
  console.error('Failed to expose electronAPI:', error);
}

// Also set it directly on window as a fallback (for debugging)
// Note: This is less secure but helps with debugging
if (typeof window !== 'undefined') {
  window.__electronAPI = {
    getAppVersion: () => process.versions.electron,
    getPlatform: () => process.platform,
    isElectron: () => true,
    getBackendUrl: () => 'http://localhost:8080',
    openExternal: (url) => {
      // Use IPC as fallback too
      if (ipcRenderer) {
        ipcRenderer.invoke('open-external', url);
      }
    }
  };
  console.log('Fallback electronAPI set on window.__electronAPI');
}

