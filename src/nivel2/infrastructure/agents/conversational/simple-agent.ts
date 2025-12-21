/**
 * Simple conversational agent - direct chat without complex thinking loops
 */

import * as vscode from 'vscode';
import type { ConversationalState } from './state';
import type { ProgressCallback } from '../common/types';
import { LLMSelector } from '../../services/llm-selector';

const SIMPLE_CHAT_PROMPT = `You are Cappy, a friendly and helpful AI coding assistant.

Your capabilities:
- Create and manage todos (use cappy_create_todo, cappy_list_todos, cappy_complete_todo tools)
- Search code files (use cappy_grep_search tool)
- Read file contents (use cappy_read_file tool)
- Create task files (use cappy_create_task_file tool)

Guidelines:
- Be direct and helpful
- When user wants to create a todo, use the cappy_create_todo tool
- When user asks to see todos, use cappy_list_todos tool
- When user marks something done, use cappy_complete_todo tool
- Use tools proactively without asking for permission
- Respond in the same language as the user
- Keep responses concise and action-oriented

Current conversation:
{{conversation}}

User: {{message}}

Respond naturally and use tools when needed.`;

/**
 * Simple conversational agent - PRIMARY entry point
 */
export async function runSimpleConversationalAgent(
  state: ConversationalState,
  progressCallback?: ProgressCallback
): Promise<ConversationalState> {
  progressCallback?.('💬 Processando...');
  
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';
  const conversationHistory = state.messages.slice(-5).map(m => 
    `${m.role}: ${m.content}`
  ).join('\n');

  try {
    // Get best available model
    const model = await LLMSelector.selectBestModel();
    
    if (!model) {
      throw new Error('[SimpleAgent] No LLM models available');
    }

    // Build prompt
    const prompt = SIMPLE_CHAT_PROMPT
      .replace('{{conversation}}', conversationHistory)
      .replace('{{message}}', lastMessage);

    // Send request
    const response = await model.sendRequest([
      vscode.LanguageModelChatMessage.User(prompt)
    ], {});
    
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
    console.error('[SimpleAgent] Error:', error);
    throw error;
  }
}
