import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './utils/config';
import logger from './utils/logger';
import { getHostInfo } from './utils/capability';
import {
  analyzeDocuments,
  getReport,
  getUserReports,
  downloadReportPDF,
  deleteReport,
} from './handlers/analysis';
import { getPatientContext, savePatientContext } from './handlers/patientContext';
import {
  validateBody,
  validateQuery,
  validateParams,
  analyzeBodySchema,
  getReportsQuerySchema,
  reportIdParam,
  patientContextQuerySchema,
  savePatientContextBodySchema,
} from './utils/validation';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In development, be more permissive - allow localhost, 127.0.0.1, and local network IPs
      if (config.env === 'development') {
        // Allow localhost variants
        if (
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:') ||
          origin.startsWith('http://192.168.') ||
          origin.startsWith('http://10.') ||
          origin.startsWith('http://172.')
        ) {
          return callback(null, true);
        }
      }
      
      // In production, use strict origin list
      const allowedOrigins = [
        config.cors.origin,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ];
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin', { origin, allowedOrigins, environment: config.env });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// API Routes — with Zod request validation
app.post('/api/analyze', validateBody(analyzeBodySchema), analyzeDocuments);
app.get('/api/reports/:reportId', validateParams(reportIdParam), getReport);
app.get('/api/reports', validateQuery(getReportsQuerySchema), getUserReports);
app.delete('/api/reports/:reportId', validateParams(reportIdParam), deleteReport);
app.get('/api/reports/:reportId/pdf', validateParams(reportIdParam), downloadReportPDF);
app.get('/api/patient-context', validateQuery(patientContextQuerySchema), getPatientContext);
app.post('/api/patient-context', validateBody(savePatientContextBodySchema), savePatientContext);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: config.env === 'development' ? err.message : undefined,
  });
});

// Start server (skip in test environment — supertest binds its own port)
if (config.env !== 'test') {
  const server = app.listen(config.port, config.host, () => {
    const hostInfo = getHostInfo();
    logger.info('HealthWeave backend started', {
      environment: config.env,
      host: config.host,
      port: config.port,
      awsEndpoint: config.aws.endpoint || 'production AWS',
      bedrockModel: config.bedrock.modelId,
      aiMode: config.aiMode,
    });
    logger.info('Local LLM capability', {
      tier: config.localLLM.tier,
      ramGB: hostInfo.ramGB,
      cores: hostInfo.cores,
      platform: hostInfo.platform,
      arch: hostInfo.arch,
      model: config.localLLM.model,
      numCtx: config.localLLM.numCtx,
      maxDocs: config.localLLM.maxDocs,
      maxTotalBytesMB: Math.round(config.localLLM.maxTotalBytes / (1024 * 1024)),
      ollamaBaseUrl: config.localLLM.ollamaBaseUrl,
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

export default app;
