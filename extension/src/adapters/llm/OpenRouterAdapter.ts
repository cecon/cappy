/**
 * Adapter: OpenRouter / OpenAI SDK → ILlmProvider.
 * Isolates all OpenAI SDK usage. The rest of the codebase never imports openai directly.
 */

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import type { ILlmProvider, LlmCallOptions, LlmStreamChunk, LlmSystemNotice } from "../../domain/ports/ILlmProvider";
import type { Message } from "../../domain/entities/Message";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterAdapter implements ILlmProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  }

  /** Rebuilds the client when the API key changes between runs. */
  updateApiKey(apiKey: string): void {
    this.client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  }

  async *stream(
    options: LlmCallOptions,
    onNotice?: (notice: LlmSystemNotice) => void,
  ): AsyncIterable<LlmStreamChunk> {
    const { model, visionModel, systemMessages, messages, tools, signal } = options;
    const hasImages = messages.some((m) => m.images?.length);
    const selectedModel = hasImages && visionModel ? visionModel : model;
    const apiMessages = buildApiMessages(systemMessages, messages);
    const apiTools: ChatCompletionTool[] = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const payload = { model: selectedModel, stream: true as const, messages: apiMessages, tools: apiTools };

    try {
      const stream = await this.client.chat.completions.create(payload, { signal });
      yield* consumeStream(stream);
    } catch (err) {
      const msg = errorMessage(err);
      if (msg.includes("image input") || msg.includes("image_url")) {
        onNotice?.("Modelo de visão não suporta imagens. Enviando apenas texto.");
        const stripped = { ...payload, model, messages: buildApiMessages(systemMessages, messages.map(stripImages)) };
        const stream = await this.client.chat.completions.create(stripped, { signal });
        yield* consumeStream(stream);
      } else if (msg.includes("tool use") || msg.includes("tool_use")) {
        onNotice?.(`Modelo \`${selectedModel}\` não suporta tools. Reenviando com modelo principal.`);
        const stripped = { ...payload, model, messages: buildApiMessages(systemMessages, messages.map(stripImages)) };
        const stream = await this.client.chat.completions.create(stripped, { signal });
        yield* consumeStream(stream);
      } else {
        throw err;
      }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function* consumeStream(
  stream: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>,
): AsyncIterable<LlmStreamChunk> {
  for await (const chunk of stream as AsyncIterable<{ choices: Array<{ delta: { content?: string | null; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }> }>) {
    const choice = chunk.choices[0];
    if (!choice) continue;
    const content = choice.delta.content;
    if (typeof content === "string" && content.length > 0) {
      yield { textDelta: content };
    }
    for (const tc of choice.delta.tool_calls ?? []) {
      const chunk: LlmStreamChunk = { toolCallIndex: tc.index ?? 0 };
      if (tc.id) chunk.toolCallId = tc.id;
      if (tc.function?.name) chunk.toolCallName = tc.function.name;
      if (tc.function?.arguments) chunk.toolCallArgsDelta = tc.function.arguments;
      yield chunk;
    }
  }
}

function buildApiMessages(
  systemMessages: string[],
  messages: Message[],
): ChatCompletionMessageParam[] {
  const system: ChatCompletionMessageParam[] = systemMessages
    .filter((s) => s.length > 0)
    .map((s) => ({ role: "system", content: s }));

  const history: ChatCompletionMessageParam[] = messages.map((m) => {
    if (m.role === "user") {
      if (m.images?.length) {
        const parts = [
          { type: "text" as const, text: m.content },
          ...m.images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: img.dataUrl },
          })),
        ];
        return { role: "user", content: parts };
      }
      return { role: "user", content: m.content };
    }

    if (m.role === "tool") {
      return { role: "tool", content: m.content, tool_call_id: m.tool_call_id ?? "" };
    }

    // assistant
    if (m.tool_calls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    return { role: "assistant", content: m.content };
  });

  return [...system, ...history];
}

function stripImages(m: Message): Message {
  if (!m.images?.length) return m;
  return { ...m, images: [] };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message.toLowerCase() : "";
}
