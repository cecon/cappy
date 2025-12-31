/**
 * @fileoverview Intelligent Agent System - Conversational Agent Orchestrator
 * @module agents
 * 
 * This is the main entry point for the agent system.
 * Currently implements a single conversational agent with thinking loop.
 * 
 * Architecture:
 * - Supervisor: Simple orchestrator (conversational-only)
 * - Conversational: Primary agent with 5-step thinking loop
 */

import { createSupervisorGraph, createSupervisorState } from './supervisor';
import type {
  ProgressCallback,
  SessionTurnRequest,
  SessionTurnResult,
  PlanningTurnResult,
  AgentMessage
} from './common/types';

/**
 * Main Intelligent Agent System
 * 
 * Orchestrates the conversational agent with session management
 */
export class IntelligentAgent {
  private progressCallback?: ProgressCallback;
  private sessions: Map<string, AgentMessage[]> = new Map();

  /**
   * Initializes the agent system
   */
  async initialize(): Promise<void> {
    console.log('🤖 [IntelligentAgent] Initializing agent system...');
    console.log('✅ [IntelligentAgent] Conversational agent ready');
    console.log('   - Thinking loop enabled (5 steps)');
    console.log('   - Tools: cappy_retrieve_context, cappy_grep_search, cappy_read_file');
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

    // Get or create session history
    let history = this.sessions.get(sessionId);
    if (!history) {
      history = [];
      this.sessions.set(sessionId, history);
    }

    // Add user message to history
    const userMessage: AgentMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    history.push(userMessage);

    // Create supervisor state
    const state = createSupervisorState(sessionId);
    state.messages = [...history];

    // Create and run supervisor graph
    const graph = createSupervisorGraph(this.progressCallback);

    try {
      const result = await graph.invoke(state);

      const responseContent = result.metadata?.response as string | undefined;

      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: responseContent || 'Processado com sucesso',
        timestamp: new Date()
      };
      history.push(assistantMessage);

      const planningResult: PlanningTurnResult = {
        phase: result.phase as PlanningTurnResult['phase'],
        responseMessage: responseContent,
        conversationLog: [...history]
      };

      return {
        result: planningResult,
        isContinuation: history.length > 2
      };

    } catch (error) {
      console.error('❌ [IntelligentAgent] Error processing turn:', error);
      throw error;
    }
  }

  /**
   * Clears session history
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(`🗑️ [IntelligentAgent] Session ${sessionId} cleared`);
  }

  /**
   * Gets all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}

// Export types and active agents only
export * from './common/types';
export * from './common/state';
export * from './supervisor';
export * from './conversational';
export * from './context';
