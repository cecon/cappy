/**
 * @fileoverview Supervisor graph - Conversational-first orchestration
 * @module agents/supervisor/graph
 */

import * as vscode from 'vscode';
import type { SupervisorState } from './state';
import type { ProgressCallback } from '../common/types';
import { runConversationalAgent } from '../conversational';
import { runResearcherAgent } from '../researcher';
import { runSummarizerAgent } from '../summarizer';
import { runDebaterAgent } from '../debater';
import { runPlannerAgent } from '../planner';
import { runCriticAgent } from '../critic';
import { runRefinerAgent } from '../refiner';
import { runExecutorAgent } from '../executor';

/**
 * Supervisor System Prompt
 * 
 * Conversational-first approach:
 * - ALWAYS starts with conversational agent
 * - Escalates to research/planning only when user explicitly requests work
 * - No intent classification needed upfront
 */
const SUPERVISOR_PROMPT = `You are the Supervisor of a multi-agent development system.

Your job is to analyze the conversation and decide the next agent based on what the user needs.

Available agents:
- conversational: Handle friendly chat, questions, clarifications (DEFAULT - always start here)
- researcher: Search workspace for relevant code/docs when user asks technical questions
- summarizer: Synthesize research findings into actionable insights
- debater: Brainstorm solutions and technical approaches collaboratively
- planner: Create detailed development plans
- critic: Validate and critique plans
- refiner: Improve plans based on critiques
- executor: Execute plans and generate code

Current phase: {{phase}}
User message: {{message}}
Conversation history: {{history}}

Decision flow:
1. NEW conversation OR casual chat → conversational
2. User asks "how does X work?" OR "where is Y?" → researcher → summarizer
3. User says "let's build X" OR "I need to implement Y" → researcher → summarizer → debater
4. After debater approves → planner → critic → (refiner if needed) → executor

IMPORTANT: 
- ALWAYS start with conversational for new messages
- Let conversational decide if escalation is needed
- Researcher/summarizer/debater work as a pipeline for technical work
- Never skip conversational unless already in a workflow phase

Respond in JSON:
{
  "action": "call_agent",
  "agent": "conversational" | "researcher" | "summarizer" | "debater" | "planner" | "critic" | "refiner" | "executor",
  "reasoning": "why you made this decision"
}`;

/**
 * Uses LLM to decide supervisor's next action
 */
async function supervisorDecision(
  state: SupervisorState,
  progressCallback?: ProgressCallback
): Promise<{
  action: 'call_agent';
  agent: string;
  reasoning?: string;
}> {
  progressCallback?.('Supervisor decidindo próximo passo...');
  
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';
  const conversationHistory = state.messages.slice(-5).map(m => 
    `${m.role}: ${m.content}`
  ).join('\n');
  
  try {
    // Get available LLM models
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      throw new Error('[Supervisor] No LLM models available');
    }
    
    const model = models[0];
    
    // Prepare prompt
    const prompt = SUPERVISOR_PROMPT
      .replace('{{phase}}', state.phase)
      .replace('{{message}}', lastMessage)
      .replace('{{history}}', conversationHistory);
    
    // Call LLM
    const messages = [
      vscode.LanguageModelChatMessage.User(prompt)
    ];
    
    const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
    
    // Collect response
    let fullResponse = '';
    for await (const chunk of response.text) {
      fullResponse += chunk;
    }
    
    // Parse JSON response
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('[Supervisor] Could not parse LLM response');
    }
    
    const decision = JSON.parse(jsonMatch[0]);
    return {
      action: 'call_agent',
      agent: decision.agent || 'intention',
      reasoning: decision.reasoning
    };
    
  } catch (error) {
    console.error('[Supervisor] LLM call failed:', error);
    throw error;
  }
}

/**
 * Supervisor orchestrates all agents in conversational-first flow
 */
