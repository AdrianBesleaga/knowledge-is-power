import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initFirebase } from './config/firebase';
import { initNeo4j, closeNeo4j } from './config/neo4j';
import { initMongoDB, closeMongoDB } from './config/mongodb';
import graphRoutes from './routes/graph';
import userRoutes from './routes/user';
import timelineRoutes from './routes/timeline';

// Load environment variables
// Resolve .env path relative to backend directory
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Verify critical environment variables are loaded
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY is not set in .env file');
  console.error('   Please make sure:');
  console.error('   1. You have a .env file in the backend/ directory');
  console.error('   2. It contains: OPENAI_API_KEY=sk-your-key-here');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
}));
app.use(express.json());

// Request logging middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${clientIp}`);
  
  // Log request body for POST/PUT/PATCH (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    // Remove sensitive fields from logs
    if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
    if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';
    if (sanitizedBody.privateKey) sanitizedBody.privateKey = '[REDACTED]';
    console.log(`[${timestamp}] Request body:`, JSON.stringify(sanitizedBody, null, 2));
  }
  
  // Log query parameters if present
  if (Object.keys(req.query).length > 0) {
    console.log(`[${timestamp}] Query params:`, req.query);
  }
  
  // Capture response finish to log status and duration
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 500 ? '🔴' : res.statusCode >= 400 ? '🟡' : '🟢';
    console.log(
      `[${new Date().toISOString()}] ${statusColor} ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
  });
  
  next();
});

// Initialize services
try {
  initFirebase();
  console.log('✅ Firebase initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

try {
  initNeo4j();
  console.log('✅ Neo4j initialized');
} catch (error) {
  console.error('❌ Failed to initialize Neo4j:', error);
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/graph', graphRoutes);
app.use('/api/user', userRoutes);
app.use('/api/timeline', timelineRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize MongoDB and start server
(async () => {
  try {
    await initMongoDB();
    console.log('✅ MongoDB initialized');
  } catch (error) {
    console.error('❌ Failed to initialize MongoDB:', error);
    process.exit(1);
  }

  // Start server
  // Bind to 0.0.0.0 to accept connections from all network interfaces (required for fly.io, Railway, etc.)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Frontend URL: ${FRONTEND_URL}`);
    console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    server.close(async () => {
      console.log('✅ HTTP server closed');
      
      try {
        await closeNeo4j();
        console.log('✅ Neo4j connection closed');
      } catch (error) {
        console.error('❌ Error closing Neo4j:', error);
      }
      
      try {
        await closeMongoDB();
        console.log('✅ MongoDB connection closed');
      } catch (error) {
        console.error('❌ Error closing MongoDB:', error);
      }
      
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();


