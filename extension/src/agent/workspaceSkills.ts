import * as fs from "node:fs/promises";
import { type Dirent } from "node:fs";
import * as path from "node:path";

/** Segmentos da pasta de skills por projeto (sob a raiz do workspace). */
export const WORKSPACE_SKILLS_SEGMENTS = [".cappy", "skills"] as const;

/** Limite de caracteres do catálogo injectado no prompt. */
const MAX_CATALOG_CHARS = 8_000;

/**
 * Metadata extraída do frontmatter YAML de uma skill (primeiras linhas do `.md`).
 */
export interface SkillMeta {
  /** Nome curto (derivado do nome do ficheiro ou pasta). */
  name: string;
  /** Descrição de uma linha (extraída de `description:` no frontmatter ou primeira frase). */
  description: string;
  /** Caminho relativo ao workspace root. */
  relativePath: string;
  /** Caminho absoluto no disco. */
  absolutePath: string;
  /** true quando é uma skill embarcada (built-in). */
  builtIn: boolean;
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
Ficam em \`.cappy/skills/\` no workspace e são carregadas automaticamente.

## Quando usar skills

- **Antes de cada tarefa**: verifique se existe uma skill relevante com \`ListSkills\`.
- **Ao encontrar padrões recorrentes**: crie uma skill para não repetir instruções.
- **Para onboarding**: documente convenções do projecto como skills.

## Tools disponíveis

| Tool | Uso |
|------|-----|
| \`ListSkills\` | Lista todas as skills com nome e descrição |
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
 * Deriva o nome da skill a partir do caminho do ficheiro.
 * Se o ficheiro for `SKILL.md`, usa o nome da pasta pai. Senão, usa o nome sem extensão.
 */
function deriveSkillName(filePath: string, skillsDir: string): string {
  const rel = path.relative(skillsDir, filePath).replace(/\\/gu, "/");
  const base = path.basename(filePath, ".md");
  if (base.toLowerCase() === "skill") {
    // Usa o nome da pasta pai
    const parent = path.basename(path.dirname(filePath));
    return parent;
  }
  // Remove subpasta se houver
  return rel.replace(/\.md$/iu, "").replace(/\//gu, "/");
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Retorna a lista de skills do workspace + built-in (metadata apenas, sem conteúdo completo).
 */
export async function listSkills(workspaceRoot: string): Promise<SkillMeta[]> {
  const resolvedRoot = path.resolve(workspaceRoot);
  const skillsDir = path.join(resolvedRoot, ...WORKSPACE_SKILLS_SEGMENTS);
  const result: SkillMeta[] = [];

  // Built-in skills
  for (const builtin of BUILTIN_SKILLS) {
    result.push({
      name: builtin.name,
      description: builtin.description,
      relativePath: `[built-in]/${builtin.fileName}`,
      absolutePath: "",
      builtIn: true,
    });
  }

  // Workspace skills
  try {
    const stat = await fs.stat(skillsDir);
    if (!stat.isDirectory()) {
      return result;
    }
  } catch {
    return result;
  }

  const files = await collectMarkdownFiles(skillsDir);
  for (const filePath of files) {
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }
    result.push({
      name: deriveSkillName(filePath, skillsDir),
      description: extractDescription(content),
      relativePath: path.relative(resolvedRoot, filePath).replace(/\\/gu, "/"),
      absolutePath: filePath,
      builtIn: false,
    });
  }

  return result;
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

  if (match.builtIn) {
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
 * Cria uma nova skill no workspace.
 */
export async function createSkill(
  workspaceRoot: string,
  name: string,
  content: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const resolvedRoot = path.resolve(workspaceRoot);
  const skillsDir = path.join(resolvedRoot, ...WORKSPACE_SKILLS_SEGMENTS);

  // Garante que a pasta existe
  await fs.mkdir(skillsDir, { recursive: true });

  // Sanitiza o nome para um filename seguro
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

  // Não sobrescreve skills existentes
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

/**
 * Gera o bloco de system prompt com o catálogo leve de skills (nome + descrição).
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
    "O workspace tem skills em `.cappy/skills/`. Antes de executar uma tarefa, " +
    "verifica se alguma skill é relevante. Usa `ReadSkill` para ler o conteúdo completo.",
    "",
    "| Nome | Tipo | Descrição |",
    "|------|------|-----------|",
  ];

  let total = lines.join("\n").length;

  for (const skill of skills) {
    const row = `| ${skill.name} | ${skill.builtIn ? "built-in" : "workspace"} | ${skill.description} |`;
    if (total + row.length + 1 > MAX_CATALOG_CHARS) {
      lines.push(`| ... | | (${skills.length - lines.length + 6} skills adicionais truncadas) |`);
      break;
    }
    lines.push(row);
    total += row.length + 1;
  }

  return lines.join("\n");
}
