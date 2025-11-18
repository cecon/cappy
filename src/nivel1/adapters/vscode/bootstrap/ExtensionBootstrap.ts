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
import type { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import type { FileProcessingQueue } from '../../../../nivel2/infrastructure/services/file-processing-queue';
import type { FileChangeWatcher } from '../../../../nivel2/infrastructure/services/file-change-watcher';
import type { GraphStorePort } from '../../../../domains/dashboard/ports/indexing-port';
import type { GraphCleanupService } from '../../../../nivel2/infrastructure/services/graph-cleanup-service';
import type { ContextRetrievalTool } from '../../../../nivel2/infrastructure/tools/context/context-retrieval-tool';
import type { HybridRetriever } from '../../../../nivel2/infrastructure/services/hybrid-retriever';
import type { GraphPanel } from '../dashboard/GraphPanel';
import { MultiAgentPlanningSystem } from '../../../../nivel2/infrastructure/agents/planning/multi-agent-system';

type PlanningTurnResult = Awaited<ReturnType<MultiAgentPlanningSystem['runSessionTurn']>>['result'];

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
  private readonly planningAgent = new MultiAgentPlanningSystem();

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

    // Phase 3: Register Chat Participant
    await this.registerChatParticipant(context);

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
   * Registers the Cappy chat participant
   */
  private async registerChatParticipant(context: vscode.ExtensionContext): Promise<void> {
    console.log('🤖 Registering @cappy chat participant...');

    // Initialize the MultiAgentPlanningSystem
    await this.planningAgent.initialize();

    const participant = vscode.chat.createChatParticipant(
      'cappy.chat',
      async (
        request: vscode.ChatRequest,
        _chatContext: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
      ) => {
        try {
          console.log('[ChatParticipant] ========================================');
          console.log('[ChatParticipant] RECEIVED REQUEST:', request.prompt);
          console.log('[ChatParticipant] Executing MultiAgentPlanningSystem...');
          console.log('[ChatParticipant] ========================================');

          stream.progress('🤖 Iniciando sistema multi-agente...');

          // Set progress callback to update chat UI
          this.planningAgent.setProgressCallback((message) => {
            stream.progress(message);
          });

          const conversationId = this.resolveConversationId(request);

          console.log('[ChatParticipant] Conversation ID:', conversationId);

          stream.progress('Processando fluxo guiado de tarefa...');

          const { result, isContinuation } = await this.planningAgent.runSessionTurn({
            sessionId: conversationId,
            message: request.prompt
          });

          if (isContinuation) {
            stream.progress('Continuando a fase atual com a resposta do usuário...');
          }

          if (result.awaitingUser) {
            stream.progress('Aguardando resposta do usuário para prosseguir.');
          }

          console.log('[ChatParticipant] Result:', {
            hasResult: !!result,
            phase: result?.phase,
            confirmed: result?.confirmed,
            readyForExecution: result?.readyForExecution,
            awaitingUser: result?.awaitingUser
          });

          if (token.isCancellationRequested) {
            stream.markdown('\n\n_Cancelado pelo usuário_');
            return { metadata: { command: 'chat', cancelled: true } };
          }

          this.streamWorkflowResult(stream, result);

          return {
            metadata: {
              command: 'chat',
              phase: result.phase,
              awaitingUser: result.awaitingUser
            }
          };
        } catch (error) {
          if (token.isCancellationRequested) {
            stream.markdown('\n\n_Cancelado pelo usuário_');
            console.warn('[ChatParticipant] Request cancelled');
            return { metadata: { command: 'chat', cancelled: true } };
          }

          const errMsg = error instanceof Error ? error.message : String(error);
          stream.markdown(`\n\n⚠️ **Error**: ${errMsg}`);
          console.error('[ChatParticipant] Error:', error);
          return { metadata: { command: 'chat', error: errMsg } };
        }
      }
    );

    // Set icon
    participant.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      'src',
      'assets',
      'icon.png'
    );

    context.subscriptions.push(participant);
    console.log('  ✅ Registered @cappy chat participant with ID:', participant.id);
    console.log('  ✅ Chat participant subscriptions added to context');
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

  private streamWorkflowResult(stream: vscode.ChatResponseStream, result: PlanningTurnResult): void {
    const phaseDescription = this.describePhase(result.phase);
    const statusLines = [
      `- Confirmacao do usuario: ${result.confirmed ? 'sim' : 'nao'}`,
      `- Pronto para execucao: ${result.readyForExecution ? 'sim' : 'nao'}`,
      `- Aguardando resposta: ${result.awaitingUser ? 'sim' : 'nao'}`
    ].join('\n');

    stream.markdown(`# Fluxo Guiado de Tarefas\n\n**Fase atual**: ${phaseDescription}\n\n${statusLines}\n`);

    const detailsSummary = this.summarizeDetails(result);
    if (detailsSummary) {
      stream.markdown(`\n**Detalhes coletados ate agora:**\n${detailsSummary}\n`);
    }

    if (result.finalResponse) {
      stream.markdown(`\n${result.finalResponse}\n`);
    } else if (result.responseMessage) {
      stream.markdown(`\n${result.responseMessage}\n`);
    } else if (result.awaitingUser) {
      stream.markdown('\nEstou aguardando sua resposta para continuar.\n');
    } else {
      stream.markdown('\nSem mensagem adicional nesta etapa.\n');
    }
  }

  private describePhase(phase: PlanningTurnResult['phase']): string {
    switch (phase) {
      case 'intencao':
        return 'Intencao';
      case 'refinamento':
        return 'Refinamento';
      case 'execucao':
        return 'Execucao';
      default:
        return 'Desconhecida';
    }
  }

  private summarizeDetails(result: PlanningTurnResult): string {
    const parts: string[] = [];
    const details = result.details;

    if (!details) {
      return '';
    }

    const pushList = (label: string, values: string[]) => {
      if (values.length > 0) {
        parts.push(`- ${label}: ${values.join('; ')}`);
      }
    };

    pushList('Escopo', details.escopo);
    pushList('Requisitos', details.requisitos);
    pushList('Restricoes', details.restricoes);
    pushList('Tecnologias', details.tecnologias);
    pushList('Preferencias', details.preferencias);

    if (details.formato) {
      parts.push(`- Formato desejado: ${details.formato}`);
    }

    return parts.join('\n');
  }

  private resolveConversationId(request: vscode.ChatRequest): string {
    const inferred = request as unknown as {
      conversation?: { id: string };
      sessionId?: string;
      requestId?: string;
    };

    return (
      inferred.conversation?.id
      ?? inferred.sessionId
      ?? inferred.requestId
      ?? `conversation-${Date.now()}`
    );
  }
}
