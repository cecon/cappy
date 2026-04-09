import { spawn } from "node:child_process";

import { coerceSearchPattern } from "./coercePattern";
import type { ToolDefinition } from "./toolTypes";
import { getRgPath } from "./ripgrep";
import { resolveWorkspacePath } from "./workspacePath";

const DEFAULT_HEAD_LIMIT = 250;
const VCS_EXCLUDE = [".git", ".svn", ".hg", ".bzr", ".jj", ".sl"] as const;

/**
 * OpenClaude-compatible ripgrep wrapper (`Grep`).
 */
export interface GrepToolParams {
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: "content" | "files_with_matches" | "count";
  "-B"?: number;
  "-A"?: number;
  "-C"?: number;
  context?: number;
  "-n"?: boolean;
  "-i"?: boolean;
  type?: string;
  head_limit?: number;
  offset?: number;
  multiline?: boolean;
}

export interface GrepToolResult {
  mode: "content" | "files_with_matches" | "count";
  content: string;
  numFiles?: number;
  appliedLimit?: number;
  appliedOffset?: number;
}

function applyHeadLimit<T>(items: T[], limit: number | undefined, offset: number): { items: T[]; applied?: number } {
  if (limit === 0) {
    return { items: items.slice(offset), applied: undefined };
  }
  const effective = limit ?? DEFAULT_HEAD_LIMIT;
  const sliced = items.slice(offset, offset + effective);
  const truncated = items.length - offset > effective;
  return { items: sliced, applied: truncated ? effective : undefined };
}

async function runRg(args: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(getRgPath(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || code === 1) {
        resolve(stdout.split(/\r?\n/u).filter((l) => l.length > 0));
        return;
      }
      reject(new Error(stderr.trim() || `rg exited with ${code}`));
    });
  });
}

/**
 * Ripgrep search aligned with OpenClaude Grep tool behavior.
 */
export const grepTool: ToolDefinition<GrepToolParams, GrepToolResult> = {
  name: "Grep",
  description:
    "Search file contents with ripgrep (regex). Prefer this over shell grep/rg. " +
    "Supports output_mode content | files_with_matches | count, glob filters, context lines, head_limit/offset.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regular expression pattern." },
      path: { type: "string", description: "File or directory to search (defaults to workspace root)." },
      glob: { type: "string", description: 'Glob filter e.g. "*.ts" or space/comma-separated patterns.' },
      output_mode: {
        type: "string",
        enum: ["content", "files_with_matches", "count"],
        description: "content: matching lines; files_with_matches: paths only; count: per-file counts.",
      },
      "-B": { type: "number", description: "Lines before each match (content mode)." },
      "-A": { type: "number", description: "Lines after each match (content mode)." },
      "-C": { type: "number", description: "Context lines before and after (content mode)." },
      context: { type: "number", description: "Alias for -C." },
      "-n": { type: "boolean", description: "Show line numbers in content mode (default true)." },
      "-i": { type: "boolean", description: "Case insensitive." },
      type: { type: "string", description: "rg --type filter (e.g. js, py, rust)." },
      head_limit: { type: "number", description: "Max lines or entries (0 = unlimited). Default 250." },
      offset: { type: "number", description: "Skip first N entries before head_limit." },
      multiline: { type: "boolean", description: "Multiline regex (rg -U --multiline-dotall)." },
    },
    required: ["pattern"],
    additionalProperties: false,
  },
  async execute(raw) {
    const pattern = coerceSearchPattern(raw as unknown as Record<string, unknown>, "grep");
    if (pattern.length === 0) {
      throw new Error("pattern is required (use pattern, regex ou query com texto não vazio).");
    }

    const outputMode = raw.output_mode ?? "files_with_matches";
    const headLimit = raw.head_limit;
    const offset = Number.isFinite(raw.offset) ? Math.max(0, Math.trunc(raw.offset ?? 0)) : 0;

    const basePath = resolveWorkspacePath(raw.path ?? ".");
    const args: string[] = ["--hidden"];

    for (const dir of VCS_EXCLUDE) {
      args.push("--glob", `!${dir}`);
    }
    args.push("--max-columns", "500");

    if (raw.multiline) {
      args.push("-U", "--multiline-dotall");
    }
    if (raw["-i"]) {
      args.push("-i");
    }

    if (outputMode === "files_with_matches") {
      args.push("-l");
    } else if (outputMode === "count") {
      args.push("-c");
    }

    const showLineNumbers = raw["-n"] !== false;
    if (showLineNumbers && outputMode === "content") {
      args.push("-n");
    }

    if (outputMode === "content") {
      const ctx = raw.context ?? raw["-C"];
      if (ctx !== undefined) {
        args.push("-C", String(ctx));
      } else {
        if (raw["-B"] !== undefined) {
          args.push("-B", String(raw["-B"]));
        }
        if (raw["-A"] !== undefined) {
          args.push("-A", String(raw["-A"]));
        }
      }
    }

    if (raw.type) {
      args.push("--type", raw.type);
    }

    if (raw.glob) {
      const rawPatterns = raw.glob.split(/\s+/u);
      for (const part of rawPatterns) {
        if (part.includes("{") && part.includes("}")) {
          args.push("--glob", part);
        } else {
          for (const g of part.split(",").filter(Boolean)) {
            args.push("--glob", g);
          }
        }
      }
    }

    if (pattern.startsWith("-")) {
      args.push("-e", pattern);
    } else {
      args.push(pattern);
    }

    args.push(basePath);

    const lines = await runRg(args);

    if (outputMode === "content") {
      const { items, applied } = applyHeadLimit(lines, headLimit, offset);
      return {
        mode: "content",
        content: items.join("\n") || "No matches found",
        appliedLimit: applied,
        appliedOffset: offset > 0 ? offset : undefined,
      };
    }

    if (outputMode === "count") {
      const { items, applied } = applyHeadLimit(lines, headLimit, offset);
      return {
        mode: "count",
        content: items.join("\n") || "No matches found",
        appliedLimit: applied,
        appliedOffset: offset > 0 ? offset : undefined,
      };
    }

    const sorted = [...lines].sort((a, b) => a.localeCompare(b));
    const { items: finalMatches, applied } = applyHeadLimit(sorted, headLimit, offset);
    return {
      mode: "files_with_matches",
      content:
        finalMatches.length === 0
          ? "No files found"
          : `Found ${finalMatches.length} file(s)\n${finalMatches.join("\n")}`,
      numFiles: finalMatches.length,
      appliedLimit: applied,
      appliedOffset: offset > 0 ? offset : undefined,
    };
  },
};
