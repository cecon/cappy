/**
 * @fileoverview Refiner Agent Graph
 * @module agents/refiner/graph
 */

import * as vscode from 'vscode';
import type { RefinerState } from './state';
import type { ProgressCallback } from '../common/types';

const REFINER_PROMPT = `You are a plan refiner. Improve the development plan based on critique feedback.

Given:
- Original plan
- Issues identified
- Suggestions for improvement

Create a refined plan that:
- Addresses all issues
- Incorporates suggestions
- Maintains original structure
- Adds "## Melhorias Aplicadas" section listing what was fixed

Respond with complete refined plan in Markdown.`;

/**
 * Refines plan using LLM
 */
export async function runRefinerAgent(
  state: RefinerState,
  progressCallback?: ProgressCallback
): Promise<RefinerState> {
  progressCallback?.('✨ Refinando plano...');
  
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      return fallbackRefine(state);
    }
    
    const model = models[0];
    const originalPlan = state.originalPlan || 'Nenhum plano original';
    const issues = state.issues || [];
    const suggestions = state.suggestions || [];
    
    const messages = [
      vscode.LanguageModelChatMessage.User(REFINER_PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Original plan:\n${originalPlan}\n\nIssues:\n${issues.join('\n')}\n\nSuggestions:\n${suggestions.join('\n')}`
      )
    ];
    
    const response = await model.sendRequest(messages, {});
    let refinedPlan = '';
    for await (const chunk of response.text) {
      refinedPlan += chunk;
    }
    
    return {
      ...state,
      refinedPlan: refinedPlan.trim(),
      phase: 'execution'
    };
  } catch (error) {
    console.error('Refiner LLM error:', error);
    return fallbackRefine(state);
  }
}

function fallbackRefine(state: RefinerState): RefinerState {
  const suggestions = state.suggestions || [];
  const refinedPlan = `${state.originalPlan || ''}\n\n## Melhorias Aplicadas\n${suggestions.map((s: string) => `- ${s}`).join('\n')}`;
  
  return {
    ...state,
    refinedPlan,
    phase: 'execution'
  };
}
