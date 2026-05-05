import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getPlanMode, recordFileRead, wasFileReadThisSession } from "../agent/sessionContext";
import { buildFileDiffPayload, type FileDiffPayload } from "../utils/fileDiffPayload";
import type { ToolDefinition } from "./toolTypes";
import { resolveWorkspacePath } from "./workspacePath";

interface EditParams {
  path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/**
 * Performs exact string replacements in a file (OpenClaude `Edit` semantics).
 */
export const editTool: ToolDefinition<EditParams, { ok: true; replacements: number; fileDiff: FileDiffPayload }> = {
  name: "Edit",
  description:
    "Performs exact string replacements in an existing file. You must call Read on the file at least once this session before editing. " +
    "If old_string is not unique, use a larger unique snippet or replace_all. Preserves indentation from the file as read.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path relative to workspace or absolute." },
      old_string: { type: "string", description: "Exact text to find (must match file bytes including whitespace)." },
      new_string: { type: "string", description: "Replacement text." },
      replace_all: {
        type: "boolean",
        description: "If true, replace every occurrence of old_string; if false, fail when old_string appears more than once.",
      },
    },
    required: ["path", "old_string", "new_string"],
    additionalProperties: false,
  },
  async execute(params) {
    if (getPlanMode()) {
      throw new Error(
        "Plan mode is active: do not edit files yet. Use ExitPlanMode when ready to implement, or ask the user.",
      );
    }
    const targetPath = resolveWorkspacePath(params.path);
    if (!wasFileReadThisSession(targetPath)) {
      // Auto-read the file so the session tracker is satisfied
      await readFile(targetPath, "utf8");
      recordFileRead(targetPath);
    }

    let content = await readFile(targetPath, "utf8");
    const beforeSnapshot = content;
    const replaceAll = params.replace_all === true;
    const occurrences = countOccurrences(content, params.old_string);

    if (occurrences === 0) {
      throw new Error(`old_string not found in ${path.basename(targetPath)}.`);
    }
    if (!replaceAll && occurrences > 1) {
      throw new Error(
        `old_string is not unique (${occurrences} matches). Use a larger surrounding snippet or replace_all.`,
      );
    }

    let replacements: number;
    if (replaceAll) {
      const parts = content.split(params.old_string);
      replacements = parts.length - 1;
      content = parts.join(params.new_string);
    } else {
      content = content.replace(params.old_string, params.new_string);
      replacements = 1;
    }

    await writeFile(targetPath, content, "utf8");
    recordFileRead(targetPath);
    const fileDiff = buildFileDiffPayload(targetPath, beforeSnapshot, content);
    return { ok: true, replacements, fileDiff };
  },
};

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }
  let count = 0;
  let pos = 0;
  while (pos <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) {
      break;
    }
    count += 1;
    pos = idx + needle.length;
  }
  return count;
}
