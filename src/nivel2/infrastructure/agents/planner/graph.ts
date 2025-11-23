/**
 * @fileoverview Planner Agent Graph
 * @module agents/planner/graph
 */

import * as vscode from 'vscode';
import type { PlanningState } from './state';
import type { ProgressCallback } from '../common/types';
import { createProgressEvent } from '../types/progress-events';

const PLANNER_PROMPT = `You are a technical planner creating actionable development plans.

Given:
- User's request
- Research findings
- Recommended approach

Create a detailed, step-by-step development plan in Markdown format with:
- Clear phases (Preparation, Implementation, Validation)
- Specific, actionable tasks with [ ] checkboxes
- Logical sequence of steps
- Technical specifics (files, components, patterns)

Format:
## Plano de Desenvolvimento

### Fase 1: [Phase name]
- [ ] Task 1
- [ ] Task 2

Be specific and practical.`;

/**
 * Creates development plan using LLM
 */
export async function runPlannerAgent(
  state: PlanningState,
  progressCallback?: ProgressCallback
): Promise<PlanningState> {
  progressCallback?.(createProgressEvent(
    'planner',
    'started',
    'Criando plano de desenvolvimento...'
  ));
  
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      progressCallback?.(createProgressEvent(
        'planner',
        'failed',
        'Modelo LLM não disponível'
      ));
      throw new Error('[Planner] No LLM models available');
    }
    
    progressCallback?.(createProgressEvent(
      'planner',
      'thinking',
      'Estruturando fases e tarefas acionáveis...'
    ));
    
    const model = models[0];
    const userRequest = state.messages[state.messages.length - 1]?.content || '';
    const recommendation = state.recommendation || 'Implementar solução';
    
    const messages = [
      vscode.LanguageModelChatMessage.User(PLANNER_PROMPT),
      vscode.LanguageModelChatMessage.User(`User request: ${userRequest}\n\nRecommendation: ${recommendation}`)
    ];
    
    const response = await model.sendRequest(messages, {});
    let plan = '';
    for await (const chunk of response.text) {
      plan += chunk;
    }
    
    progressCallback?.(createProgressEvent(
      'planner',
      'completed',
      'Plano técnico criado com sucesso!'
    ));
    
    return {
      ...state,
      plan: plan.trim(),
      phase: 'critique'
    };
  } catch (error) {
    console.error('Planner LLM error:', error);
    
    progressCallback?.(createProgressEvent(
      'planner',
      'failed',
      `Erro ao criar plano: ${error instanceof Error ? error.message : String(error)}`
    ));
    
    throw error;
  }
}
