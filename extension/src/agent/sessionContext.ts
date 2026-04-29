/**
 * In-memory session state aligned with OpenClaude mechanics (plan mode + todo list).
 * Reset when the webview bridge is disposed (clear chat / reload).
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// ── Plan (Spec contract) ───────────────────────────────────────────────────

export type PlanStatus = "draft" | "waiting_approval" | "approved" | "in_execution" | "failed";

export interface Plan {
  id: string;
  specMd: string;
  status: PlanStatus;
  createdAt: Date;
}

export type TodoStatus = "pending" | "in_progress" | "completed";

/**
 * One checklist item (OpenClaude TodoWrite schema).
 */
export interface TodoItem {
  content: string;
  status: TodoStatus;
  activeForm: string;
}

function generateSessionId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

/** Returns the plan file path for a given session id. */
export function getSessionPlanPath(id: string): string {
  return path.join(os.homedir(), ".cappy", "sessions", id, "plan.md");
}

let sessionId: string = generateSessionId();
let planMode = false;
let planFilePath: string | null = null;
let planContent: string | null = null;
let activePlan: Plan | null = null;

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
  sessionId = generateSessionId();
  planMode = false;
  planFilePath = null;
  planContent = null;
  activePlan = null;
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

/** Current session id (regenerated on reset). */
export function getSessionId(): string {
  return sessionId;
}

/** Absolute path to the session plan file, or null if not yet created. */
export function getPlanFilePath(): string | null {
  return planFilePath;
}

export function setPlanFilePath(p: string | null): void {
  planFilePath = p;
}

/** Markdown content of the plan, kept in memory for webview sync. */
export function getPlanContent(): string | null {
  return planContent;
}

export function setPlanContent(c: string | null): void {
  planContent = c;
}

/**
 * Initialises the session plan file at ~/.cappy/sessions/<id>/plan.md.
 * Creates the directory and an empty file if it doesn't exist yet.
 * Returns the absolute path.
 */
export async function initSessionPlanFile(): Promise<string> {
  const p = getSessionPlanPath(sessionId);
  await fs.mkdir(path.dirname(p), { recursive: true });
  // Write empty file only if it doesn't exist yet
  try {
    await fs.access(p);
  } catch {
    await fs.writeFile(p, "", "utf-8");
  }
  planFilePath = p;
  planContent = planContent ?? "";
  return p;
}

/**
 * Writes the given markdown content to the session plan file and keeps it in
 * memory so the webview can render it without re-reading the disk.
 */
export async function writeSessionPlan(content: string): Promise<string> {
  const p = planFilePath ?? (await initSessionPlanFile());
  await fs.writeFile(p, content, "utf-8");
  planFilePath = p;
  planContent = content;
  return p;
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

// ── Plan management ────────────────────────────────────────────────────────

/** Returns the active plan for this session, or null if none exists. */
export function getActivePlan(): Plan | null {
  return activePlan;
}

/** Creates and stores a new plan in draft status. Throws if a plan already exists. */
export function createActivePlan(specMd: string): Plan {
  if (activePlan !== null) {
    throw new Error("Já existe um plano ativo nesta sessão. Aprove ou revise o plano atual antes de gerar um novo.");
  }
  activePlan = {
    id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
    specMd,
    status: "waiting_approval",
    createdAt: new Date(),
  };
  return activePlan;
}

/** Updates the status of the active plan. Throws if no plan exists. */
export function updateActivePlanStatus(status: PlanStatus): Plan {
  if (activePlan === null) {
    throw new Error("Nenhum plano ativo encontrado nesta sessão.");
  }
  activePlan = { ...activePlan, status };
  return activePlan;
}

/** Replaces the active plan spec (used when regenerating after review). */
export function replaceActivePlanSpec(specMd: string): Plan {
  if (activePlan === null) {
    throw new Error("Nenhum plano ativo encontrado nesta sessão.");
  }
  activePlan = { ...activePlan, specMd, status: "waiting_approval", createdAt: new Date() };
  return activePlan;
}

/** Clears the active plan (allows generating a new one). */
export function clearActivePlan(): void {
  activePlan = null;
}
