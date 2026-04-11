/**
 * Domain service: token estimation and history trimming.
 * Pure logic — no I/O, no external libs. Replaces scattered functions in contextBudget.ts.
 */

import type { Message } from "../entities/Message";
import {
  CHARS_PER_TOKEN,
  AUTOCOMPACT_BUFFER_TOKENS,
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  DEFAULT_RESERVED_OUTPUT_TOKENS,
  type ContextUsagePayload,
} from "../entities/ContextBudget";

export interface TrimResult {
  messages: Message[];
  droppedCount: number;
  droppedTokenEstimate: number;
}

export class ContextBudgetService {
  estimateTokens(text: string): number {
    return text.length === 0 ? 0 : Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  estimateMessageTokens(msg: Message): number {
    let total = this.estimateTokens(msg.role) + this.estimateTokens(msg.content);
    for (const call of msg.tool_calls ?? []) {
      total += this.estimateTokens(call.id) + this.estimateTokens(call.name);
      total += this.estimateTokens(JSON.stringify(call.arguments));
    }
    if (msg.tool_call_id) total += this.estimateTokens(msg.tool_call_id);
    for (const img of msg.images ?? []) {
      total += Math.min(16_000, Math.ceil(img.dataUrl.length / 120));
    }
    return total;
  }

  estimateHistoryTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + this.estimateMessageTokens(m), 0);
  }

  getEffectiveInputBudget(contextWindow: number, reservedOutput: number): number {
    return Math.max(4096, contextWindow - reservedOutput - AUTOCOMPACT_BUFFER_TOKENS);
  }

  isValidSequence(messages: Message[]): boolean {
    if (messages.length === 0) return false;
    let i = 0;
    while (i < messages.length) {
      const msg = messages[i]!;
      if (msg.role === "user") { i++; continue; }
      if (msg.role === "tool") return false;
      if (msg.role === "assistant") {
        i++;
        const calls = msg.tool_calls;
        if (!calls?.length) continue;
        const pending = new Set(calls.map((c) => c.id));
        while (pending.size > 0) {
          const next = messages[i];
          if (!next || next.role !== "tool" || !next.tool_call_id) return false;
          if (!pending.has(next.tool_call_id)) return false;
          pending.delete(next.tool_call_id);
          i++;
        }
        continue;
      }
      return false;
    }
    return true;
  }

  trimForBudget(messages: Message[], maxTokens: number): TrimResult {
    if (this.estimateHistoryTokens(messages) <= maxTokens && this.isValidSequence(messages)) {
      return { messages, droppedCount: 0, droppedTokenEstimate: 0 };
    }

    // Prefer trimming at user-message boundaries (full turn boundaries)
    for (let start = 0; start < messages.length; start++) {
      if (messages[start]?.role !== "user") continue;
      const slice = messages.slice(start);
      if (this.isValidSequence(slice) && this.estimateHistoryTokens(slice) <= maxTokens) {
        return {
          messages: slice,
          droppedCount: start,
          droppedTokenEstimate: this.estimateHistoryTokens(messages.slice(0, start)),
        };
      }
    }

    // Fall back to any valid boundary
    for (let start = 0; start < messages.length; start++) {
      const slice = messages.slice(start);
      if (this.isValidSequence(slice) && this.estimateHistoryTokens(slice) <= maxTokens) {
        return {
          messages: slice,
          droppedCount: start,
          droppedTokenEstimate: this.estimateHistoryTokens(messages.slice(0, start)),
        };
      }
    }

    // Last resort: keep last user message or tail of 4
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      return {
        messages: [last],
        droppedCount: messages.length - 1,
        droppedTokenEstimate: this.estimateHistoryTokens(messages.slice(0, -1)),
      };
    }

    const tail = messages.slice(-Math.min(4, messages.length));
    const kept = tail.length;
    return {
      messages: tail,
      droppedCount: messages.length - kept,
      droppedTokenEstimate: this.estimateHistoryTokens(messages.slice(0, messages.length - kept)),
    };
  }

  buildUsagePayload(
    history: Message[],
    contextWindow = DEFAULT_CONTEXT_WINDOW_TOKENS,
    reservedOutput = DEFAULT_RESERVED_OUTPUT_TOKENS,
    droppedCount = 0,
    didTrim = false,
  ): ContextUsagePayload {
    return {
      usedTokens: this.estimateHistoryTokens(history),
      limitTokens: contextWindow,
      effectiveInputBudgetTokens: this.getEffectiveInputBudget(contextWindow, reservedOutput),
      didTrimForApi: didTrim,
      droppedMessageCount: droppedCount,
    };
  }
}
