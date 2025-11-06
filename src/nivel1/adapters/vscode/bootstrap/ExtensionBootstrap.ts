/**
 * @fileoverview Main bootstrap orchestrator for Cappy extension
 * @module bootstrap/ExtensionBootstrap
 */

import * as vscode from 'vscode';
import { isCappyInitialized } from '../../../../shared/utils/workspace-check';
import { LanguageModelToolsBootstrap } from './LanguageModelToolsBootstrap';
import { ViewsBootstrap } from './ViewsBootstrap';
import { CommandsBootstrap } from './CommandsBootstrap';
import { FileProcessingSystemBootstrap } from './FileProcessingSystemBootstrap';
import { CappyAgentAdapter } from '../../../../nivel2/infrastructure/agents/codeact/cappy-agent-adapter';
import type { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import type { FileProcessingQueue } from '../../../../nivel2/infrastructure/services/file-processing-queue';
import type { FileChangeWatcher } from '../../../../nivel2/infrastructure/services/file-change-watcher';
import type { GraphStorePort } from '../../../../domains/dashboard/ports/indexing-port';
import type { GraphCleanupService } from '../../../../nivel2/infrastructure/services/graph-cleanup-service';
import type { ContextRetrievalTool } from '../../../../domains/chat/tools/native/context-retrieval';
import type { GraphPanel } from '../dashboard/GraphPanel';
import type { DocumentsViewProvider } from '../documents/DocumentsViewProvider';

/**
 * Main extension state (internal - mutable)
 */
interface InternalExtensionState {
  fileDatabase: FileMetadataDatabase | null;
  fileQueue: FileProcessingQueue | null;
  fileWatcher: FileChangeWatcher | null;
  graphStore: GraphStorePort | null;
  cleanupService: GraphCleanupService | null;
  contextRetrievalTool: ContextRetrievalTool | null;
  graphPanel: GraphPanel | null;
  documentsViewProvider: DocumentsViewProvider | null;
  commandsBootstrap?: InstanceType<typeof CommandsBootstrap>;
  viewsBootstrap?: ViewsBootstrap;
}

/**
 * Main extension state (external - readonly)
 */
export interface ExtensionState {
  readonly fileDatabase: FileMetadataDatabase | null;
  readonly fileQueue: FileProcessingQueue | null;
  readonly fileWatcher: FileChangeWatcher | null;
  readonly graphStore: GraphStorePort | null;
  readonly cleanupService: GraphCleanupService | null;
  readonly contextRetrievalTool: ContextRetrievalTool | null;
  readonly graphPanel: GraphPanel | null;
  readonly documentsViewProvider: DocumentsViewProvider | null;
  readonly commandsBootstrap?: InstanceType<typeof CommandsBootstrap>;
  readonly viewsBootstrap?: ViewsBootstrap;
}

/**
 * Result from ViewsBootstrap registration
 */
interface ViewsBootstrapResult {
  readonly graphPanel: GraphPanel;
  readonly documentsViewProvider: DocumentsViewProvider;
}

/**
 * Main bootstrap orchestrator for the extension
 * 
 * Coordinates initialization of all subsystems following hexagonal architecture:
 * - Language Model Tools (Primary Adapter)
 * - Views (Primary Adapter)
 * - Commands (Primary Adapter)
 * - File Processing System (Application Layer)
 */
export class ExtensionBootstrap {
  private state: InternalExtensionState = {
    fileDatabase: null,
    fileQueue: null,
    fileWatcher: null,
    graphStore: null,
    cleanupService: null,
    contextRetrievalTool: null,
    graphPanel: null,
    documentsViewProvider: null
  };

  /**
   * Activates the extension
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('🚩 [Extension] Cappy activation starting...');
    console.log('🦫 Cappy extension is now active!');

    // Phase 1: Register Language Model Tools
    const lmToolsBootstrap = new LanguageModelToolsBootstrap();
    this.state.contextRetrievalTool = lmToolsBootstrap.register(context);

    // Phase 2: Register Views (webviews, panels, sidebar)
    const viewsBootstrap = new ViewsBootstrap();
    const viewsResult: ViewsBootstrapResult = viewsBootstrap.register(context);
    this.state.graphPanel = viewsResult.graphPanel;
    this.state.documentsViewProvider = viewsResult.documentsViewProvider;
    this.state.viewsBootstrap = viewsBootstrap; // Store for later updates

    // Phase 3: Register CodeAct Agent Chat Participant
    this.registerCodeActAgent(context);

    // Phase 4: Register Commands
    const commandsBootstrap = new CommandsBootstrap({
      graphPanel: this.state.graphPanel,
      fileDatabase: this.state.fileDatabase,
      fileQueue: this.state.fileQueue,
      graphStore: this.state.graphStore,
      contextRetrievalTool: this.state.contextRetrievalTool,
      initializeFileProcessingSystem: this.initializeFileProcessingSystem.bind(this)
    });
    commandsBootstrap.register(context);
    this.state.commandsBootstrap = commandsBootstrap;

    // Phase 5: Auto-start file processing if Cappy is initialized
    await this.autoStartFileProcessing(context);

    // Phase 6: Log available commands
    this.logAvailableCommands();

    // Show success message
    vscode.window.showInformationMessage('Cappy loaded successfully!');
    console.log('✅ [Extension] Cappy activation complete');
  }

  /**
   * Registers the CodeAct Agent as a chat participant
   */
  private registerCodeActAgent(context: vscode.ExtensionContext): void {
    console.log('🤖 Registering CodeAct Agent...');
    
    // Create chat participant
    const cappyAgent = vscode.chat.createChatParticipant(
      'cappy.assistant',
      async (
        request: vscode.ChatRequest,
        _chatContext: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
      ) => {
        try {
          // Create adapter (will be updated with retrieval when available)
          const adapter = new CappyAgentAdapter();
          await adapter.initialize();
          
          // Create Message object
          const message = {
            id: Date.now().toString(),
            content: request.prompt,
            author: 'user' as const,
            timestamp: Date.now()
          };
          
          // Create ChatContext object
          const chatContext = {
            sessionId: _chatContext.history.length > 0 
              ? `session-${Date.now()}` 
              : 'new-session',
            history: []
          };
          
          // Process message with streaming to VS Code
          for await (const chunk of adapter.processMessage(message, chatContext)) {
            if (token.isCancellationRequested) {
              stream.markdown('\n\n_Task cancelled by user_');
              break;
            }
            
            // Stream chunk to VS Code Chat
            stream.markdown(chunk);
          }
          
          return { metadata: { command: 'chat' } };
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          stream.markdown(`\n\n⚠️ **Error**: ${errMsg}`);
          console.error('[CodeActAgent] Error:', error);
          return { metadata: { command: 'chat', error: errMsg } };
        }
      }
    );
    
    // Set icon
    cappyAgent.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      'assets',
      'cappy-icon.png'
    );
    
    context.subscriptions.push(cappyAgent);
    console.log('  ✅ CodeAct Agent registered as @cappy');
  }

  /**
   * Initializes the file processing system
   */
  private async initializeFileProcessingSystem(
    context: vscode.ExtensionContext,
    graphPanel: GraphPanel
  ): Promise<void> {
    if (!this.state.documentsViewProvider || !this.state.contextRetrievalTool) {
      throw new Error('Extension not fully initialized');
    }

    const fileProcessingBootstrap = new FileProcessingSystemBootstrap();
    const result = await fileProcessingBootstrap.initialize(
      context,
      graphPanel,
      this.state.documentsViewProvider,
      this.state.contextRetrievalTool
    );

    // Update state
    this.state.fileDatabase = result.fileDatabase;
    this.state.fileQueue = result.queue;
    this.state.fileWatcher = result.watcher;
    this.state.graphStore = result.graphStore;
    this.state.cleanupService = result.cleanupService;

    // Update CommandsBootstrap with the new dependencies
    if (this.state.commandsBootstrap) {
      console.log('📡 [ExtensionBootstrap] Updating CommandsBootstrap dependencies');
      this.state.commandsBootstrap.updateDependencies({
        fileDatabase: result.fileDatabase,
        fileQueue: result.queue,
        graphStore: result.graphStore
      });
    }
    
    console.log('✅ [ExtensionBootstrap] File processing system initialized successfully');
  }

  /**
   * Auto-starts file processing if Cappy is initialized
   */
  private async autoStartFileProcessing(context: vscode.ExtensionContext): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    if (workspaceRoot && isCappyInitialized(workspaceRoot)) {
      console.log('🚀 Cappy is initialized, auto-starting file processing system...');
      
      try {
        await this.initializeFileProcessingSystem(context, this.state.graphPanel!);
        console.log('✅ File processing system auto-started successfully');
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('❌ Failed to auto-start file processing system:', error);
        
        vscode.window.showWarningMessage(
          `Cappy: File processing system failed to start. Error: ${errMsg}`,
          'Retry'
        ).then(selection => {
          if (selection === 'Retry') {
            vscode.commands.executeCommand('cappy.startProcessing');
          }
        });
      }
    } else {
      console.log('ℹ️  Cappy not initialized. Run "Cappy: Initialize Workspace" to get started.');
    }
  }

  /**
   * Logs available Cappy commands
   */
  private async logAvailableCommands(): Promise<void> {
    const commands = await vscode.commands.getCommands(true);
    const cappyCommands = commands.filter((command) => command.startsWith('cappy'));
    console.log('📋 Cappy Commands Registered:', cappyCommands);
  }

  /**
   * Deactivates the extension
   */
  async deactivate(): Promise<void> {
    console.log('🦫 Cappy extension deactivating...');

    if (this.state.cleanupService) {
      this.state.cleanupService.stop();
      console.log('  ✅ Graph cleanup service stopped');
    }

    if (this.state.fileQueue) {
      this.state.fileQueue.stop();
      console.log('  ✅ File processing queue stopped');
    }

    if (this.state.fileWatcher) {
      this.state.fileWatcher.dispose();
      console.log('  ✅ File watcher stopped');
    }

    console.log('🦫 Cappy extension deactivated');
  }

  /**
   * Gets the current extension state
   */
  getState(): Readonly<ExtensionState> {
    return { ...this.state };
  }
}
