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
import { AnalysisResult, KeyValueRow } from '../types';

/** PDF section styling - aligned with web UI card headers */
const SECTION_HEADER_HEIGHT = 28;
const SECTION_HEADER_BG = '#29628B'; // primary - matches web
const SECTION_HEADER_TEXT_COLOR = '#ffffff';
const SECTION_TITLE_FONT_SIZE = 14;
const SECTION_GAP = 2;
const BODY_FONT_SIZE = 11;
const BODY_COLOR = '#2D343F';
const MUTED_COLOR = '#666666';
const MARGIN = 50;
/** Min space (pt) from bottom of page before starting a new section (avoid orphan titles) */
const MIN_SPACE_BEFORE_SECTION = 140;

/**
 * Start a new page if current position is near the bottom (so section title + content stay together).
 */
function ensureSpaceForSection(
  doc: InstanceType<typeof PDFDocument>
): void {
  if (doc.y > doc.page.height - MIN_SPACE_BEFORE_SECTION) {
    doc.addPage();
  }
}

/**
 * Draw a card-style section header (dark bar + white text) to match the web UI.
 */
function drawCardSectionHeader(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  options: { ensureSpace?: boolean; skipRule?: boolean } = {}
): void {
  const { ensureSpace = true, skipRule = false } = options;
  if (ensureSpace) {
    ensureSpaceForSection(doc);
  }
  if (!skipRule && doc.y > 80) {
    doc
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .moveTo(MARGIN, doc.y)
      .lineTo(doc.page.width - MARGIN, doc.y)
      .stroke()
      .moveDown(0.4);
  }
  const x = MARGIN;
  const width = doc.page.width - 2 * MARGIN;
  const y = doc.y;

  doc
    .rect(x, y, width, SECTION_HEADER_HEIGHT)
    .fill(SECTION_HEADER_BG);
  doc
    .fontSize(SECTION_TITLE_FONT_SIZE)
    .font('Helvetica-Bold')
    .fillColor(SECTION_HEADER_TEXT_COLOR)
    .text(title, x + 12, y + 8, { width: width - 24, align: 'left' });

  doc.y = y + SECTION_HEADER_HEIGHT + 12;
  doc.font('Helvetica').fillColor(BODY_COLOR);
}

/**
 * Draw key values as a table. Columns: Test, Value, Unit, Reference.
 */
function drawKeyValuesTable(
  doc: InstanceType<typeof PDFDocument>,
  keyValues: KeyValueRow[]
): void {
  const margin = 50;
  const colWidths = { name: 200, value: 85, unit: 65, reference: 145 };
  const xName = margin;
  const xValue = xName + colWidths.name;
  const xUnit = xValue + colWidths.value;
  const xRef = xUnit + colWidths.unit;
  const rowPadding = 6;

  doc.fontSize(10).font('Helvetica-Bold').fillColor(SECTION_HEADER_BG);
  const headerY = doc.y;
  doc.text('Test', xName, headerY, { width: colWidths.name });
  doc.text('Value', xValue, headerY, { width: colWidths.value });
  doc.text('Unit', xUnit, headerY, { width: colWidths.unit });
  doc.text('Reference', xRef, headerY, { width: colWidths.reference });
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor(BODY_COLOR);

  for (const row of keyValues) {
    const name = stripMarkdown(row.name);
    const value = stripMarkdown(row.value);
    const unit = (row.unit && stripMarkdown(row.unit)) || '—';
    const ref = (row.referenceRange && stripMarkdown(row.referenceRange)) || '—';
    const rowY = doc.y;
    const hName = doc.heightOfString(name, { width: colWidths.name });
    const hVal = doc.heightOfString(value, { width: colWidths.value });
    const hUnit = doc.heightOfString(unit, { width: colWidths.unit });
    const hRef = doc.heightOfString(ref, { width: colWidths.reference });
    const rowHeight = Math.max(hName, hVal, hUnit, hRef, 12) + rowPadding;

    doc.text(name, xName, rowY, { width: colWidths.name });
    doc.text(value, xValue, rowY, { width: colWidths.value });
    doc.text(unit, xUnit, rowY, { width: colWidths.unit });
    doc.text(ref, xRef, rowY, { width: colWidths.reference });
    doc.y = rowY + rowHeight;
  }
  doc.moveDown(0.5);
}

