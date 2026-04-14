import type OpenAI from "openai";

import { estimateMessagesTokens } from "./contextBudget";
import type { Message } from "./types";

/** Não gastar chamada ao modelo para cortes triviais. */
export const MIN_DROPPED_TOKENS_TO_SUMMARIZE = 400;

/** Evita loops infinitos se o resumo crescer sempre acima do orçamento. */
export const MAX_CONTEXT_SANITIZE_ITERATIONS = 5;

const MAX_MESSAGE_SNIPPET_CHARS = 14_000;
const MAX_COMPLETION_TOKENS = 2_048;

/**
 * Template de compactação estruturada, inspirado no Kilo.
 * O modelo preenche cada secção com base no excerto do histórico recebido.
 */
const COMPACTION_TEMPLATE = `## Objectivo
[O que o utilizador quer alcançar?]

## Instruções Importantes
- [Instruções relevantes dadas pelo utilizador]

## Descobertas
[O que foi aprendido durante a conversa que é útil para continuar]

## Trabalho Realizado / Em Curso / Por Fazer
[O que foi completado, o que está em progresso e o que ainda falta]

## Ficheiros / Directórios Relevantes
[Lista estruturada de ficheiros lidos, editados ou criados que são relevantes para a tarefa]`;

/**
 * Prompt de sistema para compactar histórico omitido no agente principal.
 * Usa um template estruturado (inspirado no Kilo) para produzir resumos de alta qualidade
 * que permitem a outro agente continuar o trabalho sem o histórico completo.
 */
const SANITIZE_SUMMARY_SYSTEM = [
  "És um compressor de contexto para um assistente de programação.",
  "Recebes um excerto do histórico (utilizador, assistente, resultados de tools) que deixa de ser enviado ao modelo por limite de contexto.",
  "Produz um resumo detalhado em Markdown seguindo exactamente este template:\n\n" + COMPACTION_TEMPLATE,
  "Inclui nomes de ficheiros, comandos, APIs e erros concretos quando existirem. Omite conversa vazia.",
  "Escreve no mesmo idioma predominante do excerto. Máximo ~900 palavras.",
].join("\n");

/**
 * Serializa mensagens para o pedido de resumo (truncando saídas de tools longas).
 */
export function serializeMessagesForSummary(messages: Message[]): string {
  const chunks: string[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      let text = truncate(message.content, MAX_MESSAGE_SNIPPET_CHARS);
      if (message.images && message.images.length > 0) {
        text += `\n[${String(message.images.length)} anexo(s) de imagem omitidos no resumo]`;
      }
      chunks.push(`### user\n${text}`);
    } else if (message.role === "assistant") {
      let text = truncate(message.content, MAX_MESSAGE_SNIPPET_CHARS);
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolLines = message.tool_calls.map((call) => {
          const args = truncate(JSON.stringify(call.arguments), 4_000);
          return `- ${call.name}(${args})`;
        });
        text += `\n### tool_calls\n${toolLines.join("\n")}`;
      }
      chunks.push(`### assistant\n${text}`);
    } else {
      chunks.push(`### tool (${message.tool_call_id ?? "?"})\n${truncate(message.content, MAX_MESSAGE_SNIPPET_CHARS)}`);
    }
  }
  return chunks.join("\n\n---\n\n");
}

/**
 * Gera resumo LLM do prefixo de histórico removido, para memória sanitizada do agente principal.
 *
 * @param client Cliente OpenRouter/OpenAI já configurado.
 * @param model Modelo de texto (sem visão).
 * @param dropped Mensagens que deixam de ir no pedido.
 * @returns Texto markdown; vazio se não houver matéria suficiente.
 */
export async function summarizeDroppedMessagesForMainAgent(
  client: OpenAI,
  model: string,
  dropped: Message[],
): Promise<string> {
  if (dropped.length === 0) {
    return "";
  }
  const serialized = serializeMessagesForSummary(dropped);
  if (serialized.length < 64) {
    return "";
  }

  const estimated = estimateMessagesTokens(dropped);
  if (estimated < MIN_DROPPED_TOKENS_TO_SUMMARIZE) {
    return "";
  }

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.15,
    max_tokens: MAX_COMPLETION_TOKENS,
    messages: [
      { role: "system", content: SANITIZE_SUMMARY_SYSTEM },
      {
        role: "user",
        content: `Trecho a compactar (~${String(estimated)} tokens estimados):\n\n${serialized}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  return truncate(raw, 28_000);
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n… [truncado]`;
}
