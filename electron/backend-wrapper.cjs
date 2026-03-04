/**
 * Backend Wrapper for Electron
 * 
 * This CommonJS wrapper is used to load the ES module backend server
 * from within Electron's Node.js environment.
 * 
 * Usage: node backend-wrapper.cjs <path-to-server.js>
 */

// Immediate output to verify wrapper is executing
process.stdout.write('=== BACKEND WRAPPER STARTING ===\n');
process.stderr.write('=== BACKEND WRAPPER STARTING (stderr) ===\n');

const path = require('path');
const fs = require('fs');

// Get the server path from command line arguments
const serverPath = process.argv[2];

process.stdout.write(`Received server path: ${serverPath || 'NOT PROVIDED'}\n`);

if (!serverPath) {
  console.error('Error: Server path not provided');
  console.error('Usage: node backend-wrapper.cjs <path-to-server.js>');
  process.exit(1);
}

// Resolve the absolute path
const absoluteServerPath = path.isAbsolute(serverPath) 
  ? serverPath 
  : path.resolve(process.cwd(), serverPath);

// Check if the file exists
if (!fs.existsSync(absoluteServerPath)) {
  console.error(`Error: Server file not found at: ${absoluteServerPath}`);
  process.exit(1);
}

// Convert to file URL for ES module import
const serverUrl = `file://${absoluteServerPath.replace(/\\/g, '/')}`;

// Use process.stdout.write to ensure output is flushed immediately
const log = (msg) => {
  process.stdout.write(msg + '\n');
  // Node.js doesn't have flush(), but we can use setImmediate to ensure output
  if (typeof setImmediate !== 'undefined') {
    setImmediate(() => {});
  }
};

log(`Starting backend server from: ${absoluteServerPath}`);
log(`Current working directory: ${process.cwd()}`);
log(`NODE_PATH: ${process.env.NODE_PATH || 'not set'}`);
log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
log(`PORT: ${process.env.PORT || 'not set'}`);

// Dynamically import the ES module server
async function startServer() {
  try {
    log('Attempting to import backend server from: ' + serverUrl);
    log('Current working directory: ' + process.cwd());
    log('NODE_PATH: ' + (process.env.NODE_PATH || 'not set'));
    log('NODE_ENV: ' + (process.env.NODE_ENV || 'not set'));
    
    // Import the ES module
    const serverModule = await import(serverUrl);
    log('✅ Backend server module imported successfully');
    log('Module exports: ' + Object.keys(serverModule).join(', '));
    
    // Keep the process alive - the server should start when imported
    // But wait a bit to see if there are any immediate errors
    await new Promise(resolve => setTimeout(resolve, 2000));
    log('✅ Backend server should be running now');
  } catch (error) {
    const errorMsg = [
      '❌ Failed to start backend server:',
      'Error name: ' + error.name,
      'Error message: ' + error.message,
      'Error stack: ' + (error.stack || 'no stack'),
      error.code ? 'Error code: ' + error.code : '',
      error.cause ? 'Error cause: ' + error.cause : ''
    ].filter(Boolean).join('\n');
    
    process.stderr.write(errorMsg + '\n');
    if (typeof setImmediate !== 'undefined') {
      setImmediate(() => {});
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const errorMsg = [
    '❌ Unhandled Promise Rejection:',
    'Reason: ' + reason,
    'Promise: ' + promise,
    reason instanceof Error ? 'Error stack: ' + reason.stack : ''
  ].filter(Boolean).join('\n');
  
  process.stderr.write(errorMsg + '\n');
  process.stderr.flush && process.stderr.flush();
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const errorMsg = [
    '❌ Uncaught Exception:',
    'Error: ' + error,
    'Stack: ' + (error.stack || 'no stack')
  ].filter(Boolean).join('\n');
  
  process.stderr.write(errorMsg + '\n');
  process.stderr.flush && process.stderr.flush();
  process.exit(1);
});

// Start the server and handle errors
startServer().catch((error) => {
  const errorMsg = [
    '❌ startServer() failed:',
    'Error: ' + error,
    'Stack: ' + (error.stack || 'no stack')
  ].filter(Boolean).join('\n');
  
  process.stderr.write(errorMsg + '\n');
  process.stderr.flush && process.stderr.flush();
  process.exit(1);
});

