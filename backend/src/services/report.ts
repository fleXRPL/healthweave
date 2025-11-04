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
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import config from '../utils/config';
import logger from '../utils/logger';
import { AnalysisResult } from '../types';

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
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          ...report,
          createdAt: report.createdAt.getTime(),
        },
      });

      await this.client.send(command);
      logger.info('Report saved successfully', { reportId: report.id });
    } catch (error) {
      logger.error('Error saving report', { error, reportId: report.id });
      throw new Error('Failed to save report');
    }
  }

  /**
   * Get a report by ID
   */
  async getReport(reportId: string, userId: string): Promise<AnalysisResult | null> {
    logger.info('Retrieving report', { reportId, userId });

    try {
      // We need the sort key (createdAt), so we'll query by userId first
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

      const response = await this.client.send(queryCommand);

      if (!response.Items || response.Items.length === 0) {
        return null;
      }

      const item = response.Items[0];
      return {
        ...item,
        createdAt: new Date(item.createdAt),
      } as AnalysisResult;
    } catch (error) {
      logger.error('Error retrieving report', { error, reportId });
      throw new Error('Failed to retrieve report');
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
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

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
          .text('Executive Summary', { underline: true })
          .moveDown(0.5);

        doc.fontSize(11).fillColor('#2D343F').text(report.summary, { align: 'justify' }).moveDown(2);

        // Key Findings
        doc
          .fontSize(16)
          .fillColor('#29628B')
          .text('Key Findings', { underline: true })
          .moveDown(0.5);

        report.keyFindings.forEach((finding, index) => {
          doc
            .fontSize(11)
            .fillColor('#2D343F')
            .text(`${index + 1}. ${finding}`, { indent: 20 })
            .moveDown(0.5);
        });

        doc.moveDown(2);

        // Recommendations
        doc
          .fontSize(16)
          .fillColor('#29628B')
          .text('Recommendations', { underline: true })
          .moveDown(0.5);

        report.recommendations.forEach((rec, index) => {
          doc
            .fontSize(11)
            .fillColor('#2D343F')
            .text(`${index + 1}. ${rec}`, { indent: 20 })
            .moveDown(0.5);
        });

        doc.moveDown(2);

        // Full Report
        if (report.fullReport) {
          doc.addPage();
          doc
            .fontSize(16)
            .fillColor('#29628B')
            .text('Detailed Analysis', { underline: true })
            .moveDown(1);

          doc.fontSize(10).fillColor('#2D343F').text(report.fullReport, { align: 'justify' });
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
