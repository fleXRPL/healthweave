import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import PDFDocument from 'pdfkit';
// @ts-ignore - marked types may not be available until package is installed
import { marked } from 'marked';
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

/**
 * Clean up specific problematic character sequences that PDFKit can't render
 * Only fixes the specific issues without affecting markdown syntax
 */
function cleanProblematicChars(text: string): string {
  if (!text) return '';
  
  return text
    // Fix the specific malformed sequence: /;AA'à or similar patterns
    .replace(/\/;[A-Z]+'[àáâãä]/g, '') // Remove malformed sequences like /;AA'à
    // Decode HTML entities that might appear
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/**
 * Render markdown content to PDF using PDFKit
 * Properly handles headers, paragraphs, lists, bold, italic, and citations
 */
function renderMarkdownToPDF(doc: InstanceType<typeof PDFDocument>, markdown: string): void {
  if (!markdown) return;

  // Default text settings (defined outside try block for catch block access)
  const defaultFontSize = 10;
  const defaultColor = '#2D343F';
  const lineSpacing = 0.5;

  try {
    // Parse markdown into tokens (don't sanitize before parsing - it breaks markdown!)
    // @ts-ignore - marked may not be available until package is installed
    const tokens = marked.lexer(markdown);
    
    // Track list state for proper indentation
    let inOrderedList = false;
    let inUnorderedList = false;
    let listItemNumber = 0;
    const listIndent = 20;

    tokens.forEach((token: any) => {
      // Check if we need a new page (with margin)
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }

      switch (token.type) {
        case 'heading': {
          const heading = token as any;
          const headingFontSize = heading.depth === 2 ? 14 : heading.depth === 3 ? 12 : 11;
          
          // Ensure headings start at left margin with no indentation
          doc
            .fontSize(headingFontSize)
            .font('Helvetica-Bold')
            .fillColor('#29628B')
            .text(cleanProblematicChars(heading.text), { 
              align: 'left',
              indent: 0,  // Explicitly set no indentation
              continued: false  // Ensure not in continued state
            })
            .moveDown(0.5);
          
          // Reset to defaults
          doc.fontSize(defaultFontSize).font('Helvetica').fillColor(defaultColor);
          break;
        }

        case 'paragraph': {
          const paragraph = token as any;
          renderInlineContent(doc, paragraph.tokens || [], defaultFontSize, defaultColor);
          doc.moveDown(lineSpacing);
          break;
        }

        case 'list': {
          const list = token as any;
          const wasInList = inOrderedList || inUnorderedList;
          
          if (list.ordered) {
            inOrderedList = true;
            inUnorderedList = false;
            listItemNumber = 0;
          } else {
            inUnorderedList = true;
            inOrderedList = false;
          }

          // Helper to render text with bold markdown (**text**) properly
          const renderTextWithBold = (text: string) => {
            if (!text) return;
            
            // Check if text contains **bold** markers
            if (text.includes('**')) {
              // Split by ** markers (keeping the delimiters in the array)
              const parts = text.split(/(\*\*)/g);
              let inBold = false;
              
              parts.forEach((part, index) => {
                if (part === '**') {
                  // Toggle bold state
                  inBold = !inBold;
                  if (inBold) {
                    doc.font('Helvetica-Bold');
                  } else {
                    doc.font('Helvetica');
                  }
                } else if (part.trim()) {
                  // Render the text part
                  const isLast = index === parts.length - 1;
                  doc.text(cleanProblematicChars(part), { 
                    continued: !isLast || (isLast && inBold) // Continue if not last or if we're still in bold
                  });
                }
              });
              
              // Ensure we reset to normal font at the end
              doc.font('Helvetica');
            } else {
              // No bold markers, just render as normal text
              doc.text(cleanProblematicChars(text), { continued: false });
            }
          };

          list.items.forEach((item: any) => {
            if (list.ordered) {
              listItemNumber++;
              const prefix = `${listItemNumber}. `;
              doc
                .fontSize(defaultFontSize)
                .fillColor(defaultColor)
                .text(prefix, { indent: listIndent, continued: true });
              
              // Render item content
              if (item.tokens && item.tokens.length > 0) {
                // Use parsed tokens (already has markdown parsed)
                renderInlineContent(doc, item.tokens, defaultFontSize, defaultColor, false);
              } else if (item.text) {
                // If no tokens, manually handle bold markdown in text
                renderTextWithBold(item.text);
              }
            } else {
              const prefix = '• ';
              doc
                .fontSize(defaultFontSize)
                .fillColor(defaultColor)
                .text(prefix, { indent: listIndent, continued: true });
              
              // Render item content
              if (item.tokens && item.tokens.length > 0) {
                // Use parsed tokens (already has markdown parsed)
                renderInlineContent(doc, item.tokens, defaultFontSize, defaultColor, false);
              } else if (item.text) {
                // If no tokens, manually handle bold markdown in text
                renderTextWithBold(item.text);
              }
            }
            
            // Move down after each item for proper spacing
            doc.moveDown(0.3);
          });

          if (!wasInList) {
            doc.moveDown(lineSpacing);
          }
          
          inOrderedList = false;
          inUnorderedList = false;
          break;
        }

        case 'code': {
          const code = token as any;
          doc
            .fontSize(defaultFontSize - 1)
            .font('Courier')
            .fillColor('#666666')
            .text(cleanProblematicChars(code.text), { indent: 20 })
            .moveDown(lineSpacing);
          
          // Reset to defaults
          doc.fontSize(defaultFontSize).font('Helvetica').fillColor(defaultColor);
          break;
        }

        case 'blockquote': {
          const blockquote = token as any;
          doc
            .fontSize(defaultFontSize - 1)
            .fillColor('#666666')
            .text(cleanProblematicChars(blockquote.raw || blockquote.text || ''), { indent: 30, align: 'left' })
            .moveDown(lineSpacing);
          
          // Reset to defaults
          doc.fontSize(defaultFontSize).fillColor(defaultColor);
          break;
        }

        case 'hr': {
          doc
            .moveDown(0.5)
            .strokeColor('#CCCCCC')
            .lineWidth(0.5)
            .moveTo(50, doc.y)
            .lineTo(doc.page.width - 50, doc.y)
            .stroke()
            .moveDown(1);
          break;
        }

        default:
          // For any unhandled token types, try to render as plain text
          if ('text' in token) {
            doc
              .fontSize(defaultFontSize)
              .fillColor(defaultColor)
              .text(cleanProblematicChars((token as any).text || ''), { align: 'justify' })
              .moveDown(lineSpacing);
          }
          break;
      }
    });
  } catch (error) {
    logger.error('Error rendering markdown to PDF', { error });
    // Fallback to plain text if markdown parsing fails
    doc
      .fontSize(defaultFontSize)
      .fillColor(defaultColor)
      .text(cleanProblematicChars(stripMarkdown(markdown)), { align: 'justify' });
  }
}

/**
 * Render inline content (text with formatting like bold, italic, links)
 */
function renderInlineContent(
  doc: InstanceType<typeof PDFDocument>,
  tokens: any[],
  fontSize: number,
  color: string,
  continued: boolean = false
): void {
  tokens.forEach((token: any, index: number) => {
    const isLast = index === tokens.length - 1;
    
    switch (token.type) {
      case 'text': {
        const textToken = token as any;
        const text = cleanProblematicChars(textToken.text);
        
        // Check for citation patterns: [PMID: XXXXXXXX], [ClinVar: VCV000XXXXXX], [OMIM: XXXXXX]
        const citationPattern = /\[(PMID|ClinVar|OMIM|Journal):\s*([^\]]+)\]/g;
        const parts: Array<{ text: string; isCitation: boolean }> = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        
        // Reset regex lastIndex to avoid issues with global regex
        citationPattern.lastIndex = 0;
        
        while ((match = citationPattern.exec(text)) !== null) {
          // Add text before citation
          if (match.index > lastIndex) {
            parts.push({
              text: text.substring(lastIndex, match.index),
              isCitation: false,
            });
          }
          
          // Add citation
          parts.push({
            text: match[0],
            isCitation: true,
          });
          
          lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text
        if (lastIndex < text.length) {
          parts.push({
            text: text.substring(lastIndex),
            isCitation: false,
          });
        }
        
        // If no citations found, add entire text as single part
        if (parts.length === 0) {
          parts.push({ text, isCitation: false });
        }
        
        // Render each part
        parts.forEach((part, partIndex) => {
          const isLastPart = partIndex === parts.length - 1;
          // Only continue if this is not the last part AND not the last token AND continued is true
          const shouldContinue = !isLastPart && !isLast && continued;
          
          if (part.isCitation) {
            // Render citation in smaller, gray text
            doc
              .fontSize(fontSize - 2)
              .font('Helvetica')
              .fillColor('#888888')
              .text(part.text, { continued: shouldContinue });
          } else {
            // Render regular text
            doc
              .fontSize(fontSize)
              .font('Helvetica')
              .fillColor(color)
              .text(part.text, { continued: shouldContinue });
          }
        });
        break;
      }

      case 'strong': {
        const strongToken = token as any;
        doc
          .fontSize(fontSize)
          .font('Helvetica-Bold')
          .fillColor(color);
        
        const shouldContinue = !isLast && continued;
        if (strongToken.tokens && strongToken.tokens.length > 0) {
          renderInlineContent(doc, strongToken.tokens, fontSize, color, shouldContinue);
        } else {
          doc.text(cleanProblematicChars(strongToken.text || ''), { continued: shouldContinue });
        }
        break;
      }

      case 'em': {
        const emToken = token as any;
        doc
          .fontSize(fontSize)
          .font('Helvetica-Oblique')
          .fillColor(color);
        
        const shouldContinue = !isLast && continued;
        if (emToken.tokens && emToken.tokens.length > 0) {
          renderInlineContent(doc, emToken.tokens, fontSize, color, shouldContinue);
        } else {
          doc.text(cleanProblematicChars(emToken.text || ''), { continued: shouldContinue });
        }
        break;
      }

      case 'link': {
        const linkToken = token as any;
        // Render link text (could style differently, but keeping simple for now)
        doc
          .fontSize(fontSize)
          .font('Helvetica')
          .fillColor('#4693C3'); // Link color
        
        const shouldContinue = !isLast && continued;
        if (linkToken.tokens && linkToken.tokens.length > 0) {
          renderInlineContent(doc, linkToken.tokens, fontSize, '#4693C3', shouldContinue);
        } else {
          doc.text(cleanProblematicChars(linkToken.text || linkToken.href || ''), { continued: shouldContinue });
        }
        
        // Reset color
        doc.fillColor(color);
        break;
      }

      case 'code': {
        const codeToken = token as any;
        const shouldContinue = !isLast && continued;
        doc
          .fontSize(fontSize - 1)
          .font('Courier')
          .fillColor('#666666')
          .text(cleanProblematicChars(codeToken.text), { continued: shouldContinue });
        
        // Reset to defaults
        doc.fontSize(fontSize).font('Helvetica').fillColor(color);
        break;
      }

      default:
        // For any unhandled inline token, try to render text
        if ('text' in token) {
          const shouldContinue = !isLast && continued;
          doc
            .fontSize(fontSize)
            .font('Helvetica')
            .fillColor(color)
            .text(cleanProblematicChars((token as any).text || ''), { continued: shouldContinue });
        }
        break;
    }
  });
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
            response = { ...response, Items: [matchingItem] };
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

        // Full Report - Detailed Analysis with proper markdown rendering
        if (report.fullReport) {
          doc.addPage();
          doc
            .fontSize(16)
            .fillColor('#29628B')
            .text('Detailed Analysis', { underline: true })
            .moveDown(1);

          // Render markdown with proper formatting
          renderMarkdownToPDF(doc, report.fullReport);
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
