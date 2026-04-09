import { createSkill, listSkills, readSkill, type SkillMeta } from "../agent/workspaceSkills";
import type { ToolDefinition } from "./toolTypes";
import { getWorkspaceRoot } from "./workspacePath";

// ─── ListSkills ─────────────────────────────────────────────────────

interface ListSkillsParams {
  /** Filtro opcional: "builtin", "workspace", ou vazio para todas. */
  filter?: string;
}

interface ListSkillsResult {
  skills: SkillMeta[];
  total: number;
}

export const listSkillsTool: ToolDefinition<ListSkillsParams, ListSkillsResult> = {
  name: "ListSkills",
  description:
    "Lists all available skills (built-in + workspace `.cappy/skills/`). " +
    "Returns name, description, type (built-in or workspace). " +
    "Use this to discover relevant skills before starting a task.",
  parameters: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        enum: ["builtin", "workspace"],
        description: 'Optional filter: "builtin" or "workspace". Omit for all.',
      },
    },
    required: [],
    additionalProperties: false,
  },
  async execute(params) {
    const root = getWorkspaceRoot();
    let skills = await listSkills(root);

    if (params.filter === "builtin") {
      skills = skills.filter((s) => s.builtIn);
    } else if (params.filter === "workspace") {
      skills = skills.filter((s) => !s.builtIn);
    }

    return { skills, total: skills.length };
  },
};

// ─── ReadSkill ──────────────────────────────────────────────────────

interface ReadSkillParams {
  /** Nome da skill (como aparece no catálogo). */
  name: string;
}

interface ReadSkillResult {
  name: string;
  description: string;
  type: string;
  content: string;
}

export const readSkillTool: ToolDefinition<ReadSkillParams, ReadSkillResult> = {
  name: "ReadSkill",
  description:
    "Reads the full content of a skill by name. " +
    "Use after checking the skills catalog in the system prompt or after ListSkills.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Skill name as shown in the catalog (e.g. 'create-skill', 'testing-patterns').",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  async execute(params) {
    const skillName = params.name?.trim() ?? "";
    if (skillName.length === 0) {
      throw new Error("Skill name is required.");
    }

    const root = getWorkspaceRoot();
    const result = await readSkill(root, skillName);
    if (!result) {
      throw new Error(`Skill "${skillName}" not found. Use ListSkills to see available skills.`);
    }

    return {
      name: result.meta.name,
      description: result.meta.description,
      type: result.meta.builtIn ? "built-in" : "workspace",
      content: result.content,
    };
  },
};

// ─── CreateSkill ────────────────────────────────────────────────────

interface CreateSkillParams {
  /** Nome da skill (será sanitizado para filename). */
  name: string;
  /** Conteúdo Markdown da skill. */
  content: string;
  /** Descrição curta (inserida como frontmatter). */
  description?: string;
}

interface CreateSkillResult {
  relativePath: string;
  message: string;
}

export const createSkillTool: ToolDefinition<CreateSkillParams, CreateSkillResult> = {
  name: "CreateSkill",
  description:
    "Creates a new skill file in `.cappy/skills/`. " +
    "The skill will be available to the agent in future conversations. " +
    "Use when you notice recurring patterns or the user asks to save knowledge as a skill.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Skill name (e.g. 'deploy-guide', 'testing-patterns'). Will be sanitized to a safe filename.",
      },
      content: {
        type: "string",
        description: "Full Markdown content of the skill.",
      },
      description: {
        type: "string",
        description: "Short one-line description. Inserted as YAML frontmatter.",
      },
    },
    required: ["name", "content"],
    additionalProperties: false,
  },
  async execute(params) {
    const name = params.name?.trim() ?? "";
    const rawContent = params.content?.trim() ?? "";
    if (name.length === 0) {
      throw new Error("Skill name is required.");
    }
    if (rawContent.length === 0) {
      throw new Error("Skill content is required.");
    }

    // Prepend frontmatter if description provided and content doesn't already have it
    let finalContent = rawContent;
    if (params.description && params.description.trim().length > 0 && !rawContent.startsWith("---")) {
      finalContent = `---\ndescription: ${params.description.trim()}\n---\n\n${rawContent}`;
    }

    const root = getWorkspaceRoot();
    const result = await createSkill(root, name, finalContent);

    return {
      relativePath: result.relativePath,
      message: `Skill "${name}" criada em ${result.relativePath}`,
    };
  },
};
