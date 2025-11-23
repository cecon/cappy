/**
 * @fileoverview Critic Agent Graph
 * @module agents/critic/graph
 */

import * as vscode from 'vscode';
import type { CriticState } from './state';
import type { ProgressCallback } from '../common/types';
import { createProgressEvent } from '../types/progress-events';

const CRITIC_PROMPT = `You are a technical critic reviewing development plans.

Analyze the plan for:
- Missing steps or incomplete coverage
- Potential issues or risks
- Best practice violations
- Areas needing improvement

Respond with JSON:
{
  "issues": ["critical issue 1", "critical issue 2"],
  "suggestions": ["improvement 1", "improvement 2"],
  "approved": true/false
}

Approve only if plan is solid. Be constructive.`;

/**
 * Critiques plan using LLM
 */
export async function runCriticAgent(
  state: CriticState,
  progressCallback?: ProgressCallback
): Promise<CriticState> {
  progressCallback?.(createProgressEvent(
    'critic',
    'started',
    'Revisando plano de desenvolvimento...'
  ));
  
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      progressCallback?.(createProgressEvent(
        'critic',
        'failed',
        'Modelo LLM não disponível'
      ));
      throw new Error('[Critic] No LLM models available');
    }
    
    progressCallback?.(createProgressEvent(
      'critic',
      'analyzing',
      'Identificando gaps e riscos potenciais...'
    ));
    
    const model = models[0];
    const plan = state.plan || 'Nenhum plano disponível';
    
    const messages = [
      vscode.LanguageModelChatMessage.User(CRITIC_PROMPT),
      vscode.LanguageModelChatMessage.User(`Plan to review:\n${plan}`)
    ];
    
    const response = await model.sendRequest(messages, {});
    let fullText = '';
    for await (const chunk of response.text) {
      fullText += chunk;
    }
    
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      progressCallback?.(createProgressEvent(
        'critic',
        'failed',
        'Não foi possível parsear resposta do LLM'
      ));
      throw new Error('[Critic] Could not parse LLM response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    const approved = parsed.approved === true;
    const issuesCount = (parsed.issues || []).length;
    const suggestionsCount = (parsed.suggestions || []).length;
    
    if (approved) {
      progressCallback?.(createProgressEvent(
        'critic',
        'completed',
        'Plano aprovado!',
        { approved: true, issuesCount, suggestionsCount }
      ));
    } else {
      progressCallback?.(createProgressEvent(
        'critic',
        'completed',
        'Plano precisa de melhorias',
        { approved: false, issuesCount, suggestionsCount }
      ));
    }
    
    return {
      ...state,
      issues: parsed.issues || [],
      suggestions: parsed.suggestions || [],
      approved,
      phase: approved ? 'execution' : 'refinement-plan'
    };
  } catch (error) {
    console.error('Critic LLM error:', error);
    
    progressCallback?.(createProgressEvent(
      'critic',
      'failed',
      `Erro na crítica: ${error instanceof Error ? error.message : String(error)}`
    ));
    
    throw error;
  }
}
