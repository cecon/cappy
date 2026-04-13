/**
 * CliRenderer — formata e imprime os eventos do AgentLoop no terminal.
 *
 * Usa apenas escape codes ANSI nativos (sem dependências externas de cores)
 * para manter o bundle pequeno e sem conflitos de versão.
 */

// ─── ANSI helpers ──────────────────────────────────────────────────────────────

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const CYAN = `${ESC}36m`;
const GREEN = `${ESC}32m`;
const YELLOW = `${ESC}33m`;
const RED = `${ESC}31m`;
const MAGENTA = `${ESC}35m`;
const BLUE = `${ESC}34m`;
const GRAY = `${ESC}90m`;

function c(color: string, text: string): string {
  return `${color}${text}${RESET}`;
}

// ─── Spinner ───────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

export class Spinner {
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private label = "";

  start(label: string): void {
    this.label = label;
    this.frame = 0;
    if (this.timer) return;
    process.stderr.write("\x1b[?25l"); // oculta cursor
    this.timer = setInterval(() => {
      const icon = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length]!;
      process.stderr.write(`\r${c(CYAN, icon)} ${c(DIM, this.label)}  `);
      this.frame++;
    }, SPINNER_INTERVAL_MS);
  }

  update(label: string): void {
    this.label = label;
  }

  stop(finalLine?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    process.stderr.write("\r\x1b[K"); // limpa linha
    process.stderr.write("\x1b[?25h"); // mostra cursor
    if (finalLine) {
      process.stderr.write(`${finalLine}\n`);
    }
  }
}

// ─── Renderer principal ────────────────────────────────────────────────────────

export class CliRenderer {
  private readonly spinner = new Spinner();

  /** Chamado quando o primeiro token chega — inicia o print do texto. */
  private streamingStarted = false;

  /**
   * Imprime um token de streaming diretamente no stdout (sem newline).
   * Na primeira chamada, imprime o prefixo "Cappy:" e para o spinner.
   */
  onToken(token: string): void {
    if (!this.streamingStarted) {
      this.spinner.stop();
      process.stdout.write(`\n${c(BOLD + CYAN, "Cappy")}${c(GRAY, ":")} `);
      this.streamingStarted = true;
    }
    process.stdout.write(token);
  }

  /** Chamado quando o streaming termina (sem mais tool calls). */
  onDone(): void {
    if (this.streamingStarted) {
      process.stdout.write("\n");
    }
    this.spinner.stop();
    this.streamingStarted = false;
  }

  /** Mensagem de sistema do loop (ex.: aviso de fallback de modelo). */
  onSystemMessage(message: string): void {
    process.stderr.write(`\n${c(YELLOW, "⚠")}  ${c(DIM, message)}\n`);
  }

  /** Uma tool vai ser executada. */
  onToolExecuting(toolName: string, args: Record<string, unknown>): void {
    this.spinner.stop();
    this.streamingStarted = false;
    const preview = buildArgsPreview(args);
    process.stderr.write(
      `\n${c(BLUE, "🔧")} ${c(BOLD, toolName)}${preview ? c(GRAY, `  ${preview}`) : ""}\n`,
    );
    this.spinner.start("executando...");
  }

  /** Resultado de uma tool (resumido). */
  onToolResult(toolName: string, result: string): void {
    this.spinner.stop();
    const lines = result.split("\n").filter((l) => l.trim().length > 0);
    const preview = lines.slice(0, 3).join(" ↩ ").slice(0, 120);
    const suffix = result.length > 120 ? c(GRAY, ` … (+${result.length - 120} chars)`) : "";
    process.stderr.write(
      `   ${c(GREEN, "✓")} ${c(DIM, toolName)}${c(GRAY, ":")} ${preview}${suffix}\n`,
    );
  }

  /** Uma tool destrutiva foi rejeitada pelo usuário. */
  onToolRejected(toolName: string): void {
    this.spinner.stop();
    this.streamingStarted = false;
    process.stderr.write(`\n${c(RED, "✗")} Tool ${c(BOLD, toolName)} ${c(RED, "rejeitada")}. Encerrando.\n`);
  }

  /** Erro fatal no loop. */
  onError(err: Error): void {
    this.spinner.stop();
    this.streamingStarted = false;
    process.stderr.write(`\n${c(RED + BOLD, "✗ Erro:")} ${err.message}\n`);
  }

  /** Inicia spinner de "pensando" (antes da 1ª token chegar). */
  startThinking(): void {
    this.streamingStarted = false;
    this.spinner.start("pensando...");
  }

  /** Imprime resumo de uso de contexto. */
  onContextUsage(used: number, limit: number, trimmed: boolean): void {
    const pct = Math.round((used / limit) * 100);
    const color = pct > 85 ? RED : pct > 60 ? YELLOW : GREEN;
    const trimNote = trimmed ? c(YELLOW, " (contexto compactado)") : "";
    process.stderr.write(
      `${c(GRAY, `[ctx: ${c(color, `${pct}%`)}${c(GRAY, ` ${used.toLocaleString()}/${limit.toLocaleString()} tokens`)}${trimNote}${c(GRAY, "]")}`)}\n`,
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildArgsPreview(args: Record<string, unknown>): string {
  // Mostra o valor do primeiro campo relevante (command, path, pattern, query…)
  const PRIORITY_KEYS = ["command", "path", "pattern", "query", "url", "name", "content"];
  for (const key of PRIORITY_KEYS) {
    if (typeof args[key] === "string" && (args[key] as string).length > 0) {
      const val = (args[key] as string).slice(0, 80);
      return `(${key}: "${val}")`;
    }
  }
  return "";
}
