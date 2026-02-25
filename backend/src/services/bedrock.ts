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
  private readonly client: BedrockRuntimeClient;
  private readonly anthropicClient: Anthropic | null = null;

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
   * Check if Bedrock is unavailable based on error characteristics
   */
  private isBedrockUnavailable(error: any): boolean {
    return !!(
      config.aws.endpoint && (
        error.name === 'InternalFailure' ||
        error.$metadata?.httpStatusCode === 501 ||
        error.__type === 'InternalFailure' ||
        error.message?.includes('bedrock-runtime') ||
        error.message?.includes('not yet been emulated')
      )
    );
  }

  /**
   * Log analysis completion with duration metrics
   */
  private logAnalysisCompletion(
    startTime: number,
    documentCount: number,
    model?: string
  ): void {
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationSec = (durationMs / 1000).toFixed(1);
    const durationMin = (durationMs / 60000).toFixed(2);
    
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info(model ? '✅ HEALTHWEAVE ANALYSIS COMPLETED (Ollama)' : '✅ HEALTHWEAVE ANALYSIS COMPLETED', {
      documentCount,
      ...(model && { model }),
      durationSeconds: Number.parseFloat(durationSec),
      durationMinutes: Number.parseFloat(durationMin),
      durationFormatted: durationMs > 60000 
        ? `${durationMin} minutes` 
        : `${durationSec} seconds`,
      endTime: new Date(endTime).toISOString(),
    });
    logger.info('═══════════════════════════════════════════════════════════');
  }

  /**
   * Handle fallback when Bedrock is unavailable
   */
  private async handleBedrockFallback(
    systemPrompt: string,
    messages: BedrockMessage[],
    startTime: number,
    documentCount: number,
    error: any
  ): Promise<{ analysisText: string; modelUsed: string }> {
    logger.warn('Bedrock unavailable, trying Anthropic direct API', {
      error: error.message || error.name,
      errorType: error.name || error.__type,
      statusCode: error.$metadata?.httpStatusCode,
    });
    
    // Try using Anthropic direct API if available
    if (this.anthropicClient) {
      try {
        const result = await this.invokeAnthropicDirect(systemPrompt, messages);
        this.logAnalysisCompletion(startTime, documentCount);
        return result;
      } catch (anthropicError: any) {
        logger.error('Anthropic API also failed', { error: anthropicError.message });
        // Fall through to Ollama
      }
    }
    
    // Fallback to Ollama (free, local LLM)
    logger.info('Using Ollama as free local LLM fallback');
    const result = await this.invokeOllama(systemPrompt, messages);
    this.logAnalysisCompletion(startTime, documentCount, result.modelUsed);
    return { analysisText: result.analysisText, modelUsed: result.modelUsed };
  }

  /**
   * Analyze health documents and generate clinical insights
   * @returns Object with analysis markdown and the model identifier used (for provenance)
   */
  async analyzeHealthData(
    documents: HealthDocument[],
    documentContents: Map<string, string>,
    patientContext?: string
  ): Promise<{ analysisText: string; modelUsed: string }> {
    const startTime = Date.now();
    const documentCount = documents.length;
    
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('🏥 HEALTHWEAVE ANALYSIS STARTED', {
      documentCount,
      hasContext: !!patientContext,
      startTime: new Date(startTime).toISOString(),
    });
    logger.info('═══════════════════════════════════════════════════════════');

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
      const result = await this.invokeModel(systemPrompt, messages);
      this.logAnalysisCompletion(startTime, documentCount);
      return result;
    } catch (error: any) {
      if (this.isBedrockUnavailable(error)) {
        return await this.handleBedrockFallback(
          systemPrompt,
          messages,
          startTime,
          documentCount,
          error
        );
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
  private async invokeModel(systemPrompt: string, messages: BedrockMessage[]): Promise<{ analysisText: string; modelUsed: string }> {
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
      const modelUsed = responseBody.model ?? modelId;
      return {
        analysisText: responseBody.content[0].text,
        modelUsed: typeof modelUsed === 'string' ? modelUsed : modelId,
      };
    }

    throw new Error('No content in Bedrock response');
  }

  /**
   * Invoke Anthropic API directly (fallback when Bedrock unavailable)
   */
  private async invokeAnthropicDirect(systemPrompt: string, messages: BedrockMessage[]): Promise<{ analysisText: string; modelUsed: string }> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    logger.info('Invoking Anthropic API directly');

    // Convert messages format - Anthropic expects simpler format
    const anthropicMessages = messages.map(msg => ({
      role: msg.role,
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
    return { analysisText: text, modelUsed: 'claude-3-5-sonnet-20241022' };
  }

  /**
   * Invoke Ollama (free local LLM) as fallback
   */
  private async invokeOllama(systemPrompt: string, messages: BedrockMessage[]): Promise<{ analysisText: string; modelUsed: string }> {
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
      // Create abort controller with 10 minute timeout for large document sets
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes
      
      logger.info('Starting Ollama request (10 min timeout)', { 
        documentTokens: userTokens,
        model: 'mistral:latest' 
      });

      // Use chat API which handles system prompts better
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          //model: 'llama3.2', // 2GB - very fast but may not follow complex prompts
          model: 'mistral:latest', // 4.4GB - RECOMMENDED for M1 Max, good balance
          //model: 'ministral-3',
          //model: 'gemma2:27b', // 15GB - good but slower
          //model: 'qwen2.5:14b', // echoes structure, weak analysis
          //model: 'medllama2:latest', // medical Q&A focused
          //model: 'meditron:latest', // echoes prompt structure, doesn't follow instructions
          //model: 'qwen2.5:32b', // uses 30GB - too much RAM pressure on 32GB system
          //model: 'llama3.1:70b', // crashes system - too large for 32GB RAM
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          stream: false,
          options: {
            temperature: 0.3,  // Lower = more consistent/deterministic output
            top_p: 0.9,
            num_ctx: 32768,  // 32K context - needed to see all 14+ documents!
          },
        }),
      });
      
      clearTimeout(timeoutId); // Clear timeout if request completes

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
      return { analysisText: text, modelUsed: data.model || 'mistral:latest' };
    } catch (error: any) {
      logger.error('Ollama request failed', { 
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        estimatedTokens: totalTokens,
      });
      
      if (error.name === 'AbortError') {
        throw new Error('AI processing timed out after 10 minutes. Try uploading fewer documents.');
      }
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama is not running. Start it with: ollama serve');
      }
      if (error.message?.includes('fetch failed')) {
        throw new Error(`Ollama connection failed: ${error.cause?.message || error.message}. Make sure Ollama is running.`);
      }
      // Pass through the actual error message
      throw new Error(`AI analysis failed: ${error.message}`);
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
REFERENCE RANGE INTERPRETATION (MANDATORY)
═══════════════════════════════════════════════════════════════

