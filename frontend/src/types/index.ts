// Frontend types for HealthWeave

export interface HealthDocument {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
  s3Key: string;
  size: number;
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
  documentNames?: string[];
  modelUsed?: string;
  questionsForDoctor?: string[];
}

export interface Citation {
  source: string;
  type: 'document' | 'research' | 'clinical_guideline';
  relevance: string;
}

export interface AnalyzeResponse {
  success: boolean;
  reportId: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  questionsForDoctor?: string[];
  error?: string;
  message?: string;
  // Analysis metadata
  documentCount?: number;
  documentNames?: string[];
  modelUsed?: string;
  analysisDurationMs?: number;
  analysisDurationSeconds?: number;
  analysisDurationFormatted?: string;
  model?: string;
}

export interface ReportResponse {
  success: boolean;
  report: AnalysisResult;
  error?: string;
  message?: string;
}

export interface ReportsListResponse {
  success: boolean;
  reports: AnalysisResult[];
  error?: string;
  message?: string;
}
