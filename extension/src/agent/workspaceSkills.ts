import * as fs from "node:fs/promises";
import { type Dirent } from "node:fs";
import * as path from "node:path";

/** Segmentos da pasta de skills por projeto (sob a raiz do workspace). */
export const WORKSPACE_SKILLS_SEGMENTS = [".cappy", "skill"] as const;

/** Limite total de caracteres injectados no prompt (evita estourar o contexto). */
const MAX_TOTAL_CHARS = 64_000;

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
 * Lê todos os `.md` em `<workspaceRoot>/.cappy/skill` (recursivo) e devolve um bloco
 * para mensagem de sistema, no estilo Cursor/OpenClaude skills.
 *
 * @param workspaceRoot Raiz absoluta do workspace (pasta aberta no VS Code/Cursor).
 * @returns Texto vazio se a pasta não existir ou não houver `.md`.
 */
export async function loadWorkspaceSkillsPrompt(workspaceRoot: string): Promise<string> {
  const resolvedRoot = path.resolve(workspaceRoot);
  const skillsDir = path.join(resolvedRoot, ...WORKSPACE_SKILLS_SEGMENTS);

  try {
    const stat = await fs.stat(skillsDir);
    if (!stat.isDirectory()) {
      return "";
    }
  } catch {
    return "";
  }

  const files = await collectMarkdownFiles(skillsDir);
  if (files.length === 0) {
    return "";
  }

  const parts: string[] = [];
  let total = 0;

  const preamble =
    "Skills do workspace: ficheiros em `.cappy/skill/` (relativos à raiz do projeto). " +
    "Aplica estas instruções quando forem relevantes para a tarefa.\n";

  for (const filePath of files) {
    const relativePath = path.relative(resolvedRoot, filePath);
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const section = `\n\n---\n### ${relativePath}\n\n${content.trim()}`;
    if (total + section.length > MAX_TOTAL_CHARS) {
      const headroom = MAX_TOTAL_CHARS - total - 200;
      if (headroom < 400) {
        break;
      }
      const clipped = content.trim().slice(0, headroom);
      parts.push(`\n\n---\n### ${relativePath}\n\n${clipped}\n\n[…truncado por limite de tamanho…]`);
      break;
    }

    parts.push(section);
    total += section.length;
  }

  if (parts.length === 0) {
    return "";
  }

  return `${preamble}${parts.join("")}`;
}
