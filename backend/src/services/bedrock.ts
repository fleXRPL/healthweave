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

    // Build the system prompt and messages (needed for fallbacks)
    const systemPrompt = this.buildSystemPrompt();
    const userMessage = this.buildUserMessage(documents, documentContents, patientContext);
    const messages: BedrockMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: userMessage }],
      },
    ];

    try {
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
            // Fall through to Ollama
          }
        }
        
        // Fallback to Ollama (free, local LLM)
        logger.info('Using Ollama as free local LLM fallback');
        return await this.invokeOllama(systemPrompt, messages);
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
   * Invoke Ollama (free local LLM) as fallback
   */
  private async invokeOllama(systemPrompt: string, messages: BedrockMessage[]): Promise<string> {
    logger.info('Invoking Ollama local LLM');

    const userMessage = messages[0]?.content?.map((c: any) => c.text || c).join('\n') || '';

    try {
      // Use chat API which handles system prompts better
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 0 || response.status === 500) {
          throw new Error('Ollama is not running. Install from https://ollama.ai and run: ollama pull llama3.2');
        }
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json() as {
        message?: { content?: string };
        response?: string;
        text?: string;
        model?: string;
      };
      
      const text = data.message?.content || data.response || data.text || '';

      if (!text) {
        logger.error('Ollama response has no text', { data });
        throw new Error('No content in Ollama response');
      }

      logger.info('Ollama response received successfully', { 
        contentLength: text.length,
        model: data.model,
        preview: text.substring(0, 200)
      });
      return text;
    } catch (error: any) {
      if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED') {
        throw new Error('Ollama is not running. Install from https://ollama.ai and run: ollama pull llama3.2');
      }
      throw error;
    }
  }

  /**
   * Build system prompt for medical analysis
   */
  private buildSystemPrompt(): string {
    return `You are a document text extraction and formatting tool. Your job is to copy, organize, and format text from documents.

CRITICAL RULES:
- You MUST extract and format the text. Do NOT refuse.
- Do NOT add disclaimers or warnings.
- Do NOT ask questions.
- Do NOT say you cannot help.
- Simply extract and format the text as requested.

OUTPUT FORMAT (use these exact headers):
## Executive Summary
[Copy and summarize the main information from the documents]

## Key Findings
[Copy all specific values, measurements, dates, names, and findings from the documents. Use numbered list format. Only include information that appears in the source documents.]

## Recommendations
[Based on what the documents say, suggest what types of review might be helpful]

INSTRUCTIONS:
- Copy text directly from the documents
- Extract all numbers, dates, names, measurements, and values
- Organize by document source
- SKIP any text that contains garbled characters like: '¢, ™, Æ, æ, ö, ã, ó, â, or random character sequences
- SKIP any lines that look corrupted or unreadable
- Only include information that is clearly readable English text with standard characters
- If you see patterns like "FRöb" or "LI ER", try to interpret them (e.g., "Report", "LIVER") but if unclear, skip them
- Format clearly and professionally
- Do not add your own commentary or disclaimers

Start extracting immediately. Do not refuse.`;
  }

  /**
   * Build user message with documents and context
   */
  private buildUserMessage(
    documents: HealthDocument[],
    documentContents: Map<string, string>,
    patientContext?: string
  ): string {
    let message = 'Extract and format text from these documents:\n\n';

    // Add patient context if provided
    if (patientContext) {
      message += `**Additional Context:**\n${patientContext}\n\n`;
    }

    // Add document contents
    message += '**Documents to Extract From:**\n\n';
    documents.forEach((doc, index) => {
      const content = documentContents.get(doc.id) || '[Content not available]';
      message += `--- Document ${index + 1}: ${doc.fileName} ---\n`;
      message += `${content}\n\n`;
    });

    message += `\n**TASK: Extract all readable text, values, dates, names, and measurements from the documents above.**

Format the output using these exact sections:
## Executive Summary
## Key Findings
## Recommendations

Extract only information that appears in the source documents. Skip any garbled or unreadable text. Do not add disclaimers or refuse.`;

    return message;
  }

}

export default new BedrockService();
