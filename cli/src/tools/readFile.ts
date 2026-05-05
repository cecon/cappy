import { readFile } from "node:fs/promises";

import { recordFileRead } from "../agent/sessionContext";
import type { ToolDefinition } from "./toolTypes";
import { resolveWorkspacePath } from "./workspacePath";

interface ReadFileParams {
  path: string;
}

/**
 * Shared read implementation used by Read and readFile.
 */
async function executeReadFile(params: ReadFileParams): Promise<{ content: string }> {
  const targetPath = resolveWorkspacePath(params.path);
  const content = await readFile(targetPath, "utf8");
  recordFileRead(targetPath);
  return { content };
}

/**
 * OpenClaude-style file read (`Read`).
 */
export const readOpenClaudeTool: ToolDefinition<ReadFileParams, { content: string }> = {
  name: "Read",
  description: "Reads a UTF-8 text file from disk. Call before Edit on the same file.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative file path." },
    },
    required: ["path"],
    additionalProperties: false,
  },
  execute: executeReadFile,
};

/**
 * Reads a UTF-8 file from disk (legacy name `readFile`).
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
  execute: executeReadFile,
};
