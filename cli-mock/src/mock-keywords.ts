/**
 * Palavras-chave do cli-mock: inclui `@mock:<cenário>` na última mensagem do utilizador
 * para o servidor WebSocket simular tools sem chamar o LLM.
 *
 * Exemplos:
 * - `@mock:hitl` — pedido Bash com HITL; após aprovar, eco shell + resultado fictício.
 * - `@mock:write` — pedido Write com HITL (ficheiro fictício).
 * - `@mock:stream` — só texto em stream (sem tools).
 * - `@mock:usage` — envia um snapshot `context:usage` de exemplo.
 */

/** Regex: `@mock:slug` (case-insensitive). */
const MOCK_TAG = /@mock:([a-z0-9_-]+)/i;

export type MockKeywordScenario = "hitl-shell" | "hitl-write" | "stream-only" | "context-usage";

/**
 * Extrai o último texto de mensagem `user` (string).
 */
export function getLastUserText(messages: Array<{ role: string; content?: string }>): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content;
    }
  }
  return "";
}

/**
 * Se a mensagem contém `@mock:slug`, devolve o cenário correspondente; caso contrário `null` (usa AgentLoop normal).
 */
export function matchMockScenario(lastUserText: string): MockKeywordScenario | null {
  const match = MOCK_TAG.exec(lastUserText);
  if (!match) {
    return null;
  }
  const slug = (match[1] ?? "").toLowerCase();
  if (slug === "hitl" || slug === "shell" || slug === "bash") {
    return "hitl-shell";
  }
  if (slug === "write" || slug === "file") {
    return "hitl-write";
  }
  if (slug === "stream" || slug === "text") {
    return "stream-only";
  }
  if (slug === "usage" || slug === "context") {
    return "context-usage";
  }
  return null;
}

/**
 * Gera um id estável o suficiente para uma tool mock.
 */
export function nextMockToolCallId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
