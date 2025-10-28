/**
 * @fileoverview Command to reset/clean the graph database
 * @module commands/reset-database
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Resets the graph database by deleting the SQLite file
 */
export async function resetDatabase(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const dbPath = path.join(workspaceRoot, '.cappy', 'data', 'graph-store.db');

  // Confirm with user
  const confirm = await vscode.window.showWarningMessage(
    '⚠️ This will delete all indexed data in the graph database. Continue?',
    { modal: true },
    'Yes, Reset Database',
    'Cancel'
  );

  if (confirm !== 'Yes, Reset Database') {
    vscode.window.showInformationMessage('Database reset cancelled');
    return;
  }

  try {
    // Delete the database file if it exists
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`🗑️  Deleted database: ${dbPath}`);
      
      // Create empty file
      fs.writeFileSync(dbPath, '');
      console.log(`✅ Created empty database: ${dbPath}`);
      
      vscode.window.showInformationMessage(
        '✅ Database reset successfully! Now run "Cappy: Scan Workspace" to reindex.'
      );
    } else {
      vscode.window.showInformationMessage('Database file does not exist');
    }
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    vscode.window.showErrorMessage(`Failed to reset database: ${error}`);
  }
}

/**
 * Register the reset database command
 */
export function registerResetDatabaseCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('cappy.resetDatabase', resetDatabase);
  context.subscriptions.push(command);
}
