import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { ToolDefinition } from "./toolTypes.js";
import { getWorkspaceRoot } from "./workspacePath.js";

const execAsync = promisify(exec);

interface GitStatusParams {
  cwd?: string;
}

interface GitDiffParams {
  path?: string;
  staged?: boolean;
  commit?: string;
  cwd?: string;
}

async function runGit(args: string, cwd: string): Promise<string> {
  const { stdout, stderr } = await execAsync(`git ${args}`, {
    cwd,
    maxBuffer: 2 * 1024 * 1024,
    shell: process.platform === "win32" ? "powershell.exe" : "/bin/sh",
  });
  return (stdout + (stderr ? `\n[stderr]\n${stderr}` : "")).trim();
}

export const gitStatusTool: ToolDefinition<GitStatusParams, string> = {
  name: "GitStatus",
  description:
    "Returns the working tree status of the git repository (modified, staged, untracked files). " +
    "Equivalent to `git status --short`.",
  parameters: {
    type: "object",
    properties: {
      cwd: {
        type: "string",
        description: "Working directory (relative to workspace root). Defaults to workspace root.",
      },
    },
    required: [],
  },
  execute: async (params) => {
    const workspaceRoot = getWorkspaceRoot();
    const cwd =
      typeof params.cwd === "string" && params.cwd.trim().length > 0
        ? path.resolve(workspaceRoot, params.cwd)
        : workspaceRoot;
    try {
      const output = await runGit("status --short --branch", cwd);
      return output || "(working tree clean)";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `GitStatus error: ${msg}`;
    }
  },
};

export const gitDiffTool: ToolDefinition<GitDiffParams, string> = {
  name: "GitDiff",
  description:
    "Returns the diff of the repository or a specific file. " +
    "Use `staged: true` to see staged changes, `commit` to compare against a specific commit/branch. " +
    "Equivalent to `git diff [--staged] [<commit>] [<path>]`.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Specific file or directory to diff (relative to workspace root). Omit for full diff.",
      },
      staged: {
        type: "boolean",
        description: "If true, shows staged changes (git diff --staged). Default: false.",
      },
      commit: {
        type: "string",
        description: "Compare against this commit hash or branch name (e.g. 'HEAD~1', 'main').",
      },
      cwd: {
        type: "string",
        description: "Working directory (relative to workspace root). Defaults to workspace root.",
      },
    },
    required: [],
  },
  execute: async (params) => {
    const workspaceRoot = getWorkspaceRoot();
    const cwd =
      typeof params.cwd === "string" && params.cwd.trim().length > 0
        ? path.resolve(workspaceRoot, params.cwd)
        : workspaceRoot;

    const parts: string[] = ["diff"];
    if (params.staged) parts.push("--staged");
    if (typeof params.commit === "string" && params.commit.trim().length > 0) {
      parts.push(params.commit.trim());
    }
    if (typeof params.path === "string" && params.path.trim().length > 0) {
      parts.push("--");
      parts.push(path.resolve(workspaceRoot, params.path));
    }

    try {
      const output = await runGit(parts.join(" "), cwd);
      return output || "(no changes)";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `GitDiff error: ${msg}`;
    }
  },
};
