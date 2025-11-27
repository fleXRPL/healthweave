import fs from "fs";
import path from "path";

/**
 * Prompt types available in the system
 */
export enum PromptType {
  COMPREHENSIVE_ANALYSIS = "comprehensive-analysis",
  // Future prompts:
  // GENETIC_SPECIALIST = 'genetic-specialist',
  // CARDIAC_SPECIALIST = 'cardiac-specialist',
}

/**
 * Variables that can be substituted in prompts
 */
export interface PromptVariables {
  PATIENT_CONTEXT: string;
  DOCUMENTS: string;
  DOCUMENT_TYPES?: string;
  [key: string]: string | undefined;
}

/**
 * Service for loading and processing prompt templates
 */
export class PromptLoaderService {
  private promptsDir: string;
  private promptCache: Map<PromptType, string>;

  constructor() {
    // Prompts directory is at backend/prompts/
    this.promptsDir = path.join(__dirname, "../../prompts");
    this.promptCache = new Map();

    // Verify prompts directory exists
    if (!fs.existsSync(this.promptsDir)) {
      throw new Error(
        `Prompts directory not found at: ${this.promptsDir}\n` +
          "Please ensure the prompts/ directory exists at the backend root level.",
      );
    }
  }

  /**
   * Load a prompt template from file
   * @param promptType - Type of prompt to load
   * @param useCache - Whether to use cached version (default: true)
   * @returns Raw prompt template with {{VARIABLES}}
   */
  private loadPromptTemplate(promptType: PromptType, useCache = true): string {
    // Check cache first
    if (useCache && this.promptCache.has(promptType)) {
      return this.promptCache.get(promptType)!;
    }

    // Build file path
    const filename = `${promptType}.txt`;
    const filepath = path.join(this.promptsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      throw new Error(
        `Prompt file not found: ${filename}\n` +
          `Expected location: ${filepath}\n` +
          `Available prompts: ${this.listAvailablePrompts().join(", ")}`,
      );
    }

    // Read file
    const template = fs.readFileSync(filepath, "utf-8");

    // Cache it
    this.promptCache.set(promptType, template);

    return template;
  }

  /**
   * Get a prompt with variables substituted
   * @param promptType - Type of prompt to load
   * @param variables - Variables to substitute into the prompt
   * @returns Processed prompt ready to send to AI
   */
  public getPrompt(promptType: PromptType, variables: PromptVariables): string {
    // Load template
    const template = this.loadPromptTemplate(promptType);

    // Substitute all variables
    let processed = template;
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        const placeholder = `{{${key}}}`;
        processed = processed.replace(new RegExp(placeholder, "g"), value);
      }
    }

    // Check for any remaining unsubstituted variables
    const unsubstituted = processed.match(/{{[A-Z_]+}}/g);
    if (unsubstituted) {
      console.warn(
        `Warning: Prompt has unsubstituted variables: ${unsubstituted.join(", ")}\n` +
          "These may be optional or you may have forgotten to provide them.",
      );
    }

    return processed;
  }

  /**
   * Format documents for insertion into prompt
   * @param documents - Array of document objects
   * @returns Formatted string ready for prompt substitution
   */
  public formatDocuments(
    documents: Array<{ name: string; content: string }>,
  ): string {
    return documents
      .map((doc, idx) => {
        return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT ${idx + 1}: ${doc.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${doc.content}
`;
      })
      .join("\n\n");
  }

  /**
   * Format patient context for insertion into prompt
   * @param context - Patient context object
   * @returns Formatted string ready for prompt substitution
   */
  public formatPatientContext(context: {
    age?: number;
    sex?: string;
    chiefComplaint?: string;
    medicalHistory?: string;
    medications?: string[];
    allergies?: string[];
    familyHistory?: string;
  }): string {
    const parts: string[] = [];

    if (context.age) parts.push(`Age: ${context.age}`);
    if (context.sex) parts.push(`Sex: ${context.sex}`);
    if (context.chiefComplaint)
      parts.push(`Chief Complaint: ${context.chiefComplaint}`);
    if (context.medicalHistory)
      parts.push(`Medical History: ${context.medicalHistory}`);

    if (context.medications && context.medications.length > 0) {
      parts.push(
        `Current Medications:\n${context.medications.map((m) => `  - ${m}`).join("\n")}`,
      );
    }

    if (context.allergies && context.allergies.length > 0) {
      parts.push(
        `Known Allergies:\n${context.allergies.map((a) => `  - ${a}`).join("\n")}`,
      );
    }

    if (context.familyHistory)
      parts.push(`Family History: ${context.familyHistory}`);

    return parts.length > 0
      ? parts.join("\n")
      : "No additional patient context provided";
  }

  /**
   * List all available prompts in the prompts directory
   * @returns Array of available prompt names
   */
  public listAvailablePrompts(): string[] {
    try {
      const files = fs.readdirSync(this.promptsDir);
      return files
        .filter((f) => f.endsWith(".txt"))
        .map((f) => f.replace(".txt", ""));
    } catch (error) {
      console.error("Error listing prompts:", error);
      return [];
    }
  }

  /**
   * Reload a specific prompt from disk (useful during development)
   * @param promptType - Type of prompt to reload
   */
  public reloadPrompt(promptType: PromptType): void {
    this.promptCache.delete(promptType);
    console.log(`Reloaded prompt: ${promptType}`);
  }

  /**
   * Clear all cached prompts (useful during development)
   */
  public clearCache(): void {
    this.promptCache.clear();
    console.log("Cleared all prompt cache");
  }

  /**
   * Get metadata about a prompt (word count, token estimate, etc.)
   * @param promptType - Type of prompt to analyze
   * @returns Metadata about the prompt
   */
  public getPromptMetadata(promptType: PromptType): {
    wordCount: number;
    charCount: number;
    estimatedTokens: number;
    lineCount: number;
  } {
    const template = this.loadPromptTemplate(promptType);

    const words = template.split(/\s+/).filter((w) => w.length > 0);
    const chars = template.length;
    const lines = template.split("\n").length;

    // Rough token estimate (OpenAI: ~4 chars per token, Claude: similar)
    const estimatedTokens = Math.ceil(chars / 4);

    return {
      wordCount: words.length,
      charCount: chars,
      estimatedTokens,
      lineCount: lines,
    };
  }
}

// Export singleton instance
export const promptLoader = new PromptLoaderService();
