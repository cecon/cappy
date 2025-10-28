/**
 * @fileoverview VS Code command for processing pending files (cronjob)
 * @module adapters/primary/vscode/commands/process-pending-files
 * @author Cappy Team
 * @since 3.0.0
 */

import * as vscode from 'vscode';
import { WorkspaceScanner } from '../../../../nivel2/infrastructure/services/workspace-scanner';
import { ParserService } from '../../../../nivel2/infrastructure/services/parser-service';
import { EmbeddingService } from '../../../../nivel2/infrastructure/services/embedding-service';
import { IndexingService } from '../../../../nivel2/infrastructure/services/indexing-service';
import { SQLiteAdapter } from '../../../../nivel2/infrastructure/database/sqlite-adapter';
import { SQLiteVectorStore } from '../../../../nivel2/infrastructure/vector/sqlite-vector-adapter';
import { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import * as path from 'node:path';
import { ConfigService } from '../../../../nivel2/infrastructure/services/config-service';

/**
 * Registers the process pending files command (for cronjob/background processing)
 */
export function registerProcessPendingFilesCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'cappy.processPendingFiles',
    async (options?: { limit?: number; concurrency?: number; silent?: boolean }) => {
      const limit = options?.limit ?? 10;
      const concurrency = options?.concurrency ?? 3;
      const silent = options?.silent ?? false;

      console.log('🤖 [CRONJOB] Command cappy.processPendingFiles started');
      console.log(`   Limit: ${limit}, Concurrency: ${concurrency}, Silent: ${silent}`);

      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          console.error('❌ [CRONJOB] No workspace folder open');
          if (!silent) {
            vscode.window.showErrorMessage('No workspace folder open');
          }
          return { processed: 0, errors: 0 };
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        const configService = new ConfigService(workspaceRoot);
        const dataDir = configService.getGraphDataPath(workspaceRoot);

        console.log(`📁 [CRONJOB] Workspace root: ${workspaceRoot}`);
        console.log(`📁 [CRONJOB] Data directory: ${dataDir}`);

        // Initialize services
        const embeddingService = new EmbeddingService();
        await embeddingService.initialize();

        const graphStore = new SQLiteAdapter(dataDir);
        await graphStore.initialize();

        const vectorStore = new SQLiteVectorStore(graphStore, embeddingService);
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
        const metadataDbPath = path.join(dataDir, 'file-metadata.db');
        const metadataDatabase = new FileMetadataDatabase(metadataDbPath);
        await metadataDatabase.initialize();

        // Create scanner
        const scanner = new WorkspaceScanner({
          workspaceRoot,
          repoId: path.basename(workspaceRoot),
          parserService,
          metadataDatabase, // Pass metadata database
          batchSize: 10,
          concurrency: 3
        });

        // Initialize scanner (loads file index)
        await scanner.initialize();

        // Process pending files - NOTE: processPendingFiles method no longer exists
        // const result = await scanner.processPendingFiles(limit, concurrency);
        console.log(`⚠️ [CRONJOB] processPendingFiles method not available in new scanner`);
        const result = { processed: 0, errors: 0 };

        console.log(`✅ [CRONJOB] Processing complete: ${result.processed} processed, ${result.errors} errors`);

        if (!silent && result.processed > 0) {
          vscode.window.showInformationMessage(
            `✅ Processed ${result.processed} pending file(s)${result.errors > 0 ? ` (${result.errors} errors)` : ''}`
          );
        }

        return result;
      } catch (error) {
        console.error('❌ [CRONJOB] Process pending files error:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');

        if (!silent) {
          vscode.window.showErrorMessage(
            `❌ Failed to process pending files: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        return { processed: 0, errors: 1 };
      }
    }
  );

  context.subscriptions.push(command);
  console.log('✅ [CRONJOB] Command cappy.processPendingFiles registered successfully');
}
