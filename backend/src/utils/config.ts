import dotenv from 'dotenv';
import { Config } from '../types';

// Load environment variables
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
dotenv.config(); // fallback to .env

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || 'localhost',
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT, // Only set for LocalStack
  },
  bedrock: {
    modelId: process.env.BEDROCK_MODEL_ID || 'mistral',
  },
  s3: {
    bucketName: process.env.S3_BUCKET_NAME || 'healthweave-patient-data',
    bucketRegion: process.env.S3_BUCKET_REGION || 'us-east-1',
  },
  dynamodb: {
    reportsTable: process.env.DYNAMODB_TABLE_REPORTS || 'healthweave-reports',
    auditTable: process.env.DYNAMODB_TABLE_AUDIT || 'healthweave-audit-logs',
  },
  cognito: process.env.COGNITO_USER_POOL_ID
    ? {
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        clientId: process.env.COGNITO_CLIENT_ID || '',
      }
    : undefined,
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
    encryptionKey: process.env.ENCRYPTION_KEY || 'change-this-32-char-key!!!!!!!!',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Validation
if (config.env === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-secret') {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.includes('change')) {
    throw new Error('ENCRYPTION_KEY must be set in production');
  }
  if (config.aws.endpoint) {
    console.warn('⚠️  WARNING: AWS_ENDPOINT is set in production - this should only be for testing');
  }
}

export default config;
