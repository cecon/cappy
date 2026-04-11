import * as fs from "node:fs/promises";
import * as path from "node:path";

/** Segmentos do directório de KIs (sob a raiz do workspace). */
export const WORKSPACE_KNOWLEDGE_SEGMENTS = [".cappy", "knowledge"] as const;

/** Limite de caracteres do bloco de catálogo injectado no prompt (~1000 tokens). */
const MAX_CATALOG_CHARS = 4_000;

/**
 * Metadata de um Knowledge Item extraída do frontmatter YAML.
 */
export interface KnowledgeMeta {
  /** Slug do ficheiro (sem `.md`). */
  name: string;
  /** Título legível (do frontmatter `title:`, fallback = name). */
  title: string;
  /** Descrição de uma linha (do frontmatter `description:`). */
  description: string;
  /** Tags associadas (do frontmatter `tags: [...]`). */
  tags: string[];
  /** Timestamp ISO 8601 da última actualização. */
  updated: string;
  /** Caminho relativo ao workspace root. */
  relativePath: string;
  /** Caminho absoluto no disco. */
  absolutePath: string;
}

// ─── Frontmatter helpers ─────────────────────────────────────────────

/**
 * Extrai um campo de string do bloco de frontmatter YAML.
 */
function extractFrontmatterString(frontmatter: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*(.+)$`, "mu").exec(frontmatter);
  if (!match || !match[1]) {
    return "";
  }
  return match[1].trim().replace(/^["']|["']$/gu, "");
}

/**
 * Extrai um campo de array simples do frontmatter YAML (e.g. `tags: ["a", "b"]` ou `tags: [a, b]`).
 */
function extractFrontmatterTags(frontmatter: string): string[] {
  const match = /^tags:\s*\[([^\]]*)\]/mu.exec(frontmatter);
  if (!match || !match[1]) {
    return [];
  }
  return match[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/gu, ""))
    .filter((s) => s.length > 0);
}

/**
 * Extrai o bloco de frontmatter YAML do início do ficheiro (entre os dois `---`).
 * Devolve `null` se não existir frontmatter.
 */
function parseFrontmatter(content: string): string | null {
  const match = /^---\s*\n([\s\S]*?)\n---/u.exec(content);
  return match ? match[1]! : null;
}

/**
 * Constrói um frontmatter YAML com os campos obrigatórios.
 */
function buildFrontmatter(title: string, description: string, tags: string[], created: string, updated: string): string {
  const tagsStr = tags.length > 0 ? `[${tags.map((t) => `"${t}"`).join(", ")}]` : "[]";
  return `---\ntitle: "${title}"\ndescription: "${description}"\ntags: ${tagsStr}\ncreated: "${created}"\nupdated: "${updated}"\n---`;
}

/**
 * Extrai metadata de um KI a partir do conteúdo do ficheiro.
 */
function extractKnowledgeMeta(
  content: string,
  name: string,
  relativePath: string,
  absolutePath: string,
): KnowledgeMeta {
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    return {
      name,
      title: name,
      description: "",
      tags: [],
      updated: "",
      relativePath,
      absolutePath,
    };
  }

  return {
    name,
    title: extractFrontmatterString(frontmatter, "title") || name,
    description: extractFrontmatterString(frontmatter, "description"),
    tags: extractFrontmatterTags(frontmatter),
    updated: extractFrontmatterString(frontmatter, "updated"),
    relativePath,
    absolutePath,
  };
}

// ─── Slug helpers ─────────────────────────────────────────────────────

/**
 * Sanitiza uma string para um slug seguro de ficheiro (`[a-z0-9_-]`).
 */
export function sanitizeKnowledgeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Lista todos os KIs do workspace (apenas metadata, sem conteúdo completo).
 * Devolve array vazio se o directório não existir ou estiver vazio.
 */
export async function listKnowledgeItems(workspaceRoot: string): Promise<KnowledgeMeta[]> {
  const resolvedRoot = path.resolve(workspaceRoot);
  const knowledgeDir = path.join(resolvedRoot, ...WORKSPACE_KNOWLEDGE_SEGMENTS);

  try {
    const stat = await fs.stat(knowledgeDir);
    if (!stat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  let entries;
  try {
    entries = await fs.readdir(knowledgeDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const items: KnowledgeMeta[] = [];

  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of mdFiles) {
    const absolutePath = path.join(knowledgeDir, entry.name);
    const name = entry.name.replace(/\.md$/iu, "");
    const relativePath = path
      .relative(resolvedRoot, absolutePath)
      .replace(/\\/gu, "/");

    try {
      const content = await fs.readFile(absolutePath, "utf8");
      items.push(extractKnowledgeMeta(content, name, relativePath, absolutePath));
    } catch {
      // Ficheiro ilegível — omite silenciosamente
    }
  }

  return items;
}

/**
 * Lê o conteúdo completo de um KI pelo nome (slug).
 * Devolve `null` se não encontrado.
 */
export async function readKnowledgeItem(
  workspaceRoot: string,
  name: string,
): Promise<{ content: string; meta: KnowledgeMeta } | null> {
  const items = await listKnowledgeItems(workspaceRoot);
  const normalizedName = name.trim().toLowerCase();
  const match = items.find((item) => item.name.toLowerCase() === normalizedName);
  if (!match) {
    return null;
  }

  try {
    const content = await fs.readFile(match.absolutePath, "utf8");
    return { content, meta: match };
  } catch {
    return null;
  }
}

/**
 * Cria ou actualiza um KI no workspace.
 *
 * - Se o ficheiro não existir, cria com frontmatter completo.
 * - Se já existir, actualiza o frontmatter `updated:` preservando `created:` e os outros campos.
 * - Se o conteúdo já tiver frontmatter, preserva-o (apenas actualiza `updated:`).
 *
 * Devolve o caminho relativo ao workspace root e se o item foi criado (true) ou actualizado (false).
 */
export async function writeKnowledgeItem(
  workspaceRoot: string,
  name: string,
  content: string,
  description?: string,
): Promise<{ relativePath: string; absolutePath: string; created: boolean }> {
  const resolvedRoot = path.resolve(workspaceRoot);
  const knowledgeDir = path.join(resolvedRoot, ...WORKSPACE_KNOWLEDGE_SEGMENTS);

  await fs.mkdir(knowledgeDir, { recursive: true });

  const safeName = sanitizeKnowledgeName(name);
  if (safeName.length === 0) {
    throw new Error("Nome de KI inválido.");
  }

  const fileName = `${safeName}.md`;
  const absolutePath = path.join(knowledgeDir, fileName);
  const relativePath = path.relative(resolvedRoot, absolutePath).replace(/\\/gu, "/");
  const now = new Date().toISOString();

  // Verificar se já existe
  let existingContent: string | null = null;
  try {
    existingContent = await fs.readFile(absolutePath, "utf8");
  } catch {
    // Não existe — vai criar
  }

  const rawContent = content.trim();
  let finalContent: string;

  if (existingContent !== null) {
    // UPDATE: preserva frontmatter existente, actualiza apenas `updated:`
    const existingFm = parseFrontmatter(existingContent);
    if (existingFm) {
      // Actualiza o campo `updated:` no frontmatter existente
      const updatedFm = existingFm.replace(
        /^updated:\s*.+$/mu,
        `updated: "${now}"`,
      );
      // Se o conteúdo enviado já tem frontmatter, usa só o body
      const newBody = parseFrontmatter(rawContent) !== null
        ? rawContent.replace(/^---\s*\n[\s\S]*?\n---\s*\n*/u, "").trim()
        : rawContent;
      finalContent = `---\n${updatedFm}\n---\n\n${newBody}`;
    } else {
      // Ficheiro existente sem frontmatter — adiciona agora
      const desc = (description ?? "").trim();
      const title = safeName;
      finalContent = `${buildFrontmatter(title, desc, [], now, now)}\n\n${rawContent}`;
    }
  } else {
    // CREATE: constrói frontmatter novo (a não ser que o conteúdo já tenha o seu)
    if (parseFrontmatter(rawContent) !== null) {
      // Conteúdo fornecido já tem frontmatter — usa directamente, actualiza `updated:`
      const existingFm = parseFrontmatter(rawContent)!;
      const updatedFm = existingFm.includes("updated:")
        ? existingFm.replace(/^updated:\s*.+$/mu, `updated: "${now}"`)
        : `${existingFm}\nupdated: "${now}"`;
      finalContent = rawContent.replace(
        /^---\s*\n[\s\S]*?\n---/u,
        `---\n${updatedFm}\n---`,
      );
    } else {
      const desc = (description ?? "").trim();
      const title = safeName;
      finalContent = `${buildFrontmatter(title, desc, [], now, now)}\n\n${rawContent}`;
    }
  }

  await fs.writeFile(absolutePath, `${finalContent}\n`, "utf8");

  return { relativePath, absolutePath, created: existingContent === null };
}

/**
 * Gera o bloco compacto de system prompt com o catálogo de KIs (nome + descrição).
 * Não injeta o conteúdo completo — o agente deve usar `ReadKnowledge` para isso.
 * Devolve `""` se não houver KIs.
 */
export async function buildKnowledgePromptBlock(workspaceRoot: string): Promise<string> {
  let items: KnowledgeMeta[];
  try {
    items = await listKnowledgeItems(workspaceRoot);
  } catch {
    return "";
  }

  if (items.length === 0) {
    return "";
  }

  const header = [
    "## Project Knowledge Items",
    "Persistent knowledge extracted from past sessions. " +
      "Use `ReadKnowledge(name)` to load the full content of any item before acting on it.",
    "",
  ].join("\n");

  const lines: string[] = [];
  let charCount = header.length;

  for (const item of items) {
    const desc = item.description.length > 0 ? ` — ${item.description}` : "";
    const line = `- **${item.name}**${desc}`;
    if (charCount + line.length + 1 > MAX_CATALOG_CHARS) {
      lines.push(`- … (${items.length - lines.length} items adicionais omitidos)`);
      break;
    }
    lines.push(line);
    charCount += line.length + 1;
  }

  return `${header}${lines.join("\n")}`;
}
