# Integration Guide: Migrating to Prompt Files

This guide shows how to update your existing code to use the new flat-file prompt system.

## What Changed

**Before (Prompts in Code):**

```typescript
// ❌ OLD WAY - Prompts embedded in TypeScript
const prompt = `
You are a medical expert...
${documents}
${patientContext}
...
`;
```

**After (Prompts in Files):**

```typescript
// ✅ NEW WAY - Prompts loaded from files
import { aiService } from "./services/ai.service";

const analysis = await aiService.analyzeDocuments(documents, patientContext);
```

## Migration Steps

### Step 1: Create Prompts Directory

```bash
cd backend
mkdir prompts
```

### Step 2: Add Prompt Files

Copy these files from your outputs to your backend:

```bash
# Copy main prompt
cp /path/to/outputs/comprehensive-analysis.txt backend/prompts/

# Copy README
cp /path/to/outputs/prompts-README.md backend/prompts/README.md
```

### Step 3: Add Services

Copy the new service files:

```bash
# Create services directory if it doesn't exist
mkdir -p backend/src/services

# Copy services
cp /path/to/outputs/prompt-loader.service.ts backend/src/services/
cp /path/to/outputs/ai.service.ts backend/src/services/
```

### Step 4: Update Your Analysis Handler

**Old Code (backend/src/handlers/analysis.ts):**

```typescript
// ❌ OLD - Direct Bedrock/Ollama calls with embedded prompts
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

export async function analyzeDocuments(req, res) {
  const { documents, patientContext } = req.body;

  // Build prompt manually
  const prompt = `
You are a medical expert...
Documents: ${JSON.stringify(documents)}
Context: ${patientContext}
...
  `;

  // Call Bedrock/Ollama directly
  const response = await bedrockClient.invokeModel({
    modelId: "anthropic.claude-v2",
    body: JSON.stringify({
      prompt,
      max_tokens: 4000,
    }),
  });

  // Parse and return
  const analysis = JSON.parse(response.body);
  res.json(analysis);
}
```

**New Code (backend/src/handlers/analysis.ts):**

```typescript
// ✅ NEW - Use AI service with prompt files
import { aiService } from "../services/ai.service";

export async function analyzeDocuments(req, res) {
  const { documents, patientContext } = req.body;

  try {
    // AI service handles everything:
    // - Loading prompt from file
    // - Formatting documents
    // - Calling appropriate AI (Ollama or Claude)
    // - Parsing JSON response
    // - Validation
    const analysis = await aiService.analyzeDocuments(
      documents,
      patientContext,
    );

    res.json({
      success: true,
      analysis,
      provider: aiService.getProviderInfo(),
    });
  } catch (error) {
    console.error("Analysis failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
```

### Step 5: Update Environment Variables

**Old .env:**

```bash
# ❌ OLD - Only AWS Bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-v2
```

**New .env:**

```bash
# ✅ NEW - Flexible AI provider
AI_PROVIDER=ollama  # or 'claude' for production

# Ollama configuration (development)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:70b

# Claude configuration (production)
ANTHROPIC_API_KEY=your_key_here
CLAUDE_MODEL=claude-sonnet-4-20250514
```

### Step 6: Update Package Dependencies

Add Anthropic SDK and axios:

```bash
npm install @anthropic-ai/sdk axios
```

**Update package.json:**

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.28.0",
    "axios": "^1.6.0"
    // ... other dependencies
  }
}
```

### Step 7: Test the Migration

**Test with Ollama (Free):**

```bash
# Make sure Ollama is running
ollama serve

# In another terminal
cd backend
npm run dev

# Test the analysis endpoint
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "name": "test-lab.txt",
        "content": "Patient: Test\nHb: 13.5 g/dL\nWBC: 7.2 K/uL"
      }
    ],
    "patientContext": {
      "age": 45,
      "sex": "M"
    }
  }'
```

**Test with Claude (Paid):**

```bash
# Update .env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your_real_key

# Restart and test
npm run dev

# Same curl command as above
```

---

## Code Examples

### Example 1: Basic Analysis

```typescript
import { aiService } from "./services/ai.service";

async function analyzePatientDocuments() {
  const documents = [
    {
      name: "genetic-report.pdf",
      content: "BRCA1 c.5266dupC pathogenic variant identified...",
    },
    {
      name: "cardiac-echo.txt",
      content: "Echocardiogram: EF 55%, mild MR...",
    },
  ];

  const patientContext = {
    age: 45,
    sex: "F",
    medicalHistory: "Family history of breast cancer",
    medications: ["Aspirin 81mg", "Lisinopril 10mg"],
  };

  const analysis = await aiService.analyzeDocuments(documents, patientContext);

  console.log("Executive Summary:", analysis.executiveSummary.summary);
  console.log("Key Findings:", analysis.keyFindings.length);
  console.log("Provider:", aiService.getProviderInfo());
}
```

### Example 2: Custom Prompt Formatting

```typescript
import { promptLoader, PromptType } from "./services/prompt-loader.service";

