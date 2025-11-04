import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import storageService from '../services/storage';
import bedrockService from '../services/bedrock';
import reportService from '../services/report';
import auditService from '../services/audit';
import logger from '../utils/logger';
import { AnalysisResult, HealthDocument } from '../types';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common document types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'text/plain',
      'application/json',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

/**
 * Upload and analyze health documents
 */
export const analyzeDocuments = [
  upload.array('documents', 10), // Allow up to 10 files
  async (req: Request, res: Response) => {
    const userId = req.body.userId || 'test-user'; // TODO: Get from JWT
    const patientContext = req.body.patientContext;

    logger.info('Starting document analysis', {
      userId,
      fileCount: req.files?.length || 0,
    });

    // Log audit event
    await auditService.logEvent(
      userId,
      'DOCUMENT_UPLOAD',
      'health_documents',
      true,
      {
        fileCount: req.files?.length || 0,
        hasContext: !!patientContext,
      },
      req
    );

    try {
      // Validate files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
        });
      }

      const files = req.files as Express.Multer.File[];
      const uploadedDocs: HealthDocument[] = [];
      const documentContents = new Map<string, string>();

      // Upload each file to S3 and extract content
      for (const file of files) {
        const { key, url } = await storageService.uploadFile(
          userId,
          file.originalname,
          file.buffer,
          file.mimetype
        );

        const docId = uuidv4();
        const doc: HealthDocument = {
          id: docId,
          fileName: file.originalname,
          fileType: file.mimetype,
          uploadedAt: new Date(),
          s3Key: key,
          size: file.size,
        };

        uploadedDocs.push(doc);

        // Extract text content for analysis
        try {
          const content = await storageService.extractTextContent(key, file.mimetype);
          documentContents.set(docId, content);
        } catch (error) {
          logger.warn('Failed to extract content from document', {
            fileName: file.originalname,
            error,
          });
          documentContents.set(docId, `[Content extraction failed for ${file.originalname}]`);
        }
      }

      logger.info('Documents uploaded successfully', {
        userId,
        documentCount: uploadedDocs.length,
      });

      // Analyze documents with Bedrock
      logger.info('Starting AI analysis');
      const analysisText = await bedrockService.analyzeHealthData(
        uploadedDocs,
        documentContents,
        patientContext
      );

      // Parse analysis result and create structured report
      const report: AnalysisResult = {
        id: uuidv4(),
        userId,
        createdAt: new Date(),
        summary: extractSection(analysisText, 'Summary', 'Executive Summary') || 'Analysis complete',
        keyFindings: extractList(analysisText, 'Key Findings', 'Findings'),
        recommendations: extractList(analysisText, 'Recommendations', 'Recommendation'),
        citations: [], // TODO: Extract citations from analysis
        fullReport: analysisText,
      };

      // Save report to DynamoDB
      await reportService.saveReport(report);

      // Log successful analysis
      await auditService.logEvent(
        userId,
        'ANALYSIS_COMPLETE',
        `report:${report.id}`,
        true,
        {
          reportId: report.id,
          documentCount: uploadedDocs.length,
        },
        req
      );

      logger.info('Analysis completed successfully', {
        userId,
        reportId: report.id,
      });

      // Return result
      res.json({
        success: true,
        reportId: report.id,
        summary: report.summary,
        keyFindings: report.keyFindings,
        recommendations: report.recommendations,
      });
    } catch (error: any) {
      logger.error('Error during document analysis', { error, userId });

      await auditService.logEvent(
        userId,
        'ANALYSIS_FAILED',
        'health_documents',
        false,
        { error: error.message },
        req
      );

      res.status(500).json({
        success: false,
        error: 'Failed to analyze documents',
        message: error.message,
      });
    }
  },
];

/**
 * Get a specific report
 */
export const getReport = async (req: Request, res: Response) => {
  const { reportId } = req.params;
  const userId = req.body.userId || 'test-user'; // TODO: Get from JWT

  logger.info('Retrieving report', { reportId, userId });

  try {
    const report = await reportService.getReport(reportId, userId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    await auditService.logEvent(userId, 'REPORT_VIEW', `report:${reportId}`, true, {}, req);

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    logger.error('Error retrieving report', { error, reportId });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve report',
      message: error.message,
    });
  }
};

/**
 * Get all reports for a user
 */
export const getUserReports = async (req: Request, res: Response) => {
  const userId = req.body.userId || 'test-user'; // TODO: Get from JWT
  const limit = parseInt(req.query.limit as string) || 50;

  logger.info('Retrieving user reports', { userId, limit });

  try {
    const reports = await reportService.getUserReports(userId, limit);

    await auditService.logEvent(
      userId,
      'REPORTS_LIST',
      'reports',
      true,
      { count: reports.length },
      req
    );

    res.json({
      success: true,
      reports,
    });
  } catch (error: any) {
    logger.error('Error retrieving user reports', { error, userId });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve reports',
      message: error.message,
    });
  }
};

/**
 * Download report as PDF
 */
export const downloadReportPDF = async (req: Request, res: Response) => {
  const { reportId } = req.params;
  const userId = req.body.userId || 'test-user'; // TODO: Get from JWT

  logger.info('Generating PDF report', { reportId, userId });

  try {
    const report = await reportService.getReport(reportId, userId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    const pdfBuffer = await reportService.generatePDF(report);

    await auditService.logEvent(userId, 'REPORT_DOWNLOAD', `report:${reportId}`, true, {}, req);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="healthweave-report-${reportId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Error generating PDF report', { error, reportId });

    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
      message: error.message,
    });
  }
};

// Helper functions to parse AI response
function extractSection(text: string, ...headers: string[]): string | null {
  for (const header of headers) {
    const regex = new RegExp(`\\*\\*${header}\\*\\*:?\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i');
    const match = text.match(regex);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

function extractList(text: string, ...headers: string[]): string[] {
  const section = extractSection(text, ...headers);
  if (!section) return [];

  // Extract numbered or bulleted lists
  const items = section.match(/(?:^\d+\.|^[-*•])\s*(.+)$/gm);
  if (items) {
    return items.map((item) => item.replace(/^(?:\d+\.|[-*•])\s*/, '').trim());
  }

  // If no list markers, split by newlines
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
