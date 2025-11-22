/**
 * @fileoverview Executor Agent Graph
 * @module agents/executor/graph
 */

import * as vscode from 'vscode';
import type { ExecutionState } from './state';
import type { ProgressCallback } from '../common/types';

const EXECUTOR_PROMPT = `You are a code executor generating deliverables based on a development plan.

Given the approved plan, identify:
- What files/components need to be created or modified
- What code should be generated
- What documentation is needed
- What tests should be created

Respond with JSON:
{
  "executionResults": ["result 1", "result 2"],
  "deliverables": ["path/to/file1.ts", "path/to/file2.md"]
}

Be specific about file paths and actions.`;

/**
 * Executes plan using LLM
 */
export async function runExecutorAgent(
  state: ExecutionState,
  progressCallback?: ProgressCallback
): Promise<ExecutionState> {
  progressCallback?.('⚡ Executando plano...');
  
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      return fallbackExecute(state);
    }
    
    const model = models[0];
    const plan = state.plan || 'Nenhum plano disponível';
    
    const messages = [
      vscode.LanguageModelChatMessage.User(EXECUTOR_PROMPT),
      vscode.LanguageModelChatMessage.User(`Plan to execute:\n${plan}`)
    ];
    
    const response = await model.sendRequest(messages, {});
    let fullText = '';
    for await (const chunk of response.text) {
      fullText += chunk;
    }
    
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        ...state,
        executionResults: parsed.executionResults || [],
        deliverables: parsed.deliverables || [],
        phase: 'completed'
      };
    }
    
    return fallbackExecute(state);
  } catch (error) {
    console.error('Executor LLM error:', error);
    return fallbackExecute(state);
  }
}

function fallbackExecute(state: ExecutionState): ExecutionState {
  const executionResults = ['Plano analisado', 'Próximos passos identificados'];
  const deliverables = ['Implementação planejada'];
  
  return {
    ...state,
    executionResults,
    deliverables,
    phase: 'completed'
  };
}
