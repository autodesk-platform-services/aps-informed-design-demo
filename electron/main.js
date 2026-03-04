const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn, fork } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');

// Create log file for debugging
const logFile = path.join(os.homedir(), 'ind-demo-electron.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function logToFile(message) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
}

// Override console.log and console.error to also write to file
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  originalLog.apply(console, args);
  logToFile('[LOG] ' + args.join(' '));
};

console.error = function(...args) {
  originalError.apply(console, args);
  logToFile('[ERROR] ' + args.join(' '));
};

console.log('Logging to:', logFile);

const BACKEND_PORT = 8080;
const FRONTEND_PORT = 3000;

let mainWindow = null;
let backendProcess = null;
let isBackendStarting = false;
let isAppQuitting = false;

// Determine if we're in development or production
const isDev = !app.isPackaged;
const isProduction = app.isPackaged;

// Paths
// In production, backend is unpacked from asar to app.asar.unpacked
const backendPath = isProduction
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'server.js')
  : path.join(__dirname, '..', 'backend', 'server.js');

// Frontend is in the asar archive
const frontendPath = isProduction
  ? path.join(process.resourcesPath, 'app.asar', 'frontend', 'build', 'index.html')
  : `http://localhost:${FRONTEND_PORT}`;

function createWindow() {
  // Prevent multiple windows
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  // Preload script path - in production it's in app.asar, in dev it's in electron folder
  const preloadPath = isProduction
    ? path.join(process.resourcesPath, 'app.asar', 'electron', 'preload.js')
    : path.join(__dirname, 'preload.js');

  console.log('Preload script path:', preloadPath);
  console.log('Preload script exists:', fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disable web security to allow OAuth in Electron window
      allowRunningInsecureContent: true, // Allow insecure content for OAuth
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  // Set a custom user agent to make Electron look more like a regular browser
  // This helps with OAuth pages that might block Electron
  // Use a generic Chrome user agent that works across platforms
  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  // Clear any cached data that might cause OAuth issues on Windows
  mainWindow.webContents.session.clearStorageData({
    storages: ['cookies', 'localstorage', 'sessionstorage', 'cachestorage']
  }).catch(err => console.log('Could not clear storage:', err));
  
  // Log all console messages from the renderer process for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console ${level}]`, message, `(${sourceId}:${line})`);
  });
  
  // Log when the page starts loading
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[did-start-loading] Page started loading:', mainWindow.webContents.getURL());
  });
  
  // Log when the page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[did-finish-load] Page finished loading:', mainWindow.webContents.getURL());
  });
  
  // Log navigation events
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('[did-navigate] Navigated to:', url);
  });
  
  // Log navigation within page (hash changes, etc.)
  mainWindow.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
    if (isMainFrame) {
      console.log('[did-navigate-in-page] Navigated in page to:', url);
    }
  });

  // Intercept navigation to handle OAuth redirects
  // When OAuth redirects to http://localhost:8080, load it in the Electron window
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const url = new URL(navigationUrl);
      console.log('[will-navigate] Navigation attempt to:', navigationUrl);
      console.log('[will-navigate] Hostname:', url.hostname);
      
      // Allow OAuth authorization URLs (Autodesk login page) - load in Electron window
      if (url.hostname === 'developer.api.autodesk.com' && url.pathname.includes('/authentication/')) {
        console.log('[will-navigate] Allowing OAuth authorization URL in Electron window:', navigationUrl);
        // Allow the navigation - user will log in in Electron window
        return;
      }
      
      // If navigating to localhost:3000 or localhost:8080 (OAuth redirect), allow it
      if (url.hostname === 'localhost' && (url.port === '8080' || url.port === '3000' || (!url.port && url.protocol === 'http:'))) {
        console.log('[will-navigate] Allowing OAuth redirect to:', navigationUrl);
        // Allow the navigation - it will load in the Electron window
        // The backend will serve the React app on port 3000
        return;
      }
      
      // Allow all Autodesk and Okta domains (OAuth flow pages) - be very permissive
      if (url.hostname.endsWith('.autodesk.com') || 
          url.hostname.endsWith('.okta.com') ||
          url.hostname === 'autodesk.com' ||
          url.hostname === 'okta.com' ||
          url.hostname.includes('okta') ||
          url.hostname.includes('autodesk')) {
        console.log('[will-navigate] Allowing Autodesk/Okta page:', navigationUrl);
        return;
      }
      
      // Allow Microsoft login domains (Azure AD authentication)
      if (url.hostname.endsWith('.microsoftonline.com') ||
          url.hostname === 'login.microsoftonline.com' ||
          url.hostname.includes('microsoftonline') ||
          url.hostname.endsWith('.microsoft.com') ||
          url.hostname.includes('microsoft')) {
        console.log('[will-navigate] Allowing Microsoft login page:', navigationUrl);
        return;
      }
      
      // For file:// URLs, allow navigation
      if (url.protocol === 'file:') {
        console.log('[will-navigate] Allowing file:// URL:', navigationUrl);
        return;
      }
      
      // For https:// URLs from trusted domains, allow them
      if (url.protocol === 'https:') {
        console.log('[will-navigate] Allowing HTTPS navigation to:', navigationUrl);
        return;
      }
      
      // Prevent other external navigations
      console.log('[will-navigate] Preventing navigation to:', navigationUrl);
      event.preventDefault();
    } catch (err) {
      console.error('[will-navigate] Error parsing navigation URL:', err, 'URL:', navigationUrl);
      // If we can't parse the URL, allow it (might be a relative URL or special format)
      console.log('[will-navigate] Allowing unparseable URL (might be relative):', navigationUrl);
    }
  });

  // Handle new window requests (e.g., OAuth popup or external links)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      console.log('New window request for:', url);
      
      // If it's the OAuth redirect URL (port 8080 or 3000), load it in the current window
      if (parsedUrl.hostname === 'localhost' && (parsedUrl.port === '8080' || parsedUrl.port === '3000' || (!parsedUrl.port && parsedUrl.protocol === 'http:'))) {
        console.log('Loading OAuth redirect in current window:', url);
        // Use setTimeout to ensure the current navigation completes
        setTimeout(() => {
          mainWindow.loadURL(url);
        }, 100);
        return { action: 'deny' }; // Don't open a new window
      }
      // For OAuth authorization URLs, load in current window
      if (parsedUrl.hostname === 'developer.api.autodesk.com' ||
          parsedUrl.hostname.endsWith('.autodesk.com') ||
          parsedUrl.hostname.endsWith('.okta.com') ||
          parsedUrl.hostname.endsWith('.microsoftonline.com') ||
          parsedUrl.hostname === 'login.microsoftonline.com' ||
          parsedUrl.hostname.includes('okta') ||
          parsedUrl.hostname.includes('autodesk') ||
          parsedUrl.hostname.includes('microsoft')) {
        console.log('Loading OAuth page in current window:', url);
        setTimeout(() => {
          mainWindow.loadURL(url);
        }, 100);
        return { action: 'deny' };
      }
      // Allow other URLs to open in external browser
      return { action: 'allow' };
    } catch (err) {
      console.error('Error parsing window open URL:', err);
      return { action: 'deny' };
    }
  });

  // Log when the window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    const currentUrl = mainWindow.webContents.getURL();
    console.log('Window finished loading:', currentUrl);
    
    // Check if we're on the OAuth callback URL
    if (currentUrl.includes('localhost:8080') && currentUrl.includes('code=')) {
      console.log('OAuth callback detected in did-finish-load');
    }
    
    // Inject a check to verify electronAPI is available
    mainWindow.webContents.executeJavaScript(`
      console.log('Checking electronAPI in renderer...');
      console.log('window.electronAPI:', typeof window.electronAPI !== 'undefined' ? 'available' : 'NOT available');
      console.log('window.__electronAPI:', typeof window.__electronAPI !== 'undefined' ? 'available' : 'NOT available');
      if (typeof window.electronAPI !== 'undefined') {
        console.log('Backend URL from electronAPI:', window.electronAPI.getBackendUrl());
      }
    `).catch(err => console.error('Failed to execute script:', err));
  });

  // Handle failed page loads (like OAuth errors)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('Page failed to load:', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    });
    
    // If it's an OAuth redirect that failed, try to extract the code from the URL
    if (validatedURL && validatedURL.includes('localhost:8080') && validatedURL.includes('code=')) {
      console.log('OAuth redirect detected in failed load, attempting to handle...');
      // The URL might still be accessible, try loading it
      setTimeout(() => {
        mainWindow.loadURL(validatedURL);
      }, 100);
    }
  });

  // Handle console messages from the renderer (useful for debugging OAuth issues)
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level === 3) { // Error level
      console.error('[Renderer Console Error]', message, 'at', sourceId, ':', line);
    }
  });

  // Load the frontend
  if (isProduction) {
    // loadFile works with asar files automatically
    mainWindow.loadFile(frontendPath);
  } else {
    mainWindow.loadURL(frontendPath);
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    // Prevent multiple backend starts
    if (isBackendStarting || backendProcess) {
      resolve();
      return;
    }

    isBackendStarting = true;

    // Check if backend file exists
    if (!fs.existsSync(backendPath)) {
      console.error(`Backend file not found at: ${backendPath}`);
      isBackendStarting = false;
      reject(new Error(`Backend file not found at: ${backendPath}`));
      return;
    }

    // Use backend-wrapper for ES modules
    // In production, both wrapper and backend are unpacked to app.asar.unpacked
    const wrapperPath = isProduction
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'backend-wrapper.cjs')
      : path.join(__dirname, 'backend-wrapper.cjs');
    
    // In Electron, process.execPath points to the Electron executable, not Node.js
    // We need to use the Node.js binary that comes with Electron
    // In Electron, we can access Node.js via process.execPath but we need to use it differently
    // Actually, Electron's process.execPath CAN run Node.js scripts, but we need to ensure
    // the wrapper file is actually being executed. Let's add more debugging.
    // Use child_process.fork() which uses Electron's bundled Node.js
    // This is the best approach as it uses the same Node.js that Electron is running
    console.log('Wrapper file exists:', fs.existsSync(wrapperPath));
    console.log('Backend file exists:', fs.existsSync(backendPath));
    
    // Set up environment for backend
    const backendDir = isProduction ? path.dirname(backendPath) : path.join(__dirname, '..', 'backend');
    const backendEnv = {
      ...process.env,
      PORT: BACKEND_PORT.toString(),
      NODE_ENV: isProduction ? 'production' : 'development',
      // Ensure Node can find modules in the backend directory
      NODE_PATH: backendDir,
      // Set working directory for module resolution
      PWD: backendDir,
    };
    
    // In production, try to load .env from the backend directory if it exists
    if (isProduction) {
      const envPath = path.join(backendDir, '.env');
      if (fs.existsSync(envPath)) {
        console.log('✅ Found .env file in backend directory');
      } else {
        console.warn('⚠️  No .env file found in backend directory - backend will start but APS calls will fail');
      }
      
      // Verify node_modules exists
      const nodeModulesPath = path.join(backendDir, 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        console.log('✅ Found node_modules in backend directory');
      } else {
        console.error('❌ node_modules NOT FOUND in backend directory!');
        console.error('   Path checked:', nodeModulesPath);
        isBackendStarting = false;
        reject(new Error('Backend node_modules not found'));
        return;
      }
    }
    
    console.log('Starting backend process...');
    console.log('Wrapper path:', wrapperPath);
    console.log('Backend path:', backendPath);
    console.log('Working directory:', isProduction ? path.dirname(backendPath) : path.join(__dirname, '..'));
    
    // Use fork() instead of spawn() - fork() uses Electron's bundled Node.js
    // fork() automatically uses the current Node.js process (Electron's Node.js)
    console.log('Forking backend process with wrapper:', wrapperPath);
    
    backendProcess = fork(wrapperPath, [backendPath], {
      cwd: isProduction ? path.dirname(backendPath) : path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'], // fork() requires 'ipc' channel
      env: backendEnv,
      silent: false, // Don't silence output
    });
    
    console.log('Backend process spawned, PID:', backendProcess.pid);
    
    // Collect all backend output for debugging
    let allStdout = '';
    let allStderr = '';
    
    // Log backend output
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      allStdout += output;
      const lines = output.trim().split('\n').filter(l => l);
      lines.forEach(line => {
        console.log(`[Backend stdout] ${line}`);
      });
    });
    
    backendProcess.stderr.on('data', (data) => {
      const output = data.toString();
      allStderr += output;
      const lines = output.trim().split('\n').filter(l => l);
      lines.forEach(line => {
        console.error(`[Backend stderr] ${line}`);
      });
    });
    
    // If process exits quickly, dump all output
    const quickExitHandler = () => {
      if (allStdout) {
        console.log('=== Full Backend stdout ===');
        console.log(allStdout);
      }
      if (allStderr) {
        console.error('=== Full Backend stderr ===');
        console.error(allStderr);
      }
    };
    
    backendProcess.once('exit', quickExitHandler);

    backendProcess.on('error', (error) => {
      console.error('❌ Failed to spawn backend process:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      isBackendStarting = false;
      backendProcess = null;
      reject(error);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code}, signal ${signal}`);
      isBackendStarting = false;
      backendProcess = null;
      // Only reject if it's an unexpected exit (non-zero) and app is not quitting
      if (code !== 0 && code !== null && !isAppQuitting) {
        const errorMsg = `Backend exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`;
        console.error(errorMsg);
        reject(new Error(errorMsg));
      }
    });

    // Wait for backend to start and verify it's responding
    const checkBackend = () => {
      const maxAttempts = 20; // Increased attempts
      const delay = 500;
      let attempts = 0;
      
      const tryConnect = () => {
        attempts++;
        // Try health check endpoint first (simpler, doesn't require config)
        const req = http.get(`http://localhost:${BACKEND_PORT}/health`, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              console.log('Backend is ready and responding');
              isBackendStarting = false;
              resolve();
            } else {
              if (attempts < maxAttempts) {
                console.log(`Waiting for backend to start... (attempt ${attempts}/${maxAttempts})`);
                setTimeout(tryConnect, delay);
              } else {
                console.warn('Backend did not respond in time, but continuing anyway');
                isBackendStarting = false;
                resolve();
              }
            }
          });
        });
        
        req.on('error', (error) => {
          // Backend not ready yet, continue waiting
          if (attempts < maxAttempts) {
            console.log(`Waiting for backend to start... (attempt ${attempts}/${maxAttempts})`);
            setTimeout(tryConnect, delay);
          } else {
            console.error('Backend failed to start:', error.message);
            console.warn('Continuing anyway - backend may not be running');
            isBackendStarting = false;
            resolve();
          }
        });
        
        req.setTimeout(1000, () => {
          req.destroy();
          if (attempts < maxAttempts) {
            console.log(`Waiting for backend to start... (attempt ${attempts}/${maxAttempts})`);
            setTimeout(tryConnect, delay);
          } else {
            console.warn('Backend did not respond in time, but continuing anyway');
            isBackendStarting = false;
            resolve();
          }
        });
      };
      
      // Start checking after a short delay
      setTimeout(tryConnect, delay);
    };
    
    checkBackend();
  });
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Store OAuth state in main process (persists across origins)
  let oauthState = null;
  
  // Handle IPC call to open external URL
  ipcMain.handle('open-external', (event, url) => {
    console.log('Opening external URL:', url);
    shell.openExternal(url);
    return true;
  });
  
  // Handle IPC calls for OAuth state management
  ipcMain.handle('set-oauth-state', (event, state) => {
    console.log('[IPC] Storing OAuth state:', state);
    oauthState = state;
    return true;
  });
  
  ipcMain.handle('get-oauth-state', (event) => {
    console.log('[IPC] Getting OAuth state:', oauthState);
    return oauthState;
  });
  
  ipcMain.handle('clear-oauth-state', (event) => {
    console.log('[IPC] Clearing OAuth state');
    oauthState = null;
    return true;
  });

  app.whenReady().then(async () => {
    console.log('========================================');
    console.log('Electron app is ready, starting backend...');
    console.log('========================================');
    try {
      await startBackend();
      console.log('✅ Backend started successfully, creating window...');
      createWindow();
    } catch (error) {
      console.error('');
      console.error('========================================');
      console.error('❌ FAILED TO START BACKEND');
      console.error('========================================');
      console.error('Error:', error.message);
      console.error('Error details:', error.stack);
      console.error('');
      console.error('Troubleshooting:');
      console.error('1. Check [Backend stdout] and [Backend stderr] logs above');
      console.error('2. Verify backend/node_modules exists in the app bundle');
      console.error('3. Check if port 8080 is already in use');
      console.error('4. Verify backend files are in app.asar.unpacked/backend/');
      console.error('');
      
      // Show error dialog to user with log file location
      dialog.showErrorBox(
        'Backend Startup Failed',
        `Failed to start backend server:\n\n${error.message}\n\nDetailed logs saved to:\n${logFile}\n\nThe app will continue but login will not work.`
      );
      
      // Still create the window so user can see the error in the UI
      // The frontend will show the connection error
      console.log('Creating window anyway - frontend will show connection error');
      createWindow();
    }

    app.on('activate', () => {
      // On macOS, re-create window when dock icon is clicked and no windows are open
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  isAppQuitting = true;
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

