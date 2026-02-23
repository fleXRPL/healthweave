// Core types for HealthWeave backend

export interface HealthDocument {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
  s3Key: string;
  size: number;
}

export interface AnalysisRequest {
  userId: string;
  documents: HealthDocument[];
  patientContext?: string;
  requestedInsights?: string[];
}

export interface AnalysisResult {
  id: string;
  userId: string;
  createdAt: Date;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  citations: Citation[];
  fullReport: string;
  /** Source document file names (for report provenance) */
  documentNames?: string[];
  /** Model that generated the analysis (e.g. Bedrock model ID, claude-3-5-sonnet, mistral:latest) */
  modelUsed?: string;
}

export interface Citation {
  source: string;
  type: 'document' | 'research' | 'clinical_guideline';
  relevance: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, any>;
}

export interface User {
  id: string;
  email: string;
  createdAt: Date;
  lastLogin?: Date;
}

export interface BedrockInvokeParams {
  modelId: string;
  body: {
    anthropic_version?: string;
    max_tokens: number;
    messages: BedrockMessage[];
    system?: string;
  };
}

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image' | 'document';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

export interface BedrockResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface Config {
  env: string;
  port: number;
  host: string;
  aws: {
    region: string;
    endpoint?: string;
  };
  bedrock: {
    modelId: string;
  };
  s3: {
    bucketName: string;
    bucketRegion: string;
  };
  dynamodb: {
    reportsTable: string;
    auditTable: string;
  };
  cognito?: {
    userPoolId: string;
    clientId: string;
  };
  security: {
    jwtSecret: string;
    encryptionKey: string;
  };
  cors: {
    origin: string;
  };
  logging: {
    level: string;
  };
}
