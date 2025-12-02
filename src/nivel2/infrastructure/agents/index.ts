/**
 * @fileoverview Intelligent Agent System - Main orchestrator
 * @module agents
 * 
 * This is the main entry point for the multi-agent planning system.
 * It implements a complete workflow with specialized agents.
 * 
 * Architecture:
 * - Supervisor: Orchestrates all agents
 * - Conversational: Primary entry point for all interactions
 * - Researcher: Searches workspace for relevant context
 * - Summarizer: Synthesizes research findings
 * - Debater: Brainstorms solutions collaboratively
 * - Planner: Creates technical plans
 * - Critic: Validates plans
 * - Refiner: Improves plans based on critiques
 * - Executor: Executes plans and generates deliverables
 */

import { createSupervisorGraph, createSupervisorState } from './supervisor';
import type {
  ProgressCallback,
  SessionTurnRequest,
  SessionTurnResult,
  PlanningTurnResult,
  AgentMessage
} from './common/types';
import { 
  getLangGraphAdapter,
  MessageStateHandler,
  StateManager,
  CheckpointTracker,
  type LangGraphPersistenceAdapter
} from '../persistence';

/**
 * Main Intelligent Agent System
 * 
 * Orchestrates multiple specialized agents to handle:
 * - Code analysis
 * - Documentation reading
 * - Alternative discussion
 * - Technical planning
 * - Plan validation
 * - Deliverable execution
 */
export class IntelligentAgent {
  private progressCallback?: ProgressCallback;
  private persistenceAdapter?: LangGraphPersistenceAdapter;
  private messageHandlers: Map<string, MessageStateHandler> = new Map();
  private checkpointTrackers: Map<string, CheckpointTracker> = new Map();
  private stateManager?: StateManager;
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  /**
   * Initializes the agent system
   */
  async initialize(): Promise<void> {
    console.log('🤖 [IntelligentAgent] Initializing multi-agent system...');
    
    // Initialize persistence layer (StateManager will be initialized on first task)
    this.persistenceAdapter = getLangGraphAdapter(this.storagePath);
    
    console.log('✅ [IntelligentAgent] All agents ready:');
    console.log('   - Supervisor (orchestrator)');
    console.log('   - Conversational (primary entry, chat)');
    console.log('   - Researcher (workspace search)');
    console.log('   - Summarizer (synthesis)');
    console.log('   - Debater (collaborative brainstorming)');
    console.log('   - Planner (technical planning)');
    console.log('   - Critic (plan validation)');
    console.log('   - Refiner (plan improvement)');
    console.log('   - Executor (deliverable generation)');
    console.log('✅ [IntelligentAgent] Persistence layer initialized');
    console.log('✅ [IntelligentAgent] System initialized');
  }

