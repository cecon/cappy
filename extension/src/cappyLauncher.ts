import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

const CAPPY_REPO_URL = "https://github.com/cecon/cappy";
const CAPPY_SETUP_URL = "https://github.com/cecon/cappy/blob/main/cli/README.md";
const PROFILE_FILE_NAME = ".cappy-profile.json";

/**
 * Launches the Cappy CLI in an integrated terminal.
 */
export async function launchCappyCli(options: { requireWorkspaceRoot: boolean }): Promise<void> {
  const configured = vscode.workspace.getConfiguration("cappy");
  const enabled = configured.get<boolean>("cli.enabled", true);
  if (!enabled) {
    await vscode.window.showInformationMessage("Launch do Cappy CLI está desativado nas configurações (cappy.cli.enabled).");
    return;
  }

  const launchCommand = configured.get<string>(
    "cli.command",
    "npx -y @eduardocecon/cappy",
  );
  const terminalName = configured.get<string>("cli.terminalName", "Cappy");

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
 * Opens `.cappy-profile.json` in the workspace root when present.
 */
export async function openCappyWorkspaceProfile(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    await vscode.window.showInformationMessage("Abra um workspace para localizar o perfil Cappy.");
    return;
  }

  const profilePath = path.join(folder.uri.fsPath, PROFILE_FILE_NAME);
  if (!fs.existsSync(profilePath)) {
    const choice = await vscode.window.showInformationMessage(
      `Arquivo não encontrado: ${PROFILE_FILE_NAME} na raiz do workspace.`,
      "Abrir guia de setup",
    );
    if (choice === "Abrir guia de setup") {
      await vscode.env.openExternal(vscode.Uri.parse(CAPPY_SETUP_URL));
    }
    return;
  }

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(profilePath));
  await vscode.window.showTextDocument(document, { preview: false });
}

/**
 * Opens Cappy repository in the browser.
 */
export async function openCappyRepository(): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(CAPPY_REPO_URL));
}
