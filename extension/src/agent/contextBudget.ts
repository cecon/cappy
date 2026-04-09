import type { Message } from "./types";

/** Heurística ~GPT: caracteres / 4 (alinhada à ideia de `tokenCountWithEstimation` no OpenClaude). */
const CHARS_PER_TOKEN = 4;

/** Janela padrão quando não vem em `config.json` (muitos modelos via OpenRouter). */
export const DEFAULT_CONTEXT_WINDOW_TOKENS = 128_000;

/** Reserva para resposta do modelo (streaming + margem). */
export const DEFAULT_RESERVED_OUTPUT_TOKENS = 8_192;

/**
 * Buffer antes do limite duro — mesmo espírito que `AUTOCOMPACT_BUFFER_TOKENS` no OpenClaude:
 * começamos a cortar histórico antes de bater no teto.
 */
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000;

/** Margem para prompts de sistema injectados (modo Plain/Ask/Plan + prefixos). */
export const SYSTEM_PROMPT_OVERHEAD_TOKENS = 2_000;

export interface ContextUsagePayload {
  /** Tokens estimados do histórico completo da conversa (o que o utilizador acumula no chat). */
  usedTokens: number;
  /** Tamanho da janela de contexto configurada para o modelo (UI: denominador do anel). */
  limitTokens: number;
  /** Orçamento efectivo de entrada após reservas (janela − saída − buffer). */
  effectiveInputBudgetTokens: number;
  /** Se o pedido à API foi truncado nesta volta. */
  didTrimForApi: boolean;
  /** Mensagens omitidas do início ao preparar o pedido. */
  droppedMessageCount: number;
}

/**
 * Estima tokens a partir do texto (contagem rápida, consistente no mesmo sentido que Claude Code).
 */
export function estimateTextTokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estima tokens de uma mensagem interna (conteúdo + tools + imagens).
 */
export function estimateMessageTokens(message: Message): number {
  let total = estimateTextTokens(message.role);
  total += estimateTextTokens(message.content);
  if (message.tool_calls && message.tool_calls.length > 0) {
    for (const call of message.tool_calls) {
      total += estimateTextTokens(call.id);
      total += estimateTextTokens(call.name);
      total += estimateTextTokens(JSON.stringify(call.arguments));
    }
  }
  if (message.tool_call_id) {
    total += estimateTextTokens(message.tool_call_id);
  }
  if (message.images && message.images.length > 0) {
    for (const image of message.images) {
      total += Math.min(16_000, Math.ceil(image.dataUrl.length / 120));
    }
  }
  return total;
}

/**
 * Estima o total de tokens de um histórico.
 */
export function estimateMessagesTokens(messages: Message[]): number {
  let sum = 0;
  for (const message of messages) {
    sum += estimateMessageTokens(message);
  }
  return sum;
}

/**
 * Janela útil para entrada (histórico + system) antes de compactar.
 */
export function getEffectiveInputBudgetTokens(
  contextWindowTokens: number,
  reservedOutputTokens: number,
): number {
  const raw = contextWindowTokens - reservedOutputTokens - AUTOCOMPACT_BUFFER_TOKENS;
  return Math.max(4096, raw);
}

/**
 * Verifica se a sequência é válida para a API Chat (user / assistant / tool encadeados).
 */
export function isValidOpenAiMessageSequence(messages: Message[]): boolean {
  if (messages.length === 0) {
    return false;
  }
  let index = 0;
  while (index < messages.length) {
    const current = messages[index];
    if (current.role === "user") {
      index += 1;
      continue;
    }
    if (current.role === "tool") {
      return false;
    }
    if (current.role === "assistant") {
      const calls = current.tool_calls;
      index += 1;
      if (calls && calls.length > 0) {
        const pending = new Set(calls.map((c) => c.id));
        while (pending.size > 0) {
          const toolMessage = messages[index];
          if (!toolMessage || toolMessage.role !== "tool" || !toolMessage.tool_call_id) {
            return false;
          }
          if (!pending.has(toolMessage.tool_call_id)) {
            return false;
          }
          pending.delete(toolMessage.tool_call_id);
          index += 1;
        }
      }
      continue;
    }
    return false;
  }
  return true;
}

export interface TrimForBudgetResult {
  messages: Message[];
  droppedCount: number;
  droppedTokenEstimate: number;
}

/**
 * Remove mensagens a partir do início até caber no orçamento, mantendo sequência válida.
 * Preferimos cortar em fronteiras `user` (como turnos completos).
 */
export function trimMessagesForBudget(messages: Message[], maxInputTokens: number): TrimForBudgetResult {
  const fullEstimate = estimateMessagesTokens(messages);
  if (fullEstimate <= maxInputTokens && isValidOpenAiMessageSequence(messages)) {
    return { messages, droppedCount: 0, droppedTokenEstimate: 0 };
  }

  for (let start = 0; start < messages.length; start += 1) {
    if (messages[start]?.role !== "user") {
      continue;
    }
    const slice = messages.slice(start);
    if (!isValidOpenAiMessageSequence(slice)) {
      continue;
    }
    if (estimateMessagesTokens(slice) <= maxInputTokens) {
      return {
        messages: slice,
        droppedCount: start,
        droppedTokenEstimate: estimateMessagesTokens(messages.slice(0, start)),
      };
    }
  }

  for (let start = 0; start < messages.length; start += 1) {
    const slice = messages.slice(start);
    if (!isValidOpenAiMessageSequence(slice)) {
      continue;
    }
    if (estimateMessagesTokens(slice) <= maxInputTokens) {
      return {
        messages: slice,
        droppedCount: start,
        droppedTokenEstimate: estimateMessagesTokens(messages.slice(0, start)),
      };
    }
  }

  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    return {
      messages: [last],
      droppedCount: messages.length - 1,
      droppedTokenEstimate: estimateMessagesTokens(messages.slice(0, -1)),
    };
  }

  const tail = messages.slice(-Math.min(4, messages.length));
  return {
    messages: tail,
    droppedCount: Math.max(0, messages.length - tail.length),
    droppedTokenEstimate: estimateMessagesTokens(messages.slice(0, Math.max(0, messages.length - tail.length))),
  };
}
