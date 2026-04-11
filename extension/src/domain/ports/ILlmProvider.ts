/**
 * Port: LLM provider abstraction.
 * Allows swapping OpenRouter / OpenAI / local models without touching domain logic.
 */

import type { Message } from "../entities/Message";

/** Tool schema passed to the model (JSON Schema object). */
export interface LlmToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** One chunk emitted during a streaming completion. */
export interface LlmStreamChunk {
  /** Streamed text delta from the assistant. */
  textDelta?: string;
  /** Index of the tool call being streamed (multi-tool support). */
  toolCallIndex?: number;
  toolCallId?: string;
  toolCallName?: string;
  toolCallArgsDelta?: string;
}

/** Options for a single LLM streaming call. */
export interface LlmCallOptions {
  model: string;
  visionModel?: string;
  systemMessages: string[];
  messages: Message[];
  tools: LlmToolSchema[];
  signal?: AbortSignal;
}

/** Notification emitted when the model falls back (e.g. vision unsupported). */
export type LlmSystemNotice = string;

export interface ILlmProvider {
  /** Streams chunks from the model. May emit system notices via onNotice. */
  stream(
    options: LlmCallOptions,
    onNotice?: (notice: LlmSystemNotice) => void,
  ): AsyncIterable<LlmStreamChunk>;
}