  /**
   * Sets the progress callback for UI updates
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Runs a session turn with user input
   */
  async runSessionTurn(request: SessionTurnRequest): Promise<SessionTurnResult> {
    const { sessionId, message } = request;

    // DEBUG: Log what we received
    console.log('[IntelligentAgent] Received message:', message.substring(0, 100));
    console.log('[IntelligentAgent] Session ID:', sessionId);

    if (!this.persistenceAdapter) {
      throw new Error('[IntelligentAgent] Not initialized. Call initialize() first.');
    }

    // Get or create message handler for this session
    let messageHandler = this.messageHandlers.get(sessionId);
    if (!messageHandler) {
      const workspacePath = require('vscode').workspace.workspaceFolders?.[0]?.uri.fsPath;
      const { messageHandler: handler, checkpointSaver } = await this.persistenceAdapter.initializeForTask(
        sessionId,
        Date.now().toString(),
        workspacePath
      );
      messageHandler = handler;
      this.messageHandlers.set(sessionId, handler);
      
      // Initialize state manager on first task
      if (!this.stateManager) {
        this.stateManager = this.persistenceAdapter.getStateManager();
      }
    }

    // Load existing messages
    await messageHandler.loadMessages();
    const history = messageHandler.getMessages();

    // Add user message to history (atomic operation with mutex)
    const userMessage: AgentMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    await messageHandler.addMessage(userMessage);

    // Create supervisor state
    const state = createSupervisorState(sessionId);
    state.messages = [...history];

    // Create and run supervisor graph
    const graph = createSupervisorGraph(this.progressCallback);

    try {
      const result = await graph.invoke(state);

      // Build response message
      let responseContent = '';
      
      // Only show refinement question from debater if awaiting user
      if (result.awaitingUser && result.metadata?.refinementQuestion) {
        responseContent = result.metadata.refinementQuestion as string;
      }
      
      // Show plan if available
      if (result.metadata?.plan) {
        responseContent += `**Plano:**\n${result.metadata.plan}\n\n`;
      }
      
      // Show deliverables if available
      if (result.metadata?.deliverables) {
        responseContent += `**Entregáveis:**\n${(result.metadata.deliverables as string[]).map(d => `- ${d}`).join('\n')}\n\n`;
      }
      
      // Show completion status
      if (result.awaitingUser) {
        // Questions already added above
      } else if (result.phase === 'completed') {
        // If conversational response from agent
        const conversationalResponse = result.metadata?.response as string | undefined;
        const recommendations = result.metadata?.recommendations as string[] | undefined;
        
        if (conversationalResponse) {
          responseContent = conversationalResponse;
        } else if (recommendations && recommendations.length > 0) {
          responseContent = recommendations[0];
        } else {
          responseContent += `\n✅ **Processo concluído com sucesso!**`;
        }
      }

      // Create assistant response (atomic operation)
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: responseContent || 'Processado com sucesso',
        timestamp: new Date()
      };
      await messageHandler.addMessage(assistantMessage);
      
      // Update history reference
      const updatedHistory = messageHandler.getMessages();

      // Build result
      const planningResult: PlanningTurnResult = {
        phase: result.phase as PlanningTurnResult['phase'],
        confirmed: result.planConfirmed,
        readyForExecution: result.readyForExecution,
        awaitingUser: result.awaitingUser,
        responseMessage: responseContent,
        conversationLog: [...updatedHistory]
      };

      return {
        result: planningResult,
        isContinuation: updatedHistory.length > 2
      };

    } catch (error) {
      console.error('❌ [IntelligentAgent] Error processing turn:', error);
      throw error;
    }
  }

  /**
   * Clears session history
   */
  async clearSession(sessionId: string): Promise<void> {
    const messageHandler = this.messageHandlers.get(sessionId);
    if (messageHandler) {
      await messageHandler.dispose();
      this.messageHandlers.delete(sessionId);
    }
    
    const checkpointTracker = this.checkpointTrackers.get(sessionId);
    if (checkpointTracker) {
      await checkpointTracker.dispose();
      this.checkpointTrackers.delete(sessionId);
    }
    
    // Delete task from state manager
    if (this.stateManager) {
      await this.stateManager.deleteTask(sessionId);
    }
    
    console.log(`🗑️ [IntelligentAgent] Session ${sessionId} cleared`);
  }

  /**
   * Gets all active sessions
   */
  getActiveSessions(): string[] {
    if (!this.stateManager) {
      return [];
    }
    const tasks = this.stateManager.getTaskHistory();
    return tasks.map(t => t.id);
  }
  
  /**
   * Create a checkpoint for a session
   */
  async createCheckpoint(sessionId: string, description?: string): Promise<string | null> {
    const checkpointTracker = this.checkpointTrackers.get(sessionId);
    if (!checkpointTracker) {
      console.warn('[IntelligentAgent] No checkpoint tracker for session:', sessionId);
      return null;
    }
    
    try {
      const hash = await checkpointTracker.commit(description);
      console.log(`✅ [IntelligentAgent] Checkpoint created for ${sessionId}:`, hash);
      return hash;
    } catch (error) {
      console.error('[IntelligentAgent] Failed to create checkpoint:', error);
      return null;
    }
  }
  
  /**
   * Restore session to a checkpoint
   */
  async restoreCheckpoint(sessionId: string, checkpointHash: string): Promise<void> {
    const checkpointTracker = this.checkpointTrackers.get(sessionId);
    if (!checkpointTracker) {
      throw new Error(`No checkpoint tracker for session: ${sessionId}`);
    }
    
    await checkpointTracker.restore(checkpointHash);
    
    // Reload messages after restore
    const messageHandler = this.messageHandlers.get(sessionId);
    if (messageHandler) {
      await messageHandler.loadMessages();
    }
    
    console.log(`✅ [IntelligentAgent] Restored ${sessionId} to checkpoint:`, checkpointHash);
  }
  
  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    // Dispose all message handlers
    for (const handler of this.messageHandlers.values()) {
      await handler.dispose();
    }
    this.messageHandlers.clear();
    
    // Dispose all checkpoint trackers
    for (const tracker of this.checkpointTrackers.values()) {
      await tracker.dispose();
    }
    this.checkpointTrackers.clear();
    
    // Dispose persistence adapter
    if (this.persistenceAdapter) {
      await this.persistenceAdapter.dispose();
    }
  }
}

// Export all agents and types
export * from './common/types';
export * from './common/state';
export * from './supervisor';
export * from './conversational';
export * from './researcher';
export * from './summarizer';
export * from './debater';
export * from './refinement';
export * from './planner';
export * from './critic';
export * from './refiner';
export * from './executor';
export * from './context';
