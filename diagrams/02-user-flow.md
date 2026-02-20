# 02 – User Flow (End-to-End)

This diagram describes the **end-to-end user journey** from opening the app to viewing results and downloading the PDF. It is tailored for AI to understand the logical order of UI and API actions.

---

## User Journey Overview

```mermaid
flowchart LR
  A["1. Land on app"] --> B["2. Enter optional context"]
  B --> C["3. Add files (dropzone)"]
  C --> D["4. Submit Analyze"]
  D --> E["5. Wait (analysis runs)"]
  E --> F["6. See results + Download PDF"]
  F --> G["7. Optional: Analyze New Documents"]
  G --> A
```

---

## Detailed Sequence: Analyze Documents

```mermaid
sequenceDiagram
  actor User
  participant UI as Frontend (page.tsx)
  participant FileUpload as FileUpload.tsx
  participant API as lib/api
  participant Backend as Express
  participant Multer as multer
  participant Handler as analysis handler
  participant Storage as storage service
  participant S3 as S3
  participant Bedrock as bedrock service
  participant LLM as Bedrock/Anthropic/Ollama
  participant Report as report service
  participant DDB as DynamoDB
  participant Audit as audit service

  User->>FileUpload: Fills patient context (optional)
  User->>FileUpload: Drops/selects files (PDF, images, txt)
  User->>FileUpload: Clicks "Analyze"
  FileUpload->>UI: handleAnalyze(files, patientContext)
  UI->>UI: setIsAnalyzing(true), setError(null)
  UI->>API: analyzeDocuments(files, patientContext)

  Note over API: FormData: documents[] + userId + patientContext
  API->>Backend: POST /api/analyze (multipart/form-data)
  Backend->>Multer: Parse multipart (max 25 files, 10MB each)
  Multer-->>Handler: req.files, req.body.userId, req.body.patientContext

  Handler->>Audit: logEvent(DOCUMENT_UPLOAD)
  Audit->>DDB: PutItem (audit table)

  loop For each file
    Handler->>Storage: uploadFile(userId, fileName, buffer, mimeType)
    Storage->>S3: PutObject (key: users/{userId}/documents/{fileId}/{fileName})
    Storage-->>Handler: { key, url }
    Handler->>Storage: extractTextContent(key, mimeType)
    alt PDF
      Storage->>S3: GetObject
      Storage->>Storage: extractTextFromPDF (pdfjs-dist)
    else text/json
      Storage->>S3: GetObject
      Storage->>Storage: buffer.toString('utf-8')
    else image
      Storage-->>Handler: placeholder text (Textract in prod)
    end
    Storage-->>Handler: extracted text
    Handler->>Handler: documentContents.set(docId, content)
  end

  Handler->>Bedrock: analyzeHealthData(documents, documentContents, patientContext)
  Bedrock->>Bedrock: buildSystemPrompt()
  Bedrock->>Bedrock: buildUserMessage(docs, contents, context)
  Bedrock->>LLM: invoke (system + user message)
  LLM-->>Bedrock: raw markdown response
  Bedrock-->>Handler: analysisText (full markdown)

  Handler->>Handler: extractSection(analysisText, 'AI Summary', ...)
  Handler->>Handler: extractList(analysisText, 'Key Findings', ...)
  Handler->>Handler: extractSection(analysisText, 'Clinical Correlations', ...)
  Handler->>Handler: extractList(analysisText, 'Recommendations', ...)
  Handler->>Handler: extractSection(analysisText, 'Uncertainties and Limitations', ...)
  Handler->>Handler: Build report object (summary, keyFindings, recommendations, fullReport)

  Handler->>Report: saveReport(report)
  Report->>DDB: PutItem (reports table)
  Handler->>Audit: logEvent(ANALYSIS_COMPLETE, reportId)
  Audit->>DDB: PutItem (audit table)

  Handler-->>Backend: res.json({ success, reportId, summary, keyFindings, recommendations, documentCount, analysisDurationMs, ... })
  Backend-->>API: 200 JSON
  API-->>UI: result
  UI->>UI: setAnalysisResult(result), setIsAnalyzing(false)
  UI->>User: Show AnalysisResults (summary, findings, recommendations, Download PDF button)
```

---

## Sequence: Download PDF

```mermaid
sequenceDiagram
  actor User
  participant UI as AnalysisResults.tsx
  participant API as lib/api
  participant Backend as Express
  participant Handler as analysis handler
  participant Report as report service
  participant DDB as DynamoDB
  participant Audit as audit service

  User->>UI: Clicks "Download PDF"
  UI->>API: downloadReportPDF(reportId)
  API->>Backend: GET /api/reports/:reportId/pdf?userId=test-user
  Backend->>Handler: getReport(reportId), then downloadReportPDF
  Handler->>Report: getReport(reportId, userId)
  Report->>DDB: Query/Scan by reportId + userId
  DDB-->>Report: report item
  Report-->>Handler: report (AnalysisResult)
  Handler->>Report: generatePDF(report)
  Report->>Report: PDFKit: header, summary, keyFindings, recommendations, fullReport (markdown), footer
  Report-->>Handler: PDF Buffer
  Handler->>Audit: logEvent(REPORT_DOWNLOAD)
  Handler-->>Backend: res.send(pdfBuffer) (Content-Type: application/pdf, Content-Disposition: attachment)
  Backend-->>API: PDF binary
  API-->>UI: blob
  UI->>UI: createObjectURL, <a download>.click()
  User->>User: PDF file saved
```

---

## UI State Flow

```mermaid
stateDiagram-v2
  [*] --> Upload: App load
  Upload --> Analyzing: Submit (files + context)
  Analyzing --> Results: Success (reportId + data)
  Analyzing --> Upload: Error (setError, user can retry)
  Results --> Upload: "Analyze New Documents"
  Results --> Downloading: Click Download PDF
  Downloading --> Results: Blob received, trigger save
```

---

## File and Request Constraints (for AI)

- **Allowed file types**: `application/pdf`, `image/jpeg`, `image/png`, `text/plain`, `application/json`.
- **Limits**: 25 files per request, 10MB per file (multer + frontend dropzone).
- **Request body (POST /api/analyze)**: `multipart/form-data` with `documents` (files), `userId` (optional, default test-user), `patientContext` (optional string).
- **Response (success)**: `success: true`, `reportId`, `summary`, `keyFindings`, `recommendations`, `documentCount`, `analysisDurationMs`, `analysisDurationFormatted`, `model` (e.g. mistral:latest when Ollama used).
