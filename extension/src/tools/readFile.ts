import { readFile } from "node:fs/promises";

import type { ToolDefinition } from "./index";
import { resolveWorkspacePath } from "./workspacePath";

interface ReadFileParams {
  path: string;
}

/**
 * Reads a UTF-8 file from disk.
 */
export const readFileTool: ToolDefinition<ReadFileParams, { content: string }> = {
  name: "readFile",
  description: "Reads a UTF-8 text file from disk.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative file path." },
    },
    required: ["path"],
    additionalProperties: false,
  },
  async execute(params) {
    const targetPath = resolveWorkspacePath(params.path);
    const content = await readFile(targetPath, "utf8");
    return { content };
  },
};
