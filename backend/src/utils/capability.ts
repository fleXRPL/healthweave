import os from 'node:os';
import type { LocalLLMProfile } from '../types';

/** Host capability tier for local LLM; determines model, context, and limits. */
export type CapabilityTier = LocalLLMProfile['tier'];

/** Host characteristics detected at runtime (for logging and tier derivation). */
export interface HostInfo {
  ramGB: number;
  cores: number;
  platform: string;
  arch: string;
}

const BYTES_PER_GB = 1024 ** 3;
const BYTES_PER_MB = 1024 ** 2;

/** Default profiles per tier. M1 Max 32GB = medium baseline. */
const DEFAULT_PROFILES: Record<CapabilityTier, Omit<LocalLLMProfile, 'tier' | 'ollamaBaseUrl'>> = {
  low: {
    model: 'llama3:8b-instruct-q4_0',
    numCtx: 4096,
    maxDocs: 6,
    maxTotalBytes: 4 * BYTES_PER_MB,
    maxConcurrentAnalyses: 1,
  },
  medium: {
    model: 'mistral:latest', // same as pre-#92 default; override with OLLAMA_MODEL if you use another model
    numCtx: 32768,
    maxDocs: 10,
    maxTotalBytes: 25 * BYTES_PER_MB,
    maxConcurrentAnalyses: 1,
  },
  high: {
    model: 'command-r:35b-v01-q4_K_M',
    numCtx: 16384,
    maxDocs: 16,
    maxTotalBytes: 16 * BYTES_PER_MB,
    maxConcurrentAnalyses: 1,
  },
};

/**
 * Read host characteristics using Node os. In Docker this may reflect the VM;
 * on bare metal (e.g. Mac Studio) it reflects the real machine.
 */
export function getHostInfo(): HostInfo {
  const totalBytes = os.totalmem();
  const ramGB = Math.round((totalBytes / BYTES_PER_GB) * 10) / 10;
  const cores = os.cpus().length;
  const platform = os.platform();
  const arch = os.arch();
  return { ramGB, cores, platform, arch };
}

/**
 * Derive capability tier from host info. Override via env LOCAL_LLM_TIER_OVERRIDE.
 * Thresholds: low < 24GB or < 8 cores; medium 24–64GB; high >= 64GB.
 */
export function detectTier(host?: HostInfo): CapabilityTier {
  const override = process.env.LOCAL_LLM_TIER_OVERRIDE?.toLowerCase();
  if (override === 'low' || override === 'medium' || override === 'high') {
    return override;
  }

  const info = host ?? getHostInfo();
  if (info.ramGB >= 64) return 'high';
  if (info.ramGB >= 24 && info.cores >= 8) return 'medium';
  return 'low';
}

/**
 * Build the active local-LLM profile for the current host. Env overrides:
 * OLLAMA_MODEL, OLLAMA_NUM_CTX, OLLAMA_BASE_URL override tier defaults.
 */
export function getLocalLLMProfile(): LocalLLMProfile {
  const hostInfo = getHostInfo();
  const tier = detectTier(hostInfo);
  const base = DEFAULT_PROFILES[tier];

  const model = process.env.OLLAMA_MODEL ?? base.model;
  const numCtx = process.env.OLLAMA_NUM_CTX
    ? Number.parseInt(process.env.OLLAMA_NUM_CTX, 10)
    : base.numCtx;
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

  return {
    tier,
    model,
    numCtx: Number.isNaN(numCtx) ? base.numCtx : numCtx,
    maxDocs: base.maxDocs,
    maxTotalBytes: base.maxTotalBytes,
    maxConcurrentAnalyses: base.maxConcurrentAnalyses,
    ollamaBaseUrl: ollamaBaseUrl.replace(/\/$/, ''),
  };
}
