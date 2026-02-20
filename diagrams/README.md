# HealthWeave – Logical Flow Diagrams

This folder contains **Mermaid diagrams** that describe the entire logical flow of the HealthWeave application. They are written so that **AI agents and humans** can quickly gain full context on what the system does, how data moves, and how components interact.

## Purpose

- **AI context**: Give LLMs and code-assist tools a complete picture of the app without reading every file.
- **Onboarding**: New contributors (or future-you) can follow flows from user action to storage.
- **Reference**: Single source of truth for request/response flow, service boundaries, and data shapes.

## Diagram Index

| File                                               | Contents                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [01-overview.md](01-overview.md)                   | What HealthWeave is, tech stack, high-level architecture, main flows.                |
| [02-user-flow.md](02-user-flow.md)                 | End-to-end user journey: upload → analysis → results → PDF download.                 |
| [03-analysis-pipeline.md](03-analysis-pipeline.md) | Detailed analysis pipeline: handler → storage → extract → AI → parse → report save.  |
| [04-backend-services.md](04-backend-services.md)   | Backend services (Storage, Bedrock, Report, Audit), responsibilities, and call flow. |
| [05-bedrock-ai-flow.md](05-bedrock-ai-flow.md)     | AI flow: system prompt, user message, Bedrock → Anthropic → Ollama fallback.         |
| [06-data-model.md](06-data-model.md)               | Core types: HealthDocument, AnalysisResult, AuditLog, Config.                        |
| [07-api-routes.md](07-api-routes.md)               | REST API routes, request/response shapes, and which handlers/services they use.      |

## How to Use

- **Render Mermaid**: Paste diagram code into [Mermaid Live](https://mermaid.live), VS Code (Mermaid extension), or GitHub (renders in .md).
- **Navigate**: Start with `01-overview.md` for context, then follow the flow through `02` → `03` → `04` → `05` as needed. Use `06` and `07` for data and API reference.

## Key Concepts (for AI)

- **HealthWeave** = AI-powered health document synthesis. Users upload medical documents (PDF, images, text); the backend extracts text, sends it to an LLM (AWS Bedrock, or Anthropic/Ollama fallback), parses the markdown response into sections, stores the report in DynamoDB, and returns summary/findings/recommendations. Users can view results in the UI and download a PDF report.
- **userId**: Currently default `test-user`; no auth yet. All report and audit data is keyed by userId.
- **Single analysis** = one POST with N files → one report (id, summary, keyFindings, recommendations, fullReport). Report is persisted; PDF is generated on-demand from stored report.