/**
 * Parse a key finding string into category and details (for table display).
 */
function parseFindingRow(finding: string): { category: string; details: string } {
  const boldMatch = /\*\*([^*]+):\*\*\s*(.+)/.exec(finding);
  if (boldMatch) {
    return {
      category: stripMarkdown(boldMatch[1] ?? '').trim(),
      details: stripMarkdown(boldMatch[2] ?? '').trim(),
    };
  }
  const cleaned = stripMarkdown(finding).trim();
  return { category: cleaned, details: '' };
}

/**
 * Draw key findings as a two-column table: Finding | Details.
 */
function drawKeyFindingsTable(
  doc: InstanceType<typeof PDFDocument>,
  keyFindings: string[]
): void {
  const margin = 50;
  const colWidths = { category: 160, details: 335 };
  const xCat = margin;
  const xDetails = xCat + colWidths.category;
  const rowPadding = 6;

  doc.fontSize(10).font('Helvetica-Bold').fillColor(SECTION_HEADER_BG);
  const headerY = doc.y;
  doc.text('Finding', xCat, headerY, { width: colWidths.category });
  doc.text('Details', xDetails, headerY, { width: colWidths.details });
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor(BODY_COLOR);

  const rows = keyFindings.map(parseFindingRow);

  for (const row of rows) {
    const category = row.category || '—';
    const details = row.details || '—';
    const rowY = doc.y;
    const hCat = doc.heightOfString(category, { width: colWidths.category });
    const hDetails = doc.heightOfString(details, { width: colWidths.details });
    const rowHeight = Math.max(hCat, hDetails, 12) + rowPadding;

    doc.text(category, xCat, rowY, { width: colWidths.category });
    doc.text(details, xDetails, rowY, { width: colWidths.details });
    doc.y = rowY + rowHeight;
  }
  doc.moveDown(0.5);
}

/** Stop rendering keyFindings when we hit these (avoids Recommendations etc. in PDF). */
const PDF_SECTION_STOPS = new Set([
  'recommendations',
  'clinical correlations',
  'uncertainties and limitations',
  'uncertainties',
  'questions for your doctor',
  'questions for the doctor',
  'key values (quick reference)',
  'key values',
  'references',
]);

function filterFindingsBeforeSectionHeaders(findings: string[]): string[] {
  const stop = findings.findIndex((item) =>
    PDF_SECTION_STOPS.has(stripMarkdown(item).toLowerCase().trim())
  );
  if (stop < 0) return findings;
  if (stop === 0) return []; // first item is a section header – don't show wrong content
  return findings.slice(0, stop);
}

/**
 * When stored keyFindings is empty or filtered to nothing, try to extract from fullReport
 * so the PDF still shows a Key Findings section (e.g. for older reports or extraction gaps).
 */
function keyFindingsForDisplay(
  keyFindings: string[] | undefined,
  fullReport: string | undefined
): string[] {
  const filtered = filterFindingsBeforeSectionHeaders(keyFindings ?? []);
  if (filtered.length > 0) return filtered;
  if (!fullReport) return [];

  const sectionRe = /##\s+Key Findings[\s\S]*?(?=\n##|$)/i;
  const sectionMatch = sectionRe.exec(fullReport);
  if (!sectionMatch) return [];

  const text = sectionMatch[0];
  const numberedRe = /^\d+\.\s+(.+)$/gm;
  const numbered: string[] = [];
  let numMatch: RegExpExecArray | null;
  while ((numMatch = numberedRe.exec(text)) !== null) {
    numbered.push(numMatch[1].trim());
  }
  if (numbered.length > 0) {
    const items = numbered.filter((x) => x.length > 0);
    return filterFindingsBeforeSectionHeaders(items).slice(0, 15);
  }
  const bulletedRe = /^[-*•]\s+(.+)$/gm;
  const bulleted: string[] = [];
  let bulletMatch: RegExpExecArray | null;
  while ((bulletMatch = bulletedRe.exec(text)) !== null) {
    bulleted.push(bulletMatch[1].trim());
  }
  if (bulleted.length > 0) {
    const items = bulleted.filter((x) => x.length > 0);
    return filterFindingsBeforeSectionHeaders(items).slice(0, 15);
  }
  return [];
}

