/**
 * @fileoverview Bootstrap for VS Code Commands registration
 * @module bootstrap/CommandsBootstrap
 */

import * as vscode from 'vscode';
import { GraphPanel } from '../dashboard/GraphPanel';
import { isCappyInitialized } from '../../../../shared/utils/workspace-check';
import { registerScanWorkspaceCommand } from '../commands/scan-workspace';
import {
  registerInitWorkspaceCommand,
  registerProcessSingleFileCommand,
  registerDebugRetrievalCommand,
  registerDebugCommand,
  registerDebugDatabaseCommand,
  registerDebugAddTestDataCommand,
  registerReanalyzeRelationshipsCommand,
  registerResetDatabaseCommand,
  registerDiagnoseGraphCommand,
  registerCleanInvalidFilesCommand
} from '../commands';
import type { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import type { FileProcessingQueue } from '../../../../nivel2/infrastructure/services/file-processing-queue';
import type { GraphStorePort } from '../../../../domains/dashboard/ports/indexing-port';
import type { ContextRetrievalTool } from '../../../../domains/chat/tools/native/context-retrieval';
import type { GetFilesPaginatedOptions } from './types';

export interface CommandsBootstrapDependencies {
  graphPanel: GraphPanel;
  fileDatabase: FileMetadataDatabase | null;
  fileQueue: FileProcessingQueue | null;
  graphStore: GraphStorePort | null;
  contextRetrievalTool: ContextRetrievalTool | null;
  initializeFileProcessingSystem: (
    context: vscode.ExtensionContext,
    graphPanel: GraphPanel
  ) => Promise<void>;
}

/**
 * Registers all VS Code commands
 */
export class CommandsBootstrap {
  private deps: CommandsBootstrapDependencies;
  
  constructor(deps: CommandsBootstrapDependencies) {
    this.deps = deps;
  }

  /**
   * Updates dependencies (called after file processing system is initialized)
   */
  updateDependencies(deps: Partial<CommandsBootstrapDependencies>): void {
    console.log('🔄 [CommandsBootstrap] Updating dependencies');
    this.deps = { ...this.deps, ...deps };
    console.log('🔄 [CommandsBootstrap] Dependencies updated:', {
      fileDatabase: !!this.deps.fileDatabase,
      fileQueue: !!this.deps.fileQueue,
      graphStore: !!this.deps.graphStore
    });
  }

  /**
   * Registers all commands
   */
  register(context: vscode.ExtensionContext): void {
    console.log('⚙️  Registering VS Code Commands...');

    // Core commands
    this.registerCoreCommands(context);

    // Graph commands
    this.registerGraphCommands(context);

    // File processing commands
    this.registerFileProcessingCommands(context);

    // Queue management commands
    this.registerQueueCommands(context);

    // Debug commands
    this.registerDebugCommands(context);

    // Search commands
    this.registerSearchCommands(context);

    console.log('✅ All commands registered');
  }

  /**
   * Registers core commands (init, open graph, etc)
   */
  private registerCoreCommands(context: vscode.ExtensionContext): void {
    // Init workspace
    registerInitWorkspaceCommand(context);
    console.log('  ✅ cappy.init');

    // Open graph visualization
    const openGraphCommand = vscode.commands.registerCommand('cappy.openGraph', async () => {
      await this.deps.graphPanel.show();
    });
    context.subscriptions.push(openGraphCommand);
    console.log('  ✅ cappy.openGraph');
  }

  /**
   * Registers graph-related commands
   */
  private registerGraphCommands(context: vscode.ExtensionContext): void {
    // Get files paginated (for dashboard)
    const getFilesPaginatedCmd = vscode.commands.registerCommand(
      'cappy.getFilesPaginated',
      async (options: GetFilesPaginatedOptions = {}) => {
        if (!this.deps.fileDatabase) {
          throw new Error('File database is not initialized yet');
        }
        const page = options.page ?? 1;
        const limit = options.limit ?? 10;
        const sortBy = options.sortBy ?? 'updated_at';
        const sortOrder = options.sortOrder ?? 'desc';
        return await this.deps.fileDatabase.getFilesPaginated({
          page,
          limit,
          status: options.status,
          sortBy,
          sortOrder
        });
      }
    );
    context.subscriptions.push(getFilesPaginatedCmd);

    // Get document details
    const getDocumentDetailsCmd = vscode.commands.registerCommand(
      'cappy.getDocumentDetails',
      async (options: { fileId: string }) => {
        if (!this.deps.fileDatabase || !this.deps.graphStore) {
          throw new Error('Database or graph store not initialized');
        }

        const file = await this.deps.fileDatabase.getFile(options.fileId);
        if (!file) {
          return { file: null, chunks: [], graphNode: null, relationships: [] };
        }

        const chunks = await this.deps.graphStore.getFileChunks(file.filePath);

        return {
          file: { id: file.id, filePath: file.filePath, fileName: file.fileName },
          chunks,
          graphNode: null, // Not available in GraphStorePort interface
          relationships: []
        };
      }
    );
    context.subscriptions.push(getDocumentDetailsCmd);

    // Reprocess document
    const reprocessDocumentCmd = vscode.commands.registerCommand(
      'cappy.reprocessDocument',
      async (options: { fileId: string; filePath: string }) => {
        if (!this.deps.fileDatabase || !this.deps.graphStore) {
          throw new Error('Database or graph store not initialized');
        }

        // deleteFileNodes is part of GraphStorePort interface
        await this.deps.graphStore.deleteFileNodes(options.filePath);

        await this.deps.fileDatabase.updateFile(options.fileId, {
          status: 'pending',
          currentStep: 'Queued for reprocessing',
          progress: 0,
          errorMessage: undefined
        });
      }
    );
    context.subscriptions.push(reprocessDocumentCmd);

    // Diagnose graph
    if (this.deps.graphStore) {
      registerDiagnoseGraphCommand(context, this.deps.graphStore);
      console.log('  ✅ cappy.diagnoseGraph');
    }

    // Reanalyze relationships
    if (this.deps.graphStore && this.deps.fileDatabase) {
      registerReanalyzeRelationshipsCommand(context, this.deps.graphStore, this.deps.fileDatabase);
      console.log('  ✅ cappy.reanalyzeRelationships');
    }

    // Reset database
    registerResetDatabaseCommand(context);
    console.log('  ✅ cappy.resetDatabase');
  }

  /**
   * Registers file processing commands
   */
  private registerFileProcessingCommands(context: vscode.ExtensionContext): void {
    // Start processing
    const startProcessingCommand = vscode.commands.registerCommand(
      'cappy.startProcessing',
      async () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
          vscode.window.showErrorMessage('❌ No workspace folder open.');
          return;
        }

        if (!isCappyInitialized(workspaceRoot)) {
          const response = await vscode.window.showWarningMessage(
            '⚠️ Cappy is not initialized. Please run "Cappy: Initialize Workspace" first.',
            'Initialize Now',
            'Cancel'
          );
          if (response === 'Initialize Now') {
            await vscode.commands.executeCommand('cappy.init');
            if (isCappyInitialized(workspaceRoot)) {
              await vscode.commands.executeCommand('cappy.startProcessing');
            }
          }
          return;
        }

        try {
          await this.deps.initializeFileProcessingSystem(context, this.deps.graphPanel);
          vscode.window.showInformationMessage('✅ Cappy: File processing system started');
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error('Failed to initialize file processing system:', error);
          vscode.window.showErrorMessage(`Failed to start file processing: ${errMsg}`);
        }
      }
    );
    context.subscriptions.push(startProcessingCommand);
    console.log('  ✅ cappy.startProcessing');

    // Scan workspace
    registerScanWorkspaceCommand(context);
    console.log('  ✅ cappy.scanWorkspace');

    // Process single file
    registerProcessSingleFileCommand(context);
    console.log('  ✅ cappy.processSingleFile');

    // Clean invalid files
    registerCleanInvalidFilesCommand(context);
    console.log('  ✅ cappy.cleanInvalidFiles');
  }

  /**
   * Registers queue management commands
   */
  private registerQueueCommands(context: vscode.ExtensionContext): void {
    // Pause queue
    const pauseQueueCommand = vscode.commands.registerCommand('cappy.pauseQueue', () => {
      if (!this.deps.fileQueue) {
        vscode.window.showWarningMessage('Queue processor not initialized');
        return;
      }
      this.deps.fileQueue.pause();
      vscode.window.showInformationMessage('⏸️ Processing queue paused');
    });
    context.subscriptions.push(pauseQueueCommand);
    console.log('  ✅ cappy.pauseQueue');

    // Resume queue
    const resumeQueueCommand = vscode.commands.registerCommand('cappy.resumeQueue', () => {
      if (!this.deps.fileQueue) {
        vscode.window.showWarningMessage('Queue processor not initialized');
        return;
      }
      this.deps.fileQueue.resume();
      vscode.window.showInformationMessage('▶️ Processing queue resumed');
    });
    context.subscriptions.push(resumeQueueCommand);
    console.log('  ✅ cappy.resumeQueue');

    // Queue status
    const queueStatusCommand = vscode.commands.registerCommand('cappy.queueStatus', async () => {
      if (!this.deps.fileDatabase || !this.deps.fileQueue) {
        vscode.window.showWarningMessage('Queue system not initialized');
        return;
      }

      const stats = await this.deps.fileDatabase.getStats();
      const message = [
        `📊 Queue Status`,
        ``,
        `📁 Files:`,
        `   Total: ${stats.total}`,
        `   Pending: ${stats.pending}`,
        `   Processing: ${stats.processing}`,
        `   Extracting Entities: ${stats.extractingEntities}`,
        `   Creating Relationships: ${stats.creatingRelationships}`,
        `   Entity Discovery: ${stats.entityDiscovery}`,
        `   Processed: ${stats.processed}`,
        `   Error: ${stats.error}`,
        `   Paused: ${stats.paused}`
      ].join('\n');

      vscode.window.showInformationMessage(message, { modal: true });
    });
    context.subscriptions.push(queueStatusCommand);
    console.log('  ✅ cappy.queueStatus');
  }

  /**
   * Registers debug commands
   */
  private registerDebugCommands(context: vscode.ExtensionContext): void {
    registerDebugCommand(context);
    console.log('  ✅ cappy.debug');

    registerDebugDatabaseCommand(context);
    console.log('  ✅ cappy.debugDatabase');

    registerDebugRetrievalCommand(context);
    console.log('  ✅ cappy.debugRetrieval');

    registerDebugAddTestDataCommand(context);
    console.log('  ✅ cappy.debugAddTestData');

    // Test retriever
    const testRetrieverCommand = vscode.commands.registerCommand('cappy.testRetriever', async () => {
      try {
        const outputChannel = vscode.window.createOutputChannel('Cappy Retriever Test');
        outputChannel.show();
        outputChannel.appendLine('🔍 CAPPY RETRIEVER DIAGNOSTIC');
        outputChannel.appendLine('═'.repeat(60));

        outputChannel.appendLine(`\n📦 Tool Instance: ${this.deps.contextRetrievalTool ? '✅ EXISTS' : '❌ NULL'}`);

        if (this.deps.contextRetrievalTool) {
          // Diagnostic code accessing private properties via unknown cast
          const tool = this.deps.contextRetrievalTool as unknown as { retriever?: unknown; graphService?: unknown };
          outputChannel.appendLine(`📦 Retriever: ${tool.retriever ? '✅ EXISTS' : '❌ NULL'}`);
          outputChannel.appendLine(`📦 GraphService: ${tool.graphService ? '✅ EXISTS' : '❌ NULL'}`);

          const retriever = tool.retriever as { graphStore?: unknown; graphData?: unknown; workspaceRoot?: string } | undefined;
          if (retriever) {
            outputChannel.appendLine(`📦 Retriever.graphStore: ${retriever.graphStore ? '✅ EXISTS' : '❌ NULL'}`);
            outputChannel.appendLine(`📦 Retriever.graphData: ${retriever.graphData ? '✅ EXISTS' : '❌ NULL'}`);
            outputChannel.appendLine(`📦 Retriever.workspaceRoot: ${retriever.workspaceRoot || 'NULL'}`);
          }
        }

        outputChannel.appendLine(`\n📦 Global graphStore: ${this.deps.graphStore ? '✅ EXISTS' : '❌ NULL'}`);

        if (this.deps.graphStore) {
          // GraphStorePort doesn't have getChunkContents, this is diagnostic code only
          const store = this.deps.graphStore as GraphStorePort & { getChunkContents?: (limit: number) => Promise<Array<{ chunk_id: string }>> };
          if (store.getChunkContents) {
            outputChannel.appendLine(`📦 graphStore.getChunkContents: ✅ EXISTS`);
            outputChannel.appendLine(`\n🔍 Testing vector query...`);
            const chunks = await store.getChunkContents(5);
            outputChannel.appendLine(`✅ Retrieved ${chunks?.length || 0} chunks`);
            if (chunks && chunks.length > 0) {
              outputChannel.appendLine(`📄 Sample: ${chunks[0].chunk_id}`);
            }
          }
        }

        outputChannel.appendLine('\n' + '═'.repeat(60));
        const query = await vscode.window.showInputBox({
          prompt: 'Enter search query',
          value: 'workspace scanner'
        });

        if (query) {
          outputChannel.appendLine(`\n🔍 Query: "${query}"`);
          outputChannel.appendLine(`📋 Use: @workspace use cappy_retrieve_context to search for "${query}"`);
        }
        vscode.window.showInformationMessage(`✅ Check output for diagnostics`);
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Failed: ${error}`);
      }
    });
    context.subscriptions.push(testRetrieverCommand);
    console.log('  ✅ cappy.testRetriever');
  }

  /**
   * Registers search commands
   */
  private registerSearchCommands(context: vscode.ExtensionContext): void {
    const searchCommand = vscode.commands.registerCommand('cappy.search', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const query = await vscode.window.showInputBox({
        title: 'Cappy Hybrid Search',
        prompt: 'Enter your search query (code, docs, rules, tasks)',
        ignoreFocusOut: true
      });
      if (!query) return;

      const { HybridRetriever } = await import('../../../../nivel2/infrastructure/services/hybrid-retriever.js');
      const retriever = new HybridRetriever();
      
      let result;
      try {
        result = await retriever.retrieve(query, {
          maxResults: 10,
          minScore: 0.3,
          sources: ['code', 'documentation'],
          includeRelated: true,
          rerank: true
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }

      if (!result?.contexts?.length) {
        vscode.window.showInformationMessage(`No relevant context found for: "${query}"`);
        return;
      }

      type QuickPickItem = {
        label: string;
        description?: string;
        detail?: string;
        ctx: typeof result.contexts[0];
      };
      
      const items: QuickPickItem[] = result.contexts.map(ctx => {
        const icon = ctx.source === 'code' ? '💻' : ctx.source === 'documentation' ? '📚' : '📄';
        return {
          label: `${icon} ${ctx.metadata.title || ctx.id}`,
          description: ctx.filePath || undefined,
          detail: ctx.snippet ? ctx.snippet.replace(/\n/g, ' ').slice(0, 200) : ctx.content.slice(0, 200),
          ctx
        };
      });

      const picked = await vscode.window.showQuickPick(items, {
        title: `Hybrid Search Results (${result.contexts.length})`,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Select a context to copy snippet to clipboard',
      });
      
      if (picked?.ctx) {
        await vscode.env.clipboard.writeText(picked.ctx.content);
        vscode.window.showInformationMessage('Context copied to clipboard!');
      }
    });
    context.subscriptions.push(searchCommand);
    console.log('  ✅ cappy.search');
  }
}
