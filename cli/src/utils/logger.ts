import { loadConfig } from "../config";

// vscode is optional — when running inside VS Code it provides an Output Channel;
// when bundled into the CLI it is marked --external:vscode and may be unavailable,
// so we fall back to console.* in that case.
let _vscodeChecked = false;
let _vscode: typeof import("vscode") | undefined;

function tryGetVscode(): typeof import("vscode") | undefined {
  if (!_vscodeChecked) {
    _vscodeChecked = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _vscode = require("vscode") as typeof import("vscode");
    } catch {
      _vscode = undefined;
    }
  }
  return _vscode;
}

interface SimpleChannel {
  appendLine(value: string): void;
  show?(preserveFocus?: boolean): void;
  dispose?(): void;
}

let outputChannel: SimpleChannel | undefined;
let debugEnabled: boolean | undefined;

function getChannel(): SimpleChannel {
  if (!outputChannel) {
    const vscode = tryGetVscode();
    if (vscode) {
      outputChannel = vscode.window.createOutputChannel("Cappy");
    } else {
      outputChannel = {
        appendLine: (value: string) => process.stderr.write(value + "\n"),
        show: () => undefined,
        dispose: () => undefined,
      };
    }
  }
  return outputChannel;
}

async function isDebug(): Promise<boolean> {
  if (debugEnabled === undefined) {
    const config = await loadConfig();
    debugEnabled = config.debug === true;
  }
  return debugEnabled;
}

/**
 * Resets cached debug flag (call after config changes).
 */
export function resetLoggerCache(): void {
  debugEnabled = undefined;
}

/**
 * Logs an info message (always visible in Output Channel).
 */
export function logInfo(message: string): void {
  getChannel().appendLine(`[INFO] ${new Date().toISOString()} ${message}`);
}

/**
 * Logs a debug message (only when config.debug is true).
 */
export async function logDebug(message: string): Promise<void> {
  if (await isDebug()) {
    getChannel().appendLine(`[DEBUG] ${new Date().toISOString()} ${message}`);
  }
}

/**
 * Logs an error message (always visible).
 */
export function logError(message: string, error?: unknown): void {
  const suffix = error instanceof Error ? `: ${error.message}` : error ? `: ${String(error)}` : "";
  getChannel().appendLine(`[ERROR] ${new Date().toISOString()} ${message}${suffix}`);
  console.error(`[cappy] ${message}${suffix}`);
}

/**
 * Shows the Output Channel in the UI.
 */
export function showLog(): void {
  getChannel().show?.(true);
}

/**
 * Disposes the Output Channel.
 */
export function disposeLogger(): void {
  outputChannel?.dispose?.();
  outputChannel = undefined;
  debugEnabled = undefined;
}
