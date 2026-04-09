import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

const OPENCLAUDE_REPO_URL = "https://github.com/Gitlawb/openclaude";
const OPENCLAUDE_SETUP_URL = "https://github.com/Gitlawb/openclaude/blob/main/README.md#quick-start";
const PROFILE_FILE_NAME = ".openclaude-profile.json";

/**
 * Launches the OpenClaude CLI in an integrated terminal (same mechanics as the upstream VS Code extension).
 */
export async function launchOpenClaudeCli(options: { requireWorkspaceRoot: boolean }): Promise<void> {
  const configured = vscode.workspace.getConfiguration("cappy");
  const enabled = configured.get<boolean>("openClaudeCli.enabled", true);
  if (!enabled) {
    await vscode.window.showInformationMessage("Launch do OpenClaude CLI está desativado nas configurações (cappy.openClaudeCli.enabled).");
    return;
  }

  const launchCommand = configured.get<string>(
    "openClaudeCli.command",
    "npx -y @gitlawb/openclaude",
  );
  const terminalName = configured.get<string>("openClaudeCli.terminalName", "OpenClaude");

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (options.requireWorkspaceRoot && !folder) {
    await vscode.window.showWarningMessage("Abra uma pasta de workspace antes de usar esta ação.");
    return;
  }

  const cwd = options.requireWorkspaceRoot ? folder!.uri.fsPath : folder?.uri.fsPath;

  const terminal = vscode.window.createTerminal({
    name: terminalName,
    ...(cwd ? { cwd } : {}),
  });
  terminal.show(true);
  terminal.sendText(launchCommand, true);
}

/**
 * Opens `.openclaude-profile.json` in the workspace root when present.
 */
export async function openOpenClaudeWorkspaceProfile(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showInformationMessage("Abra um workspace para localizar o perfil OpenClaude.");
    return;
  }

  const profilePath = path.join(folder.uri.fsPath, PROFILE_FILE_NAME);
  if (!fs.existsSync(profilePath)) {
    const choice = await vscode.window.showInformationMessage(
      `Arquivo não encontrado: ${PROFILE_FILE_NAME} na raiz do workspace.`,
      "Abrir guia de setup",
    );
    if (choice === "Abrir guia de setup") {
      await vscode.env.openExternal(vscode.Uri.parse(OPENCLAUDE_SETUP_URL));
    }
    return;
  }

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(profilePath));
  await vscode.window.showTextDocument(document, { preview: false });
}

/**
 * Opens upstream OpenClaude documentation in the browser.
 */
export async function openOpenClaudeRepository(): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(OPENCLAUDE_REPO_URL));
}
