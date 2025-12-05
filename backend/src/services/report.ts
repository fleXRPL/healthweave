import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import config from '../utils/config';
import logger from '../utils/logger';
import { AnalysisResult } from '../types';

/**
 * Strip markdown formatting from text for PDF rendering
 * Converts **bold** to plain text and handles other markdown patterns
 */
function stripMarkdown(text: string): string {
  if (!text) return '';
  
  // Remove markdown bold markers (**text**)
  let cleaned = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  // Remove markdown italic (*text* or _text_)
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
  
  // Remove markdown code blocks (`code`)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  
  // Remove markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // Clean up any remaining markdown artifacts
  cleaned = cleaned.replace(/\*\*/g, ''); // Any remaining **
  cleaned = cleaned.replace(/\*/g, ''); // Any remaining *
  
  return cleaned.trim();
}

class ReportService {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: config.aws.region,
      ...(config.aws.endpoint && {
        endpoint: config.aws.endpoint,
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
        },
      }),
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = config.dynamodb.reportsTable;

    // Initialize table (for LocalStack)
    if (config.aws.endpoint) {
      this.initializeTable();
    }
  }

  /**
   * Initialize DynamoDB table (for LocalStack development)
   */
  private async initializeTable(): Promise<void> {
    try {
      const describeCommand = new DescribeTableCommand({ TableName: this.tableName });
      await this.client.send(describeCommand as any);
      logger.info('Reports table already exists', { table: this.tableName });
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        try {
          const createCommand = new CreateTableCommand({
            TableName: this.tableName,
            KeySchema: [
              { AttributeName: 'id', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
            AttributeDefinitions: [
              { AttributeName: 'id', AttributeType: 'S' },
              { AttributeName: 'createdAt', AttributeType: 'N' },
              { AttributeName: 'userId', AttributeType: 'S' },
            ],
            GlobalSecondaryIndexes: [
              {
                IndexName: 'UserIdIndex',
                KeySchema: [
                  { AttributeName: 'userId', KeyType: 'HASH' },
                  { AttributeName: 'createdAt', KeyType: 'RANGE' },
                ],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: {
                  ReadCapacityUnits: 5,
                  WriteCapacityUnits: 5,
                },
              },
            ],
            BillingMode: 'PROVISIONED',
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          });

          await this.client.send(createCommand as any);
          logger.info('Reports table created successfully', { table: this.tableName });
        } catch (createError) {
          logger.error('Failed to create reports table', { error: createError });
        }
      } else {
        logger.error('Error checking reports table', { error });
      }
    }
  }

  /**
   * Save analysis report
   */
  async saveReport(report: AnalysisResult): Promise<void> {
    logger.info('Saving analysis report', { reportId: report.id, userId: report.userId });

    try {
      const item = {
        ...report,
        createdAt: report.createdAt.getTime(),
      };
      
      logger.debug('Report item to save', { 
        reportId: item.id,
        userId: item.userId,
        createdAt: item.createdAt,
        hasSummary: !!item.summary,
        findingsCount: item.keyFindings?.length || 0,
      });

      const command = new PutCommand({
        TableName: this.tableName,
        Item: item,
      });

      await this.client.send(command);
      logger.info('Report saved successfully', { reportId: report.id, userId: report.userId });
    } catch (error: any) {
      logger.error('Error saving report', { 
        error: error?.message || String(error),
        errorStack: error?.stack,
        reportId: report.id 
      });
      throw new Error('Failed to save report');
    }
  }

  /**
   * Get a report by ID
   */
  async getReport(reportId: string, userId: string): Promise<AnalysisResult | null> {
    logger.info('Retrieving report', { reportId, userId });

    try {
      // First try: Query by userId using GSI, filter by id
      const queryCommand = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':id': reportId,
        },
        Limit: 1,
      });

      let response = await this.client.send(queryCommand);
      
      logger.debug('Query response', { 
        itemCount: response.Items?.length || 0,
        reportId,
        userId 
      });

      // If query returns nothing, try Scan as fallback (LocalStack GSI indexing lag)
      if (!response.Items || response.Items.length === 0) {
        logger.warn('Query returned no items, trying Scan fallback', { reportId, userId });
        const scanCommand = new ScanCommand({
          TableName: this.tableName,
          FilterExpression: '#id = :id',
          ExpressionAttributeNames: {
            '#id': 'id',
          },
          ExpressionAttributeValues: {
            ':id': reportId,
          },
        });
        const scanResponse = await this.client.send(scanCommand);
        logger.debug('Scan response', { 
          itemCount: scanResponse.Items?.length || 0,
          reportId,
          userId,
          allItems: scanResponse.Items?.map(i => ({ id: i.id, userId: i.userId }))
        });
        
        // Filter by userId in code (since FilterExpression with AND might not work in LocalStack)
        if (scanResponse.Items && scanResponse.Items.length > 0) {
          const matchingItem = scanResponse.Items.find(item => 
            item.id === reportId && item.userId === userId
          );
          if (matchingItem) {
            response = { Items: [matchingItem] };
            logger.info('Found report via Scan fallback', { reportId });
          }
        }
      }

      if (!response.Items || response.Items.length === 0) {
        logger.warn('Report not found', { reportId, userId });
        return null;
      }

      const item = response.Items[0];
      const report = {
        ...item,
        createdAt: new Date(item.createdAt),
      } as AnalysisResult;
      
      logger.info('Report retrieved successfully', { reportId });
      return report;
    } catch (error: any) {
      logger.error('Error retrieving report', { 
        error: error.message || error,
        errorName: error.name,
        reportId,
        userId 
      });
      throw new Error(`Failed to retrieve report: ${error.message || error}`);
    }
  }

  /**
   * Get all reports for a user
   */
  async getUserReports(userId: string, limit: number = 50): Promise<AnalysisResult[]> {
    logger.info('Retrieving user reports', { userId, limit });

    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
      });

      const response = await this.client.send(command);

      if (!response.Items) {
        return [];
      }

      return response.Items.map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
      })) as AnalysisResult[];
    } catch (error) {
      logger.error('Error retrieving user reports', { error, userId });
      throw new Error('Failed to retrieve user reports');
    }
  }

  /**
   * Generate PDF report from analysis result
   */
  async generatePDF(report: AnalysisResult): Promise<Buffer> {
    logger.info('Generating PDF report', { reportId: report.id });

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length === 0) {
            reject(new Error('Generated PDF buffer is empty'));
            return;
          }
          resolve(buffer);
        });
        doc.on('error', (error) => {
          logger.error('PDFDocument error', { error, reportId: report.id });
          reject(error);
        });

        // Add header with logo placeholder
        doc
          .fontSize(24)
          .fillColor('#29628B')
          .text('HealthWeave', { align: 'center' })
          .fontSize(12)
          .fillColor('#4693C3')
          .text('Health Data Synthesis Report', { align: 'center' })
          .moveDown(2);

        // Report metadata
        doc
          .fontSize(10)
          .fillColor('#2D343F')
          .text(`Report ID: ${report.id}`)
          .text(`Generated: ${report.createdAt.toLocaleString()}`)
          .moveDown(2);

        // Summary section
        doc
          .fontSize(16)
          .fillColor('#29628B')
          .text('AI Summary', { underline: true })
          .moveDown(0.5);

        doc.fontSize(11).fillColor('#2D343F').text(stripMarkdown(report.summary), { align: 'justify' }).moveDown(2);

        // Key Findings
        doc
          .fontSize(16)
          .fillColor('#29628B')
          .text('Key Findings', { underline: true })
          .moveDown(0.5);

        if (report.keyFindings && report.keyFindings.length > 0) {
          report.keyFindings.forEach((finding, index) => {
            const cleanedFinding = stripMarkdown(finding);
            // Check if there's a bold header pattern to render properly
            const boldMatch = finding.match(/\*\*([^*]+):\*\*\s*(.+)/);
            if (boldMatch) {
              const header = boldMatch[1];
              const content = boldMatch[2];
              doc
                .fontSize(11)
                .fillColor('#2D343F')
                .text(`${index + 1}. `, { indent: 20, continued: true })
                .font('Helvetica-Bold')
                .text(`${header}: `, { continued: true })
                .font('Helvetica')
                .text(stripMarkdown(content))
                .moveDown(0.5);
            } else {
              doc
                .fontSize(11)
                .fillColor('#2D343F')
                .text(`${index + 1}. ${cleanedFinding}`, { indent: 20 })
                .moveDown(0.5);
            }
          });
        } else {
          doc
            .fontSize(11)
            .fillColor('#666666')
            .text('No specific findings identified.', { indent: 20 })
            .moveDown(0.5);
        }

        doc.moveDown(2);

        // Recommendations
        doc
          .fontSize(16)
          .fillColor('#29628B')
          .text('Recommendations', { underline: true })
          .moveDown(0.5);

        if (report.recommendations && report.recommendations.length > 0) {
          report.recommendations.forEach((rec, index) => {
            const cleanedRec = stripMarkdown(rec);
            // Check if there's a bold header pattern to render properly
            const boldMatch = rec.match(/\*\*([^*]+):\*\*\s*(.+)/);
            if (boldMatch) {
              const header = boldMatch[1];
              const content = boldMatch[2];
              doc
                .fontSize(11)
                .fillColor('#2D343F')
                .text(`${index + 1}. `, { indent: 20, continued: true })
                .font('Helvetica-Bold')
                .text(`${header}: `, { continued: true })
                .font('Helvetica')
                .text(stripMarkdown(content))
                .moveDown(0.5);
            } else {
              doc
                .fontSize(11)
                .fillColor('#2D343F')
                .text(`${index + 1}. ${cleanedRec}`, { indent: 20 })
                .moveDown(0.5);
            }
          });
        } else {
          doc
            .fontSize(11)
            .fillColor('#666666')
            .text('No specific recommendations at this time.', { indent: 20 })
            .moveDown(0.5);
        }

        doc.moveDown(2);

        // Full Report
        if (report.fullReport) {
          doc.addPage();
          doc
            .fontSize(16)
            .fillColor('#29628B')
            .text('Detailed Analysis', { underline: true })
            .moveDown(1);

          doc.fontSize(10).fillColor('#2D343F').text(stripMarkdown(report.fullReport), { align: 'justify' });
        }

        // Footer
        doc
          .fontSize(8)
          .fillColor('#888888')
          .text(
            'This report is for informational purposes only and should be reviewed by a qualified healthcare provider.',
            50,
            doc.page.height - 50,
            { align: 'center' }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default new ReportService();
