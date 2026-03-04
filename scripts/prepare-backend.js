/**
 * Prepare Backend for Electron Build
 * 
 * This script prepares the backend for packaging with Electron:
 * 1. Copies necessary files
 * 2. Creates a production-ready package.json
 * 3. Installs production dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendDir = path.join(__dirname, '..', 'backend');
const buildDir = path.join(__dirname, '..', 'backend-build');

console.log('Preparing backend for Electron build...');

// Function to copy file
function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${path.basename(src)}`);
}

// Function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // Skip node_modules
    if (entry.name === 'node_modules') {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// Check if .env exists in backend, warn if not
const envPath = path.join(backendDir, '.env');
if (!fs.existsSync(envPath)) {
  console.warn('\n⚠️  Warning: No .env file found in backend directory.');
  console.warn('   The application will need environment variables to be configured.');
  console.warn('   Copy .env.example to backend/.env and fill in your credentials.\n');
}

// Install production dependencies in backend directory
console.log('Installing backend dependencies...');
try {
  execSync('npm install --omit=dev', {
    cwd: backendDir,
    stdio: 'inherit'
  });
  console.log('Backend dependencies installed successfully!');
} catch (error) {
  console.error('Failed to install backend dependencies:', error.message);
  process.exit(1);
}

console.log('Backend preparation complete!');
console.log('\nNote: Make sure to configure your .env file with APS credentials before running the app.');

