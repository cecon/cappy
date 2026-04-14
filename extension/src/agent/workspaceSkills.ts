import * as fs from "node:fs/promises";
import { type Dirent } from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";

/**
 * Pasta primária de skills no workspace (maior prioridade — sobrescreve todas as outras).
 */
export const WORKSPACE_SKILLS_SEGMENTS = [".cappy", "skills"] as const;

/**
 * Pastas externas no workspace que também são varridas por skills.
 * Cada uma deve conter uma sub-pasta `skills/` com ficheiros `.md`.
 * Inspirado nos dirs externos do Kilo (.claude, .agents).
 * Ordem = prioridade crescente (último varre sobrescreve o anterior).
 */
export const EXTERNAL_SKILL_DIRS = [".github", ".agent", ".code"] as const;

/**
 * Pasta global de skills (home do utilizador).
 * Carregada primeiro — qualquer dir de projeto sobrescreve.
 */
export const GLOBAL_SKILLS_DIR = path.join(homedir(), ".cappy", "skills");

/** Limite de caracteres do catálogo injectado no prompt. */
const MAX_CATALOG_CHARS = 8_000;

/**
 * Origem da skill — usada no catálogo do system prompt.
 */
export type SkillSource = "built-in" | "global" | "external" | "workspace";

/**
 * Metadata extraída do frontmatter YAML de uma skill (primeiras linhas do `.md`).
 */
export interface SkillMeta {
  /** Nome curto (derivado do nome do ficheiro ou pasta). */
  name: string;
  /** Descrição de uma linha (extraída de `description:` no frontmatter ou primeira frase). */
  description: string;
  /** Caminho relativo ao workspace root (ou `[global]` / `[built-in]`). */
  relativePath: string;
  /** Caminho absoluto no disco. */
  absolutePath: string;
  /** Origem da skill. */
  source: SkillSource;
}

// ─── Built-in skills ────────────────────────────────────────────────

const BUILTIN_SKILLS: Array<{ name: string; fileName: string; description: string; content: string }> = [
  {
    name: "create-skill",
    fileName: "create-skill.md",
    description: "Como criar uma nova skill para o Cappy",
    content: `# Como criar uma skill

Uma skill é um ficheiro \`.md\` dentro de \`.cappy/skills/\` no workspace.

## Estrutura

\`\`\`
.cappy/skills/
  minha-skill.md          ← skill simples (ficheiro único)
  dominio/
    SKILL.md              ← skill com sub-pasta (nome = pasta)
  scripts/                ← scripts associados a skills
    minha-skill/
      run.py              ← script referenciado pela skill
      helpers.js
\`\`\`

## Scripts associados

Quando uma skill precisa de scripts (Python, JS, bash, etc.), coloque-os em:

\`\`\`.cappy/skills/scripts/<nome-da-skill>/<script>\`\`\`

Na skill markdown, **sempre indique o caminho completo** do script:

\`\`\`markdown
## Execução

Rodar o script:
\`\`\`bash
python .cappy/skills/scripts/minha-skill/run.py
\`\`\`
\`\`\`

Isso garante que o agente sabe onde encontrar e executar o script.

## Frontmatter (opcional)

Use YAML frontmatter no topo do ficheiro para metadata:

\`\`\`yaml
---
description: Breve descrição do que esta skill faz
---
\`\`\`

Se não houver frontmatter, o Cappy usa a primeira frase do conteúdo como descrição.

## Boas práticas

- **Nome descritivo**: use nomes como \`deploy-azure.md\`, \`testing-patterns.md\`.
- **Foco estreito**: cada skill deve cobrir um tema específico.
- **Instruções claras**: escreva como se estivesse a instruir outro developer.
- **Exemplos**: inclua snippets de código quando possível.
- **Tamanho**: prefira skills < 4000 caracteres; skills grandes são truncadas.

## Exemplo completo

\`\`\`markdown
---
description: Convenções de testes unitários do projeto
---

# Testes Unitários

- Usar vitest como test runner
- Colocar testes em \`__tests__/\` ao lado do módulo
- Nomear como \`<module>.test.ts\`
- Preferir \`describe\` / \`it\` com nomes descritivos
\`\`\`
`,
  },
  {
    name: "skill-guide",
    fileName: "skill-guide.md",
    description: "Como o Cappy usa skills e quando invocá-las",
    content: `# Guia de Skills do Cappy

## O que são skills?

Skills são blocos de conhecimento em Markdown que expandem as capacidades do Cappy.
São descobertas automaticamente nos seguintes locais (ordem de prioridade crescente):

1. \`~/.cappy/skills/\` — skills globais (home do utilizador)
2. \`.github/skills/\` — skills do repositório (convenção GitHub)
3. \`.agent/skills/\` — skills de agentes genéricos
4. \`.code/skills/\` — skills específicas do editor/ambiente
5. \`.cappy/skills/\` — skills primárias do workspace (maior prioridade)

## Quando usar skills

- **Antes de cada tarefa**: verifique se existe uma skill relevante com \`ListSkills\`.
- **Ao encontrar padrões recorrentes**: crie uma skill para não repetir instruções.
- **Para onboarding**: documente convenções do projecto como skills.

## Tools disponíveis

| Tool | Uso |
|------|-----|
| \`ListSkills\` | Lista todas as skills com nome, origem e descrição |
| \`ReadSkill\` | Lê o conteúdo completo de uma skill pelo nome |
| \`CreateSkill\` | Cria uma nova skill \`.md\` em \`.cappy/skills/\` |

## Fluxo recomendado

1. O utilizador pede uma tarefa
2. Consulte o catálogo de skills (já injectado no prompt)
3. Se uma skill parecer relevante, use \`ReadSkill\` para ler o conteúdo completo
4. Siga as instruções da skill ao executar a tarefa
5. Se a skill referenciar scripts, execute-os pelo caminho indicado na skill (ex: \`.cappy/skills/scripts/<skill>/<script>\`)
`,
  },
];

