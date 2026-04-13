/**
 * CliHitl — Human-in-the-Loop interativo no terminal.
 *
 * Quando o AgentLoop emite `tool:confirm`, exibe prompt e aguarda
 * resposta do usuário via readline antes de aprovar/rejeitar.
 */

import * as readline from "node:readline";

// ANSI helpers (inline para não depender de CliRenderer)
const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const YELLOW = `${ESC}33m`;
const RED = `${ESC}31m`;
const GREEN = `${ESC}32m`;
const GRAY = `${ESC}90m`;
const CYAN = `${ESC}36m`;

function c(color: string, text: string): string {
  return `${color}${text}${RESET}`;
}

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type HitlPolicy = "confirm_each" | "allow_all" | "deny_all";

// ─── CliHitl ──────────────────────────────────────────────────────────────────

export class CliHitl {
  private policy: HitlPolicy;

  constructor(policy: HitlPolicy = "confirm_each") {
    this.policy = policy;
  }

  /**
   * Exibe o prompt de confirmação e aguarda a resposta do usuário.
   * Retorna `true` para aprovar, `false` para rejeitar.
   */
  async confirm(toolName: string, args: Record<string, unknown>): Promise<boolean> {
    // Políticas automáticas
    if (this.policy === "allow_all") return true;
    if (this.policy === "deny_all") return false;

    // Imprime o banner de confirmação
    process.stderr.write("\n");
    process.stderr.write(
      `${c(YELLOW + BOLD, "⚠  Tool destrutiva detectada")} — confirmação necessária\n`,
    );
    process.stderr.write(`   ${c(BOLD, "Tool:")} ${c(CYAN, toolName)}\n`);

    const argsPreview = buildArgsBlock(args);
    if (argsPreview) {
      process.stderr.write(`   ${c(BOLD, "Args:")}\n${argsPreview}\n`);
    }

    process.stderr.write("\n");
    process.stderr.write(
      `   ${c(GREEN, "[y]")} aprovar  ${c(RED, "[n]")} rejeitar  ${c(GRAY, "[a]")} aprovar todas  ${c(GRAY, "[d]")} negar todas\n`,
    );

    const answer = await askQuestion(
      `   ${c(BOLD, "Decisão")} ${c(GRAY, "[y/n/a/d]:")} `,
    );

    const normalized = answer.trim().toLowerCase();

    if (normalized === "a") {
      this.policy = "allow_all";
      process.stderr.write(
        `   ${c(GREEN, "✓")} Política alterada para ${c(BOLD, "allow_all")} — tools destrutivas serão aprovadas automaticamente nesta sessão.\n\n`,
      );
      return true;
    }

    if (normalized === "d") {
      this.policy = "deny_all";
      process.stderr.write(
        `   ${c(RED, "✗")} Política alterada para ${c(BOLD, "deny_all")} — tools destrutivas serão negadas automaticamente nesta sessão.\n\n`,
      );
      return false;
    }

    const approved = normalized === "y" || normalized === "yes" || normalized === "s" || normalized === "sim";

    process.stderr.write(
      approved
        ? `   ${c(GREEN, "✓")} Aprovado.\n\n`
        : `   ${c(RED, "✗")} Rejeitado.\n\n`,
    );

    return approved;
  }

  /** Retorna a política atual. */
  getPolicy(): HitlPolicy {
    return this.policy;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Exibe uma pergunta e aguarda resposta no stdin de forma assíncrona.
 */
function askQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Formata args como bloco indentado legível.
 */
function buildArgsBlock(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";

  return entries
    .map(([key, value]) => {
      const raw = typeof value === "string" ? value : JSON.stringify(value);
      const preview = raw.length > 200 ? `${raw.slice(0, 200)}${c(GRAY, " …")}` : raw;
      return `      ${c(GRAY, `${key}:`)} ${preview}`;
    })
    .join("\n");
}
