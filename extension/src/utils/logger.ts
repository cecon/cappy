import * as vscode from "vscode";
import { loadConfig } from "../config";

let outputChannel: vscode.OutputChannel | undefined;
let debugEnabled: boolean | undefined;

function getChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Cappy");
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
  getChannel().show(true);
}

/**
 * Disposes the Output Channel.
 */
export function disposeLogger(): void {
  outputChannel?.dispose();
  outputChannel = undefined;
  debugEnabled = undefined;
}
