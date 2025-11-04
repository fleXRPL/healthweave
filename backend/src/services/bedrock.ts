import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import Anthropic from '@anthropic-ai/sdk';
import config from '../utils/config';
import logger from '../utils/logger';
import { BedrockMessage, HealthDocument } from '../types';

class BedrockService {
  private client: BedrockRuntimeClient;
  private anthropicClient: Anthropic | null = null;

  constructor() {
    const clientConfig: any = {
      region: config.aws.region,
    };

    // Use LocalStack endpoint if configured (for development)
    if (config.aws.endpoint) {
      clientConfig.endpoint = config.aws.endpoint;
      clientConfig.credentials = {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      };
      logger.info('Bedrock client configured for LocalStack', {
        endpoint: config.aws.endpoint,
      });
    }

    this.client = new BedrockRuntimeClient(clientConfig);

    // Initialize Anthropic client for direct API (fallback when LocalStack Bedrock unavailable)
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicApiKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
      logger.info('Anthropic API client initialized for direct API calls');
    }
  }

  /**
   * Analyze health documents and generate clinical insights
   */
  async analyzeHealthData(
    documents: HealthDocument[],
    documentContents: Map<string, string>,
    patientContext?: string
  ): Promise<string> {
    logger.info('Starting health data analysis', {
      documentCount: documents.length,
      hasContext: !!patientContext,
    });

    try {
      // Build the system prompt for medical analysis
      const systemPrompt = this.buildSystemPrompt();

      // Build user message with documents and context
      const userMessage = this.buildUserMessage(documents, documentContents, patientContext);

      // Prepare messages for Bedrock
      const messages: BedrockMessage[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: userMessage }],
        },
      ];

      // Invoke Bedrock model
      const response = await this.invokeModel(systemPrompt, messages);

      logger.info('Health data analysis completed successfully');
      return response;
    } catch (error: any) {
      // If Bedrock fails in development (e.g., LocalStack doesn't support bedrock-runtime),
      // fall back to mock analysis
      const isBedrockUnavailable = 
        config.aws.endpoint && (
          error.name === 'InternalFailure' ||
          error.$metadata?.httpStatusCode === 501 ||
          error.__type === 'InternalFailure' ||
          (error.message && error.message.includes('bedrock-runtime')) ||
          (error.message && error.message.includes('not yet been emulated'))
        );

      if (isBedrockUnavailable) {
        logger.warn('Bedrock unavailable, trying Anthropic direct API', {
          error: error.message || error.name,
          errorType: error.name || error.__type,
          statusCode: error.$metadata?.httpStatusCode,
        });
        
        // Try using Anthropic direct API if available
        if (this.anthropicClient) {
          try {
            return await this.invokeAnthropicDirect(systemPrompt, messages);
          } catch (anthropicError: any) {
            logger.error('Anthropic API also failed', { error: anthropicError.message });
            throw new Error('Both Bedrock and Anthropic API failed');
          }
        }
        
        // If no Anthropic API key, throw error
        throw new Error('Bedrock unavailable and ANTHROPIC_API_KEY not configured. Please set ANTHROPIC_API_KEY for development.');
      }
      
      logger.error('Error analyzing health data', { 
        error: error.message || error,
        errorName: error.name,
        errorType: error.__type,
        statusCode: error.$metadata?.httpStatusCode,
      });
      throw new Error('Failed to analyze health data');
    }
  }

  /**
   * Invoke the Bedrock model
   */
  private async invokeModel(systemPrompt: string, messages: BedrockMessage[]): Promise<string> {
    const modelId = config.bedrock.modelId;

    // Prepare the request body based on the model
    const requestBody: any = {
      max_tokens: 4096,
      messages: messages,
    };

    // Add system prompt (Claude models support this)
    if (modelId.includes('claude') || modelId.includes('anthropic')) {
      requestBody.anthropic_version = 'bedrock-2023-05-31';
      requestBody.system = systemPrompt;
    } else {
      // For other models (like Mistral in LocalStack), prepend system prompt to first message
      requestBody.messages[0].content[0].text = `${systemPrompt}\n\n${requestBody.messages[0].content[0].text}`;
    }

    const input: InvokeModelCommandInput = {
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    };

    logger.debug('Invoking Bedrock model', { modelId });

    const command = new InvokeModelCommand(input);
    const response = await this.client.send(command);

    // Parse response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    logger.debug('Bedrock model response received', {
      modelId,
      stopReason: responseBody.stop_reason,
    });

    // Extract text from response
    if (responseBody.content && responseBody.content.length > 0) {
      return responseBody.content[0].text;
    }

    throw new Error('No content in Bedrock response');
  }

  /**
   * Invoke Anthropic API directly (fallback when Bedrock unavailable)
   */
  private async invokeAnthropicDirect(systemPrompt: string, messages: BedrockMessage[]): Promise<string> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    logger.info('Invoking Anthropic API directly');

    // Convert messages format - Anthropic expects simpler format
    const anthropicMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content.map((c: any) => c.text || c).join('\n'),
    }));

    const response = await this.anthropicClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages as any,
    });

    const text = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    if (!text) {
      throw new Error('No content in Anthropic response');
    }

    logger.info('Anthropic API response received successfully', { 
      contentLength: text.length 
    });
    return text;
  }

  /**
   * Build system prompt for medical analysis
   */
  private buildSystemPrompt(): string {
    return `You are a medical AI assistant specialized in analyzing patient health data and generating comprehensive clinical insights. Your role is to:

1. Carefully analyze all provided medical documents (lab results, clinical notes, imaging reports, etc.)
2. Identify key findings, diagnoses, and trends
3. Synthesize information from multiple sources into a coherent health summary
4. Provide evidence-based recommendations for patient care
5. Highlight any concerning findings or trends that require attention
6. Use clear, professional medical language appropriate for healthcare providers

IMPORTANT GUIDELINES:
- Be thorough and accurate in your analysis
- Cite specific findings from the documents
- Identify patterns across multiple data points
- Flag any inconsistencies or concerning trends
- Provide actionable recommendations
- Maintain patient privacy - do not include unnecessary personal identifiers in your analysis
- Structure your response clearly with sections for: Summary, Key Findings, Trends, Recommendations

Do not diagnose conditions definitively - instead, present findings and suggest further evaluation when appropriate.`;
  }

  /**
   * Build user message with documents and context
   */
  private buildUserMessage(
    documents: HealthDocument[],
    documentContents: Map<string, string>,
    patientContext?: string
  ): string {
    let message = 'Please analyze the following patient health documents:\n\n';

    // Add patient context if provided
    if (patientContext) {
      message += `**Patient Context:**\n${patientContext}\n\n`;
    }

    // Add document contents
    message += '**Medical Documents:**\n\n';
    documents.forEach((doc, index) => {
      const content = documentContents.get(doc.id) || '[Content not available]';
      message += `--- Document ${index + 1}: ${doc.fileName} (${doc.fileType}) ---\n`;
      message += `${content}\n\n`;
    });

    message += `\n**Instructions:**
1. Provide a comprehensive summary of this patient's health status based on all documents
2. Identify key findings from each document
3. Note any trends or patterns across multiple documents
4. Highlight any concerning findings that require attention
5. Provide evidence-based recommendations for care
6. Structure your response in a clear, professional format suitable for healthcare providers

Please begin your analysis:`;

    return message;
  }

}

export default new BedrockService();
