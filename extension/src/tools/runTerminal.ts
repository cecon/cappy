import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { getPlanMode } from "../agent/sessionContext";
import type { ToolDefinition } from "./toolTypes";
import { getWorkspaceRoot } from "./workspacePath";

interface RunTerminalParams {
  command: string;
  cwd?: string;
}

const execAsync = promisify(exec);

async function executeTerminal(params: RunTerminalParams): Promise<{ stdout: string; stderr: string }> {
  if (getPlanMode()) {
    throw new Error(
      "Plan mode is active: do not run shell commands yet. Use ExitPlanMode when ready to execute, or ask the user.",
    );
  }
  const workspaceRoot = getWorkspaceRoot();
  const resolvedCwd =
    typeof params.cwd === "string" && params.cwd.trim().length > 0
      ? path.resolve(workspaceRoot, params.cwd)
      : workspaceRoot;
  const { stdout, stderr } = await execAsync(params.command, {
    cwd: resolvedCwd,
    maxBuffer: 1024 * 1024,
    shell: process.platform === "win32" ? "powershell.exe" : "/bin/sh",
  });
  return { stdout, stderr };
}

/**
 * OpenClaude-style shell (`Bash`).
 */
export const bashTool: ToolDefinition<RunTerminalParams, { stdout: string; stderr: string }> = {
  name: "Bash",
  description:
    "Runs a shell command in the workspace (PowerShell on Windows, sh on Linux/macOS). Prefer Glob, Grep, Read, Edit, Write for file operations when possible.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Command line to execute." },
      cwd: { type: "string", description: "Optional working directory relative to workspace root." },
    },
    required: ["command"],
    additionalProperties: false,
  },
  execute: executeTerminal,
};

/**
 * Runs a terminal command (legacy name `runTerminal`).
 */
export const runTerminalTool: ToolDefinition<RunTerminalParams, { stdout: string; stderr: string }> = {
  name: "runTerminal",
  description: "Runs a terminal command (PowerShell on Windows, sh on Linux/macOS).",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Command line to execute." },
      cwd: { type: "string", description: "Optional working directory." },
    },
    required: ["command"],
    additionalProperties: false,
  },
  execute: executeTerminal,
};