/**
 * Strip markdown formatting from text for PDF rendering.
 * Converts **bold** to plain text and handles other markdown patterns.
 */
function stripMarkdown(text: string): string {
  if (!text) return '';

  // Remove markdown bold markers (**text**)
  let cleaned = text.replaceAll(/\*\*([^*]+)\*\*/g, '$1');

  // Remove markdown italic (*text* or _text_)
  cleaned = cleaned.replaceAll(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replaceAll(/_([^_]+)_/g, '$1');

  // Remove markdown code blocks (`code`)
  cleaned = cleaned.replaceAll(/`([^`]+)`/g, '$1');

  // Remove markdown links [text](url) -> text
  cleaned = cleaned.replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Clean up any remaining markdown artifacts
  cleaned = cleaned.replaceAll('**', ''); // Any remaining **
  cleaned = cleaned.replaceAll('*', ''); // Any remaining *

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
    .replaceAll(/\/;[A-Z]+'[àáâãä]/g, '') // Remove malformed sequences like /;AA'à
    // Decode HTML entities that might appear
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
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
          const heading = token as { type: string; depth?: number; text?: string };
          let headingFontSize = 11;
          if (heading.depth === 2) headingFontSize = 14;
          else if (heading.depth === 3) headingFontSize = 12;
          
          // Ensure headings start at left margin with no indentation
          doc
            .fontSize(headingFontSize)
            .font('Helvetica-Bold')
            .fillColor('#29628B')
            .text(cleanProblematicChars(heading.text ?? ''), { 
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
          const paragraph = token as { type: string; tokens?: unknown[] };
          renderInlineContent(doc, paragraph.tokens || [], defaultFontSize, defaultColor);
          doc.moveDown(lineSpacing);
          break;
        }

        case 'list': {
          const list = token as { type: string; ordered?: boolean; items?: { text?: string; tokens?: unknown[] }[] };
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

          list.items?.forEach((item: { text?: string; tokens?: unknown[] }) => {
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
          const code = token as { type: string; text?: string };
          doc
            .fontSize(defaultFontSize - 1)
            .font('Courier')
            .fillColor('#666666')
            .text(cleanProblematicChars(code.text ?? ''), { indent: 20 })
            .moveDown(lineSpacing);
          
          // Reset to defaults
          doc.fontSize(defaultFontSize).font('Helvetica').fillColor(defaultColor);
          break;
        }

        case 'blockquote': {
          const blockquote = token as { type: string; raw?: string; text?: string };
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
              .text(cleanProblematicChars(String((token as { text?: string }).text ?? '')), { align: 'justify' })
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
        const textToken = token as { type: string; text?: string };
        // Check for ** BEFORE cleaning, as cleanProblematicChars doesn't affect it
        const rawText = textToken.text || '';
        const hasBold = rawText.includes('**');
        const text = cleanProblematicChars(rawText);
        
        // If text contains **bold** markers, handle them first
        if (hasBold) {
          // Split by ** markers and render with bold formatting
          const parts = text.split(/(\*\*)/g);
          let inBold = false;
          
          parts.forEach((part, partIndex) => {
            if (part === '**') {
              inBold = !inBold;
              if (inBold) {
                doc.font('Helvetica-Bold');
              } else {
                doc.font('Helvetica');
              }
            } else if (part) {
              // Check for citations in this text part
              const citationPattern = /\[(PMID|ClinVar|OMIM|Journal):\s*([^\]]+)\]/g;
              const citationParts: Array<{ text: string; isCitation: boolean }> = [];
              let lastIndex = 0;
              let match: RegExpExecArray | null;
              
              citationPattern.lastIndex = 0;
              
              while ((match = citationPattern.exec(part)) !== null) {
                if (match.index > lastIndex) {
                  citationParts.push({
                    text: part.substring(lastIndex, match.index),
                    isCitation: false,
                  });
                }
                citationParts.push({
                  text: match[0],
                  isCitation: true,
                });
                lastIndex = match.index + match[0].length;
              }
              
              if (lastIndex < part.length) {
                citationParts.push({
                  text: part.substring(lastIndex),
                  isCitation: false,
                });
              }
              
              if (citationParts.length === 0) {
                citationParts.push({ text: part, isCitation: false });
              }
              
              // Render citation parts
              citationParts.forEach((citationPart, citationIndex) => {
                const isLastCitationPart = citationIndex === citationParts.length - 1;
                const isLastPart = partIndex === parts.length - 1;
                const shouldContinue = !isLastCitationPart || (!isLastPart && !isLast && continued);
                
                if (citationPart.isCitation) {
                  doc
                    .fontSize(fontSize - 2)
                    .font('Helvetica')
                    .fillColor('#888888')
                    .text(citationPart.text, { continued: shouldContinue });
                } else {
                  doc
                    .fontSize(fontSize)
                    .font(inBold ? 'Helvetica-Bold' : 'Helvetica')
                    .fillColor(color)
                    .text(citationPart.text, { continued: shouldContinue });
                }
              });
            }
          });
          
          // Reset to normal font
          doc.font('Helvetica');
        } else {
          // No bold markers, handle citations normally
          const citationPattern = /\[(PMID|ClinVar|OMIM|Journal):\s*([^\]]+)\]/g;
          const parts: Array<{ text: string; isCitation: boolean }> = [];
          let lastIndex = 0;
          let match: RegExpExecArray | null;
          
          citationPattern.lastIndex = 0;
          
          while ((match = citationPattern.exec(text)) !== null) {
            if (match.index > lastIndex) {
              parts.push({
                text: text.substring(lastIndex, match.index),
                isCitation: false,
              });
            }
            parts.push({
              text: match[0],
              isCitation: true,
            });
            lastIndex = match.index + match[0].length;
          }
          
          if (lastIndex < text.length) {
            parts.push({
              text: text.substring(lastIndex),
              isCitation: false,
            });
          }
          
          if (parts.length === 0) {
            parts.push({ text, isCitation: false });
          }
          
          parts.forEach((part, partIndex) => {
            const isLastPart = partIndex === parts.length - 1;
            const shouldContinue = !isLastPart && !isLast && continued;
            
            if (part.isCitation) {
              doc
                .fontSize(fontSize - 2)
                .font('Helvetica')
                .fillColor('#888888')
                .text(part.text, { continued: shouldContinue });
            } else {
              doc
                .fontSize(fontSize)
                .font('Helvetica')
                .fillColor(color)
                .text(part.text, { continued: shouldContinue });
            }
          });
        }
        break;
      }

      case 'strong': {
        const strongToken = token as { type: string; text?: string; tokens?: unknown[] };
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
        const emToken = token as { type: string; text?: string; tokens?: unknown[] };
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
        const linkToken = token as { type: string; text?: string; href?: string; tokens?: unknown[] };
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
        const codeToken = token as { type: string; text?: string };
        const shouldContinue = !isLast && continued;
        doc
          .fontSize(fontSize - 1)
          .font('Courier')
          .fillColor('#666666')
          .text(cleanProblematicChars(codeToken.text ?? ''), { continued: shouldContinue });
        
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
            .text(cleanProblematicChars(String((token as { text?: string }).text ?? '')), { continued: shouldContinue });
        }
        break;
    }
  });
}

class ReportService {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;
  private tableInitPromise: Promise<void> | null = null;

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
  }

  /**
   * Ensure table exists (for LocalStack). Called lazily on first use, not in constructor.
   */
  private async ensureTable(): Promise<void> {
    if (!config.aws.endpoint) return;
    this.tableInitPromise ??= this.initializeTable();
    await this.tableInitPromise;
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
    await this.ensureTable();
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
    await this.ensureTable();
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
    await this.ensureTable();
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
          .text(`Generated: ${report.createdAt.toLocaleString()}`);

        // Provenance: model and source documents (when available)
        if (report.modelUsed) {
          doc.text(`Model: ${report.modelUsed}`);
        }
        if (report.documentNames && report.documentNames.length > 0) {
          doc.text(`Based on ${report.documentNames.length} document(s):`);
          report.documentNames.forEach((name) => {
            doc.text(`• ${name}`, { indent: 10 });
          });
        }
        doc.moveDown(2);

        // AI Summary (card-style header, matches web)
        drawCardSectionHeader(doc, 'AI Summary', { skipRule: true });
        doc
          .fontSize(BODY_FONT_SIZE)
          .fillColor(BODY_COLOR)
          .text(stripMarkdown(report.summary), { align: 'justify' })
          .moveDown(SECTION_GAP);

        // Key Values (Quick Reference) - only when present, like web
        if (report.keyValues && report.keyValues.length > 0) {
          drawCardSectionHeader(doc, 'Key Values (Quick Reference)');
          drawKeyValuesTable(doc, report.keyValues);
          doc.moveDown(SECTION_GAP);
        }

        // Key Findings (use stored list or fallback to fullReport so section is never missing)
        drawCardSectionHeader(doc, 'Key Findings');

        const keyFindingsForPDF = keyFindingsForDisplay(
          report.keyFindings,
          report.fullReport
        );

        if (keyFindingsForPDF.length > 0) {
          drawKeyFindingsTable(doc, keyFindingsForPDF);
        } else {
          doc
            .fontSize(BODY_FONT_SIZE)
            .fillColor(MUTED_COLOR)
            .text('No specific findings identified.', { indent: 20 })
            .moveDown(0.5);
        }

        doc.moveDown(SECTION_GAP);

        // Recommendations
        drawCardSectionHeader(doc, 'Recommendations');

        if (report.recommendations && report.recommendations.length > 0) {
          const boldRecRegex = /\*\*([^*]+):\*\*\s*(.+)/;
          report.recommendations.forEach((rec, index) => {
            const cleanedRec = stripMarkdown(rec);
            const boldMatch = boldRecRegex.exec(rec);
            if (boldMatch) {
              const header = boldMatch[1];
              const content = boldMatch[2];
              doc
                .fontSize(BODY_FONT_SIZE)
                .fillColor(BODY_COLOR)
                .text(`${index + 1}. `, { indent: 20, continued: true })
                .font('Helvetica-Bold')
                .text(`${header}: `, { continued: true })
                .font('Helvetica')
                .text(stripMarkdown(content))
                .moveDown(0.5);
            } else {
              doc
                .fontSize(BODY_FONT_SIZE)
                .fillColor(BODY_COLOR)
                .text(`${index + 1}. ${cleanedRec}`, { indent: 20 })
                .moveDown(0.5);
            }
          });
        } else {
          doc
            .fontSize(BODY_FONT_SIZE)
            .fillColor(MUTED_COLOR)
            .text('No specific recommendations at this time.', { indent: 20 })
            .moveDown(0.5);
        }

        doc.moveDown(SECTION_GAP);

        // Questions for Your Doctor
        drawCardSectionHeader(doc, 'Questions for Your Doctor');

        if (report.questionsForDoctor && report.questionsForDoctor.length > 0) {
          report.questionsForDoctor.forEach((q, index) => {
            doc
              .fontSize(BODY_FONT_SIZE)
              .fillColor(BODY_COLOR)
              .text(`${index + 1}. ${stripMarkdown(q)}`, { indent: 20 })
              .moveDown(0.5);
          });
        } else {
          doc
            .fontSize(BODY_FONT_SIZE)
            .fillColor(MUTED_COLOR)
            .text('None generated.', { indent: 20 })
            .moveDown(0.5);
        }

        doc.moveDown(SECTION_GAP);

        // Appendix: full narrative (clearly separate from main report)
        if (report.fullReport) {
          doc.addPage();
          drawCardSectionHeader(doc, 'Appendix: Full Analysis');
          doc.moveDown(0.3);
          doc.fontSize(10).fillColor(BODY_COLOR);
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
