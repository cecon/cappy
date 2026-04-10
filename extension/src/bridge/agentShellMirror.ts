import type { ToolCall } from "../agent/types";

const SHELL_TOOL_NAMES = new Set(["bash", "runterminal"]);

/**
 * Indica se a tool é shell (`Bash` / `runTerminal`) cujo resultado deve ser espelhado no painel do chat.
 */
export function isAgentShellTool(toolName: string): boolean {
  return SHELL_TOOL_NAMES.has(toolName.trim().toLowerCase());
}

/**
 * Extrai `command` e `cwd` dos argumentos da tool shell.
 */
export function shellToolMeta(toolCall: ToolCall): { command: string; cwd?: string } {
  const { arguments: args } = toolCall;
  const command = typeof args.command === "string" ? args.command : "";
  const cwd = typeof args.cwd === "string" && args.cwd.trim().length > 0 ? args.cwd : undefined;
  return { command, ...(cwd !== undefined ? { cwd } : {}) };
}

const MAX_SHELL_CHARS = 120_000;

/**
 * Trunca texto muito longo para o webview continuar responsivo.
 */
export function truncateShellText(text: string): string {
  if (text.length <= MAX_SHELL_CHARS) {
    return text;
  }
  const n = text.length - MAX_SHELL_CHARS;
  return `${text.slice(0, MAX_SHELL_CHARS)}\n\n… [truncado ${String(n)} caracteres]`;
}

/**
 * Interpreta o JSON devolvido por {@link serializeToolResult} para `{ stdout, stderr }`.
 */
export function parseShellToolResultString(result: string): { stdout: string; stderr: string } | null {
  const trimmed = result.trim();
  if (trimmed.length === 0) {
    return { stdout: "", stderr: "" };
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        const rec = parsed as Record<string, unknown>;
        const stdout = typeof rec.stdout === "string" ? rec.stdout : "";
        const stderr = typeof rec.stderr === "string" ? rec.stderr : "";
        return { stdout, stderr };
      }
    } catch {
      return null;
    }
  }
  return null;
}
