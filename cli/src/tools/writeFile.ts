import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getPlanMode, recordFileRead } from "../agent/sessionContext";
import { buildFileDiffPayload, type FileDiffPayload } from "../utils/fileDiffPayload";
import type { ToolDefinition } from "./toolTypes";
import { resolveWorkspacePath } from "./workspacePath";

interface WriteFileParams {
  path: string;
  content: string;
}

async function readPreviousUtf8(targetPath: string): Promise<string | null> {
  try {
    return await readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

async function executeWriteFile(params: WriteFileParams): Promise<{ ok: true; fileDiff: FileDiffPayload }> {
  if (getPlanMode()) {
    throw new Error(
      "Plan mode is active: do not write files yet. Use ExitPlanMode when ready to implement, or ask the user.",
    );
  }
  const targetPath = resolveWorkspacePath(params.path);
  const previous = await readPreviousUtf8(targetPath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, params.content, "utf8");
  recordFileRead(targetPath);
  const fileDiff = buildFileDiffPayload(targetPath, previous, params.content);
  return { ok: true, fileDiff };
}

/**
 * OpenClaude-style full file write (`Write`).
 */
export const writeOpenClaudeTool: ToolDefinition<WriteFileParams, { ok: true }> = {
  name: "Write",
  description:
    "Writes UTF-8 text content to a file path (creates parent directories). Prefer Edit for small changes to existing files.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative file path." },
      content: { type: "string", description: "Text content to be written." },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  execute: executeWriteFile,
};

/**
 * Writes UTF-8 content to disk (legacy name `writeFile`).
 */
export const writeFileTool: ToolDefinition<WriteFileParams, { ok: true }> = {
  name: "writeFile",
  description: "Writes UTF-8 text content to a file path.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative file path." },
      content: { type: "string", description: "Text content to be written." },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  execute: executeWriteFile,
};
