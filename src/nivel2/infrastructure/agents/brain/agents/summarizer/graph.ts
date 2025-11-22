/**
 * @fileoverview Summarizer Agent Graph
 * @module agents/brain/agents/summarizer/graph
 */

import * as vscode from 'vscode';
import type { SummarizerState } from './state';
import type { ProgressCallback } from '../../../common/types';
import { createProgressEvent } from '../../../types/progress-events';

const SUMMARIZER_PROMPT = `You are a technical summarizer. Analyze research findings and create a concise summary.

Your summary should:
- Synthesize key information from research findings
- Identify patterns and important details
- Be clear and actionable (2-4 sentences)
- Focus on what matters for the user's request

Respond with plain text summary only.`;

/**
 * Summarizes research findings using LLM
 */
export async function runSummarizerAgent(
  state: SummarizerState,
  progressCallback?: ProgressCallback
): Promise<SummarizerState> {
  const findingsCount = state.findings?.length || 0;
  
  progressCallback?.(createProgressEvent(
    'summarizer',
    'started',
    'Sintetizando informações encontradas...',
    { findingsCount }
  ));
  
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      progressCallback?.(createProgressEvent(
        'summarizer',
        'failed',
        'Modelo LLM não disponível'
      ));
      throw new Error('[Summarizer] No LLM models available');
    }
    
    const model = models[0];
    const findingsText = JSON.stringify(state.findings || [], null, 2);
    const userRequest = state.messages[state.messages.length - 1]?.content || '';
    
    progressCallback?.(createProgressEvent(
      'summarizer',
      'thinking',
      'Identificando padrões e informações-chave...',
      { findingsCount }
    ));
    
    const messages = [
      vscode.LanguageModelChatMessage.User(SUMMARIZER_PROMPT),
      vscode.LanguageModelChatMessage.User(`User request: ${userRequest}\n\nResearch findings:\n${findingsText}`)
    ];
    
    const response = await model.sendRequest(messages, {});
    let summary = '';
    for await (const chunk of response.text) {
      summary += chunk;
    }
    
    progressCallback?.(createProgressEvent(
      'summarizer',
      'completed',
      'Resumo criado com sucesso!'
    ));
    
    return {
      ...state,
      summary: summary.trim(),
      phase: 'debate'
    };
  } catch (error) {
    console.error('Summarizer LLM error:', error);
    
    progressCallback?.(createProgressEvent(
      'summarizer',
      'failed',
      `Erro ao resumir: ${error instanceof Error ? error.message : String(error)}`
    ));
    
    throw error;
  }
}
