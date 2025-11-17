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

          // Create the LangGraph workflow
          const graph = this.planningAgent.createGraph();
          
          // Initial state
          const initialState = {
            userInput: request.prompt,
            plan: null,
            messages: [],
            criticFeedback: [],
            currentClarification: null,
            userAnswer: null,
            maturityScore: 0,
            nextStep: 'plan' as const,
            iterationCount: 0
          };

          stream.progress('📋 Planning Agent gerando esqueleto...');

          // Execute the graph with streaming updates
          const result = await graph.invoke(initialState, {
            configurable: {
              thread_id: `chat-${Date.now()}`
            },
            streamMode: 'values'
          });
          
          // Show progress after each step
          if (result.iterationCount > 0) {
            stream.progress(`🔄 Iteração ${result.iterationCount}/3 completa (Score: ${result.maturityScore}/100)`);
          }

          console.log('[ChatParticipant] Result:', {
            hasResult: !!result,
            hasPlan: !!result?.plan,
            maturityScore: result?.maturityScore,
            iterationCount: result?.iterationCount,
            nextStep: result?.nextStep
          });

          if (token.isCancellationRequested) {
            stream.markdown('\n\n_Cancelado pelo usuário_');
            return { metadata: { command: 'chat', cancelled: true } };
          }

          // Stream the results
          stream.markdown(`# 📊 Plano de Desenvolvimento\n\n`);
          
          if (!result.plan) {
            stream.markdown(`⚠️ **Atenção**: O sistema executou ${result.iterationCount} iterações mas não conseguiu gerar um plano estruturado.\n\n`);
            stream.markdown(`**Motivo**: A pontuação de maturidade ficou muito baixa (${result.maturityScore}/100).\n\n`);
            stream.markdown(`**Sugestão**: Tente reformular sua solicitação de forma mais específica ou detalhada.\n\n`);
            
            // Show messages history
            if (result.messages && result.messages.length > 0) {
              stream.markdown(`## 💬 Histórico de Mensagens\n\n`);
              const lastMessages = result.messages.slice(-3); // Show last 3 messages
              for (const msg of lastMessages) {
                stream.markdown(`**${msg.role}**: ${msg.content.substring(0, 500)}${msg.content.length > 500 ? '...' : ''}\n\n`);
              }
            }
            
            return { metadata: { command: 'chat' } };
          }
          
          if (result.plan) {
            stream.markdown(`## 🎯 Objetivo\n${result.plan.context.problem}\n\n`);
            
            if (result.maturityScore !== undefined) {
              stream.markdown(`**Maturidade**: ${result.maturityScore}/100\n\n`);
            }

            if (result.plan.functionalRequirements.length > 0) {
              stream.markdown(`## ✅ Requisitos Funcionais\n`);
              result.plan.functionalRequirements.forEach((req, idx) => {
                stream.markdown(`${idx + 1}. **${req.description}** (${req.priority})\n`);
              });
              stream.markdown('\n');
            }

            if (result.plan.components.length > 0) {
              stream.markdown(`## 🏗️ Componentes\n`);
              result.plan.components.forEach((comp) => {
                stream.markdown(`- **${comp.name}** (${comp.type}): ${comp.description}\n`);
              });
              stream.markdown('\n');
            }

            if (result.criticFeedback && result.criticFeedback.length > 0) {
              stream.markdown(`## ⚠️ Feedback Crítico\n`);
              result.criticFeedback.forEach((feedback) => {
                const icon = feedback.severity === 'critical' ? '🔴' : feedback.severity === 'warning' ? '⚠️' : 'ℹ️';
                stream.markdown(`${icon} **[${feedback.category}]** ${feedback.issue}\n`);
                if (feedback.suggestion) {
                  stream.markdown(`   → _Sugestão: ${feedback.suggestion}_\n`);
                }
              });
              stream.markdown('\n');
            }

            if (result.currentClarification) {
              stream.markdown(`## ❓ Esclarecimento Necessário\n\n${result.currentClarification}\n\n`);
              stream.markdown('_Responda para continuar o refinamento do plano._\n');
            }

            // Show plan saved message
            stream.markdown(`\n---\n\n💾 Plano salvo em: \`.cappy/plans/${result.plan.id}.json\`\n`);
          } else {
            stream.markdown('⚠️ Nenhum plano foi gerado. Tente reformular sua solicitação.\n');
          }

          return { metadata: { command: 'chat', planId: result.plan?.id } };
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
}
