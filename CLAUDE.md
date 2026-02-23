# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

No root `package.json` — frontend and backend are independent packages run separately. All commands must be run from their respective directories.

```bash
healthweave/
├── backend/        # Express + TypeScript API (port 4000)
├── frontend/       # Next.js 16 + React 19 (port 3000)
├── diagrams/       # Mermaid architecture docs (authoritative flow reference)
├── docker-compose.yml  # LocalStack only (AWS emulation, port 4566)
└── setup.sh        # Initial environment setup
```

---

## Commands

### Backend (`cd backend`)

```bash
npm run dev       # Start with tsx watch (hot reload)
npm run build     # tsc compile to dist/
npm run start     # Run compiled dist/index.js
npm test          # Jest (no tests exist yet)
npm run lint      # ESLint on src/
npm run format    # Prettier on src/
```

### Frontend (`cd frontend`)

```bash
npm run dev       # Next.js dev server
npm run build     # Production build
npm run lint      # ESLint via next lint
```

No frontend test runner is installed.

### LocalStack (AWS emulation for dev)

```bash
docker compose up -d         # Start LocalStack
docker compose down          # Stop
docker compose logs -f       # Tail logs
```

---

## Environment

**Backend**: Loads `.env.development` first, then falls back to `.env`. A committed `.env.development` contains dev placeholder values. Copy `.env.example` to `.env` for overrides.

Key backend env vars:

- `AWS_ENDPOINT=http://localhost:4566` — points to LocalStack in dev (omit in prod)
- `BEDROCK_MODEL_ID` — e.g. `mistral` in dev, a Claude model ID in prod
- `ANTHROPIC_API_KEY` — optional; enables direct Anthropic API as Bedrock fallback
- `CORS_ORIGIN=http://localhost:3000`

**Frontend**: `NEXT_PUBLIC_API_URL=http://localhost:4000` (see `.env.example`).

---

## Architecture

### Request Flow: POST /api/analyze

1. **Multer** parses multipart upload (max 25 files, 10 MB each; types: pdf, jpeg, png, text, json)
2. Each file is uploaded to **S3** under `users/{userId}/documents/{fileId}/{fileName}`
3. Text is extracted per file: PDF via `pdfjs-dist`, text/json as UTF-8, images as a placeholder
4. All document texts + optional `patientContext` are sent to `bedrockService.analyzeHealthData()`
5. The raw markdown response is parsed into sections (`extractSection`, `extractList`) and assembled into an `AnalysisResult`
6. Report saved to **DynamoDB** (reports table); audit event written (audit table)
7. Response: `{ reportId, summary, keyFindings, recommendations, ... }`

### LLM Fallback Chain

Bedrock → Anthropic API (if `ANTHROPIC_API_KEY` set) → Ollama (`mistral:latest` at `http://localhost:11434`)

Fallback only triggers when `isBedrockUnavailable()` returns true: requires `AWS_ENDPOINT` set (LocalStack) AND a 501 or "not yet been emulated" error from Bedrock runtime. Other Bedrock errors are thrown without fallback.

### DynamoDB Tables

**Reports table** (`healthweave-reports`): PK=`id`, SK=`createdAt` (epoch ms). GSI `UserIdIndex`: PK=`userId`, SK=`createdAt`.

**Audit table** (`healthweave-audit-logs`): Same key structure. Actions: `DOCUMENT_UPLOAD`, `ANALYSIS_COMPLETE`, `ANALYSIS_FAILED`, `REPORT_VIEW`, `REPORTS_LIST`, `REPORT_DOWNLOAD`. Audit failures are swallowed (never throw to caller).

### Report Retrieval (`report.getReport`)

Queries `UserIdIndex` GSI by `userId` then filters by `id`. Falls back to a full Scan if GSI returns nothing — this covers LocalStack GSI propagation lag.

### PDF Generation

`report.generatePDF()` uses **PDFKit** with a custom **marked** markdown renderer (`renderMarkdownToPDF`). Headings, paragraphs, bullet lists, and bold are handled; output is a `Buffer` returned as `application/pdf` attachment.

### Frontend State

Single-page app (`page.tsx`) with three states driven by `useState`:

- Upload form (`FileUpload.tsx`) — dropzone + patient context textarea
- Analyzing (loading state)
- Results (`AnalysisResults.tsx`) — summary, key findings, recommendations, download PDF button

The API client lives in `frontend/src/lib/api.ts` and wraps all backend calls with axios.

---

## Key Files

| File | Purpose |
| --- | --- |
| `backend/src/services/bedrock.ts` | System prompt, user message builder, LLM invocation, fallback chain |
| `backend/src/services/report.ts` | DynamoDB persistence, PDF generation with marked renderer |
| `backend/src/handlers/analysis.ts` | All route handlers; section parsing (`extractSection`, `extractList`) |
| `backend/src/utils/config.ts` | All env var loading — check here before adding new config |
| `diagrams/` | Authoritative Mermaid diagrams for every subsystem flow |

---

## TypeScript Strictness

Backend `tsconfig.json` enables `noUnusedLocals`, `noUnusedParameters`, and `noImplicitReturns`. Variables and parameters must be used; all code paths must return. Frontend uses `@/*` path alias mapping to `frontend/src/*`.

---

## userId / Auth

There is no authentication. All handlers default `userId` to `'test-user'` when the field is absent from the request. Auth (Cognito) env vars exist in config but are unused.
