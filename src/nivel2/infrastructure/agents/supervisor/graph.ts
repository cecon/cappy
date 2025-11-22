/**
 * @fileoverview Supervisor graph - LLM-based orchestration
 * @module agents/supervisor/graph
 */

import * as vscode from 'vscode';
import type { SupervisorState } from './state';
import type { ProgressCallback } from '../common/types';
import { runIntentionAgent } from '../intention';
import { runBrainAgent } from '../brain';
import { runPlannerAgent } from '../planner';
import { runCriticAgent } from '../critic';
import { runRefinerAgent } from '../refiner';
import { runExecutorAgent } from '../executor';

/**
 * Supervisor System Prompt
 * 
 * This LLM decides which specialized agent to invoke next based on:
 * - User message
 * - Current phase
 * - Conversation history
 * 
 * TODO: This will be used when vscode.lm API is integrated
 */
const SUPERVISOR_PROMPT = `You are the Supervisor of a multi-agent development system.

Your job is to analyze the user's message and decide which agent to call next.

Available agents:
- brain: Handles casual chat OR research+debate (with technical refinement questions)
- intention: Analyzes user intent for ANY development/work task
- planner: Creates technical development plans
- critic: Validates and critiques plans
- refiner: Improves plans based on critiques
- executor: Executes plans and generates deliverables

Current phase: {{phase}}
User message: {{message}}
Conversation history: {{history}}

Decide:
1. ONLY smalltalk (hi, thanks, bye) → BRAIN agent
2. ANY work/development task (criar, desenvolver, implementar, refatorar, analisar, etc) → INTENTION agent
3. Follow development workflow: intention → brain (research+debate with refinement) → planner → critic → refiner → executor

IMPORTANT: If user wants to BUILD, CREATE, DEVELOP, IMPLEMENT anything → call INTENTION, NOT brain!

Respond in JSON:
{
  "action": "call_agent",
  "agent": "conversational" | "intention" | "refinement" | "brain" | "planner" | "critic" | "refiner" | "executor",
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
  progressCallback?.('🤖 Supervisor decidindo próximo passo...');
  
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
      console.warn('[Supervisor] No LLM models available, using fallback');
      return fallbackDecision(lastMessage, state);
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
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]);
      return {
        action: 'call_agent',
        agent: decision.agent || 'intention',
        reasoning: decision.reasoning
      };
    }
    
    console.warn('[Supervisor] Could not parse LLM response, using fallback');
    return fallbackDecision(lastMessage, state);
    
  } catch (error) {
    console.error('[Supervisor] LLM call failed:', error);
    return fallbackDecision(lastMessage, state);
  }
}

/**
 * Fallback decision logic when LLM is unavailable
 */
function fallbackDecision(message: string, state: SupervisorState): {
  action: 'call_agent';
  agent: string;
  reasoning: string;
} {
  const lowerMessage = message.toLowerCase().trim();
  
  // Pure greetings/thanks/goodbye go to Brain
  const isPureSmallTalk = /^(oi|olá|hey|hi|hello|bom dia|boa tarde|boa noite|obrigad|thanks|tchau|bye)\s*[!?.]*$/i;
  if (isPureSmallTalk.test(lowerMessage)) {
    return {
      action: 'call_agent',
      agent: 'brain',
      reasoning: 'Pure smalltalk - Brain conversational mode (fallback)'
    };
  }
  
  // Development keywords → Intention
  const isDevelopment = /\b(criar|desenvolver|implement|refatorar|analisar|criar|adicionar|modificar|corrigir|fix|build|create|develop|add|tool|feature|funcionalidade|classe|função)\b/i;
  if (isDevelopment.test(lowerMessage)) {
    return {
      action: 'call_agent',
      agent: 'intention',
      reasoning: 'Development task detected - Starting with Intention (fallback)'
    };
  }
  
  // Default: if already in a phase, continue workflow
  if (state.phase !== 'intention' && state.currentAgent) {
    return {
      action: 'call_agent',
      agent: state.currentAgent,
      reasoning: `Continuing workflow at phase: ${state.phase} (fallback)`
    };
  }
  
  // Default: start development workflow
  return {
    action: 'call_agent',
    agent: 'intention',
    reasoning: 'Default to Intention for task analysis (fallback)'
  };
}

/**
 * Supervisor orchestrates all agents based on LLM decisions
 */
export function createSupervisorGraph(progressCallback?: ProgressCallback) {
  return {
    invoke: async (state: SupervisorState): Promise<SupervisorState> => {
      const currentState = { ...state };
      
      // Let LLM decide what to do
      const decision = await supervisorDecision(currentState, progressCallback);
      
      // Execute the chosen agent
      try {
        // Brain for conversational (smalltalk)
        if (decision.agent === 'brain' && currentState.phase === 'intention') {
          progressCallback?.('💬 Brain (Conversational)');
          const result = await runBrainAgent(
            { ...currentState, messages: currentState.messages },
            progressCallback
          );
          return {
            ...currentState,
            phase: 'completed',
            metadata: {
              ...currentState.metadata,
              recommendations: result.debateConclusions || []
            }
          };
        }
        
        if (currentState.phase === 'intention' || decision.agent === 'intention') {
          progressCallback?.('🎯 Intention Agent');
          const result = await runIntentionAgent(
            { ...currentState, messages: currentState.messages },
            progressCallback
          );
          currentState.routerIntent = result.intent;
          currentState.intentionSummary = result.summary;
          currentState.phase = 'research';
          currentState.currentAgent = 'brain';
        }
        
        if (currentState.phase === 'research' || currentState.phase === 'debate') {
          progressCallback?.('🎯 Brain Agent (Research & Debate)');
          const result = await runBrainAgent(
            { ...currentState, messages: currentState.messages, phase: currentState.phase },
            progressCallback
          );
          
          // If debater needs refinement, pause
          if (result.awaitingUser) {
            return {
              ...currentState,
              awaitingUser: true,
              phase: 'debate',
              metadata: {
                ...currentState.metadata,
                refinementQuestion: result.metadata?.refinementQuestion
              }
            };
          }
          
          // Ready to proceed
          currentState.metadata = {
            ...currentState.metadata,
            researchFindings: result.researchResults,
            summaries: result.summaries,
            recommendations: result.debateConclusions
          };
          currentState.phase = 'planning';
          currentState.currentAgent = 'planner';
        }
        
        if (currentState.phase === 'planning') {
          progressCallback?.('🎯 Planner Agent');
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
        
        if (currentState.phase === 'critique') {
          progressCallback?.('🎯 Critic Agent');
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
        
        if (currentState.phase === 'refinement-plan') {
          progressCallback?.('🎯 Refiner Agent');
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
        
        if (currentState.phase === 'execution') {
          progressCallback?.('🎯 Executor Agent');
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
