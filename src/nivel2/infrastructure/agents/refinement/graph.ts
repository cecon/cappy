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
      console.warn('[Refinement] No LLM available');
      throw new Error('[Refinement] No LLM models available');
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
    if (!jsonMatch) {
      console.warn('[Refinement] Could not parse LLM response');
      throw new Error('[Refinement] Could not parse LLM response');
    }
    
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
  } catch (error) {
    console.error('[Refinement] LLM call failed:', error);
    throw error;
  }
}
