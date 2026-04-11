/**
 * Domain service: pure message list operations.
 * Extracted from Chat.tsx helper functions. No React, no bridge, no UI deps.
 */

import type { FileDiffPayload, Message, ToolCall } from "../../lib/types";
import { extractPathArg, extractStringArg } from "./ActivityService";

// ── Stream helpers ─────────────────────────────────────────────────────────

/**
 * Appends one streaming token to the last assistant message.
 * Creates a new assistant message if the last message has a different role.
 */
export function appendAssistantToken(messages: Message[], token: string): Message[] {
  if (token.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") {
    return [...messages, { role: "assistant", content: token }];
  }
  return [...messages.slice(0, -1), { ...last, content: `${last.content}${token}` }];
}

// ── Tool log helpers ───────────────────────────────────────────────────────

/**
 * Appends one compact tool event to the message list.
 * Deduplicates identical consecutive tool messages (avoids double-display on retry).
 */
export function appendToolLogMessage(
  messages: Message[],
  title: string,
  detail: string | null,
  fileDiff?: FileDiffPayload,
): Message[] {
  const content = detail ? `${title}\n${detail}` : title;
  const last = messages[messages.length - 1];
  if (last?.role === "tool" && last.content === content && !fileDiff) return messages;
  return [...messages, { role: "tool", content, ...(fileDiff ? { fileDiff } : {}) }];
}

/**
 * Builds one human-readable detail line for a tool event.
 */
export function getToolLogDetail(toolCall: ToolCall): string | null {
  const path = extractPathArg(toolCall.arguments);
  const query = extractStringArg(toolCall.arguments, ["query", "pattern"]);
  const command = extractStringArg(toolCall.arguments, ["command"]);
  if (query) return `Filtro: ${clip(query, 120)}`;
  if (command) return `Comando: ${clip(command, 120)}`;
  if (path) return `Alvo: ${clip(path, 120)}`;
  return null;
}

/**
 * Summarises a raw tool result string for the timeline display.
 */
export function summarizeToolResult(result: string): string {
  const s = result.trim();
  if (s.length === 0) return "Tool sem retorno textual";
  return `Retorno: ${clip(s.replace(/\s+/gu, " "), 140)}`;
}

// ── Internal ───────────────────────────────────────────────────────────────

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}
