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
    const userMessage = messages[0]?.content?.map((c: any) => c.text || c).join('\n') || '';
    
    // Estimate token count (rough: ~4 chars per token)
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const userTokens = Math.ceil(userMessage.length / 4);
    const totalTokens = systemTokens + userTokens;
    
    logger.info('Invoking Ollama local LLM', {
      systemPromptLength: systemPrompt.length,
      userMessageLength: userMessage.length,
      estimatedSystemTokens: systemTokens,
      estimatedUserTokens: userTokens,
      estimatedTotalTokens: totalTokens,
    });

    // Warn if input is very large
    if (totalTokens > 30000) {
      logger.warn('Input may exceed model context window', { 
        estimatedTotalTokens: totalTokens,
        recommendation: 'Consider reducing document count or using Claude for production'
      });
    }

    try {
      // Use chat API which handles system prompts better
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          //model: 'llama3.2', Original model used
          model: 'mistral',
          //model: 'llama3.1:70b', this was crashing the system big time!
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_ctx: 32768,  // Increase context window (default is 2048-8192)
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
    return `You are an expert clinical analyst with deep expertise across multiple medical specialties. Your role is to analyze patient health documents and generate comprehensive, specialist-level clinical reports that synthesize complex medical data into actionable insights.

═══════════════════════════════════════════════════════════════
CITATION REQUIREMENTS (MANDATORY)
═══════════════════════════════════════════════════════════════

**Every clinical claim MUST be supported by medical evidence. Include citations for:**

1. **Genetic Variants**: Cite ClinVar, OMIM, or peer-reviewed studies
   - Format: [ClinVar: VCV000XXXXXX] or [OMIM: XXXXXX] or [PMID: XXXXXXXX]
   - Example: "MTHFR C677T homozygosity is associated with elevated homocysteine levels [ClinVar: VCV000003520]"

2. **Drug Interactions & Pharmacogenomics**: Cite FDA labels, PharmGKB, or CPIC guidelines
   - Format: [PharmGKB] or [CPIC Guideline] or [FDA Label]
   - Example: "CYP2C19 poor metabolizers require dose adjustment for clopidogrel [CPIC Guideline]"

3. **Clinical Recommendations**: Cite ACMG, NCCN, AHA, AASLD, or relevant specialty guidelines
   - Format: [ACMG Guidelines] or [NCCN Guidelines] or [AHA/ACC Guidelines]
   - Example: "Hepatocellular carcinoma surveillance every 6 months per AASLD guidelines [AASLD Practice Guidance 2023]"

4. **Disease Associations & Risk Factors**: Cite peer-reviewed literature
   - Format: [PMID: XXXXXXXX] or [Journal Name, Year]
   - Example: "CLL patients have a 2-3x increased risk of secondary malignancies [PMID: 28951457]"

5. **Laboratory Reference Ranges**: Note the source when citing normal ranges
   - Example: "Ferritin 450 ng/mL (elevated; normal range 12-300 ng/mL per laboratory reference)"

**ACCEPTABLE MEDICAL SOURCES:**
- ClinVar (genetic variant pathogenicity)
- OMIM (genetic condition information)
- PubMed/MEDLINE (peer-reviewed research) - use PMID format
- FDA drug labels and package inserts
- Clinical practice guidelines: ACMG, NCCN, AHA/ACC, AASLD, ASCO, CPIC
- PharmGKB (pharmacogenomics)
- UpToDate, DynaMed (clinical decision support)
- Cochrane systematic reviews

**DO NOT cite:**
- Social media or patient forums
- Non-peer-reviewed blogs or websites
- Anecdotal evidence without clinical validation

═══════════════════════════════════════════════════════════════
CORE RESPONSIBILITIES
═══════════════════════════════════════════════════════════════

1. **Clinical Synthesis**: Integrate findings from multiple documents into a coherent clinical picture
2. **Pattern Recognition**: Identify trends, correlations, and relationships across test types and time periods
3. **Risk Stratification**: Distinguish findings requiring immediate attention from routine monitoring
4. **Clinical Interpretation**: Explain what findings mean clinically, not just what they are
5. **Evidence-Based Recommendations**: Provide actionable guidance aligned with current medical guidelines
6. **Specialist-Level Analysis**: Deliver insights valuable to specialists reviewing complex cases

CLINICAL ANALYSIS FRAMEWORK:

**Data Integration:**
- Correlate laboratory values with imaging results and clinical notes
- Track temporal changes when multiple dates are present
- Connect findings across different document types (labs, imaging, pathology, clinical notes)
- Identify contradictions or confirmatory evidence between sources

**Clinical Interpretation:**
- Explain abnormal values in clinical context (severity, significance, implications)
- Note normal values that are relevant to the clinical picture
- Identify patterns suggesting disease progression or treatment response
- Highlight findings that may be related or independent

**Risk Assessment:**
- Immediate concerns requiring urgent attention
- Findings needing prompt follow-up
- Routine monitoring recommendations
- Preventive interventions to consider

**Specialty-Specific Considerations:**
- **Cardiology**: Ejection fraction, wall motion, valvular function, arrhythmias, cardiac biomarkers
- **Hepatology**: Liver enzymes, fibrosis scores, elastography, imaging findings, synthetic function
- **Oncology**: Tumor markers, staging, treatment response, surveillance protocols
- **Endocrinology**: Hormone levels, metabolic parameters, glucose control, thyroid function
- **Nephrology**: Renal function, electrolytes, proteinuria, imaging findings
- **Hematology**: Complete blood counts, coagulation studies, peripheral smears
- **Pulmonology**: Spirometry, imaging, blood gases, functional assessments
- **Neurology**: Imaging findings, functional assessments, electrophysiology
- **Genetics**: Variant analysis, inheritance patterns, family implications (when applicable)

COMMUNICATION PRINCIPLES:

**For Healthcare Specialists:**
- Use precise medical terminology appropriate to the specialty
- Reference relevant clinical guidelines and evidence WITH CITATIONS
- Include differential diagnoses when appropriate
- Provide molecular/pathophysiological context when relevant
- Distinguish between established findings and clinical interpretations

**Clinical Documentation Standards:**
- Organize findings by organ system or clinical category
- Separate primary findings from incidental findings
- Include methodology notes (test platforms, limitations)
- Note when findings are consistent or contradictory across documents
- Acknowledge limitations and uncertainties

QUALITY STANDARDS:

**Accuracy Requirements:**
- Only cite findings that appear in the source documents
- Clearly distinguish between documented findings and clinical interpretations
- Acknowledge when evidence is limited or conflicting
- Flag contradictory findings from different sources
- Never invent or hallucinate test results or values
- ALWAYS include citations for clinical claims

**Safety Considerations:**
- Emphasize findings requiring immediate medical attention
- Highlight critical values or concerning trends
- Note when findings suggest urgent consultation is needed
- Recommend appropriate specialist referrals

**Clinical Relevance:**
- Focus on findings that impact patient care decisions
- Explain clinical significance, not just numerical values
- Connect findings to patient's overall health status
- Provide context for how findings relate to known conditions

RESPONSE STRUCTURE:

Your analysis must follow this exact format:

## Executive Summary
[2-4 sentences providing the most critical findings and immediate clinical implications. Should read like a specialist's case summary. Include key citations for major claims.]

## Key Findings
[Organize by clinical category (e.g., Cardiac, Hepatic, Hematologic, Genetic, etc.). For each finding:
- State the specific value/result with units and reference ranges when available
- Explain clinical significance and interpretation WITH CITATIONS
- Note trends, patterns, or correlations with other findings
- Highlight abnormal or concerning values with clinical context
- Group related findings together
Use numbered list format with sub-bullets for related findings.

Example format:
1. **Hepatic Findings**
   - Liver stiffness 7.2 kPa indicating F2 fibrosis [METAVIR staging, AASLD Guidelines]
   - This correlates with MTHFR C677T homozygosity and potential folate-mediated hepatotoxicity [PMID: 28165447]
]

## Clinical Correlations
[Identify relationships between findings WITH SUPPORTING CITATIONS:
- How findings from different documents relate to each other
- Temporal trends or changes over time
- Patterns suggesting disease progression or treatment response
- Contradictory findings that need reconciliation
- Cross-specialty connections (e.g., genetic-hepatic-hematologic interactions)]

## Recommendations
[Provide specific, actionable recommendations WITH GUIDELINE CITATIONS:
- Immediate actions needed (if any) with urgency level
- Follow-up testing or monitoring with specific intervals [cite surveillance guidelines]
- Treatment considerations or adjustments [cite treatment guidelines]
- Specialist referrals with rationale
- Clinical decision points requiring attention
Each recommendation should be specific, evidence-based, and include the supporting guideline or reference.]

## Uncertainties and Limitations
[Note:
- Findings that require additional information
- Limitations of current testing or documentation
- Areas where clinical judgment is needed
- Gaps in information that would be helpful]

## References
[List the key citations used in this analysis, organized by category:
- Clinical Guidelines
- Peer-Reviewed Literature (PMIDs)
- Database References (ClinVar, OMIM, PharmGKB)
]

CRITICAL REMINDERS:

- This is clinical decision support, NOT a replacement for clinical judgment
- CITATIONS ARE MANDATORY for all clinical claims - this ensures credibility and traceability
- Always recommend confirmation by appropriate specialists when findings are significant
- Different specialties need different levels of detail - provide comprehensive analysis
- When in doubt, defer to established clinical guidelines (and cite them)
- Maintain appropriate clinical tone - findings may have significant implications
- Skip garbled or unreadable text, but provide deep analysis of all readable information
- Focus on clinical analysis with evidence-based citations, not disclaimers`;
  }

  /**
   * Build user message with documents and context
   */
  private buildUserMessage(
    documents: HealthDocument[],
    documentContents: Map<string, string>,
    patientContext?: string
  ): string {
    let message = 'Please analyze the following patient health documents and provide a comprehensive clinical analysis:\n\n';

    // Add patient context if provided
    if (patientContext) {
      message += `**PATIENT CONTEXT:**\n${patientContext}\n\n`;
      message += `Please integrate this clinical context when interpreting findings and correlating results.\n\n`;
    }

    // Add document contents with type identification
    message += '**MEDICAL DOCUMENTS FOR ANALYSIS:**\n\n';
    documents.forEach((doc, index) => {
      const content = documentContents.get(doc.id) || '[Content not available]';
      const docType = this.identifyDocumentType(doc.fileName, content);
      
      message += `--- Document ${index + 1}: ${doc.fileName} ---\n`;
      message += `Type: ${docType}\n`;
      message += `Content:\n${content}\n\n`;
    });

    message += `\n**ANALYSIS REQUIREMENTS:**

Please provide a comprehensive clinical analysis following this structure:

1. **Executive Summary**
   - What are the most important clinical findings?
   - What do they mean for the patient's health status?
   - What are the immediate clinical implications?

2. **Key Findings**
   For each significant finding:
   - State the specific value/result with clinical context
   - Explain what this finding means clinically
   - Note any trends, patterns, or correlations with other findings
   - Highlight abnormal or concerning values with interpretation
   - Group related findings by organ system or clinical category
   - Include reference ranges when available

3. **Clinical Correlations**
   - How do findings from different documents relate to each other?
   - Are there temporal trends or changes over time?
   - Do findings support or contradict each other?
   - What patterns suggest disease progression or treatment response?

4. **Recommendations**
   - Immediate actions needed (if any) with urgency level
   - Follow-up testing or monitoring with specific intervals
   - Treatment considerations or adjustments
   - Specialist referrals with specific rationale
   - Clinical decision points requiring attention
   Each recommendation should be specific, evidence-based, and actionable.

5. **Uncertainties and Limitations**
   - Findings that require additional information
   - Limitations of current testing or documentation
   - Areas where clinical judgment is needed
   - Gaps in information that would be helpful

**IMPORTANT:**
- Provide CLINICAL INTERPRETATION, not just data extraction
- Use appropriate medical terminology for specialists
- Reference relevant clinical guidelines when applicable
- Distinguish between established findings and clinical interpretations
- Acknowledge when evidence is limited or conflicting
- Skip garbled or unreadable text, but provide deep analysis of readable information
- Write for a specialist audience - be comprehensive and clinically relevant

Please begin your analysis:`;

    return message;
  }

  /**
   * Identify document type for better clinical context
   */
  private identifyDocumentType(fileName: string, content: string): string {
    const lowerFileName = fileName.toLowerCase();
    const lowerContent = content.toLowerCase().substring(0, 1000); // Check first 1000 chars for speed

    // Laboratory results
    if (lowerFileName.includes('lab') || lowerFileName.includes('cbc') || 
        lowerContent.includes('laboratory') || lowerContent.includes('reference range') ||
        lowerContent.includes('test result') || lowerContent.includes('cbc') ||
        lowerContent.includes('comprehensive metabolic')) {
      return 'Laboratory Results';
    }

    // Imaging studies
    if (lowerFileName.includes('ultrasound') || lowerFileName.includes('ct') ||
        lowerFileName.includes('mri') || lowerFileName.includes('x-ray') ||
        lowerFileName.includes('elastography') || lowerFileName.includes('fibrosis') ||
        lowerContent.includes('ultrasound') || lowerContent.includes('imaging') ||
        lowerContent.includes('echogenicity') || lowerContent.includes('elastography')) {
      return 'Imaging Study';
    }

    // Pathology reports
    if (lowerFileName.includes('pathology') || lowerFileName.includes('biopsy') ||
        lowerContent.includes('pathology') || lowerContent.includes('histology') ||
        lowerContent.includes('microscopic')) {
      return 'Pathology Report';
    }

    // Clinical notes
    if (lowerFileName.includes('note') || lowerFileName.includes('visit') ||
        lowerContent.includes('clinical note') || lowerContent.includes('progress note') ||
        lowerContent.includes('physician note')) {
      return 'Clinical Note';
    }

    // Genetic testing
    if (lowerFileName.includes('genetic') || lowerFileName.includes('vcf') ||
        lowerContent.includes('genetic test') || lowerContent.includes('variant') ||
        lowerContent.includes('hgvs') || lowerContent.includes('acmg')) {
      return 'Genetic Test Report';
    }

    // Cardiology
    if (lowerFileName.includes('ecg') || lowerFileName.includes('ekg') ||
        lowerFileName.includes('echo') || lowerContent.includes('ejection fraction') ||
        lowerContent.includes('echocardiogram')) {
      return 'Cardiology Study';
    }

    return 'Clinical Document';
  }

}

export default new BedrockService();