// Get raw prompt with custom variables
const customPrompt = promptLoader.getPrompt(PromptType.COMPREHENSIVE_ANALYSIS, {
  PATIENT_CONTEXT: "Custom context here",
  DOCUMENTS: "Custom docs here",
});

// Check prompt stats
const metadata = promptLoader.getPromptMetadata(
  PromptType.COMPREHENSIVE_ANALYSIS,
);
console.log(`Prompt has ${metadata.estimatedTokens} tokens`);
```

### Example 3: Error Handling

```typescript
import { aiService } from "./services/ai.service";

async function robustAnalysis(documents, context) {
  try {
    // Test connection first
    const connected = await aiService.testConnection();
    if (!connected) {
      throw new Error("AI service not available");
    }

    // Run analysis
    const analysis = await aiService.analyzeDocuments(documents, context);

    // Validate critical fields
    if (!analysis.executiveSummary) {
      throw new Error("Analysis missing executive summary");
    }

    return {
      success: true,
      data: analysis,
    };
  } catch (error) {
    console.error("Analysis failed:", error);

    return {
      success: false,
      error: error.message,
      fallback: "Please try again or contact support",
    };
  }
}
```

### Example 4: Development vs Production

```typescript
// Different behavior based on provider
const providerInfo = aiService.getProviderInfo();

if (providerInfo.provider === "ollama") {
  console.log("⚠️  Running in DEVELOPMENT mode with Ollama");
  console.log("⚠️  Citations may be inaccurate - verify manually");
} else {
  console.log("✅ Running in PRODUCTION mode with Claude");
  console.log("✅ Citations are reliable");
}
```

---

## Benefits of New System

### For Development

**Before:**

- ❌ Prompts buried in code
- ❌ Hard to track changes
- ❌ Expensive to test (Claude API costs)
- ❌ Can't A/B test easily

**After:**

- ✅ Prompts in version-controlled files
- ✅ Easy to see diffs in Git
- ✅ Free testing with Ollama
- ✅ Simple A/B testing (swap .txt files)

### For Team Collaboration

**Medical experts can now:**

- Review prompts directly (plain text)
- Suggest changes without coding
- Understand what AI is being told
- Validate medical accuracy of instructions

**Developers can now:**

- Focus on code, not prompt content
- Switch AI providers easily
- Test without API costs
- Track prompt versions in Git

### For Production

**Flexibility:**

- Switch between Ollama and Claude instantly
- A/B test different prompt versions
- Roll back to previous prompts easily
- Use different prompts for different use cases

**Cost Management:**

- Develop for free with Ollama
- Only pay Claude for production
- Easy to estimate costs (token count in metadata)

---

## Rollback Plan

If you need to roll back to old system:

1. **Keep old code temporarily:**

```bash
git checkout -b backup-old-prompts
git add .
git commit -m "Backup: Old prompt system before migration"
```

2. **If new system has issues:**

```bash
git checkout backup-old-prompts
```

3. **Debug the issue:**

- Check Ollama is running: `ollama serve`
- Verify prompt files exist: `ls backend/prompts/`
- Check .env configuration
- Review logs for errors

---

## Testing Checklist

Before deploying to production:

- [ ] Prompts directory created with files
- [ ] Services copied and compiling
- [ ] .env configured correctly
- [ ] Ollama tested and working
- [ ] Claude tested with real API key
- [ ] Analysis endpoint returns expected JSON
- [ ] Citations are present in output
- [ ] Error handling works (test bad inputs)
- [ ] Provider switching works (Ollama ↔ Claude)
- [ ] Performance acceptable (under 2 minutes)

---

## Troubleshooting Migration

### Problem: "Cannot find module './services/ai.service'"

**Solution:**
Make sure you copied the services to the right location:

```bash
ls backend/src/services/ai.service.ts
ls backend/src/services/prompt-loader.service.ts
```

### Problem: "Prompts directory not found"

**Solution:**

```bash
mkdir backend/prompts
cp comprehensive-analysis.txt backend/prompts/
```

### Problem: Old code still using Bedrock

**Solution:**
Search for old imports:

```bash
grep -r "BedrockRuntimeClient" backend/src/
```

Replace with new AI service.

### Problem: Analysis returns different results

**Expected:** Ollama and Claude will have different quality levels. That's normal.

**Solution:** If results are completely wrong:

1. Check prompt loaded correctly (logs show token count)
2. Verify model is appropriate (70B not 8B for quality)
3. Test with simple document first

---

## Next Steps

1. ✅ Complete migration steps
2. ✅ Test with Ollama (free)
3. ✅ Test with Claude (paid, small dataset)
4. ✅ Run on Baylor pilot test cases
5. ✅ Validate with genetic counselors
6. ✅ Deploy to production

**Questions?** Check the AI Setup Guide or open an issue.

---

**Last Updated:** 2025-01-15
**Migration Author:** HealthWeave Engineering Team
