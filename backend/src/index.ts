import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './utils/config';
import logger from './utils/logger';
import {
  analyzeDocuments,
  getReport,
  getUserReports,
  downloadReportPDF,
} from './handlers/analysis';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
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
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// API Routes
app.post('/api/analyze', analyzeDocuments);
app.get('/api/reports/:reportId', getReport);
app.get('/api/reports', getUserReports);
app.get('/api/reports/:reportId/pdf', downloadReportPDF);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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

// Start server
const server = app.listen(config.port, config.host, () => {
  logger.info('HealthWeave backend started', {
    environment: config.env,
    host: config.host,
    port: config.port,
    awsEndpoint: config.aws.endpoint || 'production AWS',
    bedrockModel: config.bedrock.modelId,
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

export default app;
