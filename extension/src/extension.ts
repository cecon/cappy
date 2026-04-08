import * as vscode from "vscode";

import { runAgentLoop } from "./agent/loop";
import { toolsRegistry } from "./tools";

/**
 * Activates Cappy extension commands.
 */
export function activate(context: vscode.ExtensionContext): void {
  const startCommand = vscode.commands.registerCommand("cappy.start", async () => {
    const result = await runAgentLoop(
      [{ role: "user", content: "bootstrap" }],
      toolsRegistry,
    );

    await vscode.window.showInformationMessage(result);
  });

  context.subscriptions.push(startCommand);
}

/**
 * Cleans extension resources on shutdown.
 */
export function deactivate(): void {
  // No resources to clean in scaffold version.
}
