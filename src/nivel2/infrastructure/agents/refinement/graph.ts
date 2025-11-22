/**
 * @fileoverview Refinement Agent Graph
 * @module agents/refinement/graph
 */

import * as vscode from 'vscode';
import type { RefinementState } from './state';
import type { ProgressCallback } from '../common/types';

/**
 * Refinement Agent System Prompt
 */
const REFINEMENT_PROMPT = `You are a requirements refinement specialist.

Your job: Analyze if the user has provided ENOUGH information to proceed with development.

User's conversation so far:
{{conversation}}

Decide:
1. If they provided clear requirements (what to build, modify, or analyze) → PROCEED
2. If they're ASKING YOU for help (find file, explain code, show path) → PROCEED (research phase will help)
3. If information is vague or missing critical details → ASK for clarification

Guidelines:
- "nova tool para chat" alone = TOO VAGUE, ask what it should do
- "usar service X para fazer Y" = CLEAR, proceed
- "implementar feature Z" = CLEAR, proceed
- "confirmar caminho de X" / "onde está X" = USER ASKING HELP, proceed to research
- "já existe service X" = CLEAR context provided, proceed
- Just greetings/thanks = NOT A TASK, proceed anyway (will be handled elsewhere)

IMPORTANT: If user is asking YOU a question or requesting information, PROCEED to research phase.

Respond in JSON:
{
  "hasEnoughDetail": true/false,
  "reasoning": "why you decided",
  "question": "question to ask user (only if hasEnoughDetail=false)"
}`;

/**
 * Refines user requirements using LLM
 */
export async function runRefinementAgent(
  state: RefinementState,
  progressCallback?: ProgressCallback
): Promise<RefinementState> {
  progressCallback?.('🔍 Refinando requisitos...');
  
  // Get conversation context
  const conversation = state.messages
    .slice(-5)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
  
  try {
    // Get LLM models
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      console.warn('[Refinement] No LLM available, using fallback');
      return fallbackRefinement(state);
    }
    
    const model = models[0];
    
    // Prepare prompt
    const prompt = REFINEMENT_PROMPT.replace('{{conversation}}', conversation);
    
    // Call LLM
    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
    const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
    
    // Collect response
    let fullResponse = '';
    for await (const chunk of response.text) {
      fullResponse += chunk;
    }
    
    // Parse JSON
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]);
      
      if (decision.hasEnoughDetail) {
        return {
          ...state,
          requirements: [conversation],
          questions: [],
          awaitingUser: false,
          phase: 'research'
        };
      } else {
        return {
          ...state,
          requirements: [],
          questions: [decision.question || 'Pode detalhar mais?'],
          awaitingUser: true,
          phase: 'refinement'
        };
      }
    }
    
    console.warn('[Refinement] Could not parse LLM response, using fallback');
    return fallbackRefinement(state);
    
  } catch (error) {
    console.error('[Refinement] LLM call failed:', error);
    return fallbackRefinement(state);
  }
}

/**
 * Fallback when LLM unavailable
 */
function fallbackRefinement(state: RefinementState): RefinementState {
  const userMessages = state.messages
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content)
    .join(' ');
  
  const hasDevelopmentKeywords = /\b(criar|implementar|adicionar|modificar|ferramenta|feature|tool|função|classe|service|component|api|chat|interface|integrar|usar|colocar|novo|nova)\b/i.test(userMessages);
  const hasContext = /\b(existe|código|projeto|workspace|arquivo|service|class|function|método)\b/i.test(userMessages);
  
  if (hasDevelopmentKeywords || hasContext) {
    return {
      ...state,
      requirements: [userMessages],
      questions: [],
      awaitingUser: false,
      phase: 'research'
    };
  }
  
  return {
    ...state,
    requirements: [],
    questions: ['Pode detalhar mais o que precisa?'],
    awaitingUser: true,
    phase: 'refinement'
  };
}
