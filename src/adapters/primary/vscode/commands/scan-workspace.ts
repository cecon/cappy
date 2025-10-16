/**
 * @fileoverview VS Code command for workspace scanning
 * @module adapters/primary/vscode/commands/scan-workspace
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import { WorkspaceScanner, type ScanProgress } from '../../../../services/workspace-scanner';
import { ParserService } from '../../../../services/parser-service';
import { IndexingService } from '../../../../services/indexing-service';
import { EmbeddingService } from '../../../../services/embedding-service';
import { KuzuAdapter } from '../../../secondary/graph/kuzu-adapter';
import { LanceDBAdapter } from '../../../secondary/vector/lancedb-adapter';
import * as path from 'path';

/**
 * Registers the scan workspace command
 */
export function registerScanWorkspaceCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'cappy.scanWorkspace',
    async () => {
      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        const dataDir = path.join(workspaceRoot, '.cappy', 'data');

        // Show progress
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning workspace...',
            cancellable: false
          },
          async (progress) => {
            // Initialize services
            console.log('🔧 Initializing services...');
            
            const embeddingService = new EmbeddingService();
            await embeddingService.initialize();
            
            const vectorStore = new LanceDBAdapter(
              path.join(dataDir, 'lancedb')
            );
            await vectorStore.initialize();
            
            const graphStore = new KuzuAdapter(
              path.join(dataDir, 'kuzu')
            );
            await graphStore.initialize();
            
            const parserService = new ParserService();
            const indexingService = new IndexingService(
              vectorStore,
              graphStore,
              embeddingService
            );
            await indexingService.initialize();

            // Create scanner
            const scanner = new WorkspaceScanner({
              workspaceRoot,
              repoId: path.basename(workspaceRoot),
              parserService,
              indexingService,
              graphStore,
              batchSize: 10,
              concurrency: 3
            });

            // Setup progress reporting
            scanner.onProgress((scanProgress: ScanProgress) => {
              const percentage = scanProgress.totalFiles > 0
                ? (scanProgress.processedFiles / scanProgress.totalFiles) * 100
                : 0;
              
              progress.report({
                message: `${scanProgress.status} - ${scanProgress.processedFiles}/${scanProgress.totalFiles} files`,
                increment: percentage
              });
            });

            // Initialize and scan
            await scanner.initialize();
            await scanner.scanWorkspace();

            vscode.window.showInformationMessage(
              '✅ Workspace scan completed successfully!'
            );
          }
        );
      } catch (error) {
        console.error('❌ Scan workspace error:', error);
        vscode.window.showErrorMessage(
          `Failed to scan workspace: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  context.subscriptions.push(command);
}
