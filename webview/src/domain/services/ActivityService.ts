/**
 * Domain service: activity state building and merging.
 * Extracted from Chat.tsx helper functions. Pure logic — no React, no bridge deps.
 */

import type { ToolCall } from "../../lib/types";
import type { ActivityState } from "../entities/ChatState";

// ── Core helpers ───────────────────────────────────────────────────────────

/** Creates a new ActivityState payload. */
export function createActivity(primary: string, secondary: string | null): ActivityState {
  return {
    primary,
    secondary,
    signature: `${primary}::${secondary ?? ""}`,
    repeats: 1,
    startedAtMs: Date.now(),
  };
}

/**
 * Merges repeated activity updates — increments repeats counter instead of
 * resetting the timer, so the UI doesn't flicker on fast repeated calls.
 */
export function mergeActivity(
  previous: ActivityState | null,
  next: ActivityState,
): ActivityState {
  if (!previous || previous.signature !== next.signature) return next;
  return { ...previous, repeats: previous.repeats + 1 };
}

// ── Tool-specific activity copy ────────────────────────────────────────────

/**
 * Maps a ToolCall name + arguments to human-readable status copy.
 */
export function buildToolActivity(toolCall: ToolCall): ActivityState {
  const name = toolCall.name.toLowerCase();
  const path = extractPathArg(toolCall.arguments);
  const command = extractStringArg(toolCall.arguments, ["command"]);
  const query = extractStringArg(toolCall.arguments, ["query"]);

  if (name.includes("read")) {
    return createActivity(
      path ? `Lendo ${path}` : "Lendo arquivos",
      path ?? "Abrindo arquivo solicitado",
    );
  }
  if (name.includes("search") || name.includes("rg") || name.includes("grep")) {
    return createActivity(
      "Procurando no codigo",
      query ? `Filtro: ${clip(query, 80)}` : path ? `Escopo: ${path}` : "Escopo: projeto inteiro",
    );
  }
  if (name.includes("list") || name.includes("dir")) {
    return createActivity(
      path ? `Explorando ${path}` : "Explorando estrutura do projeto",
      path ? `Diretorio: ${path}` : "Listando diretorios e arquivos",
    );
  }
  if (name.includes("write") || name.includes("edit")) {
    return createActivity(
      path ? `Editando ${path}` : "Aplicando alteracoes",
      path ? `Arquivo alvo: ${path}` : "Atualizando conteudo",
    );
  }
  if (name.includes("run") || name.includes("terminal") || name.includes("shell")) {
    return createActivity(
      "Executando comando no terminal",
      command ? `Comando: ${clip(command, 88)}` : path ? `Diretorio: ${path}` : "Diretorio atual",
    );
  }
  return createActivity(
    `Trabalhando com ${toolCall.name}`,
    path ? `Alvo: ${path}` : "Processando requisicao",
  );
}

// ── Argument extraction helpers ────────────────────────────────────────────

const PATH_KEYS = ["path", "targetPath", "filePath", "working_directory", "cwd"] as const;

export function extractPathArg(args: Record<string, unknown>): string | null {
  for (const key of PATH_KEYS) {
    const v = args[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

export function extractStringArg(
  args: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}
