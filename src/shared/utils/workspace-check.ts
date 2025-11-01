import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * Checks if Cappy is initialized in the current workspace
 * @returns true if .cappy folder exists
 */
export function isCappyInitialized(workspaceRoot?: string): boolean {
  const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return false;
  }
  
  const cappyDir = path.join(root, '.cappy');
  return fs.existsSync(cappyDir);
}

/**
 * Gets the workspace root path
 * @returns workspace root path or undefined
 */
export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Ensures Cappy is initialized before running a command
 * Shows a warning message if not initialized
 * @returns true if initialized, false otherwise
 */
export async function ensureCappyInitialized(): Promise<boolean> {
  const workspaceRoot = getWorkspaceRoot();
  
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('❌ No workspace folder open. Please open a folder first.');
    return false;
  }

  if (!isCappyInitialized(workspaceRoot)) {
    const response = await vscode.window.showWarningMessage(
      '⚠️ Cappy is not initialized in this workspace. Please run "Cappy: Initialize Workspace" first.',
      'Initialize Now',
      'Cancel'
    );
    
    if (response === 'Initialize Now') {
      await vscode.commands.executeCommand('cappy.init');
      // Check again after init
      return isCappyInitialized(workspaceRoot);
    }
    
    return false;
  }

  return true;
}
