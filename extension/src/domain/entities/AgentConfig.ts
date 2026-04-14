/**
 * Configuration and preference entities — no I/O, no external deps.
 */

export type ActiveAgent = "coder" | "planner" | "reviewer" | "strategist" | "tdd" | "sdd";
export type HitlPolicy = "confirm_each" | "allow_all";
export type ChatUiMode = "plain" | "agent" | "ask";

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  visionModel: string;
  contextWindowTokens?: number;
  reservedOutputTokens?: number;
}

export interface AgentRuntimeConfig {
  activeAgent: ActiveAgent;
  systemPrompt: string;
  maxIterations: number;
  recoverToolArgumentsWithLlm?: boolean;
}

export interface McpServerConfig {
  name: string;
  url: string;
}

export interface RagConfig {
  enabled: boolean;
  embeddingModel: string;
  dimensions: number;
  chunkMaxChars: number;
  chunkOverlapChars: number;
  embeddingBatchSize: number;
  ignorePatterns: string[];
  includeExtensions: string[];
}

export interface CappyConfig {
  openrouter: OpenRouterConfig;
  agent: AgentRuntimeConfig;
  mcp: { servers: McpServerConfig[] };
  rag?: RagConfig;
  debug?: boolean;
}

/** Persisted per-workspace HITL policy (`.cappy/agent-preferences.json`). */
export interface AgentPreferences {
  version: 1;
  hitl: { destructiveTools: HitlPolicy };
}

/** McpTool metadata exposed to the agent and webview. */
export interface McpTool {
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
