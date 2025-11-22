/**
 * @fileoverview Intention Agent Graph
 * @module agents/intention/graph
 */

import * as vscode from 'vscode';
import type { IntentionState } from './state';
import type { ProgressCallback } from '../common/types';

const INTENTION_PROMPT = `Analyze the user's message and determine their intent.

Classify the intent as one of:
- "task": User wants to create, implement, modify code or perform development work
- "question": User is asking a question about code, documentation, or technical concepts
- "smalltalk": User is engaging in casual conversation, greetings, or non-technical chat
- "unknown": Cannot determine intent clearly

Respond ONLY with valid JSON in this exact format:
{
  "intent": "task" | "question" | "smalltalk" | "unknown",
  "confidence": 0.0 to 1.0
}

Examples:
User: "criar uma nova feature de autenticação" → {"intent": "task", "confidence": 0.95}
User: "como funciona o sistema de cache?" → {"intent": "question", "confidence": 0.9}
User: "oi, tudo bem?" → {"intent": "smalltalk", "confidence": 0.95}`;

/**
 * Analyzes user intent using LLM
 */
export async function runIntentionAgent(
  state: IntentionState,
  progressCallback?: ProgressCallback
): Promise<IntentionState> {
  progressCallback?.('💡 Analisando sua intenção...');
  
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';
  
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      return fallbackIntention(state, lastMessage);
    }
    
    const model = models[0];
    const messages = [
      vscode.LanguageModelChatMessage.User(INTENTION_PROMPT),
      vscode.LanguageModelChatMessage.User(`User message: ${lastMessage}`)
    ];
    
    const response = await model.sendRequest(messages, {});
    let fullText = '';
    for await (const chunk of response.text) {
      fullText += chunk;
    }
    
    const jsonMatch = fullText.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const intent = parsed.intent || 'unknown';
      
      return {
        ...state,
        userRequest: lastMessage,
        intent: intent as IntentionState['intent'],
        summary: undefined,
        phase: 'refinement'
      };
    }
    
    return fallbackIntention(state, lastMessage);
  } catch (error) {
    console.error('Intention LLM error:', error);
    return fallbackIntention(state, lastMessage);
  }
}

function fallbackIntention(state: IntentionState, lastMessage: string): IntentionState {
  let intent: IntentionState['intent'] = 'unknown';
  
  const lowerMsg = lastMessage.toLowerCase();
  if (lowerMsg.match(/\b(criar|implementar|adicionar|desenvolver|modificar|refatorar)\b/)) {
    intent = 'task';
  } else if (lastMessage.includes('?')) {
    intent = 'question';
  } else if (lowerMsg.match(/\b(oi|olá|ola|hey|hello)\b/)) {
    intent = 'smalltalk';
  } else {
    intent = 'task';
  }
  
  return {
    ...state,
    userRequest: lastMessage,
    intent,
    summary: undefined,
    phase: 'refinement'
  };
}
