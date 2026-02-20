# 03 – Analysis Pipeline (Detailed)

This document describes the **analysis pipeline** from the moment the backend receives POST /api/analyze until the report is saved and the response is sent. It is the single place to understand ordering, error handling, and parsing logic.

---

## Pipeline Stages

```mermaid
flowchart TB
  A["POST /api/analyze"] --> B["Validate: files present?"]
  B -->|No| C["400 No files uploaded"]
  B -->|Yes| D["Audit: DOCUMENT_UPLOAD"]
  D --> E["For each file: upload S3 + extract text"]
  E --> F["Bedrock: analyzeHealthData"]
  F --> G["Parse LLM markdown"]
  G --> H["Build AnalysisResult"]
  H --> I["Report.saveReport"]
  I --> J["Audit: ANALYSIS_COMPLETE"]
  J --> K["200 + report payload"]
```

---

## Stage 1: Upload and Extract (per file)

```mermaid
flowchart LR
  subgraph File["Per file"]
    F1["file buffer"] --> F2["storage.uploadFile"]
    F2 --> F3["S3 PutObject\nkey: users/{userId}/documents/{fileId}/{fileName}"]
    F3 --> F4["storage.extractTextContent(key, mimeType)"]
    F4 --> F5{"mimeType?"}
    F5 -->|PDF| F6["downloadFile → extractTextFromPDF (pdfjs-dist)"]
    F5 -->|text/json| F7["downloadFile → buffer.toString('utf-8')"]
    F5 -->|image| F8["placeholder string (Textract in prod)"]
    F6 --> F9["documentContents.set(docId, text)"]
    F7 --> F9
    F8 --> F9
  end
```

- **HealthDocument** created per file: `id` (uuid), `fileName`, `fileType`, `uploadedAt`, `s3Key`, `size`. No document ID is the S3 fileId; docId is generated in handler and used only to key `documentContents` and in the user message.
- **Extract failure**: On exception, handler sets `documentContents.set(docId, '[Content extraction failed for {fileName}]')` and continues.

---

## Stage 2: AI Analysis (Bedrock Service)

```mermaid
flowchart TB
  In["documents, documentContents Map, patientContext?"] --> BuildPrompt["buildSystemPrompt()"]
  BuildPrompt --> BuildMsg["buildUserMessage(docs, contents, context)"]
  BuildMsg --> Messages["messages = [{ role: 'user', content: [{ type: 'text', text: userMessage }] }]"]
  Messages --> Invoke["invokeModel(systemPrompt, messages)"]
  Invoke --> Ok{"Bedrock OK?"}
  Ok -->|Yes| Return["return response text"]
  Ok -->|No| Unavail["isBedrockUnavailable(error)?"]
  Unavail -->|No| Throw["throw Failed to analyze health data"]
  Unavail -->|Yes| Fallback["handleBedrockFallback"]
  Fallback --> Anth["anthropicClient?"]
  Anth -->|Yes| TryAnth["invokeAnthropicDirect"]
  TryAnth --> AnthOk{"OK?"}
  AnthOk -->|Yes| Return
  AnthOk -->|No| Ollama
  Anth -->|No| Ollama["invokeOllama (mistral:latest)"]
  Ollama --> Return
```

- **System prompt**: Defines role (expert clinical analyst), citation requirements, reference-range rules (only flag abnormal when value outside stated range), depth/comprehensiveness, response structure (## AI Summary, ## Key Findings, ## Clinical Correlations, ## Recommendations, ## Uncertainties and Limitations, ## References).
- **User message**: Patient context (if provided) + per-document block "--- Document N: filename ---", "Type: {Laboratory Results|Imaging Study|...}", "Content: {extracted text}". Document type is inferred from filename and content (e.g. lab, imaging, pathology, clinical note, genetic, cardiology).
- **Fallback order**: Bedrock → Anthropic API (if ANTHROPIC_API_KEY) → Ollama (http://localhost:11434/api/chat, model mistral:latest, 10 min timeout).

---

## Stage 3: Parse LLM Response

The LLM returns a single markdown string. The handler parses it into sections using helper functions. **Order of extraction matters** only for which header variant is tried first.

```mermaid
flowchart LR
  Raw["analysisText\n(full markdown)"] --> S1["extractSection('AI Summary', 'Executive Summary', 'Summary')"]
  Raw --> S2["extractList('Key Findings', 'Findings')"]
  Raw --> S3["extractSection('Clinical Correlations', 'Correlations')"]
  Raw --> S4["extractList('Recommendations', 'Recommendation')"]
  Raw --> S5["extractSection('Uncertainties and Limitations', 'Uncertainties', 'Limitations')"]

  S1 --> Summary["summary"]
  S2 --> Findings["keyFindings[]"]
  S3 --> Corr["clinicalCorrelations"]
  S4 --> Recs["recommendations[]"]
  S5 --> Uncert["uncertainties"]

  Summary --> Enhance["enhancedSummary = summary + (correlations if present)"]
  Findings --> FinalFindings["finalKeyFindings (or fallback: numbered/bulleted lines from full text)"]
  Recs --> FinalRecs["finalRecommendations (or fallback: parse ## Recommendations section)"]
```

- **extractSection(text, ...headers)**: Tries `## Header`, `**Header**:`, `Header:` and returns content until next section or end.
- **extractList(text, ...headers)**: Gets section first; then extracts items by `**Label:** content`, then `1. item`, then `-`/`*`/`•` items. Returns string array.
- **Fallbacks**: If keyFindings length 0, use first 10 numbered or bulleted lines from full text. If recommendations length 0, find `## Recommendations` and parse numbered/bulleted lines.
- **Default strings**: If no summary, use first 2000 chars of analysisText or "Analysis complete". If no findings, use `['Analysis completed. Review full report for details.']`. If no recommendations, use `['Review the full analysis report with your healthcare provider.']`.

---

## Stage 4: Build and Save Report

```mermaid
flowchart TB
  P["Parsed sections + fullReport"] --> R["AnalysisResult"]
  R --> Fields["id (uuid), userId, createdAt, summary: enhancedSummary, keyFindings, recommendations, citations: [], fullReport: analysisText"]
  Fields --> Save["reportService.saveReport(report)"]
  Save --> DDB["DynamoDB PutItem (reports table)"]
  DDB --> Audit["auditService.logEvent(ANALYSIS_COMPLETE, report:reportId)"]
  Audit --> Resp["Response JSON"]
```

- **AnalysisResult** type: `id`, `userId`, `createdAt`, `summary`, `keyFindings`, `recommendations`, `citations` (currently empty array), `fullReport`. Stored in DynamoDB with `createdAt` as number (epoch ms) for range key.
- **Response** includes: `success`, `reportId`, `summary`, `keyFindings`, `recommendations`, `documentCount`, `analysisDurationMs`, `analysisDurationSeconds`, `analysisDurationFormatted`, `model`.

---

## Error Handling (Pipeline)

- **No files**: 400, `{ success: false, error: 'No files uploaded' }`.
- **Multer (e.g. file type/size)**: Error propagates to Express error middleware → 500.
- **Storage/upload failure**: Throws → 500, audit not rolled back (DOCUMENT_UPLOAD already logged).
- **Extract failure per file**: Logged; placeholder text stored; pipeline continues.
- **Bedrock/fallback failure**: Throws → 500, `Failed to analyze health data`.
- **Report save failure**: Throws → 500.
- **Audit failure**: Logged but not thrown (audit must not break main flow).
