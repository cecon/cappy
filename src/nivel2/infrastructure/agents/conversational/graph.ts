/**
 * @fileoverview Conversational Agent Graph - Primary entry point for all interactions
 * @module agents/conversational/graph
 */

import * as vscode from 'vscode';
import type { ConversationalState } from './state';
import type { ProgressCallback } from '../common/types';
import { getProjectContext } from '../common/utils';

/**
 * Conversational Agent System Prompt
 * 
 * Primary entry point - handles all initial interactions and decides escalation
 */
const CONVERSATIONAL_PROMPT = `You are Cappy, a friendly AI assistant for software development.

You are the FIRST agent the user interacts with. Your role is to:
1. Engage in friendly conversation when appropriate
2. Detect when the user needs technical help or wants to build something
3. Signal when to escalate to research/planning agents

Current Project Context:
{{projectContext}}

User message: {{message}}
Conversation history: {{history}}

Your personality:
- Friendly and direct
- Brief (1-2 sentences max)
- Professional but approachable
- Eager to help with technical work

Response rules:
- Greetings (olá, hi, bom dia) → Greet back and ask what they want to work on
- Thanks (obrigado, thanks) → Accept graciously
- Goodbyes (tchau, bye) → Wish them well
- Questions about code/project → Answer if simple, otherwise signal ESCALATE
- Requests to build/create/implement → Signal ESCALATE immediately
- General chat → Be friendly but guide toward technical work

You MUST respond in this JSON format:
{
  "response": "your friendly message to the user",
  "shouldEscalate": true | false,
  "escalationReason": "why escalation is needed (if shouldEscalate=true)"
}

Set shouldEscalate=true when:
- User asks technical questions that need workspace search
- User wants to build, create, implement, or modify code
- User asks "how does X work?" or "where is Y?"
- User needs planning or analysis

Set shouldEscalate=false when:
- Pure greetings, thanks, goodbyes
- Casual chat without work intent
- Simple clarifications you can answer directly

Respond in the same language as the user's message.`;

/**
 * Conversational agent - PRIMARY entry point for all interactions
 */
export async function runConversationalAgent(
  state: ConversationalState,
  progressCallback?: ProgressCallback
): Promise<ConversationalState> {
  progressCallback?.('Conversando...');
  
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
    
    // Parse JSON response
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Conversational] Could not parse JSON, using raw response');
      return {
        ...state,
        response: fullResponse.trim(),
        phase: 'completed'
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      ...state,
      response: parsed.response || fullResponse.trim(),
      phase: parsed.shouldEscalate ? 'research' : 'completed',
      metadata: {
        ...state.metadata,
        shouldEscalate: parsed.shouldEscalate || false,
        escalationReason: parsed.escalationReason
      }
    };
    
  } catch (error) {
    console.error('[Conversational] LLM call failed:', error);
    throw error;
  }
}
