# Electron Windows Installer Build Guide

This guide explains how to build a standalone Windows installer for the Informed Design Demo application using Electron.

## Overview

The Electron build packages both the React frontend and Node.js backend into a single Windows installer (.exe). Users can install and run the application without needing Node.js, npm, or any development tools.

## Prerequisites

Before building, you need:

1. **Node.js 18+** installed on your development machine
2. **Windows 10/11** (for building Windows installers)
3. **APS Credentials** configured in `backend/.env`

## Project Structure

```
ind-demo/
├── electron/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Secure IPC bridge
│   └── backend-wrapper.cjs  # ES module loader for backend
├── frontend/                 # React application
├── backend/                  # Express.js API server
├── assets/
│   └── icon.ico             # Windows application icon (you need to add this)
├── scripts/
│   └── prepare-backend.js   # Build preparation script
├── package.json             # Root Electron configuration
└── dist/                    # Build output (created during build)
```

## Setup Steps

### 1. Install Dependencies

```powershell
# Install root dependencies (Electron, electron-builder)
npm install

# This will also install frontend and backend dependencies via postinstall
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# backend/.env
APS_CLIENT_ID=your_client_id_here
APS_CLIENT_SECRET=your_client_secret_here
APS_REDIRECT_URI=http://localhost:3000
PORT=3001
```

**Important:** Get your APS credentials from https://aps.autodesk.com/myapps

### 3. Add Application Icon (Optional but Recommended)

Place a Windows icon file at `assets/icon.ico`. See `assets/README.md` for icon requirements.

If you don't have an icon, the build will still work with a default icon.

### 4. Build the Application

```powershell
# Build everything (frontend + Electron installer)
npm run build
```

This command will:
1. Build the React frontend (`npm run build:frontend`)
2. Prepare the backend (`npm run build:backend`)
3. Package everything into a Windows installer (`npm run build:electron`)

### 5. Find Your Installer

After a successful build, find your installer in:

```
dist/
├── Informed Design Demo Setup 1.0.0.exe  # NSIS installer
└── win-unpacked/                          # Unpacked app (for testing)
```

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Full build (frontend + backend + installer) |
| `npm run build:frontend` | Build only the React frontend |
| `npm run build:backend` | Prepare backend for packaging |
| `npm run build:electron` | Build Windows installer |
| `npm run pack` | Create unpacked build (faster, for testing) |
| `npm start` | Run Electron in development mode |
| `npm run start:dev` | Run with hot-reload (frontend + backend + Electron) |

## Development Mode

For development with hot-reload:

```powershell
# Terminal 1: Start the React dev server
cd frontend
npm start

# Terminal 2: Start the backend server
cd backend
npm start

# Terminal 3: Start Electron (after frontend is ready)
npm start
```

Or use the combined command:
```powershell
npm run start:dev
```

## Configuration

### Changing the App Name/Version

Edit the root `package.json`:

```json
{
  "name": "ind-demo-desktop",
  "version": "1.0.0",
  "build": {
    "productName": "Informed Design Demo",
    "appId": "com.autodesk.informed-design-demo"
  }
}
```

### Installer Options

The installer is configured in `package.json` under `build.nsis`:

```json
{
  "nsis": {
    "oneClick": false,           // Show installation wizard
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Informed Design Demo"
  }
}
```

### Changing Ports

Edit `electron/main.js`:

```javascript
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 3000;
```

## Troubleshooting

### Build Fails with "icon.ico not found"

Either:
- Add an icon file at `assets/icon.ico`
- Or remove the icon references from `package.json` build config

### Backend doesn't start

1. Check that `backend/.env` exists with valid APS credentials
2. Ensure port 3001 is not in use
3. Check the developer console (Ctrl+Shift+I in the app) for errors

### Frontend shows blank screen

1. Make sure the frontend was built: `npm run build:frontend`
2. Check that `frontend/build/` exists and contains `index.html`
3. Check the console for CORS or loading errors

### "Cannot find module" errors

Run `npm install` in the root directory to ensure all dependencies are installed.

## Distribution

### Code Signing (Recommended for Production)

For production distribution, you should code-sign your application to avoid Windows SmartScreen warnings:

1. Obtain a code signing certificate
2. Add to `package.json`:

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "your-password"
    }
  }
}
```

Or use environment variables:
- `CSC_LINK`: Path to certificate
- `CSC_KEY_PASSWORD`: Certificate password

### Auto-Updates (Future Enhancement)

To add auto-updates, consider using `electron-updater`:

1. Add to dependencies: `npm install electron-updater`
2. Configure a update server or use GitHub Releases
3. Add update checking logic to `electron/main.js`

## File Sizes

Typical build sizes:
- Installer: ~80-120 MB
- Installed application: ~200-300 MB

The size is primarily from:
- Electron runtime (~150 MB)
- Node.js modules
- React build

## Security Notes

1. **Environment Variables**: The `.env` file with APS credentials is copied into the build. For production apps, consider:
   - Using a secure credential storage system
   - Implementing user-level authentication
   - Using electron-store for encrypted local storage

2. **Context Isolation**: The app uses `contextIsolation: true` for security

3. **Node Integration**: Disabled in renderer for security (`nodeIntegration: false`)

## Support

For issues with:
- **APS/ACC APIs**: Check https://aps.autodesk.com/developer/documentation
- **Electron**: Check https://www.electronjs.org/docs
- **electron-builder**: Check https://www.electron.build/


