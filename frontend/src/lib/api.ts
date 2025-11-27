import axios, { AxiosInstance } from 'axios';
import { AnalyzeResponse, ReportResponse, ReportsListResponse } from '@/types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      timeout: 120000, // 2 minutes for AI processing
      // Note: Don't set Content-Type here - let axios auto-set it for FormData
    });

    // Add request interceptor for logging and Content-Type handling
    this.client.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        // Only set Content-Type for non-FormData requests
        // FormData requests need axios to auto-set the boundary
        if (!(config.data instanceof FormData)) {
          config.headers['Content-Type'] = 'application/json';
        }
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Upload and analyze health documents
   */
  async analyzeDocuments(
    files: File[],
    patientContext?: string,
    userId?: string
  ): Promise<AnalyzeResponse> {
    const formData = new FormData();

    // Add files
    files.forEach((file) => {
      formData.append('documents', file);
    });

    // Add optional context
    if (patientContext) {
      formData.append('patientContext', patientContext);
    }

    // Add userId (temporary - will be from JWT in production)
    formData.append('userId', userId || 'test-user');

    try {
      // Don't set Content-Type - let axios auto-set it with the boundary for FormData
      const response = await this.client.post<AnalyzeResponse>('/api/analyze', formData);

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to analyze documents');
    }
  }

  /**
   * Get a specific report
   */
  async getReport(reportId: string, userId?: string): Promise<ReportResponse> {
    try {
      const response = await this.client.get<ReportResponse>(`/api/reports/${reportId}`, {
        data: {
          userId: userId || 'test-user',
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to retrieve report');
    }
  }

  /**
   * Get all reports for a user
   */
  async getUserReports(userId?: string, limit?: number): Promise<ReportsListResponse> {
    try {
      const response = await this.client.get<ReportsListResponse>('/api/reports', {
        params: { limit },
        data: {
          userId: userId || 'test-user',
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to retrieve reports');
    }
  }

  /**
   * Download report as PDF
   */
  async downloadReportPDF(reportId: string, userId?: string): Promise<Blob> {
    try {
      const response = await this.client.get(`/api/reports/${reportId}/pdf`, {
        responseType: 'blob',
        params: {
          userId: userId || 'test-user',
        },
      });

      // If successful, return the blob
      return response.data;
    } catch (error: any) {
      // If error response is a blob (JSON error wrapped in blob), try to parse it
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.error || 'Failed to download PDF');
        } catch {
          // If parsing fails, use status code
          throw new Error(error.response?.status === 404 ? 'Report not found' : 'Failed to download PDF');
        }
      }
      // Otherwise use standard error handling
      throw new Error(error.response?.data?.message || error.message || 'Failed to download PDF');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; environment: string }> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error: any) {
      throw new Error('Backend is not reachable');
    }
  }
}

export default new ApiClient();
