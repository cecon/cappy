/**
 * @fileoverview Conversational Agent Graph - Handles smalltalk within Brain
 * @module agents/brain/agents/conversational/graph
 */

import * as vscode from 'vscode';
import type { ConversationalState } from './state';
import type { ProgressCallback } from '../../../common/types';
import { getProjectContext } from '../../../common/utils';

/**
 * Conversational Agent System Prompt
 * 
 * This agent handles all non-technical conversations within the Brain:
 * - Greetings and introductions
 * - Thanks and appreciation
 * - Goodbyes
 * - General questions about capabilities
 * - Casual chat
 */
const CONVERSATIONAL_PROMPT = `You are Cappy, a friendly AI assistant for software development.

You are in CONVERSATIONAL mode - the user is engaging in smalltalk, not requesting technical work.

Current Project Context:
{{projectContext}}

Your personality:
- Friendly and direct
- Brief (1-2 sentences max)
- Professional but approachable
- Focus on guiding toward action

User message: {{message}}
Conversation history: {{history}}

Respond naturally to:
- Greetings (olá, hi, bom dia) → Greet back briefly and ask what they want to work on today
- Thanks (obrigado, thanks) → Accept graciously and stay ready for next task
- Goodbyes (tchau, bye) → Wish them well briefly
- Questions about you → Keep it very short, ask what they need help with
- General chat → Be friendly but immediately guide toward work: "No que vamos trabalhar hoje?"

DO NOT introduce yourself or say "I am Cappy" - they already know.
DO NOT explain your capabilities unless asked.
DO ask what they want to work on or build.
Keep responses extremely short and action-oriented.
Respond in the same language as the user's message.`;

/**
 * Conversational agent - handles smalltalk with LLM
 */
export async function runConversationalAgent(
  state: ConversationalState,
  progressCallback?: ProgressCallback
): Promise<ConversationalState> {
  progressCallback?.('💬 Conversando...');
  
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';
  const conversationHistory = state.messages.slice(-5).map(m => 
    `${m.role}: ${m.content}`
  ).join('\n');
  
  // Get project context
  const projectContext = await getProjectContext();

  try {
    // Get available LLM models
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      console.warn('[Conversational] No LLM models available');
      throw new Error('[Conversational] No LLM models available');
    }
    
    const model = models[0];
    
    // Prepare prompt
    const prompt = CONVERSATIONAL_PROMPT
      .replace('{{message}}', lastMessage)
      .replace('{{history}}', conversationHistory)
      .replace('{{projectContext}}', projectContext);
    
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
    
    return {
      ...state,
      response: fullResponse.trim(),
      phase: 'completed'
    };
    
  } catch (error) {
    console.error('[Conversational] LLM call failed:', error);
    throw error;
  }
}
