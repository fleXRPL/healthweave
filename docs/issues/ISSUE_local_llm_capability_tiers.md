# Summary

Add host-aware capability detection, tiered local-LLM profiles, resource guardrails for local-only mode, and formal deployment profiles so HealthWeave runs optimally and safely on a range of hardware (e.g. M1 Max 32GB, M4, high-end Windows, low-powered machines) without hard-freezes or OOM.

**Project:** [HealthWeave Production Readiness](https://github.com/orgs/fleXRPL/projects/6)

## Background

- Local-only mode (Ollama) already exists (#71); we need to make it stable and predictable across different host specs.
- On 32GB unified-memory machines (e.g. Mac Studio M1 Max), large models + long context can cause kernel panics; we should cap context and enforce doc/size limits.
- Docker on macOS cannot use the GPU; the recommended pattern is "sidecar" Ollama on the host, backend in Docker calling `host.docker.internal:11434`.
- We want the app to **detect** host capabilities (RAM, cores, platform) and choose appropriate model, context length, and limits—with a defined minimum (e.g. current M1 Max 32GB as baseline).

## Acceptance criteria

### 1. Capability detection and tiers

- [ ] At startup, backend reads host characteristics via Node `os`: total RAM, CPU count, platform, arch.
- [ ] Define three tiers (e.g. low / medium / high) with clear RAM/CPU thresholds; M1 Max 32GB maps to **medium**.
- [ ] Each tier has a default **local-LLM profile**: model name, `num_ctx`, max docs per run, max total bytes, max concurrent local analyses.
- [ ] Tier can be overridden via env (e.g. `LOCAL_LLM_TIER_OVERRIDE=high`) for operators who know their hardware.
- [ ] Profile is logged at startup so operators can see which tier and profile are active.

### 2. Resource guardrails (local-only mode)

- [ ] **Document/size guard:** When `localOnly` (or `AI_MODE=local`), reject the request if doc count or total upload size exceeds the active profile limits; return 400 with a clear message (e.g. "Too much content for local mode on this machine; use fewer/smaller documents or cloud mode").
- [ ] **Token/context guard:** Before calling Ollama, estimate input tokens (e.g. system + user message length / 4); if estimate > `profile.numCtx * 0.8`, reject with a clear message instead of sending the request.
- [ ] **Concurrency guard:** In local-only mode, allow only one analysis at a time (or profile’s `maxConcurrentAnalyses`); queue or return 429 for additional requests until the current one finishes.

### 3. Configuration and deployment profiles

- [ ] **AI_MODE** (or equivalent) supports: `cloud` (Bedrock + Anthropic, Ollama fallback), `local` (Ollama only), and optionally `auto`.
- [ ] Env overrides for local profile: `OLLAMA_MODEL`, `OLLAMA_NUM_CTX`, `OLLAMA_BASE_URL` override tier defaults when set.
- [ ] Docs and (if present) `docker-compose` / example env describe the **sidecar** pattern: Ollama on host, backend using `OLLAMA_BASE_URL=http://host.docker.internal:11434`.

### 4. Documentation

- [ ] Configuration guide documents: capability tiers, tier detection logic, env overrides, and recommended models per tier (e.g. llama3:8b-instruct-q8_0 for medium, command-r:35b-q4_K_M for high).
- [ ] Local-first / local-only docs mention resource limits and optional ops tips (e.g. macOS `iogpu.wired_limit_mb` for 32GB machines) without the app depending on them.
- [ ] UI or API error messages for guardrail rejections are user-friendly and suggest next steps (fewer docs, cloud mode, or wait and retry).

## Out of scope (this issue)

- GPU/Metal detection inside the app; we rely on tier derived from RAM/CPU only.
- Docker Model Runner / vLLM-Metal or other in-container GPU; sidecar Ollama remains the supported local pattern.
- Changing how documents are chunked or summarized for context (future improvement).

## Technical notes

- **Tier thresholds (example):** low &lt; 24GB RAM or &lt; 8 cores; medium 24–64GB; high ≥ 64GB. Exact numbers TBD in implementation.
- **Profile shape (example):** `{ model, numCtx, maxDocs, maxTotalBytes, maxConcurrentAnalyses }` stored in config; Ollama request builder and upload handler both use it.
- **Minimum supported:** Current M1 Max 32GB (medium tier) is the baseline; low tier supports smaller machines with reduced limits.

## References

- Local-only / privacy mode: #71
- HealthWeave Production Readiness project: [https://github.com/orgs/fleXRPL/projects/6](https://github.com/orgs/fleXRPL/projects/6)
- Discussion: host detection, resource guardrails, sidecar Ollama, capability tiers
