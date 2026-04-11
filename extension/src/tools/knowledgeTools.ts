import {
  listKnowledgeItems,
  readKnowledgeItem,
  sanitizeKnowledgeName,
  writeKnowledgeItem,
  type KnowledgeMeta,
} from "../agent/knowledgeBase";
import type { ToolDefinition } from "./toolTypes";
import { getWorkspaceRoot } from "./workspacePath";

// ─── ListKnowledge ────────────────────────────────────────────────────

interface ListKnowledgeParams {
  /** Filtro opcional por tag. */
  tag?: string;
}

interface ListKnowledgeResult {
  items: KnowledgeMeta[];
  total: number;
}

export const listKnowledgeTool: ToolDefinition<ListKnowledgeParams, ListKnowledgeResult> = {
  name: "ListKnowledge",
  description:
    "Lists all Knowledge Items (KIs) stored in `.cappy/knowledge/`. " +
    "Returns name, title, description, tags and last-updated timestamp. " +
    "Use this to discover relevant knowledge before starting a task, or use ReadKnowledge to load full content.",
  parameters: {
    type: "object",
    properties: {
      tag: {
        type: "string",
        description: "Optional tag filter. Only returns items that include this tag.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  readonly: true,
  async execute(params) {
    const root = getWorkspaceRoot();
    let items = await listKnowledgeItems(root);

    if (params.tag && params.tag.trim().length > 0) {
      const filterTag = params.tag.trim().toLowerCase();
      items = items.filter((item) => item.tags.some((t) => t.toLowerCase() === filterTag));
    }

    return { items, total: items.length };
  },
};

// ─── ReadKnowledge ────────────────────────────────────────────────────

interface ReadKnowledgeParams {
  /** Nome (slug) do KI a ler. */
  name: string;
}

interface ReadKnowledgeResult {
  name: string;
  title: string;
  description: string;
  tags: string[];
  updated: string;
  content: string;
}

export const readKnowledgeTool: ToolDefinition<ReadKnowledgeParams, ReadKnowledgeResult> = {
  name: "ReadKnowledge",
  description:
    "Reads the full content of a Knowledge Item by name. " +
    "Use after seeing a relevant item in the system prompt catalog or after ListKnowledge.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Knowledge Item name (slug) as shown in the catalog (e.g. 'auth-flow', 'api-patterns').",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  readonly: true,
  async execute(params) {
    const name = params.name?.trim() ?? "";
    if (name.length === 0) {
      throw new Error("Knowledge Item name is required.");
    }

    const root = getWorkspaceRoot();
    const result = await readKnowledgeItem(root, name);
    if (!result) {
      throw new Error(
        `Knowledge Item "${name}" not found. Use ListKnowledge to see available items.`,
      );
    }

    return {
      name: result.meta.name,
      title: result.meta.title,
      description: result.meta.description,
      tags: result.meta.tags,
      updated: result.meta.updated,
      content: result.content,
    };
  },
};

// ─── WriteKnowledge ───────────────────────────────────────────────────

interface WriteKnowledgeParams {
  /** Nome (slug) do KI a criar ou actualizar. */
  name: string;
  /** Conteúdo Markdown do KI. */
  content: string;
  /** Descrição curta de uma linha (usada no catálogo e como frontmatter). */
  description?: string;
}

interface WriteKnowledgeResult {
  relativePath: string;
  created: boolean;
  message: string;
}

export const writeKnowledgeTool: ToolDefinition<WriteKnowledgeParams, WriteKnowledgeResult> = {
  name: "WriteKnowledge",
  description:
    "Creates or updates a Knowledge Item in `.cappy/knowledge/`. " +
    "Use to persist important project knowledge across sessions: architecture decisions, " +
    "troubleshooting discoveries, API patterns, coding conventions, etc. " +
    "If the item already exists, its content is updated and `updated:` timestamp refreshed.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Knowledge Item name (slug, e.g. 'auth-flow', 'db-schema'). " +
          "Will be sanitized to lowercase alphanumeric + hyphens.",
      },
      content: {
        type: "string",
        description: "Full Markdown content of the Knowledge Item.",
      },
      description: {
        type: "string",
        description: "Short one-line description shown in the catalog. Stored as YAML frontmatter.",
      },
    },
    required: ["name", "content"],
    additionalProperties: false,
  },
  async execute(params) {
    const name = params.name?.trim() ?? "";
    const rawContent = params.content?.trim() ?? "";

    if (name.length === 0) {
      throw new Error("Knowledge Item name is required.");
    }
    if (rawContent.length === 0) {
      throw new Error("Knowledge Item content is required.");
    }

    const safeName = sanitizeKnowledgeName(name);
    if (safeName.length === 0) {
      throw new Error(`Invalid Knowledge Item name: "${name}". Use lowercase letters, numbers, and hyphens.`);
    }

    const root = getWorkspaceRoot();
    const result = await writeKnowledgeItem(root, safeName, rawContent, params.description);

    return {
      relativePath: result.relativePath,
      created: result.created,
      message: result.created
        ? `Knowledge Item "${safeName}" created at ${result.relativePath}`
        : `Knowledge Item "${safeName}" updated at ${result.relativePath}`,
    };
  },
};