export function createSupervisorGraph(progressCallback?: ProgressCallback) {
  return {
    invoke: async (state: SupervisorState): Promise<SupervisorState> => {
      const currentState = { ...state };
      
      // Let LLM decide what to do
      const decision = await supervisorDecision(currentState, progressCallback);
      
      // Execute the chosen agent
      try {
        // CONVERSATIONAL (default entry point)
        if (decision.agent === 'conversational' || currentState.phase === 'conversational') {
          const result = await runConversationalAgent(
            { ...currentState, messages: currentState.messages },
            progressCallback
          );
          
          // Check if conversational wants to escalate to research
          if (result.metadata?.shouldEscalate) {
            currentState.phase = 'research';
            currentState.currentAgent = 'researcher';
          } else {
            return {
              ...currentState,
              phase: 'completed',
              metadata: {
                ...currentState.metadata,
                response: result.response
              }
            };
          }
        }
        
        // RESEARCH pipeline: researcher → summarizer → debater
        if (currentState.phase === 'research') {
          progressCallback?.('🔍 Researcher Agent');
          const researchResult = await runResearcherAgent(
            { ...currentState, messages: currentState.messages },
            progressCallback
          );
          
          progressCallback?.('📝 Summarizer Agent');
          const summaryResult = await runSummarizerAgent(
            { 
              ...currentState, 
              messages: currentState.messages,
              findings: researchResult.findings || []
            },
            progressCallback
          );
          
          progressCallback?.('💡 Debater Agent');
          const debateResult = await runDebaterAgent(
            { 
              ...currentState, 
              messages: currentState.messages,
              summary: summaryResult.summary
            },
            progressCallback
          );
          
          // If debater needs clarification, pause
          if (debateResult.awaitingUser) {
            return {
              ...currentState,
              awaitingUser: true,
              phase: 'debate',
              metadata: {
                ...currentState.metadata,
                refinementQuestion: debateResult.metadata?.refinementQuestion,
                researchFindings: researchResult.findings?.map(f => f.content),
                summaries: summaryResult.summary ? [summaryResult.summary] : []
              }
            };
          }
          
          // Ready to proceed to planning
          currentState.metadata = {
            ...currentState.metadata,
            researchFindings: researchResult.findings?.map(f => f.content),
            summaries: summaryResult.summary ? [summaryResult.summary] : [],
            recommendations: debateResult.recommendation ? [debateResult.recommendation] : []
          };
          currentState.phase = 'planning';
          currentState.currentAgent = 'planner';
        }
        
        // PLANNING
        if (currentState.phase === 'planning') {
          progressCallback?.('📋 Planner Agent');
          const result = await runPlannerAgent(
            { ...currentState, messages: currentState.messages },
            progressCallback
          );
          currentState.metadata = {
            ...currentState.metadata,
            plan: result.plan
          };
          currentState.phase = 'critique';
          currentState.currentAgent = 'critic';
        }
        
        // CRITIQUE
        if (currentState.phase === 'critique') {
          progressCallback?.('🔎 Critic Agent');
          const result = await runCriticAgent(
            { ...currentState, messages: currentState.messages },
            progressCallback
          );
          
          if (!result.approved) {
            currentState.phase = 'refinement-plan';
            currentState.currentAgent = 'refiner';
          } else {
            currentState.phase = 'execution';
            currentState.currentAgent = 'executor';
            currentState.readyForExecution = true;
          }
          
          currentState.metadata = {
            ...currentState.metadata,
            critiques: result.suggestions
          };
        }
        
        // REFINEMENT
        if (currentState.phase === 'refinement-plan') {
          progressCallback?.('✨ Refiner Agent');
          const result = await runRefinerAgent(
            { 
              ...currentState, 
              messages: currentState.messages,
              originalPlan: currentState.metadata?.plan as string
            },
            progressCallback
          );
          currentState.metadata = {
            ...currentState.metadata,
            plan: result.refinedPlan
          };
          currentState.phase = 'execution';
          currentState.currentAgent = 'executor';
          currentState.readyForExecution = true;
        }
        
        // EXECUTION
        if (currentState.phase === 'execution') {
          progressCallback?.('⚡ Executor Agent');
          const result = await runExecutorAgent(
            { ...currentState, messages: currentState.messages },
            progressCallback
          );
          currentState.metadata = {
            ...currentState.metadata,
            executionResults: result.executionResults,
            deliverables: result.deliverables
          };
          currentState.phase = 'completed';
          currentState.currentAgent = null;
        }
        
        return currentState;
        
      } catch (error) {
        console.error('❌ [Supervisor] Error:', error);
        return {
          ...currentState,
          metadata: {
            ...currentState.metadata,
            error: error instanceof Error ? error.message : String(error)
          }
        };
      }
    }
  };
}
