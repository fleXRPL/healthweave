# HealthWeave Prompt Library

This directory contains the medical analysis prompts used by HealthWeave's AI system. Prompts are stored as flat text files to enable:

- Version control and change tracking
- Easy collaboration and review
- Non-technical team member contributions
- Clear separation of prompts from code logic

## Directory Structure

```bash
prompts/
├── README.md                      # This file
├── comprehensive-analysis.txt     # Main medical synthesis prompt (PRODUCTION)
├── genetic-specialist.txt         # Genetics-focused analysis (FUTURE)
├── cardiac-specialist.txt         # Cardiology-focused analysis (FUTURE)
├── oncology-specialist.txt        # Oncology-focused analysis (FUTURE)
└── templates/
    └── variables.json             # Reusable prompt components (FUTURE)
```

## Prompt Template Variables

Prompts use double-curly-brace syntax for variable substitution:

- `{{PATIENT_CONTEXT}}` - Patient demographics, chief complaint, medical history
- `{{DOCUMENTS}}` - Formatted list of all documents with content
- `{{DOCUMENT_TYPES}}` - Types of documents provided (for routing)

## Current Prompts

### comprehensive-analysis.txt

**Purpose:** Main production prompt for comprehensive medical synthesis

**Features:**

- Evidence-based analysis with mandatory citations
- Cross-specialty connection identification
- Medication interaction analysis
- Pharmacogenomic considerations
- Structured JSON output
- Medical scope constraints (no ethics/finance/legal)

**Output:** Complete JSON medical analysis with citations

**Used For:**

- All general medical document synthesis
- Genetic report analysis
- Multi-specialty cases
- Complex patient scenarios

**Model Recommendations:**

- **Production:** Claude Sonnet 4.5 or Claude Opus 4 (best quality, citations)
- **Development:** Llama 3.1 70B via Ollama (adequate quality, free)

## Adding New Prompts

### 1. Create the Prompt File

Create a new `.txt` file in this directory:

```bash
touch prompts/your-new-prompt.txt
```

### 2. Use Template Variables

Include variable placeholders:

```text
You are a medical expert in {{SPECIALTY}}.

Analyze these documents:
{{DOCUMENTS}}

Patient context: {{PATIENT_CONTEXT}}
```

### 3. Document the Prompt

Add a section to this README describing:

- Purpose and use case
- Required variables
- Output format
- Recommended models

### 4. Register in Code

Update `src/services/prompt-loader.service.ts`:

```typescript
export enum PromptType {
  COMPREHENSIVE = "comprehensive-analysis",
  YOUR_NEW_PROMPT = "your-new-prompt",
}
```

## Prompt Development Guidelines

### Writing Effective Medical Prompts

1. **Be Explicit About Citations**

   - Specify required citation formats
   - List acceptable medical sources
   - Mandate evidence-based claims

2. **Define Medical Scope**

   - What the AI should analyze
   - What it should NOT analyze (ethics, finance, legal)
   - Acceptable vs unacceptable sources

3. **Structure Output Clearly**

   - Use JSON for programmatic parsing
   - Define all fields explicitly
   - Include examples when helpful

4. **Emphasize Safety**

   - Disclaimers about clinical judgment
   - Uncertainty acknowledgment
   - Evidence quality ratings

5. **Focus on Value-Add**
   - What specialists working in silos MISS
   - Cross-specialty connections
   - Care coordination insights

### Prompt Quality Checklist

Before committing a new prompt:

- [ ] Variables use `{{VARIABLE_NAME}}` syntax
- [ ] Citations are mandatory for clinical claims
- [ ] Medical scope is explicitly constrained
- [ ] Output format is well-defined (ideally JSON)
- [ ] Disclaimers are included
- [ ] Evidence quality expectations are clear
- [ ] Safety considerations are addressed
- [ ] Purpose and use case are documented in README

## Testing Prompts

### Local Testing with Ollama

```bash
# Start Ollama with medical model
ollama pull llama3.1:70b

# Test prompt in isolation
ollama run llama3.1:70b "$(cat prompts/comprehensive-analysis.txt | sed 's/{{PATIENT_CONTEXT}}/Test patient/g')"
```

### Production Testing with Claude

Use the HealthWeave backend with `AI_PROVIDER=claude` in `.env`

### A/B Testing

To compare prompt versions:

1. Save current version as `prompt-name-v1.txt`
2. Create modified version as `prompt-name-v2.txt`
3. Run both versions on same test cases
4. Compare output quality, accuracy, citation coverage

## Prompt Version Control

### Naming Convention

When making major prompt changes:

```text
comprehensive-analysis.txt          # Current production version
comprehensive-analysis-v2.txt       # New version under development
comprehensive-analysis-v1.txt       # Previous stable version (backup)
```

### Change Log

Document significant changes in Git commit messages:

```bash
git commit -m "prompts: Add pharmacogenomic analysis section to comprehensive prompt

- Added pharmacogenomic_considerations to output schema
- Specified PharmGKB and CPIC as citation sources
- Included metabolizer phenotype classification
- Tested with 10 genetic reports: 92% accuracy vs genetic counselor"
```

## Model-Specific Considerations

### Claude (Production)

- **Strengths:** Excellent medical knowledge, reliable citations, nuanced reasoning
- **Token Limits:** ~200K context window (can handle many documents)
- **Cost:** ~$0.015 per analysis (worth it for quality)
- **Citation Quality:** Very good at finding and formatting proper citations

### Llama 3.1 70B (Development)

- **Strengths:** Free, runs locally, decent medical knowledge
- **Weaknesses:** Citation quality lower, may hallucinate references
- **Token Limits:** ~128K context window
- **Cost:** Free (local compute)
- **Use Case:** Development iteration, testing prompt logic

### Prompt Adjustments for Ollama

Ollama models may need:

- More explicit instructions (less implicit understanding)
- Stricter output format enforcement
- Simpler JSON schemas (less nesting)
- More examples in the prompt

## Security & Privacy

### What Goes in Prompts

✅ Medical analysis instructions
✅ Citation requirements
✅ Output format specifications
✅ Clinical reasoning frameworks

### What Does NOT Go in Prompts

❌ API keys or credentials
❌ Patient names or identifiers
❌ Specific patient data (use variables)
❌ Internal business logic or pricing

## Contributing

### Prompt Improvement Process

1. **Identify Issue:** Note where current prompt fails or produces suboptimal results
2. **Research:** Review medical literature, guidelines, or consult domain experts
3. **Draft Changes:** Modify prompt with specific improvements
4. **Test:** Run on 10+ test cases, compare to baseline
5. **Document:** Update README with changes and rationale
6. **Review:** Get feedback from medical domain experts if possible
7. **Deploy:** Commit changes with detailed commit message

### Getting Help

Questions about prompts? Contact:

- **Technical:** [Your email]
- **Medical Content:** [Medical advisor email if you have one]
- **General:** Open an issue in GitHub

## Resources

### Medical Guidelines & Sources

- [ACMG Standards](https://www.acmg.net/ACMG/Medical-Genetics-Practice-Resources/Practice-Guidelines.aspx)
- [NCCN Guidelines](https://www.nccn.org/guidelines/)
- [ClinVar Database](https://www.ncbi.nlm.nih.gov/clinvar/)
- [PharmGKB](https://www.pharmgkb.org/)
- [CPIC Guidelines](https://cpicpgx.org/)

### Prompt Engineering

- [Anthropic Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)

---

**Last Updated:** 2025-01-15
**Current Version:** comprehensive-analysis.txt v1.0
**Maintained By:** HealthWeave Engineering Team
