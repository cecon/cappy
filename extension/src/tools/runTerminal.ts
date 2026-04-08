import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { ToolDefinition } from "./index";

interface RunTerminalParams {
  command: string;
  cwd?: string;
}

const execAsync = promisify(exec);

/**
 * Runs a shell command and returns stdout/stderr.
 */
export const runTerminalTool: ToolDefinition<
  RunTerminalParams,
  { stdout: string; stderr: string }
> = {
  name: "runTerminal",
  description: "Runs a terminal command in the local machine.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Command line to execute." },
      cwd: { type: "string", description: "Optional working directory." },
    },
    required: ["command"],
    additionalProperties: false,
  },
  async execute(params) {
    const { stdout, stderr } = await execAsync(params.command, {
      cwd: params.cwd,
      maxBuffer: 1024 * 1024,
    });
    return { stdout, stderr };
  },
};
