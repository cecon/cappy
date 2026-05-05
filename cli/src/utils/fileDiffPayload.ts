/**
 * Builds compact line diffs for Write/Edit tool results (webview cards).
 */
import path from "node:path";
import { structuredPatch } from "diff";

import { getWorkspaceRoot } from "../tools/workspacePath";

/**
 * One line in a compact diff card (webview).
 */
export interface DiffLine {
  type: "context" | "add" | "del";
  text: string;
}

/**
 * Serializable diff summary for Write/Edit tool results.
 */
export interface FileDiffPayload {
  /** Path relative to workspace when possible. */
  path: string;
  additions: number;
  deletions: number;
  hunks: Array<{ lines: DiffLine[] }>;
}

const MAX_HUNKS_UI = 8;
const MAX_LINES_PER_HUNK = 16;

/**
 * Builds a display path for UI (relative to workspace, else basename).
 */
export function toDisplayPath(absolutePath: string): string {
  const root = getWorkspaceRoot();
  const rel = path.relative(root, absolutePath);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
    return rel.split(path.sep).join("/");
  }
  return path.basename(absolutePath);
}

/**
 * Computes line diff stats and compact hunks for the webview card.
 */
export function buildFileDiffPayload(absolutePath: string, oldText: string | null, newText: string): FileDiffPayload {
  const displayPath = toDisplayPath(absolutePath);
  const oldStr = oldText ?? "";
  const patch = structuredPatch(displayPath, displayPath, oldStr, newText, "old", "new", { context: 2 });

  let additions = 0;
  let deletions = 0;
  for (const h of patch.hunks) {
    for (const line of h.lines) {
      const prefix = line[0];
      if (prefix === "+") {
        additions += 1;
      } else if (prefix === "-") {
        deletions += 1;
      }
    }
  }

  const hunks: Array<{ lines: DiffLine[] }> = [];
  for (const h of patch.hunks.slice(0, MAX_HUNKS_UI)) {
    const lines: DiffLine[] = [];
    for (const line of h.lines) {
      if (lines.length >= MAX_LINES_PER_HUNK) {
        break;
      }
      const prefix = line[0];
      const text = line.slice(1).replace(/\n$/u, "");
      if (prefix === "+") {
        lines.push({ type: "add", text });
      } else if (prefix === "-") {
        lines.push({ type: "del", text });
      } else {
        lines.push({ type: "context", text });
      }
    }
    if (lines.length > 0) {
      hunks.push({ lines });
    }
  }

  return {
    path: displayPath,
    additions,
    deletions,
    hunks,
  };
}
