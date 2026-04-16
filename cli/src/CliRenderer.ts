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

  /** Exibe um resumo estruturado ao final de uma sessão: ferramentas usadas, arquivos modificados e próximos passos. */
  renderSessionSummary(summary: { steps: Array<{ tool: string; durationMs: number; success: boolean }>; modifiedFiles: string[]; durationMs: number; totalTokensIn: number }, lastAssistantMessage: string): void {
    const totalMs = summary.durationMs;
    const secs = (totalMs / 1000).toFixed(1);
    const toolCount = summary.steps.length;
    const successCount = summary.steps.filter((s) => s.success).length;

    process.stderr.write(`\n${c(GRAY, "─".repeat(50))}\n`);
    process.stderr.write(`${c(BOLD, "Resumo da sessão")} ${c(GRAY, `(${secs}s · ${toolCount} tool${toolCount === 1 ? "" : "s"} · ${summary.totalTokensIn.toLocaleString()} tokens)`)}\n`);

    if (summary.modifiedFiles.length > 0) {
      process.stderr.write(`\n${c(BOLD, "Arquivos modificados:")}\n`);
      for (const f of summary.modifiedFiles) {
        process.stderr.write(`  ${c(GREEN, "✎")} ${c(CYAN, f)}\n`);
      }
    }

    if (toolCount > 0 && successCount < toolCount) {
      const failed = toolCount - successCount;
      process.stderr.write(`\n${c(YELLOW, `⚠  ${failed} tool${failed === 1 ? "" : "s"} rejeitada${failed === 1 ? "" : "s"} ou com erro`)}\n`);
    }

    const nextSteps = extractNextSteps(lastAssistantMessage);
    if (nextSteps.length > 0) {
      process.stderr.write(`\n${c(BOLD, "Próximos passos sugeridos:")}\n`);
      for (const step of nextSteps) {
        process.stderr.write(`  ${c(BLUE, "›")} ${step}\n`);
      }
    }

    process.stderr.write(`${c(GRAY, "─".repeat(50))}\n\n`);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractNextSteps(text: string): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  const steps: string[] = [];
  const NEXT_STEP_PATTERNS = [
    /próximo[s]?\s+passo[s]?/i,
    /next\s+step/i,
    /a\s+seguir/i,
    /recomendo/i,
    /você\s+pode/i,
    /pode(?:mos)?\s+agora/i,
  ];
  for (const line of lines) {
    const trimmed = line.replace(/^[\s\-*•>]+/, "").trim();
    if (trimmed.length < 10 || trimmed.length > 200) continue;
    if (NEXT_STEP_PATTERNS.some((p) => p.test(trimmed))) {
      steps.push(trimmed);
      if (steps.length >= 3) break;
    }
  }
  if (steps.length === 0) {
    // Fallback: últimas linhas não vazias do texto
    const nonEmpty = lines.filter((l) => l.trim().length > 15).slice(-3);
    for (const line of nonEmpty) {
      const trimmed = line.replace(/^[\s\-*•>]+/, "").trim();
      if (trimmed.length > 0) steps.push(trimmed);
    }
  }
  return steps.slice(0, 3);
}

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
