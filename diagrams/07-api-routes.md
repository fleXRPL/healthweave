# 07 – API Routes

This document lists all **HTTP routes**, their handlers, and which services they use. It gives AI and humans a complete map of the backend API surface.

---

## Route Map

```mermaid
flowchart TB
  subgraph Routes["Express routes"]
    R1["POST /api/analyze"]
    R2["GET /api/reports/:reportId"]
    R3["GET /api/reports"]
    R4["GET /api/reports/:reportId/pdf"]
    R0["GET /health"]
  end

  subgraph Handlers["Handlers"]
    H1["analyzeDocuments"]
    H2["getReport"]
    H3["getUserReports"]
    H4["downloadReportPDF"]
  end

  R1 --> H1
  R2 --> H2
  R3 --> H3
  R4 --> H4
  R0 --> Health["JSON status"]
```

---

## Route Details

| Method | Path                       | Handler           | Auth                 | Description                                                                                                                                                                                             |
| ------ | -------------------------- | ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /health                    | (inline)          | No                   | Returns `{ status: 'healthy', timestamp, environment }`.                                                                                                                                                |
| POST   | /api/analyze               | analyzeDocuments  | No (userId in body)  | Multipart upload: documents, userId, patientContext. Uploads to S3, extracts text, runs AI, parses response, saves report, audits. Returns reportId + summary + keyFindings + recommendations + timing. |
| GET    | /api/reports/:reportId     | getReport         | No (userId in body)  | Body: userId. Returns full report JSON or 404. Logs REPORT_VIEW.                                                                                                                                        |
| GET    | /api/reports               | getUserReports    | No (userId in body)  | Body/usage: userId. Query: limit (default 50). Returns list of reports for user (most recent first). Logs REPORTS_LIST.                                                                                 |
| GET    | /api/reports/:reportId/pdf | downloadReportPDF | No (userId in query) | Query: userId. Fetches report, generates PDF, returns attachment. Logs REPORT_DOWNLOAD.                                                                                                                 |

**Note**: All report routes currently use `userId = 'test-user'` when not supplied (TODO: JWT/auth).

---

## Middleware Order (Express)

```mermaid
flowchart LR
  A["helmet"] --> B["cors"]
  B --> C["express.json 10mb"]
  C --> D["express.urlencoded 10mb"]
  D --> E["request logging"]
  E --> F["Routes"]
  F --> G["404 handler"]
  G --> H["Error handler"]
```

- **helmet**: Security headers.
- **cors**: Origin check (development allows localhost/private IPs; production uses allowed list). Methods: GET, POST, PUT, DELETE, OPTIONS. Allowed headers: Content-Type, Authorization. Credentials: true.
- **Body limits**: 10mb for JSON and urlencoded (needed for large context; actual file upload is multipart via multer in analyzeDocuments, 10MB per file, max 25 files).

---

## Service Usage by Route

```mermaid
flowchart TB
  subgraph POST_analyze["POST /api/analyze"]
    A1["audit.logEvent DOCUMENT_UPLOAD"]
    A2["storage.uploadFile (per file)"]
    A3["storage.extractTextContent (per file)"]
    A4["bedrock.analyzeHealthData"]
    A5["report.saveReport"]
    A6["audit.logEvent ANALYSIS_COMPLETE"]
  end

  subgraph GET_report["GET /api/reports/:reportId"]
    B1["report.getReport"]
    B2["audit.logEvent REPORT_VIEW"]
  end

  subgraph GET_reports["GET /api/reports"]
    C1["report.getUserReports"]
    C2["audit.logEvent REPORTS_LIST"]
  end

  subgraph GET_pdf["GET /api/reports/:reportId/pdf"]
    D1["report.getReport"]
    D2["report.generatePDF"]
    D3["audit.logEvent REPORT_DOWNLOAD"]
  end
```

---

## Error Responses

- **400**: No files uploaded (POST /api/analyze).
- **404**: Report not found (GET report or GET pdf).
- **500**: Any thrown error in handler or service (e.g. S3, Bedrock, DynamoDB, PDF generation). Message in body only in development (config.env === 'development').
- **CORS error**: Origin not allowed → response may be non-2xx; message from CORS callback.

---

## Quick Reference for AI

- **Analyze**: POST /api/analyze, multipart with `documents`, `userId`, `patientContext`. Response includes reportId; use it for GET report and GET pdf.
- **List reports**: GET /api/reports with body/param userId (e.g. test-user). Optional query limit.
- **Single report**: GET /api/reports/:reportId, body userId.
- **PDF**: GET /api/reports/:reportId/pdf?userId=... returns binary PDF; no JSON.
- **Health**: GET /health for liveness/readiness.