**Only flag laboratory or imaging values as abnormal when they fall OUTSIDE the stated reference range.**

- Before labeling any value as "elevated," "low," "abnormal," "anemia," "thrombocytopenia," "neutropenia," "elevated monocytes," etc., verify the numeric value against the document's reference range.
- Values within the stated normal/reference range must NOT be flagged as abnormal, elevated, low, or concerning. State that they are within normal limits when relevant to the clinical picture.
- If a reference range is provided in the document (e.g., "14.0-18.0 g/dL" or "2-10%"), the value is normal only when it falls inside that range. Do not infer abnormality from context alone when the number is in range.
- When in doubt, quote the value, quote the reference range, and state explicitly whether the value is within or outside that range before making any abnormal interpretation.
- This rule applies only to correct labeling (normal vs abnormal). It does NOT mean you should omit findings, write less, or give only high-level summaries. You must still provide comprehensive, detailed analysis (see DEPTH AND COMPREHENSIVENESS below).

═══════════════════════════════════════════════════════════════
DEPTH AND COMPREHENSIVENESS (MANDATORY)
═══════════════════════════════════════════════════════════════

**Reports must be thorough and specialist-level in depth. Do not abbreviate or summarize sections into short, high-level bullets only.**

- **Key Findings**: List each significant finding with the specific value, units, reference range (when available), and clinical interpretation. Use numbered categories (e.g., 1. Hepatic Findings) with sub-bullets that contain concrete values and citations—not just category headers like "Hepatic Findings" or "Hematologic Findings" without detailed sub-items. Include both abnormal values (flagged only when outside range) and relevant normal values (state "within normal limits" where it matters for the picture).
- **Recommendations**: Each recommendation must be a specific, actionable sentence with rationale and citations—not just category labels like "Immediate Actions" or "Follow-up Testing." For example: "Consider starting prophylactic antibiotics given neutropenia [ACMG Guidelines for Neutropenia]" not just "Immediate action: antibiotics."
- **AI Summary**: 2–4 substantive sentences that capture the most critical findings and implications; not a single vague sentence.
- **Clinical Correlations** and **Uncertainties and Limitations**: Full paragraphs or bullet lists with specific content, not placeholders.
- **Cover all document types** provided: labs, imaging, pathology, clinical notes, etc. Do not collapse multiple documents into a brief overview.

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
- Only flag lab/imaging values as abnormal when they fall outside the document's stated reference range; values within range must not be labeled elevated, low, or abnormal

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