// ─── Filesystem helpers ─────────────────────────────────────────────

/**
 * Percorre `dir` e recolhe caminhos de ficheiros `.md` (ordem alfabética).
 */
async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true }) as Dirent[];
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        out.push(fullPath);
      }
    }
  }

  await walk(dir);
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Extrai descrição do frontmatter YAML ou da primeira frase do conteúdo.
 */
function extractDescription(content: string): string {
  // Tenta frontmatter ---\ndescription: ...\n---
  const fmMatch = /^---\s*\n([\s\S]*?)\n---/u.exec(content);
  if (fmMatch) {
    const descMatch = /^description:\s*(.+)$/mu.exec(fmMatch[1]!);
    if (descMatch && descMatch[1]!.trim().length > 0) {
      return descMatch[1]!.trim().replace(/^["']|["']$/gu, "");
    }
  }
  // Fallback: primeira linha não-vazia que não seja heading
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
      return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
    }
  }
  return "";
}

/**
 * Deriva o nome da skill a partir do caminho do ficheiro e da pasta raiz das skills.
 * Se o ficheiro for `SKILL.md`, usa o nome da pasta pai. Senão, usa o nome sem extensão.
 */
function deriveSkillName(filePath: string, skillsDir: string): string {
  const rel = path.relative(skillsDir, filePath).replace(/\\/gu, "/");
  const base = path.basename(filePath, ".md");
  if (base.toLowerCase() === "skill") {
    return path.basename(path.dirname(filePath));
  }
  return rel.replace(/\.md$/iu, "").replace(/\//gu, "/");
}

/**
 * Varre uma pasta de skills e popula o mapa de skills fornecido.
 * Skills com o mesmo nome sobrescrevem as anteriores (maior prioridade).
 */
async function scanSkillsDir(
  dir: string,
  source: SkillSource,
  workspaceRoot: string,
  map: Map<string, SkillMeta>,
): Promise<void> {
  let isDir = false;
  try {
    isDir = (await fs.stat(dir)).isDirectory();
  } catch {
    return;
  }
  if (!isDir) return;

  const files = await collectMarkdownFiles(dir);
  for (const filePath of files) {
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const name = deriveSkillName(filePath, dir);
    const relBase = source === "global"
      ? `[global]/${path.relative(dir, filePath).replace(/\\/gu, "/")}`
      : path.relative(workspaceRoot, filePath).replace(/\\/gu, "/");

    map.set(name, {
      name,
      description: extractDescription(content),
      relativePath: relBase,
      absolutePath: filePath,
      source,
    });
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Retorna a lista de skills disponíveis, com deduplicação por nome.
 *
 * Ordem de prioridade (menor → maior; skills de maior prioridade sobrescrevem):
 * 1. Built-in (sempre presente, menor prioridade)
 * 2. Global: `~/.cappy/skills/`
 * 3. Externos: `.github/skills/`, `.agent/skills/`, `.code/skills/`
 * 4. Primário: `.cappy/skills/` (maior prioridade)
 */
export async function listSkills(workspaceRoot: string): Promise<SkillMeta[]> {
  const resolvedRoot = path.resolve(workspaceRoot);

  // Mapa ordenado: chave = nome normalizado; skills de maior prioridade sobrescrevem
  const map = new Map<string, SkillMeta>();

  // 1. Built-in (base)
  for (const builtin of BUILTIN_SKILLS) {
    map.set(builtin.name, {
      name: builtin.name,
      description: builtin.description,
      relativePath: `[built-in]/${builtin.fileName}`,
      absolutePath: "",
      source: "built-in",
    });
  }

  // 2. Global (~/.cappy/skills/)
  await scanSkillsDir(GLOBAL_SKILLS_DIR, "global", resolvedRoot, map);

  // 3. Externos (.github/skills/, .agent/skills/, .code/skills/)
  for (const dir of EXTERNAL_SKILL_DIRS) {
    const skillsDir = path.join(resolvedRoot, dir, "skills");
    await scanSkillsDir(skillsDir, "external", resolvedRoot, map);
  }

  // 4. Primário (.cappy/skills/) — maior prioridade
  const primaryDir = path.join(resolvedRoot, ...WORKSPACE_SKILLS_SEGMENTS);
  await scanSkillsDir(primaryDir, "workspace", resolvedRoot, map);

  return Array.from(map.values());
}

/**
 * Lê o conteúdo completo de uma skill pelo nome.
 */
export async function readSkill(workspaceRoot: string, skillName: string): Promise<{ content: string; meta: SkillMeta } | null> {
  const skills = await listSkills(workspaceRoot);
  const normalizedName = skillName.trim().toLowerCase();
  const match = skills.find((s) => s.name.toLowerCase() === normalizedName);
  if (!match) {
    return null;
  }

  if (match.source === "built-in") {
    const builtin = BUILTIN_SKILLS.find((b) => b.name.toLowerCase() === normalizedName);
    if (!builtin) {
      return null;
    }
    return { content: builtin.content, meta: match };
  }

  try {
    const content = await fs.readFile(match.absolutePath, "utf8");
    return { content, meta: match };
  } catch {
    return null;
  }
}

/**
 * Cria uma nova skill no workspace (sempre em `.cappy/skills/`).
 */
export async function createSkill(
  workspaceRoot: string,
  name: string,
  content: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const resolvedRoot = path.resolve(workspaceRoot);
  const skillsDir = path.join(resolvedRoot, ...WORKSPACE_SKILLS_SEGMENTS);

  await fs.mkdir(skillsDir, { recursive: true });

  const safeName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");

  if (safeName.length === 0) {
    throw new Error("Nome de skill inválido.");
  }

  const fileName = safeName.endsWith(".md") ? safeName : `${safeName}.md`;
  const filePath = path.join(skillsDir, fileName);

  try {
    await fs.access(filePath);
    throw new Error(`Skill "${safeName}" já existe em ${path.relative(resolvedRoot, filePath)}.`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  await fs.writeFile(filePath, content, "utf8");

  return {
    relativePath: path.relative(resolvedRoot, filePath).replace(/\\/gu, "/"),
    absolutePath: filePath,
  };
}

/** Rótulo legível para cada origem de skill. */
const SOURCE_LABEL: Record<SkillSource, string> = {
  "built-in": "built-in",
  global: "global",
  external: "external",
  workspace: "workspace",
};

/**
 * Gera o bloco de system prompt com o catálogo leve de skills (nome + origem + descrição).
 * Não injeta o conteúdo completo — o agente deve usar ReadSkill para isso.
 */
export async function loadWorkspaceSkillsPrompt(workspaceRoot: string): Promise<string> {
  const skills = await listSkills(workspaceRoot);
  if (skills.length === 0) {
    return "";
  }

  const lines: string[] = [
    "# Skills disponíveis",
    "",
    "Skills são carregadas de (prioridade crescente): " +
    "`~/.cappy/skills/` (global) → `.github/skills/` → `.agent/skills/` → `.code/skills/` → `.cappy/skills/` (workspace).",
    "Antes de executar uma tarefa, verifica se alguma skill é relevante. " +
    "Usa `ReadSkill` para ler o conteúdo completo.",
    "",
  ];

  let total = lines.join("\n").length;

  for (const skill of skills) {
    const row = `- **${skill.name}** (${SOURCE_LABEL[skill.source]}): ${skill.description}`;
    if (total + row.length + 1 > MAX_CATALOG_CHARS) {
      lines.push(`- *(${skills.length - lines.length + 5} skills adicionais truncadas)*`);
      break;
    }
    lines.push(row);
    total += row.length + 1;
  }

  return lines.join("\n");
}
