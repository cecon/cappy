/**
 * @fileoverview Brain Agent Graph - Orchestrates research workflow or handles conversation
 * @module agents/brain/graph
 */

import * as vscode from 'vscode';
import type { BrainState } from './state';
import type { ProgressCallback } from '../common/types';
import { runResearcherAgent } from './agents/researcher';
import { runSummarizerAgent } from './agents/summarizer';
import { runDebaterAgent } from './agents/debater';
import { runConversationalAgent } from './agents/conversational';

/**
 * Detects if message is conversational or technical using LLM
 */
async function isConversational(message: string): Promise<boolean> {
  const lowerMessage = message.toLowerCase().trim();
  
  // Fast path: obvious greetings/goodbyes
  if (/^(oi|olá|hey|hi|hello|bom dia|boa tarde|boa noite|obrigad|thanks|tchau|bye)$/i.test(lowerMessage)) {
    return true;
  }
  
  // Fast path: obvious work requests
  if (message.length > 50) {
    return false; // Detailed requests are always technical
  }
  
  // Use LLM to classify ambiguous messages
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      // No LLM available - cannot classify
      return false;
    }
    
    const model = models[0];
    const prompt = `Classify this message as "conversational" or "technical":

Message: "${message}"

Rules:
- "conversational" = pure smalltalk (greetings, thanks, goodbyes, casual chat with NO work intent)
- "technical" = ANY request for information, analysis, work, or questions about code/project/files

Examples:
- "oi" → conversational
- "obrigado" → conversational  
- "testes automatizados" → technical (asking about tests)
- "verifique se já temos uma pasta de test" → technical (asking to check)
- "o que você acha?" → conversational (unless in context of work discussion)

Respond with ONLY ONE WORD: "conversational" or "technical"`;

    const response = await model.sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      {},
      new vscode.CancellationTokenSource().token
    );
    
    let classification = '';
    for await (const chunk of response.text) {
      classification += chunk;
    }
    
    return classification.toLowerCase().includes('conversational');
  } catch (error) {
    console.error('[Brain] Error classifying message:', error);
    // No LLM available - assume technical
    return false;
  }
}

/**
 * Brain orchestrates:
 * - Conversational path: For greetings, smalltalk (ONLY when called directly by supervisor)
 * - Technical path: researcher -> summarizer -> debater (when in workflow phase 'research')
 */
export async function runBrainAgent(
  state: BrainState,
  progressCallback?: ProgressCallback
): Promise<BrainState> {
  progressCallback?.('🧠 Brain ativado...');
  
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';
  
  // ONLY do conversational check if we're NOT in a workflow phase
  // If phase is 'research', we're part of the development workflow
  if (state.phase !== 'research' && await isConversational(lastMessage)) {
    progressCallback?.('💬 Modo conversacional');
    const conversationalState = await runConversationalAgent(
      { ...state, messages: state.messages },
      progressCallback
    );
    
    return {
      ...state,
      phase: 'completed',
      debateConclusions: conversationalState.response ? [conversationalState.response] : []
    };
  }
  
  // Technical workflow (when phase is 'research' or not conversational)
  progressCallback?.('🧠 Iniciando análise profunda...');
  const currentState = { ...state };
  
  // Step 1: Research
  const researchState = await runResearcherAgent(
    { ...currentState, phase: 'research' },
    progressCallback
  );
  currentState.researchResults = researchState.findings?.map(f => f.content) || [];
  
  // Step 2: Summarize
  const summarizeState = await runSummarizerAgent(
    { ...currentState, phase: 'summarize' },
    progressCallback
  );
  if (summarizeState.summary) {
    currentState.summaries = [summarizeState.summary];
  }
  
  // Step 3: Debate (collaborative brainstorm)
  const debateState = await runDebaterAgent(
    { ...currentState, phase: 'debate' },
    progressCallback
  );
  
  // Debater always contributes and proceeds - no blocking
  if (debateState.recommendation) {
    currentState.debateConclusions = [debateState.recommendation];
  }
  
  // Add debater's contribution to conversation context
  if (debateState.metadata?.debaterContribution) {
    currentState.metadata = {
      ...currentState.metadata,
      debaterContribution: debateState.metadata.debaterContribution
    };
  }
  
  return {
    ...currentState,
    phase: 'planning',
    awaitingUser: false
  };
}
