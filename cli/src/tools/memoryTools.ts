/**
 * Memory tools — persistent project memory in `.cappy/memory/`.
 *
 * Four tools mirror the skills system pattern:
 *   MemoryList  — read-only, available in Ask mode
 *   MemoryRead  — read-only, available in Ask mode
 *   MemoryWrite — destructive (HITL required)
 *   MemoryDelete — destructive (HITL required)
 */

import { getMemoryStore } from "../memory/MemoryStore";
import type { ToolDefinition } from "./ToolDefinition";
import { getWorkspaceRoot } from "./workspacePath";

// ── MemoryList ──────────────────────────────────────────────────────────────

interface MemoryListParams {
  // No parameters — lists all memory files.
}

interface MemoryListResult {
  files: Array<{ name: string; summary: string }>;
  total: number;
}

export const memoryListTool: ToolDefinition<MemoryListParams, MemoryListResult> = {
  name: "MemoryList",
  description:
    "Lists all persistent project memory files in `.cappy/memory/`. " +
    "Returns file names and one-line summaries. " +
    "Use MemoryRead to retrieve the full content of a specific file.",
  readOnly: true,
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  async execute() {
    const root = getWorkspaceRoot();
    const files = await getMemoryStore().list(root);
    return { files, total: files.length };
  },
};

// ── MemoryRead ──────────────────────────────────────────────────────────────

interface MemoryReadParams {
  name: string;
}

interface MemoryReadResult {
  name: string;
  content: string;
  found: boolean;
}

export const memoryReadTool: ToolDefinition<MemoryReadParams, MemoryReadResult> = {
  name: "MemoryRead",
  description:
    "Reads the full content of a project memory file from `.cappy/memory/<name>.md`. " +
    "Use MemoryList first to discover available memory files.",
  readOnly: true,
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Name of the memory file (without .md extension). " +
          "Examples: 'architecture', 'conventions', 'pitfalls'.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    const content = await getMemoryStore().read(root, params.name);
    if (content === null) {
      return { name: params.name, content: "", found: false };
    }
    return { name: params.name, content, found: true };
  },
};

// ── MemoryWrite ─────────────────────────────────────────────────────────────

interface MemoryWriteParams {
  name: string;
  content: string;
}

interface MemoryWriteResult {
  name: string;
  path: string;
  ok: true;
}

export const memoryWriteTool: ToolDefinition<MemoryWriteParams, MemoryWriteResult> = {
  name: "MemoryWrite",
  description:
    "Creates or overwrites a project memory file at `.cappy/memory/<name>.md`. " +
    "Use this to persist important project knowledge: architecture decisions, conventions, " +
    "known pitfalls, or active workstreams. " +
    "Content should be valid markdown. Existing content is fully replaced.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Name of the memory file (without .md extension). " +
          "Use descriptive names: 'architecture', 'auth-flow', 'db-schema', 'deploy-process'.",
      },
      content: {
        type: "string",
        description: "Full markdown content to write to the memory file.",
      },
    },
    required: ["name", "content"],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    await getMemoryStore().write(root, params.name, params.content);
    return {
      name: params.name,
      path: `.cappy/memory/${params.name}.md`,
      ok: true,
    };
  },
};

// ── MemoryDelete ────────────────────────────────────────────────────────────

interface MemoryDeleteParams {
  name: string;
}

interface MemoryDeleteResult {
  name: string;
  deleted: boolean;
}

export const memoryDeleteTool: ToolDefinition<MemoryDeleteParams, MemoryDeleteResult> = {
  name: "MemoryDelete",
  description:
    "Permanently deletes a project memory file from `.cappy/memory/<name>.md`. " +
    "Use only when the information is no longer relevant. This action is irreversible.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the memory file to delete (without .md extension).",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    const deleted = await getMemoryStore().delete(root, params.name);
    return { name: params.name, deleted };
  },
};
