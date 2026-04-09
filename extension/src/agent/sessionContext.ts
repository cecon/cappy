/**
 * In-memory session state aligned with OpenClaude mechanics (plan mode + todo list).
 * Reset when the webview bridge is disposed (clear chat / reload).
 */

export type TodoStatus = "pending" | "in_progress" | "completed";

/**
 * One checklist item (OpenClaude TodoWrite schema).
 */
export interface TodoItem {
  content: string;
  status: TodoStatus;
  activeForm: string;
}

let planMode = false;

let todos: TodoItem[] = [];

/**
 * Notas acumuladas quando o histórico é truncado para a API (paridade com memória de sessão pós-compactação no OpenClaude).
 * Injectadas como mensagem de sistema no próximo pedido ao modelo.
 */
let conversationCompactionSummary = "";

/** Limite para a memória injectada no system prompt (evita crescer sem limite). */
const MAX_COMPACTION_SUMMARY_CHARS = 36_000;

/** Normalized absolute paths read via Read in this session (OpenClaude-style pre-edit guard). */
const readPaths = new Set<string>();

/**
 * Clears plan mode and todos for a new chat session.
 */
export function resetSessionContext(): void {
  planMode = false;
  todos = [];
  readPaths.clear();
  conversationCompactionSummary = "";
}

/**
 * Acrescenta uma linha ao resumo pós-compactação (não duplica turnos completos no prompt).
 */
export function appendCompactionNote(note: string): void {
  const line = note.trim();
  if (line.length === 0) {
    return;
  }
  if (conversationCompactionSummary.length > 0) {
    conversationCompactionSummary += "\n\n";
  }
  conversationCompactionSummary += line;
  if (conversationCompactionSummary.length > MAX_COMPACTION_SUMMARY_CHARS) {
    conversationCompactionSummary =
      "[…início da memória compactada truncado por limite de tamanho…]\n\n" +
      conversationCompactionSummary.slice(conversationCompactionSummary.length - MAX_COMPACTION_SUMMARY_CHARS);
  }
}

/**
 * Texto injectado no pedido LLM para preservar contexto após cortes.
 */
export function getConversationCompactionSummary(): string {
  return conversationCompactionSummary;
}

/**
 * Records that a file was read (absolute path), for OpenClaude-style Edit gating.
 */
export function recordFileRead(absolutePath: string): void {
  readPaths.add(pathNormalize(absolutePath));
}

/**
 * Whether `Read` was used on this normalized path in the current chat session.
 */
export function wasFileReadThisSession(absolutePath: string): boolean {
  return readPaths.has(pathNormalize(absolutePath));
}

/** Normalizes path separators for stable Set lookup. */
function pathNormalize(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Whether the agent is in plan-only mode (explore/design, no writes).
 */
export function getPlanMode(): boolean {
  return planMode;
}

/**
 * Sets plan mode flag.
 */
export function setPlanMode(value: boolean): void {
  planMode = value;
}

/**
 * Replaces the todo list and returns previous and new snapshots.
 */
export function replaceTodos(next: TodoItem[]): { oldTodos: TodoItem[]; newTodos: TodoItem[] } {
  const oldTodos = [...todos];
  const allDone = next.length > 0 && next.every((item) => item.status === "completed");
  todos = allDone ? [] : [...next];
  return { oldTodos, newTodos: [...todos] };
}
