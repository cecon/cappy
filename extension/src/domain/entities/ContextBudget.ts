/**
 * Context budget constants and payload type — no logic, no deps.
 * Logic lives in ContextBudgetService.
 */

/** Heuristic token estimate: chars / 4 (aligned with OpenClaude). */
export const CHARS_PER_TOKEN = 4;

/** Default context window when not set in config. */
export const DEFAULT_CONTEXT_WINDOW_TOKENS = 128_000;

/** Default tokens reserved for model output. */
export const DEFAULT_RESERVED_OUTPUT_TOKENS = 8_192;

/**
 * Buffer before the hard limit — we start trimming history before hitting
 * the ceiling (same spirit as AUTOCOMPACT_BUFFER_TOKENS in OpenClaude).
 */
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000;

/** Headroom for injected system prompts (mode prefix, skills, prefs). */
export const SYSTEM_PROMPT_OVERHEAD_TOKENS = 2_000;

/** Context usage snapshot emitted to the webview after each LLM round. */
export interface ContextUsagePayload {
  usedTokens: number;
  limitTokens: number;
  effectiveInputBudgetTokens: number;
  didTrimForApi: boolean;
  droppedMessageCount: number;
}
