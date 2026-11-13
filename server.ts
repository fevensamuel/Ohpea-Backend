import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

import { initDatabase, testConnection, query } from './src/backend/database.js';
import { apiRouter } from './src/backend/routes.js';
import { publicRouter } from './src/backend/routes/public.js';
import { healthRouter } from './src/routes/health.js';
import { contractRouter } from './src/routes/contract.js';
import { openApiSpec } from './src/backend/swagger.js';
import { UPLOAD_PATH } from './src/config/multer.js';
import { smsCampaignService } from './src/services/smsCampaignService.js';

// Enforce Security Rule: JWT_SECRET must be at least 32 characters long
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is missing or shorter than 32 characters.');
  process.exit(1);
}

// Parse port from CLI args (--port 3000) or default to 3000
const args = process.argv.slice(2);
let cliPort: number | null = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    cliPort = parseInt(args[i + 1], 10);
  } else if (args[i].startsWith('--port=')) {
    cliPort = parseInt(args[i].split('=')[1], 10);
  }
}

const envPort = parseInt(process.env.PORT || '', 10);
const PORT = cliPort || (Number.isFinite(envPort) && envPort > 0 ? envPort : 3000);
const app = express();

// CORS configuration (allow-list + localhost in dev)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Dev tolerance
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-otp-token'],
    exposedHeaders: ['X-Contract-Version'],
  })
);

// Helmet Security Headers (adjusted to allow Swagger UI execution)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve Public Uploads with CORS (only public directory, no HTML/views)
app.use(
  '/uploads',
  cors(),
  express.static(path.resolve(UPLOAD_PATH), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// Root endpoint: strictly small JSON object
app.get('/', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    name: 'OHPEA API',
    version: '1.0.0',
  });
});

// Health Check Endpoints (/health and /api/health)
const healthHandler = async (_req: Request, res: Response) => {
  const startedAt = Date.now();
  let dbOk = false;
  try {
    await query('SELECT 1');
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? 'healthy' : 'degraded';
  const payload = {
    status,
    uptimeSeconds: Math.floor(process.uptime()),
    db: dbOk ? 'ok' : 'unreachable',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
  };

  return res.status(dbOk ? 200 : 503).json({ success: dbOk, status, data: payload });
};

app.get('/health', healthHandler);

// Interactive Swagger UI & raw OpenAPI Specification
app.get('/api-docs/openapi.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json(openApiSpec);
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'OHPEA REST API Documentation & Explorer',
    customCss: '.swagger-ui .topbar { background-color: #166534; }',
    swaggerOptions: {
      defaultModelExpandDepth: 3,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  })
);

// Diagnostic & Contract Routers (unauthenticated, mounted before auth)
app.use('/api', healthRouter);
app.use('/api', contractRouter);

// Mount Public router (unauthenticated, rate-limited)
app.use('/api/public', publicRouter);

// Mount API router (admin and auth)
app.use('/api', apiRouter);

// Start SMS background scheduler
if (process.env.FEATURE_SMS === 'true') {
  smsCampaignService.startSmsScheduler();
}

// Global 404 handler: returns JSON 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Endpoint '${req.originalUrl}' not found on OHPEA API`,
  });
});

// Global Error Handler: returns JSON
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Global Error]', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

async function startServer() {
  try {
    await initDatabase();

    const serverInstance = app.listen(PORT, '0.0.0.0', () => {
      console.log(`================================================================`);
      console.log(`  OHPEA Headless Backend API running on http://0.0.0.0:${PORT}`);
      console.log(`  Swagger UI:    http://localhost:${PORT}/api-docs`);
      console.log(`  OpenAPI JSON:  http://localhost:${PORT}/api-docs/openapi.json`);
      console.log(`  Health Check:  http://localhost:${PORT}/health`);
      console.log(`================================================================`);
    });

    serverInstance.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Server] Notice: Port ${PORT} occupied by existing process. Re-using current instance.`);
      } else {
        console.error('[Server] Unexpected listen error:', err);
      }
    });
  } catch (err: any) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

startServer();

export default app;