## AI Summary
[2-4 substantive sentences: most critical findings, immediate clinical implications, key citations. Read like a specialist's case summary. Do not be vague or abbreviated.]

## Key Findings
[REQUIRED—you MUST always include this section. Do NOT omit it. This section is rendered as a TABLE in the report with columns "Finding" and "Details". Format each row as a single line: **Category name:** Summary with values, units, reference ranges, and clinical significance (with citations). One such line per table row.
- Each line = one table row: **Finding category:** Concise details (values, ranges, interpretation, citations). Combine sub-points into the Details text for that category.
- Include both abnormal (only when outside stated range) and relevant normal values ("within normal limits" where it matters)
- Use bold category names followed by a colon and the details on the same line so the report can fill the Finding | Details table
- If documents are limited, still provide at least one row (e.g. **Summary of available findings:** [specific points from the documents])

Example format (each line becomes one table row; this level of detail is required):
1. **Hepatic Findings:** Liver stiffness 7.2 kPa (normal <7.0 kPa) indicating F2 fibrosis [METAVIR staging, AASLD Guidelines]; ALT 45 U/L (reference 7-56)—within normal limits; Bilirubin 2.7 mg/dL (elevated; reference 0.2-1.2) possibly related to liver disease or hemolysis [ACMG Guidelines]
2. **Hematologic Findings:** Lymphocytes 63% (elevated; reference 20-40%)—lymphocytosis consistent with CLL [NCCN Guidelines]; Platelets 126 x 10³/µL (low; reference 145-450)—thrombocytopenia [ACMG Guidelines]
]

## Key Values (Quick Reference)
[OPTIONAL: If the documents contain lab or imaging values, list the most important ones in a markdown table with exactly 4 columns: Test | Value | Unit | Reference. Include a header row, then one row per value. Example:
| Hemoglobin | 12.1 | g/dL | 12-16 |
| Creatinine | 1.2 | mg/dL | 0.7-1.3 |
If no key values to highlight, omit this section.]

## Clinical Correlations
[Identify relationships between findings WITH SUPPORTING CITATIONS:
- How findings from different documents relate to each other
- Temporal trends or changes over time
- Patterns suggesting disease progression or treatment response
- Contradictory findings that need reconciliation
- Cross-specialty connections (e.g., genetic-hepatic-hematologic interactions)]

## Recommendations
[REQUIRED: List each recommendation as a full, specific sentence—not just category labels. Each item must be actionable with rationale and citation. Do NOT output only headers like "Immediate Actions" or "Follow-up Testing" without the actual recommendations beneath them.
- Immediate actions: specific action + urgency + citation
- Follow-up: specific tests and intervals + guideline citation
- Treatment: specific consideration + citation
- Referrals: which specialist + rationale + citation
- Decision points: what to monitor + citation

Example (this level of detail is required):
1. Consider prophylactic antibiotics given neutropenia to reduce infection risk [ACMG Guidelines for Neutropenia]
2. CBC with differential every 1-2 months; renal function every 3-6 months [NCCN Guidelines for CLL]
3. Hematology referral to discuss CLL management and monitor for infection/bleeding [ACMG Guidelines]
]

## Uncertainties and Limitations
[Note:
- Findings that require additional information
- Limitations of current testing or documentation
- Areas where clinical judgment is needed
- Gaps in information that would be helpful]

## Questions for Your Doctor
[REQUIRED: List 3-5 concrete questions the patient can ask at their next visit. Derive from key findings, recommendations, and uncertainties. Each question must be specific and actionable—e.g. "Given my thrombocytopenia and CLL, should I hold aspirin before my next procedure?" or "How often should we repeat liver elastography given my MASH F3?" Do NOT use generic questions. Format as a numbered list.]

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
- Focus on clinical analysis with evidence-based citations, not disclaimers
- Check each value against its reference range before labeling abnormal—values within normal limits must not be flagged as abnormal
- Output full depth: Key Findings as table rows (**Category:** details per line), Recommendations as full sentences with citations—not abbreviated or header-only sections
- Key Findings is MANDATORY and is displayed as a table (Finding | Details): always output at least one row in the format **Category:** details; never leave it empty or omit it`;
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

1. **AI Summary**
   - What are the most important clinical findings?
   - What do they mean for the patient's health status?
   - What are the immediate clinical implications?

2. **Key Findings** (REQUIRED—must always be present; displayed as a table with columns Finding | Details)
   Output each finding as one table row in the form **Category:** details (values, ranges, interpretation, citations).
   - One line per row: bold category name, then colon, then the summary/details
   - Include reference ranges and clinical significance; group by organ system or clinical category
   - Do not omit this section

2a. **Key Values (Quick Reference)** (optional): When lab or imaging values exist, add a 4-column markdown table after Key Findings: Test | Value | Unit | Reference.

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

6. **Questions for Your Doctor**
   - List 3-5 specific questions the patient can ask at their next visit, derived from findings and uncertainties (e.g. about medications, procedures, or monitoring).

**IMPORTANT:**
- Key Findings is REQUIRED and is rendered as a table (Finding | Details): use the format **Category:** details (one line per row); never omit this section.
- Provide a COMPREHENSIVE, DETAILED analysis—Key Findings and Recommendations must include specific values, ranges, and full actionable items with citations, not only high-level category headers.
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
