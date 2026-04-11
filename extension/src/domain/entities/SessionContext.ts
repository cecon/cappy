/**
 * In-memory session state — encapsulated in a class instead of module globals.
 * One instance per agent run; reset on new chat session.
 */

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  content: string;
  status: TodoStatus;
  activeForm: string;
}

const MAX_COMPACTION_CHARS = 36_000;

export class SessionContext {
  private planMode = false;
  private todos: TodoItem[] = [];
  private compactionSummary = "";
  private readonly readPaths = new Set<string>();

  /** Resets all state for a new chat session. */
  reset(): void {
    this.planMode = false;
    this.todos = [];
    this.compactionSummary = "";
    this.readPaths.clear();
  }

  // ── Plan mode ─────────────────────────────────────────────────────────────

  getPlanMode(): boolean {
    return this.planMode;
  }

  setPlanMode(value: boolean): void {
    this.planMode = value;
  }

  // ── Todo list ─────────────────────────────────────────────────────────────

  getTodos(): readonly TodoItem[] {
    return this.todos;
  }

  replaceTodos(next: TodoItem[]): { old: TodoItem[]; current: TodoItem[] } {
    const old = [...this.todos];
    const allDone = next.length > 0 && next.every((i) => i.status === "completed");
    this.todos = allDone ? [] : [...next];
    return { old, current: [...this.todos] };
  }

  // ── Compaction summary ────────────────────────────────────────────────────

  appendCompactionNote(note: string): void {
    const line = note.trim();
    if (!line) return;
    if (this.compactionSummary) this.compactionSummary += "\n\n";
    this.compactionSummary += line;
    if (this.compactionSummary.length > MAX_COMPACTION_CHARS) {
      this.compactionSummary =
        "[…início truncado por limite de tamanho…]\n\n" +
        this.compactionSummary.slice(-MAX_COMPACTION_CHARS);
    }
  }

  getCompactionSummary(): string {
    return this.compactionSummary;
  }

  // ── File-read tracking (Edit guard) ───────────────────────────────────────

  recordFileRead(absolutePath: string): void {
    this.readPaths.add(normalizePath(absolutePath));
  }

  wasFileRead(absolutePath: string): boolean {
    return this.readPaths.has(normalizePath(absolutePath));
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}
