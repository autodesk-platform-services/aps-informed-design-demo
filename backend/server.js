import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const API_PORT = process.env.PORT || 8080;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000;

// Middleware
app.use(cors());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  
  if (Object.keys(req.query).length > 0) {
    
  }
  if (req.body && Object.keys(req.body).length > 0) {
    
  }
  
  // Log response status when it finishes
  const originalSend = res.send;
  res.send = function(data) {
    
    return originalSend.call(this, data);
  };
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
import authRoutes from './routes/authRoutes.js';
import accRoutes from './routes/accRoutes.js';
import productRoutes from './routes/productRoutes.js';
import variantRoutes from './routes/variantRoutes.js';
import outputRoutes from './routes/outputRoutes.js';
import ossRoutes from './routes/ossRoutes.js';

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Register routes
app.use('/api/aps', authRoutes);
app.use('/api/acc', accRoutes);
app.use('/api/informed-design', productRoutes);
app.use('/api/informed-design/variants', variantRoutes);
app.use('/api/informed-design/outputs', outputRoutes);
app.use('/api/oss', ossRoutes);

// Serve frontend static files in production (for Electron OAuth redirects)
// In Electron, the OAuth redirect goes to http://localhost:8080, so we need to serve the frontend
if (process.env.NODE_ENV === 'production') {
  // Try to find frontend build directory
  // In Electron production:
  // - Backend is in: app.asar.unpacked/backend/server.js
  // - Frontend is in: app.asar/frontend/build
  // - process.resourcesPath points to the Resources directory containing app.asar
  let frontendBuildPath;
  
  // First, try to use process.resourcesPath (available in Electron)
  if (typeof process !== 'undefined' && process.resourcesPath) {
    // In Electron, process.resourcesPath points to the Resources directory
    // app.asar is in that directory, so we can access app.asar/frontend/build
    frontendBuildPath = path.join(process.resourcesPath, 'app.asar', 'frontend', 'build');
    
  }
  
  // If that doesn't exist, try relative path (for development or non-Electron production)
  if (!frontendBuildPath || !fs.existsSync(frontendBuildPath)) {
    frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
    
  }
  
  // Check if frontend build exists
  if (fs.existsSync(frontendBuildPath)) {
    
    app.use(express.static(frontendBuildPath));
    
    // Serve index.html for all non-API routes (for React Router and OAuth redirects)
    // This must be after all API routes but before the 404 handler
    app.get('*', (req, res, next) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith('/api/')) {
        return next(); // Let the 404 handler deal with it
      }
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
  } else {
    
    
    
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error('[Global Error Handler] Stack:', err.stack);
  }
  
  if (!res.headersSent) {
    res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// 404 handler
app.use((req, res) => {
  
  res.status(404).json({ error: 'Route not found' });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', reason?.message || reason);
  if (process.env.NODE_ENV === 'development' && reason?.stack) {
    console.error('[Unhandled Rejection] Stack:', reason.stack);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error('[Uncaught Exception] Stack:', error.stack);
  }
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Start API server on port 8080
app.listen(API_PORT, () => {
  console.log(`[Server] API server listening on port ${API_PORT}`);
});

// In production (Electron), also serve frontend on port 3000 for OAuth redirects
if (process.env.NODE_ENV === 'production') {
  // Create a separate Express app for the frontend server
  const frontendApp = express();
  frontendApp.use(cors());
  frontendApp.use(express.json());
  frontendApp.use(express.urlencoded({ extended: true }));
  
  // Find frontend build directory (same logic as above)
  let frontendBuildPath;
  if (typeof process !== 'undefined' && process.resourcesPath) {
    frontendBuildPath = path.join(process.resourcesPath, 'app.asar', 'frontend', 'build');
  }
  if (!frontendBuildPath || !fs.existsSync(frontendBuildPath)) {
    frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
  }
  
  if (fs.existsSync(frontendBuildPath)) {
    
    frontendApp.use(express.static(frontendBuildPath));
    
    // Proxy API requests to the main server on port 8080
    frontendApp.use('/api', (req, res, next) => {
      // For GET/HEAD requests, skip body parsing
      if (req.method === 'GET' || req.method === 'HEAD') {
        return next();
      }
      // For other methods, parse JSON body
      express.json()(req, res, next);
    }, (req, res) => {
      const http = require('http');
      const url = require('url');
      
      const apiUrl = url.parse(`http://localhost:${API_PORT}${req.originalUrl}`);
      const options = {
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        path: apiUrl.path,
        method: req.method,
        headers: {
          ...req.headers,
          host: undefined,
          'content-length': undefined,
        },
      };
      
      const proxyReq = http.request(options, (proxyRes) => {
        // Copy response headers
        Object.keys(proxyRes.headers).forEach(key => {
          res.setHeader(key, proxyRes.headers[key]);
        });
        res.status(proxyRes.statusCode);
        proxyRes.pipe(res);
      });
      
      proxyReq.on('error', (err) => {
        
        res.status(500).json({ error: 'Failed to proxy API request', details: err.message });
      });
      
      // Only write body for non-GET/HEAD requests
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        const bodyStr = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyStr));
        proxyReq.write(bodyStr);
      }
      proxyReq.end();
    });
    
    // Serve index.html for all non-API routes
    frontendApp.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Route not found' });
      }
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
    
    frontendApp.listen(FRONTEND_PORT, () => {
      
    });
  } else {
    
  }
}
