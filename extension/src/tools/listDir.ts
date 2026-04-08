import { readdir } from "node:fs/promises";

import type { ToolDefinition } from "./index";
import { resolveWorkspacePath } from "./workspacePath";

interface ListDirParams {
  path: string;
}

/**
 * Lists direct entries in a directory.
 */
export const listDirTool: ToolDefinition<ListDirParams, { entries: string[] }> = {
  name: "listDir",
  description: "Lists files and folders from a directory path.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative directory path." },
    },
    required: ["path"],
    additionalProperties: false,
  },
  async execute(params) {
    const targetPath = resolveWorkspacePath(params.path);
    const dirEntries = await readdir(targetPath, { withFileTypes: true });
    const entries = dirEntries.map((entry) => {
      return entry.isDirectory() ? `${entry.name}/` : entry.name;
    });
    return { entries };
  },
};
