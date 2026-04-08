import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ToolDefinition } from "./index";

interface WriteFileParams {
  path: string;
  content: string;
}

/**
 * Writes UTF-8 content to disk.
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
  async execute(params) {
    const targetPath = path.resolve(params.path);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, params.content, "utf8");
    return { ok: true };
  },
};
