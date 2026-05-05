/**
 * MemoryStore — persistent markdown-based project memory.
 *
 * Stores human-readable knowledge files in `.cappy/memory/` inside the workspace.
 * Each file is a standard markdown document representing a category of project knowledge.
 *
 * Design mirrors the skills system: files are loaded on demand, catalogued by name,
 * and their first non-empty line is used as a summary for the system prompt injection.
 */

import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MEMORY_DIR = ".cappy/memory";

/** Summary entry returned by list(). */
export interface MemoryFileSummary {
  name: string;    // filename without .md extension
  summary: string; // first non-empty line from the file (excluding markdown headings marker)
}

/** Default memory files created on first startup. */
const DEFAULT_FILES: Array<{ name: string; template: string }> = [
  {
    name: "project-overview",
    template: "# project-overview\n\n<!-- Descreva aqui o que é o projeto, stack utilizada e objetivo principal. -->\n",
  },
  {
    name: "architecture",
    template: "# architecture\n\n<!-- Documente aqui as decisões arquiteturais e padrões do projeto. -->\n",
  },
  {
    name: "conventions",
    template: "# conventions\n\n<!-- Documente aqui as convenções de código, nomenclatura e estilo do projeto. -->\n",
  },
  {
    name: "pitfalls",
    template: "# pitfalls\n\n<!-- Documente aqui problemas conhecidos, armadilhas e o que NÃO fazer. -->\n",
  },
  {
    name: "active-workstreams",
    template: "# active-workstreams\n\n<!-- Documente aqui o trabalho em andamento, tarefas abertas e próximos passos. -->\n",
  },
];

export class MemoryStore {
  private memoryDirPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, MEMORY_DIR);
  }

  private filePath(workspaceRoot: string, name: string): string {
    const safeName = sanitizeName(name);
    return path.join(this.memoryDirPath(workspaceRoot), `${safeName}.md`);
  }

  /**
   * Creates `.cappy/memory/` and the 5 default files if they do not exist.
   * Safe to call on every startup — skips files that already exist.
   */
  async ensureDefaults(workspaceRoot: string): Promise<void> {
    const dir = this.memoryDirPath(workspaceRoot);
    await mkdir(dir, { recursive: true });

    for (const { name, template } of DEFAULT_FILES) {
      const fp = this.filePath(workspaceRoot, name);
      try {
        await readFile(fp, "utf8"); // check existence
      } catch {
        // File does not exist — create it.
        await writeFile(fp, template, "utf8");
      }
    }
  }

  /**
   * Lists all `.md` files in `.cappy/memory/` with their one-line summary.
   * Returns an empty array if the directory does not exist.
   */
  async list(workspaceRoot: string): Promise<MemoryFileSummary[]> {
    const dir = this.memoryDirPath(workspaceRoot);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const mdFiles = entries.filter((e) => e.endsWith(".md")).sort();
    const results: MemoryFileSummary[] = [];

    for (const file of mdFiles) {
      const name = file.replace(/\.md$/u, "");
      const fp = path.join(dir, file);
      let summary = "";
      try {
        const content = await readFile(fp, "utf8");
        summary = extractSummary(content);
      } catch {
        // Unreadable — include with empty summary.
      }
      results.push({ name, summary });
    }

    return results;
  }

  /**
   * Reads the full content of a named memory file.
   * Returns `null` if the file does not exist.
   */
  async read(workspaceRoot: string, name: string): Promise<string | null> {
    const fp = this.filePath(workspaceRoot, name);
    try {
      return await readFile(fp, "utf8");
    } catch {
      return null;
    }
  }

  /**
   * Writes (creates or overwrites) a memory file.
   * Creates the directory if it does not exist.
   */
  async write(workspaceRoot: string, name: string, content: string): Promise<void> {
    const dir = this.memoryDirPath(workspaceRoot);
    await mkdir(dir, { recursive: true });
    const fp = this.filePath(workspaceRoot, name);
    await writeFile(fp, content, "utf8");
  }

  /**
   * Deletes a memory file.
   * Returns `true` if the file existed and was deleted, `false` if it was not found.
   */
  async delete(workspaceRoot: string, name: string): Promise<boolean> {
    const fp = this.filePath(workspaceRoot, name);
    try {
      await unlink(fp);
      return true;
    } catch {
      return false;
    }
  }
}

// ── Module-level singleton (same pattern as RagIndexer / ragSearchTool) ─────

let _memoryStore: MemoryStore | undefined;

/** Called by CappyCompositionRoot to inject the singleton. */
export function setMemoryStore(store: MemoryStore): void {
  _memoryStore = store;
}

/**
 * Returns the module-level MemoryStore instance.
 * Throws if called before `setMemoryStore()`.
 */
export function getMemoryStore(): MemoryStore {
  if (_memoryStore === undefined) {
    throw new Error("MemoryStore not initialised. Call setMemoryStore() in CappyCompositionRoot first.");
  }
  return _memoryStore;
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Strips leading `#` heading markers and returns the first non-empty,
 * non-comment line of a markdown file as a summary string.
 */
function extractSummary(content: string): string {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith("<!--")) continue;
    // Strip markdown heading markers.
    const withoutHeading = trimmed.replace(/^#+\s*/u, "");
    if (withoutHeading.length > 0) return withoutHeading;
  }
  return "";
}

/**
 * Sanitises a memory file name: lowercase, alphanumerics and hyphens only.
 * Prevents path traversal and invalid filenames.
 */
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 64) || "memory";
}
