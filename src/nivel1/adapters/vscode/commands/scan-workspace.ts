/**
 * @fileoverview VS Code command for workspace scanning
 * @module adapters/primary/vscode/commands/scan-workspace
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import { WorkspaceScanner } from '../../../../nivel2/infrastructure/services/workspace-scanner';
import type { ScanProgress } from '../../../../nivel2/infrastructure/services/workspace-scanner';
import { ParserService } from '../../../../nivel2/infrastructure/services/parser-service';
import { EmbeddingService } from '../../../../nivel2/infrastructure/services/embedding-service';
import { IndexingService } from '../../../../nivel2/infrastructure/services/indexing-service';
import { SQLiteAdapter } from '../../../../nivel2/infrastructure/database/sqlite-adapter';
import { SQLiteVectorStore } from '../../../../nivel2/infrastructure/vector/sqlite-vector-adapter';
import { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import * as path from 'node:path';
import { ConfigService } from '../../../../nivel2/infrastructure/services/config-service';

/**
 * Registers the scan workspace command
 */
export function registerScanWorkspaceCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'cappy.scanWorkspace',
    async () => {
      console.log('🚀 [SCAN] Command cappy.scanWorkspace started');
      try {
        // Immediate feedback
        vscode.window.showInformationMessage('🚀 Starting workspace scan...');
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          console.error('❌ [SCAN] No workspace folder open');
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  // Use the same config path as the rest of the extension (no extra 'sqlite' subdir)
  const configService = new ConfigService(workspaceRoot);
  const dataDir = configService.getGraphDataPath(workspaceRoot);
        console.log(`📁 [SCAN] Workspace root: ${workspaceRoot}`);
        console.log(`📁 [SCAN] Data directory: ${dataDir}`);

        // Show progress
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: '🔍 Scanning workspace...',
            cancellable: false
          },
          async (progress) => {
            // Step 1: Initialize services
            progress.report({ message: '🔧 Initializing services...', increment: 0 });
            console.log('🔧 Initializing services...');
            
            const embeddingService = new EmbeddingService();
            await embeddingService.initialize();
            
            progress.report({ message: '💾 Initializing database...', increment: 5 });
            
            const graphStore = new SQLiteAdapter(dataDir);
            await graphStore.initialize();
            
            progress.report({ message: '📦 Setting up vector store...', increment: 5 });
            
            // Create vector store using the same SQLite database (with embeddings)
            const vectorStore = new SQLiteVectorStore(graphStore, embeddingService);
            console.log('✅ Vector store initialized (SQLite-based)');
            
            progress.report({ message: '📦 Setting up parsers...', increment: 5 });
            
            const parserService = new ParserService();
            const indexingService = new IndexingService(
              vectorStore,
              graphStore,
              embeddingService,
              workspaceRoot,
              undefined
            );
            await indexingService.initialize();

            // Initialize metadata database
            progress.report({ message: '💾 Initializing metadata database...', increment: 5 });
            const metadataDbPath = path.join(dataDir, 'file-metadata.db');
            const metadataDatabase = new FileMetadataDatabase(metadataDbPath);
            await metadataDatabase.initialize();
            console.log('✅ Metadata database initialized');

            // Step 2: Create scanner
            progress.report({ message: '🔍 Discovering files...', increment: 5 });
            
            const scanner = new WorkspaceScanner({
              workspaceRoot,
              repoId: path.basename(workspaceRoot),
              parserService,
              metadataDatabase, // Pass metadata database
              batchSize: 10,
              concurrency: 3
            });

            // Step 3: Setup progress reporting
            let lastProcessed = 0;
            scanner.onProgress((scanProgress: ScanProgress) => {
              const processed = scanProgress.processedFiles;
              const total = scanProgress.totalFiles;
              const currentFile = scanProgress.currentFile;
              
              // Calculate incremental progress
              const increment = total > 0 ? ((processed - lastProcessed) / total) * 85 : 0;
              lastProcessed = processed;
              
              let statusEmoji = '📄';
              if (scanProgress.status === 'completed') statusEmoji = '✅';
              if (scanProgress.status === 'error') statusEmoji = '❌';
              
              const fileName = currentFile ? path.basename(currentFile) : '';
              const shortName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;
              
              progress.report({
                message: statusEmoji + ' ' + processed + '/' + total + ' files' + (shortName ? ' - ' + shortName : ''),
                increment: increment > 0 ? increment : undefined
              });
            });

            // Step 4: Initialize and scan
            console.log('🔍 Starting scanner initialization...');
            await scanner.initialize();
            
            console.log('🚀 Starting workspace scan...');
            await scanner.scanWorkspace();

            progress.report({ message: '✅ Completed!', increment: 100 });
            
            // Show detailed completion message
            const stats = scanner.getStats();
            console.log('📊 Scan Statistics:', stats);
            
            const errorMsg = stats.errors.length > 0 ? ` (${stats.errors.length} errors)` : '';
            vscode.window.showInformationMessage(
              `✅ Workspace scan completed! Processed ${stats.processedFiles}/${stats.totalFiles} files${errorMsg}`
            );
          }
        );
      } catch (error) {
        console.error('❌ Scan workspace error:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
        
        vscode.window.showErrorMessage(
          `❌ Failed to scan workspace: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  context.subscriptions.push(command);
  console.log('✅ [SCAN] Command cappy.scanWorkspace registered successfully');
}
