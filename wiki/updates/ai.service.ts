import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { promptLoader, PromptType } from "./prompt-loader.service";

/**
 * AI Provider options
 */
export enum AIProvider {
  CLAUDE = "claude",
  OLLAMA = "ollama",
}

/**
 * Configuration for AI service
 */
interface AIConfig {
  provider: AIProvider;
  claudeApiKey?: string;
  claudeModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

/**
 * Medical analysis response structure
 */
export interface MedicalAnalysis {
  executiveSummary: {
    summary: string;
    primary_concerns: string[];
    key_specialties_involved: string[];
  };
  keyFindings: Array<{
    category: string;
    finding: string;
    significance: string;
    evidence: string;
    citations: Array<{
      source: string;
      reference: string;
      relevance: string;
    }>;
  }>;
  geneticAnalysis?: any;
  crossSpecialtyConnections: any[];
  medicationAnalysis: any;
  clinicalRecommendations: any[];
  surveillancePlan: any;
  questionsForProviders: any[];
  evidenceQuality: any;
  uncertainties: any[];
  disclaimers: string[];
}

/**
 * Unified AI service that works with both Claude and Ollama
 */
export class AIService {
  private config: AIConfig;
  private anthropic?: Anthropic;

  constructor() {
    // Load configuration from environment
    this.config = this.loadConfig();

    // Initialize Claude client if using Claude
    if (this.config.provider === AIProvider.CLAUDE) {
      if (!this.config.claudeApiKey) {
        throw new Error("Claude API key required when using Claude provider");
      }
      this.anthropic = new Anthropic({
        apiKey: this.config.claudeApiKey,
      });
    }

    console.log(
      `AI Service initialized with provider: ${this.config.provider}`,
    );
    if (this.config.provider === AIProvider.CLAUDE) {
      console.log(`  Model: ${this.config.claudeModel}`);
    } else {
      console.log(`  Model: ${this.config.ollamaModel}`);
      console.log(`  Ollama URL: ${this.config.ollamaBaseUrl}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): AIConfig {
    const provider = (process.env.AI_PROVIDER?.toLowerCase() ||
      "ollama") as AIProvider;

    return {
      provider,

      // Claude configuration
      claudeApiKey: process.env.ANTHROPIC_API_KEY,
      claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",

      // Ollama configuration
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      ollamaModel: process.env.OLLAMA_MODEL || "llama3.1:70b",
    };
  }

  /**
   * Analyze medical documents
   */
  async analyzeDocuments(
    documents: Array<{ name: string; content: string }>,
    patientContext: any,
  ): Promise<MedicalAnalysis> {
    console.log(
      `Analyzing ${documents.length} documents with ${this.config.provider}`,
    );

    // Format documents and context
    const formattedDocs = promptLoader.formatDocuments(documents);
    const formattedContext = promptLoader.formatPatientContext(patientContext);

    // Get the comprehensive analysis prompt
    const prompt = promptLoader.getPrompt(PromptType.COMPREHENSIVE_ANALYSIS, {
      PATIENT_CONTEXT: formattedContext,
      DOCUMENTS: formattedDocs,
    });

    // Get prompt metadata for logging
    const metadata = promptLoader.getPromptMetadata(
      PromptType.COMPREHENSIVE_ANALYSIS,
    );
    console.log(`Prompt tokens (estimated): ${metadata.estimatedTokens}`);

    // Route to appropriate provider
    let analysisText: string;

    if (this.config.provider === AIProvider.CLAUDE) {
      analysisText = await this.callClaude(prompt);
    } else {
      analysisText = await this.callOllama(prompt);
    }

    // Parse JSON response
    try {
      const analysis = this.parseAnalysisResponse(analysisText);

      // Validate critical fields exist
      this.validateAnalysis(analysis);

      return analysis;
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      console.error("Raw response:", analysisText.substring(0, 500));
      throw new Error("AI returned invalid response format");
    }
  }

  /**
   * Call Claude API
   */
  private async callClaude(prompt: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error("Claude client not initialized");
    }

    console.log("Calling Claude API...");
    const startTime = Date.now();

    try {
      const response = await this.anthropic.messages.create({
        model: this.config.claudeModel!,
        max_tokens: 12000, // Increased for comprehensive analysis with citations
        temperature: 0.2, // Lower for consistency and citation accuracy
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const duration = Date.now() - startTime;
      console.log(`Claude response received in ${duration}ms`);
      console.log(`Input tokens: ${response.usage.input_tokens}`);
      console.log(`Output tokens: ${response.usage.output_tokens}`);

      // Extract text from response
      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Claude");
      }

      return content.text;
    } catch (error: any) {
      console.error("Claude API error:", error.message);
      throw new Error(`Claude API failed: ${error.message}`);
    }
  }

  /**
   * Call Ollama API
   */
  private async callOllama(prompt: string): Promise<string> {
    console.log("Calling Ollama API...");
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.config.ollamaBaseUrl}/api/generate`,
        {
          model: this.config.ollamaModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 12000, // Max tokens to generate
          },
        },
        {
          timeout: 300000, // 5 minute timeout (Ollama can be slow on CPU)
        },
      );

      const duration = Date.now() - startTime;
      console.log(`Ollama response received in ${duration}ms`);

      return response.data.response;
    } catch (error: any) {
      console.error("Ollama API error:", error.message);

      if (error.code === "ECONNREFUSED") {
        throw new Error(
          `Cannot connect to Ollama at ${this.config.ollamaBaseUrl}. ` +
            "Make sure Ollama is running: `ollama serve`",
        );
      }

      throw new Error(`Ollama API failed: ${error.message}`);
    }
  }

  /**
   * Parse the analysis response, handling markdown code blocks if present
   */
  private parseAnalysisResponse(text: string): MedicalAnalysis {
    // Remove markdown code blocks if present (```json ... ```)
    let cleaned = text.trim();

    // Check for markdown code blocks
    if (cleaned.startsWith("```")) {
      const match = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (match) {
        cleaned = match[1].trim();
      }
    }

    // Parse JSON
    return JSON.parse(cleaned);
  }

  /**
   * Validate that critical fields exist in the analysis
   */
  private validateAnalysis(analysis: any): void {
    const required = [
      "executiveSummary",
      "keyFindings",
      "crossSpecialtyConnections",
      "medicationAnalysis",
      "clinicalRecommendations",
    ];

    for (const field of required) {
      if (!analysis[field]) {
        throw new Error(`Missing required field in analysis: ${field}`);
      }
    }

    // Validate citations exist on key findings
    if (analysis.keyFindings && analysis.keyFindings.length > 0) {
      const missingCitations = analysis.keyFindings.filter(
        (f: any) => !f.citations || f.citations.length === 0,
      );

      if (missingCitations.length > 0) {
        console.warn(
          `Warning: ${missingCitations.length} findings lack citations. ` +
            "This may indicate AI did not follow citation requirements.",
        );
      }
    }
  }

  /**
   * Get current AI provider information
   */
  getProviderInfo(): { provider: AIProvider; model: string } {
    return {
      provider: this.config.provider,
      model:
        this.config.provider === AIProvider.CLAUDE
          ? this.config.claudeModel!
          : this.config.ollamaModel!,
    };
  }

  /**
   * Test AI connection (useful for health checks)
   */
  async testConnection(): Promise<boolean> {
    try {
      const testPrompt = 'Respond with a single word: "OK"';

      if (this.config.provider === AIProvider.CLAUDE) {
        await this.callClaude(testPrompt);
      } else {
        await this.callOllama(testPrompt);
      }

      return true;
    } catch (error) {
      console.error("AI connection test failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
