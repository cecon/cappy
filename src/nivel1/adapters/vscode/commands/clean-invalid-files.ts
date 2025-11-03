/**
 * @fileoverview Command to clean invalid files (assets, binaries) from database
 * @module adapters/vscode/commands/clean-invalid-files
 * @author Cappy Team
 * @since 3.0.8
 */

import * as vscode from 'vscode';
import { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import * as path from 'node:path';

/**
 * Patterns for files that should not be processed
 */
const INVALID_FILE_PATTERNS = [
  /\.svg$/i,
  /\.wasm$/i,
  /\.png$/i,
  /\.jpg$/i,
  /\.jpeg$/i,
  /\.gif$/i,
  /\.ico$/i,
  /\.ttf$/i,
  /\.woff$/i,
  /\.woff2$/i,
  /\.eot$/i,
  /\.vsix$/i,
  /^src\/assets\//i,
  /^out\//i,
  /^dist\//i,
  /^build\//i
];

/**
 * Checks if a file path matches invalid patterns
 */
function isInvalidFile(filePath: string): boolean {
  return INVALID_FILE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Registers the clean invalid files command
 */
export function registerCleanInvalidFilesCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'cappy.cleanInvalidFiles',
    async () => {
      console.log('🧹 [CLEAN] Command cappy.cleanInvalidFiles started');
      
      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          console.error('❌ [CLEAN] No workspace folder open');
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        const dataDir = path.join(workspaceRoot, '.cappy');
        const metadataDbPath = path.join(dataDir, 'file-metadata.db');

        // Initialize database
        const metadataDatabase = new FileMetadataDatabase(metadataDbPath);
        await metadataDatabase.initialize();

        // Get all files
        const allFiles = await metadataDatabase.getAllFiles();
        console.log(`📊 [CLEAN] Total files in database: ${allFiles.length}`);

        // Filter invalid files
        const invalidFiles = allFiles.filter(file => isInvalidFile(file.filePath));
        console.log(`🗑️ [CLEAN] Found ${invalidFiles.length} invalid files to remove`);

        if (invalidFiles.length === 0) {
          vscode.window.showInformationMessage('✅ No invalid files found in database');
          metadataDatabase.close();
          return;
        }

        // Show list and confirm
        const fileList = invalidFiles.map(f => `  - ${f.filePath}`).join('\n');
        const answer = await vscode.window.showWarningMessage(
          `Found ${invalidFiles.length} invalid files:\n\n${fileList.slice(0, 500)}${fileList.length > 500 ? '...' : ''}\n\nRemove them from database?`,
          { modal: true },
          'Yes',
          'No'
        );

        if (answer !== 'Yes') {
          console.log('❌ [CLEAN] User cancelled cleanup');
          metadataDatabase.close();
          return;
        }

        // Remove invalid files
        let removedCount = 0;
        for (const file of invalidFiles) {
          try {
            await metadataDatabase.deleteFile(file.id);
            removedCount++;
            console.log(`🗑️ [CLEAN] Removed: ${file.filePath}`);
          } catch (error) {
            console.error(`❌ [CLEAN] Failed to remove ${file.filePath}:`, error);
          }
        }

        console.log(`✅ [CLEAN] Removed ${removedCount}/${invalidFiles.length} invalid files`);
        vscode.window.showInformationMessage(
          `✅ Removed ${removedCount} invalid files from database`
        );

        // Close database
        metadataDatabase.close();

      } catch (error) {
        console.error('❌ [CLEAN] Error cleaning invalid files:', error);
        vscode.window.showErrorMessage(
          `❌ Failed to clean invalid files: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  context.subscriptions.push(command);
  console.log('✅ [CLEAN] Command cappy.cleanInvalidFiles registered successfully');
}
