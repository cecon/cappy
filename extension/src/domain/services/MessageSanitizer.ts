/**
 * Domain service: LLM-based compression of dropped context messages.
 * Extracted from contextSanitize.ts; depends only on ILlmProvider port.
 */

import type { Message } from "../entities/Message";
import type { ILlmProvider } from "../ports/ILlmProvider";
import { ContextBudgetService } from "./ContextBudgetService";

export const MIN_DROPPED_TOKENS_TO_SUMMARIZE = 400;
export const MAX_SANITIZE_ITERATIONS = 5;

const MAX_SNIPPET_CHARS = 14_000;
const MAX_COMPLETION_TOKENS = 2_048;

const SUMMARY_SYSTEM = [
  "És um compressor de contexto para um assistente de programação.",
  "Recebes excertos de histórico que deixam de ser enviados ao modelo por limite de contexto.",
  "Produz um resumo denso em Markdown com secções: Objectivos, Decisões, Ficheiros/caminhos, Erros, Próximos passos.",
  "Inclui nomes de ficheiros, comandos e APIs. Omite conversa vazia. Máximo ~900 palavras.",
].join(" ");

export class MessageSanitizer {
  constructor(private readonly budget: ContextBudgetService) {}

  /** Serialises messages into a condensed text snippet for the summary request. */
  serializeForSummary(messages: Message[]): string {
    return messages.map((m) => {
      if (m.role === "user") {
        const img = m.images?.length ? `\n[${m.images.length} imagem(ns) omitidas]` : "";
        return `### user\n${clip(m.content)}${img}`;
      }
      if (m.role === "assistant") {
        let text = clip(m.content);
        if (m.tool_calls?.length) {
          const calls = m.tool_calls
            .map((c) => `- ${c.name}(${clip(JSON.stringify(c.arguments), 4_000)})`)
            .join("\n");
          text += `\n### tool_calls\n${calls}`;
        }
        return `### assistant\n${text}`;
      }
      return `### tool (${m.tool_call_id ?? "?"})\n${clip(m.content)}`;
    }).join("\n\n---\n\n");
  }

  /**
   * Requests a dense summary of `dropped` messages from the LLM.
   * Returns empty string if the dropped content is too small to warrant a call.
   */
  async summarizeDropped(
    llm: ILlmProvider,
    model: string,
    dropped: Message[],
  ): Promise<string> {
    if (!dropped.length) return "";
    const estimated = this.budget.estimateHistoryTokens(dropped);
    if (estimated < MIN_DROPPED_TOKENS_TO_SUMMARIZE) return "";
    const serialized = this.serializeForSummary(dropped);
    if (serialized.length < 64) return "";

    const chunks: string[] = [];
    for await (const chunk of llm.stream({
      model,
      systemMessages: [SUMMARY_SYSTEM],
      messages: [
        {
          role: "user",
          content: `Trecho a compactar (~${estimated} tokens estimados):\n\n${serialized}`,
        },
      ],
      tools: [],
      // No vision needed for compaction
    })) {
      if (chunk.textDelta) chunks.push(chunk.textDelta);
    }

    const raw = chunks.join("").trim();
    return raw.length > 28_000
      ? `${raw.slice(0, 28_000)}\n… [truncado]`
      : raw;
  }
}

function clip(text: string, max = MAX_SNIPPET_CHARS): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n… [truncado]`;
}
