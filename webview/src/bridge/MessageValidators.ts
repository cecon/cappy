/**
 * Message validators extracted from vscode-bridge.ts.
 * Pure validation logic — no bridge state, no side effects.
 * Enables testing message validation in isolation.
 */

import type {
  CappyConfig,
  FileDiffPayload,
  McpTool,
  ToolCall,
} from "../lib/types";
import type { IncomingMessage } from "../lib/vscode-bridge";

/**
 * Narrows an unknown value to IncomingMessage.
 * Used by the bridge to discard malformed host payloads.
 */
export function isIncomingMessage(value: unknown): value is IncomingMessage {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  const v = value;

  switch (v.type) {
    case "stream:token":    return typeof v.token === "string";
    case "stream:done":     return true;
    case "stream:system":   return typeof v.message === "string";
    case "config:saved":    return true;
    case "tool:confirm":
    case "tool:executing":
    case "tool:rejected":
      return isToolCall(v.toolCall);
    case "tool:result":
      return isToolCall(v.toolCall) && typeof v.result === "string" &&
        (v.fileDiff === undefined || isFileDiffPayload(v.fileDiff));
    case "error":
      return typeof v.message === "string";
    case "config:loaded":
      return isCappyConfig(v.config);
    case "mcp:tools":
      return Array.isArray(v.tools) && (v.tools as unknown[]).every(isMcpTool);
    case "context:usage":
      return typeof v.usedTokens === "number" &&
        typeof v.limitTokens === "number" &&
        typeof v.effectiveInputBudgetTokens === "number" &&
        typeof v.didTrimForApi === "boolean" &&
        typeof v.droppedMessageCount === "number";
    case "agent:shell:start":
      return typeof v.command === "string" && (v.cwd === undefined || typeof v.cwd === "string");
    case "agent:shell:complete":
      return typeof v.command === "string" &&
        typeof v.stdout === "string" &&
        typeof v.stderr === "string" &&
        (v.errorText === undefined || typeof v.errorText === "string");
    case "hitl:policy":
      return (v.destructiveTools === "confirm_each" || v.destructiveTools === "allow_all") &&
        typeof v.sessionAutoApproveDestructive === "boolean";
    default:
      return false;
  }
}

// ── Type guards ────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isToolCall(v: unknown): v is ToolCall {
  return isRecord(v) && typeof v.id === "string" &&
    typeof v.name === "string" && isRecord(v.arguments);
}

function isFileDiffPayload(v: unknown): v is FileDiffPayload {
  if (!isRecord(v)) return false;
  if (typeof v.path !== "string" || typeof v.additions !== "number" || typeof v.deletions !== "number") return false;
  if (!Array.isArray(v.hunks)) return false;
  return (v.hunks as unknown[]).every(
    (h) => isRecord(h) && Array.isArray(h.lines) &&
      (h.lines as unknown[]).every(
        (l) => isRecord(l) &&
          (l.type === "context" || l.type === "add" || l.type === "del") &&
          typeof l.text === "string",
      ),
  );
}

function isCappyConfig(v: unknown): v is CappyConfig {
  if (!isRecord(v) || !isRecord(v.openrouter) || !isRecord(v.agent) || !isRecord(v.mcp)) return false;
  const or = v.openrouter;
  if (or.contextWindowTokens !== undefined &&
    (typeof or.contextWindowTokens !== "number" || or.contextWindowTokens < 4096)) return false;
  if (or.reservedOutputTokens !== undefined &&
    (typeof or.reservedOutputTokens !== "number" || or.reservedOutputTokens < 256)) return false;
  return typeof or.apiKey === "string" && typeof or.model === "string" &&
    typeof v.agent.systemPrompt === "string" && typeof v.agent.maxIterations === "number" &&
    Array.isArray(v.mcp.servers) &&
    (v.mcp.servers as unknown[]).every(
      (s) => isRecord(s) && typeof s.name === "string" && typeof s.url === "string",
    );
}

function isMcpTool(v: unknown): v is McpTool {
  return isRecord(v) &&
    typeof v.serverName === "string" &&
    typeof v.name === "string" &&
    typeof v.description === "string";
}
