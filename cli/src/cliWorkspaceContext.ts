import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const CAPPY_MD_FILENAME = "CAPPY.md";

// ─── CAPPY.md loader ──────────────────────────────────────────────────────────

export async function loadCappyMd(workspaceRoot: string): Promise<string | null> {
  const filePath = path.join(workspaceRoot, CAPPY_MD_FILENAME);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.trim().length > 0 ? content.trim() : null;
  } catch {
    return null;
  }
}

// ─── Git context ──────────────────────────────────────────────────────────────

interface GitContext {
  branch: string;
  log: string;
  status: string;
}

async function getGitContext(workspaceRoot: string): Promise<GitContext | null> {
  try {
    const [branchResult, logResult, statusResult] = await Promise.all([
      exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: workspaceRoot }),
      exec("git", ["log", "--oneline", "-6"], { cwd: workspaceRoot }),
      exec("git", ["status", "--short"], { cwd: workspaceRoot }),
    ]);
    return {
      branch: branchResult.stdout.trim(),
      log: logResult.stdout.trim(),
      status: statusResult.stdout.trim(),
    };
  } catch {
    return null;
  }
}

function formatGitBlock(ctx: GitContext): string {
  const lines = [`## Contexto Git`, ``, `Branch: \`${ctx.branch}\``];
  if (ctx.status.length > 0) {
    lines.push(`Arquivos modificados:\n${ctx.status}`);
  }
  if (ctx.log.length > 0) {
    lines.push(`Últimos commits:\n${ctx.log}`);
  }
  return lines.join("\n");
}

// ─── Combined builder ─────────────────────────────────────────────────────────

/**
 * Builds a system prompt prefix combining CAPPY.md instructions and live git context.
 * Returns null if neither source has content.
 */
export async function buildSystemPromptPrefix(workspaceRoot: string): Promise<string | null> {
  const [cappyMd, gitCtx] = await Promise.all([
    loadCappyMd(workspaceRoot),
    getGitContext(workspaceRoot),
  ]);

  const parts: string[] = [];

  if (cappyMd) {
    parts.push(cappyMd);
  }

  if (gitCtx) {
    parts.push(formatGitBlock(gitCtx));
  }

  return parts.length > 0 ? parts.join("\n\n---\n\n") : null;
}
