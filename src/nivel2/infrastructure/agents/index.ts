/**
 * @fileoverview Intelligent Agent System - Planning Agent Orchestrator
 * @module agents
 * 
 * This is the main entry point for the agent system.
 * Implements a Planning Agent focused on collecting scope and creating task files.
 * 
 * Architecture:
 * - Planning Agent: Collects scope -> Analyzes codebase -> Creates task XML
 */

import { runPlanningAgent, type PlanningState } from './planning';
import type {
  ProgressCallback,
  SessionTurnRequest,
  SessionTurnResult,
  PlanningTurnResult,
  AgentMessage
} from './common/types';

/**
 * Session data including state for continuity
 */
interface SessionData {
  history: AgentMessage[];
  planningState?: Partial<PlanningState>;
}

/**
 * Main Intelligent Agent System
 * 
 * Orchestrates the Planning Agent with session management
 */
export class IntelligentAgent {
  private progressCallback?: ProgressCallback;
  private sessions: Map<string, SessionData> = new Map();

  /**
   * Initializes the agent system
   */
  async initialize(): Promise<void> {
    console.log('🤖 [IntelligentAgent] Initializing Planning Agent...');
    console.log('✅ [IntelligentAgent] Planning Agent ready');
    console.log('   - Scope collection');
    console.log('   - Codebase analysis');
    console.log('   - Task XML generation');
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

    // Get or create session data
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = { history: [] };
      this.sessions.set(sessionId, session);
    }

    // Add user message to history
    const userMessage: AgentMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    session.history.push(userMessage);

    try {
      // Run planning agent with existing state for continuity
      const { response, state } = await runPlanningAgent(
        session.history.map(m => ({ role: m.role, content: m.content })),
        session.planningState,
        this.progressCallback
      );

      // Store state for continuity
      session.planningState = {
        phase: state.phase,
        taskPlan: state.taskPlan,
        scopeQuestions: state.scopeQuestions,
        codebaseInfo: state.codebaseInfo,
        taskCreated: state.taskCreated
      };

      // Add assistant response to history
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      session.history.push(assistantMessage);

      const planningResult: PlanningTurnResult = {
        phase: state.phase as PlanningTurnResult['phase'],
        responseMessage: response,
        conversationLog: [...session.history]
      };

      return {
        result: planningResult,
        isContinuation: session.history.length > 2
      };

    } catch (error) {
      console.error('❌ [IntelligentAgent] Error processing turn:', error);
      throw error;
    }
  }

  /**
   * Clears session history and state
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


// Export types and planning agent
export * from './common/types';
export * from './common/state';
export { runPlanningAgent, createPlanningGraph } from './planning';
export type { PlanningState, TaskPlan, TaskStep, PlanningPhase, ScopeQuestion } from './planning';
export * from './conversational';
export * from './context';
