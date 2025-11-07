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
import type { HybridRetriever } from '../../../../nivel2/infrastructure/services/hybrid-retriever';
import type { GraphPanel } from '../dashboard/GraphPanel';

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
  hybridRetriever: HybridRetriever | null;
  graphPanel: GraphPanel | null;
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
  readonly hybridRetriever: HybridRetriever | null;
  readonly graphPanel: GraphPanel | null;
  readonly commandsBootstrap?: InstanceType<typeof CommandsBootstrap>;
  readonly viewsBootstrap?: ViewsBootstrap;
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
  private readonly state: InternalExtensionState = {
    fileDatabase: null,
    fileQueue: null,
    fileWatcher: null,
    graphStore: null,
    cleanupService: null,
    contextRetrievalTool: null,
    hybridRetriever: null,
    graphPanel: null
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

        // Phase 2: Register Views (Graph Panel with Documents page integrated)
    const viewsBootstrap = new ViewsBootstrap();
    const viewsResult = viewsBootstrap.register(context);
    this.state.graphPanel = viewsResult.graphPanel;
    this.state.viewsBootstrap = viewsBootstrap;

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
    console.log('🤖 Registering CodeAct Chat Participants...');

    const registerParticipant = (
      id: string,
      mode: 'plan' | 'code'
    ) => {
      const participant = vscode.chat.createChatParticipant(
        id,
        async (
          request: vscode.ChatRequest,
          _chatContext: vscode.ChatContext,
          stream: vscode.ChatResponseStream,
          token: vscode.CancellationToken
        ) => {
          try {
            // Create adapter with HybridRetriever if available
            const adapter = new CappyAgentAdapter({ mode }, this.state.hybridRetriever || undefined);
            await adapter.initialize();

            // Use request.prompt directly - the mode is already set in the adapter
            // No need to add @cappy/plan or @cappy/code prefix as we're already in a specific participant
            const messageContent = request.prompt;

            // Create Message object
            const message = {
              id: Date.now().toString(),
              content: messageContent,
              author: 'user' as const,
              timestamp: Date.now()
            };

            // Create ChatContext object with proper history
            const chatContext = {
              sessionId: _chatContext.history.length > 0
                ? `session-${Date.now()}`
                : 'new-session',
              history: _chatContext.history.map((h, index) => ({
                id: `hist-${Date.now()}-${index}`,
                content: 'prompt' in h ? h.prompt : ('response' in h ? h.response.join('') : ''),
                author: h.participant === id ? 'assistant' as const : 'user' as const,
                timestamp: Date.now()
              }))
            };

            // Process message with streaming to VS Code
            for await (const chunk of adapter.processMessage(message, chatContext)) {
              if (token.isCancellationRequested) {
                stream.markdown('\n\n_Task cancelled by user_');
                break;
              }
              stream.markdown(chunk);
            }

            return { metadata: { command: 'chat', mode } };
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            stream.markdown(`\n\n⚠️ **Error**: ${errMsg}`);
            console.error('[CodeActAgent] Error:', error);
            return { metadata: { command: 'chat', error: errMsg, mode } };
          }
        }
      );

      // Set icon (use the actual icon from src/assets)
      participant.iconPath = vscode.Uri.joinPath(
        context.extensionUri,
        'src',
        'assets',
        'icon.png'
      );

      context.subscriptions.push(participant);
      return participant;
    };

    // Register the participants
    registerParticipant('cappy.plan', 'plan');
    registerParticipant('cappy.code', 'code');

    console.log('  ✅ Registered @cappyplan and @cappycode');
  }

  /**
   * Initializes the file processing system
   */
  private async initializeFileProcessingSystem(
    context: vscode.ExtensionContext
  ): Promise<void> {
    if (!this.state.contextRetrievalTool) {
      throw new Error('Extension not fully initialized');
    }

    const fileProcessingBootstrap = new FileProcessingSystemBootstrap();
    const result = await fileProcessingBootstrap.initialize(
      context,
      this.state.contextRetrievalTool
    );

    // Update state
    this.state.fileDatabase = result.fileDatabase;
    this.state.fileQueue = result.queue;
    this.state.fileWatcher = result.watcher;
    this.state.graphStore = result.graphStore;
    this.state.cleanupService = result.cleanupService;
    this.state.hybridRetriever = result.hybridRetriever;

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
        await this.initializeFileProcessingSystem(context);
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
