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
  upload.array('documents', 25), // Allow up to 25 files
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

    // Start timing for analysis
    const analysisStartTime = Date.now();
    
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
        } catch (error: any) {
          logger.warn('Failed to extract content from document', {
            fileName: file.originalname,
            error: error?.message || String(error),
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

      // Log the raw analysis text for debugging
      logger.debug('Raw analysis text received', { 
        length: analysisText.length,
        preview: analysisText.substring(0, 500) 
      });

      // Parse analysis result and create structured report
      const summary = extractSection(analysisText, 'AI Summary', 'Executive Summary', 'Summary');
      const keyFindings = extractList(analysisText, 'Key Findings', 'Findings');
      const clinicalCorrelations = extractSection(analysisText, 'Clinical Correlations', 'Correlations');
      const recommendations = extractList(analysisText, 'Recommendations', 'Recommendation');
      const uncertainties = extractSection(analysisText, 'Uncertainties and Limitations', 'Uncertainties', 'Limitations');
      
      logger.debug('Extracted report sections', {
        hasSummary: !!summary,
        summaryLength: summary?.length || 0,
        findingsCount: keyFindings.length,
        findingsPreview: keyFindings.slice(0, 2),
        hasCorrelations: !!clinicalCorrelations,
        recommendationsCount: recommendations.length,
        recommendationsPreview: recommendations.slice(0, 2),
        hasUncertainties: !!uncertainties,
        rawAnalysisLength: analysisText.length,
        rawAnalysisPreview: analysisText.substring(0, 1000),
      });

      // Enhance summary with correlations if available (no truncation!)
      let enhancedSummary = summary || analysisText.substring(0, 2000) || 'Analysis complete';
      if (clinicalCorrelations && summary) {
        // Include full correlations, not truncated
        enhancedSummary = `${summary}\n\n${clinicalCorrelations}`;
      }

      // If extraction failed, try to extract from full text as fallback
      let finalKeyFindings = keyFindings;
      let finalRecommendations = recommendations;
      
      if (keyFindings.length === 0 && analysisText.length > 0) {
        // Try to extract any numbered or bulleted lists from the full text
        const allNumbered = analysisText.match(/^\d+\.\s+.+$/gm);
        const allBulleted = analysisText.match(/^[-*•]\s+.+$/gm);
        if (allNumbered && allNumbered.length > 0) {
          finalKeyFindings = allNumbered.slice(0, 10).map(item => item.replace(/^\d+\.\s+/, '').trim());
        } else if (allBulleted && allBulleted.length > 0) {
          finalKeyFindings = allBulleted.slice(0, 10).map(item => item.replace(/^[-*•]\s+/, '').trim());
        }
      }
      
      if (recommendations.length === 0 && analysisText.length > 0) {
        // Look for recommendations section in full text
        const recSection = analysisText.match(/##\s+Recommendations[\s\S]*?(?=##|$)/i);
        if (recSection) {
          const recItems = recSection[0].match(/^\d+\.\s+.+$/gm) || recSection[0].match(/^[-*•]\s+.+$/gm);
          if (recItems) {
            finalRecommendations = recItems.map(item => item.replace(/^(\d+\.|[-*•])\s+/, '').trim());
          }
        }
      }

      const report: AnalysisResult = {
        id: uuidv4(),
        userId,
        createdAt: new Date(),
        summary: enhancedSummary,
        keyFindings: finalKeyFindings.length > 0 ? finalKeyFindings : ['Analysis completed. Review full report for details.'],
        recommendations: finalRecommendations.length > 0 ? finalRecommendations : ['Review the full analysis report with your healthcare provider.'],
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

      // Calculate analysis duration
      const analysisEndTime = Date.now();
      const analysisDurationMs = analysisEndTime - analysisStartTime;
      const analysisDurationSeconds = Math.round(analysisDurationMs / 1000);
      const analysisDurationFormatted = analysisDurationMs > 60000 
        ? `${(analysisDurationMs / 60000).toFixed(1)} minutes`
        : `${analysisDurationSeconds} seconds`;

      logger.info('Analysis completed successfully', {
        userId,
        reportId: report.id,
        documentCount: uploadedDocs.length,
        durationSeconds: analysisDurationSeconds,
        durationFormatted: analysisDurationFormatted,
      });

      // Return result with timing info
      res.json({
        success: true,
        reportId: report.id,
        summary: report.summary,
        keyFindings: report.keyFindings,
        recommendations: report.recommendations,
        // Analysis metadata
        documentCount: uploadedDocs.length,
        analysisDurationMs,
        analysisDurationSeconds,
        analysisDurationFormatted,
        model: 'mistral:latest', // Current model being used
      });
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Unknown error';
      const errorStack = error?.stack;
      
      logger.error('Error during document analysis', { 
        error: errorMessage,
        errorStack,
        errorName: error?.name,
        userId 
      });

      await auditService.logEvent(
        userId,
        'ANALYSIS_FAILED',
        'health_documents',
        false,
        { error: errorMessage },
        req
      );

      res.status(500).json({
        success: false,
        error: 'Failed to analyze documents',
        message: errorMessage,
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
    logger.error('Error retrieving report', { 
      error: error?.message || String(error),
      errorStack: error?.stack,
      reportId 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve report',
      message: error?.message || 'Unknown error',
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
    logger.error('Error retrieving user reports', { 
      error: error?.message || String(error),
      errorStack: error?.stack,
      userId 
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve reports',
      message: error?.message || 'Unknown error',
    });
  }
};

/**
 * Download report as PDF
 */
export const downloadReportPDF = async (req: Request, res: Response) => {
  const { reportId } = req.params;
  const userId = (req.query.userId as string) || 'test-user'; // TODO: Get from JWT

  logger.info('Generating PDF report', { reportId, userId });

  try {
    const report = await reportService.getReport(reportId, userId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
        message: 'Report not found',
      });
    }

    logger.info('Generating PDF buffer', { reportId });
    const pdfBuffer = await reportService.generatePDF(report);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      logger.error('PDF buffer is empty', { reportId });
      return res.status(500).json({
        success: false,
        error: 'Failed to generate PDF',
        message: 'Generated PDF is empty',
      });
    }

    logger.info('PDF generated successfully', { reportId, size: pdfBuffer.length });

    await auditService.logEvent(userId, 'REPORT_DOWNLOAD', `report:${reportId}`, true, {}, req);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="healthweave-report-${reportId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    const errorMessage = error?.message || String(error) || 'Unknown error occurred';
    
    logger.error('Error generating PDF report', { 
      error: errorMessage,
      errorStack: error?.stack,
      reportId,
      errorName: error?.name,
    });

    // Always send JSON error response (never send PDF headers if error)
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate PDF',
        message: errorMessage,
      });
    }
    
    // If headers were already sent (shouldn't happen), log and end
    logger.error('Headers already sent when error occurred', { reportId });
    res.end();
  }
};

// Helper functions to parse AI response
function extractSection(text: string, ...headers: string[]): string | null {
  for (const header of headers) {
    // Try markdown headers first (## Header)
    let regex = new RegExp(`##+\\s+${header}[\\s\\S]*?\\n([\\s\\S]*?)(?=\n##|$)`, 'i');
    let match = text.match(regex);
    if (match) {
      const content = match[1].trim();
      // Remove next section header if present
      const cleaned = content.replace(/^##+.*$/m, '').trim();
      return cleaned || null;
    }

    // Try bold headers (**Header**:)
    regex = new RegExp(`\\*\\*${header}\\*\\*:?\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i');
    match = text.match(regex);
    if (match) {
      return match[1].trim();
    }

    // Try plain headers (Header:)
    regex = new RegExp(`^${header}:?\\s*([\\s\\S]*?)(?=\\n[A-Z][^:]*:|$)`, 'im');
    match = text.match(regex);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

function extractList(text: string, ...headers: string[]): string[] {
  const section = extractSection(text, ...headers);
  if (!section) return [];

  const items: string[] = [];
  
  // Try to extract structured content with bold headers
  // Pattern: **Header:** content (on same line or following lines)
  const headerPattern = /\*\*([^*]+?):\*\*\s*([^\n*]+(?:\n(?!\*\*|\d+\.|[-*•]|##)[^\n]+)*)/g;
  const headerMatches = [...section.matchAll(headerPattern)];
  
  if (headerMatches.length > 0) {
    headerMatches.forEach(match => {
      const header = match[1].trim();
      let content = match[2].trim();
      
      // If content is empty, look for content on following lines
      if (!content || content.length === 0) {
        const afterMatch = section.substring(match.index! + match[0].length);
        const nextMatch = afterMatch.match(/^\*\*|\n\d+\.|\n[-*•]|\n##|\n\n\n/);
        const contentEnd = nextMatch ? nextMatch.index! : Math.min(afterMatch.length, 500);
        content = afterMatch.substring(0, contentEnd).trim();
      }
      
      if (content.length > 0) {
        items.push(`**${header}:** ${content}`);
      }
    });
    if (items.length > 0) return items;
  }

  // Extract numbered lists (1. item)
  let numberedItems = section.match(/^\d+\.\s+(.+)$/gm);
  if (numberedItems && numberedItems.length > 0) {
    return numberedItems.map((item) => item.replace(/^\d+\.\s+/, '').trim()).filter(item => item.length > 0);
  }

  // Extract bulleted lists (- item, * item, • item)
  let bulletItems = section.match(/^[-*•]\s+(.+)$/gm);
  if (bulletItems && bulletItems.length > 0) {
    return bulletItems.map((item) => item.replace(/^[-*•]\s+/, '').trim()).filter(item => item.length > 0);
  }

  // Extract lines that look like list items (start with dash or number after some whitespace)
  let spacedItems = section.match(/^\s*[-*•]\s+(.+)$/gm);
  if (spacedItems && spacedItems.length > 0) {
    return spacedItems.map((item) => item.replace(/^\s*[-*•]\s+/, '').trim()).filter(item => item.length > 0);
  }

  // If no list markers, split by newlines but filter out empty lines and headers
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      return line.length > 0 && 
             !line.match(/^##/) && 
             !line.match(/^#{1,6}\s/) &&
             !line.match(/^\*\*[^*]+\*\*\s*$/) && // Standalone bold text
             !line.match(/^\*\*[^*]+:\*\*\s*$/); // Standalone bold header with colon but no content
    });
}
