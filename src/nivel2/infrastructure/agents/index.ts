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
  private sessions: Map<string, AgentMessage[]> = new Map();

  /**
   * Initializes the agent system
   */
  async initialize(): Promise<void> {
    console.log('🤖 [IntelligentAgent] Initializing multi-agent system...');
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

      // Create assistant response
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: responseContent || 'Processado com sucesso',
        timestamp: new Date()
      };
      history.push(assistantMessage);

      // Build result
      const planningResult: PlanningTurnResult = {
        phase: result.phase as PlanningTurnResult['phase'],
        confirmed: result.planConfirmed,
        readyForExecution: result.readyForExecution,
        awaitingUser: result.awaitingUser,
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
