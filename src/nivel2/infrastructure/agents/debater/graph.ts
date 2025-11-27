/**
 * @fileoverview Debater Agent Graph
 * @module agents/debater/graph
 */

import * as vscode from 'vscode';
import type { DebaterState } from './state';
import type { ProgressCallback } from '../common/types';
import { createProgressEvent } from '../types/progress-events';

const DEBATER_PROMPT = `You are a COLLABORATIVE brainstorm partner that analyzes requirements and asks clarifying questions.

Given:
- User's request: {{userRequest}}
- Research findings: {{research}}
- Conversation history: {{conversation}}

Your job is to:
1. Analyze the user's request and research findings
2. Identify what needs clarification or specification
3. Ask ONE focused question to refine the requirements
4. Provide context for why the question matters

IMPORTANT RULES:
- ALWAYS ask at least ONE clarifying question unless requirements are crystal clear
- Base your questions on the research findings and project context
- Questions should help narrow down implementation details
- Provide brief context/analysis before the question

EXAMPLES OF GOOD QUESTIONS:
"Vi que o projeto tem estrutura em TypeScript. Para melhorar o README, preciso saber:
Você quer focar em documentação técnica (APIs, arquitetura) ou em guia de início rápido para usuários?"

"Encontrei arquivos de configuração e docs de build. Qual aspecto do README é mais importante melhorar:
1. Instruções de instalação
2. Exemplos de uso
3. Documentação da arquitetura?"

Respond with JSON:
{
  "analysis": "brief analysis of what you found in research",
  "question": "your focused clarifying question",
  "needsUserInput": true,
  "recommendation": "what you'll do once question is answered"
}

Only set needsUserInput=false if the request is 100% clear and needs no clarification.`;

/**
 * Debates alternatives and REFINES through technical questions using LLM
 */
export async function runDebaterAgent(
  state: DebaterState,
  progressCallback?: ProgressCallback
): Promise<DebaterState> {
  progressCallback?.(createProgressEvent(
    'debater',
    'started',
    'Analisando requisitos e alternativas...'
  ));
  
  try {
    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    });
    
    if (models.length === 0) {
      progressCallback?.(createProgressEvent(
        'debater',
        'failed',
        'Modelo LLM não disponível'
      ));
      throw new Error('[Debater] No LLM models available');
    }
    
    const model = models[0];
    const userRequest = state.messages[state.messages.length - 1]?.content || '';
    const summary = state.summary || 'Sem resumo disponível';
    // Keep full conversation history - no truncation
    const conversation = state.messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const prompt = DEBATER_PROMPT
      .replace('{{userRequest}}', userRequest)
      .replace('{{research}}', summary)
      .replace('{{conversation}}', conversation);
    
    const messages = [
      vscode.LanguageModelChatMessage.User(prompt)
    ];
    
    progressCallback?.(createProgressEvent(
      'debater',
      'analyzing',
      'Avaliando prós e contras das alternativas...'
    ));
    
    const response = await model.sendRequest(messages, {});
    let fullText = '';
    for await (const chunk of response.text) {
      fullText += chunk;
    }
    
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      progressCallback?.(createProgressEvent(
        'debater',
        'failed',
        'Não foi possível parsear resposta do LLM'
      ));
      throw new Error('[Debater] Could not parse LLM response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Check if user input is needed
    const needsUserInput = parsed.needsUserInput !== false;
    
    progressCallback?.(createProgressEvent(
      'debater',
      'completed',
      needsUserInput ? 'Aguardando esclarecimentos...' : 'Análise concluída!',
      { 
        needsUserInput,
        hasQuestion: !!parsed.question
      }
    ));
    
    // If needs user input, pause and wait
    if (needsUserInput && parsed.question) {
      return {
        ...state,
        recommendation: parsed.recommendation,
        phase: 'debate',
        awaitingUser: true,
        metadata: {
          ...state.metadata,
          refinementQuestion: `${parsed.analysis}\n\n${parsed.question}`,
          debaterAnalysis: parsed.analysis
        }
      };
    }
    
    // Otherwise proceed to planning
    return {
      ...state,
      recommendation: parsed.recommendation,
      phase: 'planning',
      awaitingUser: false,
      metadata: {
        ...state.metadata,
        debaterAnalysis: parsed.analysis
      }
    };
  } catch (error) {
    console.error('Debater LLM error:', error);
    
    progressCallback?.(createProgressEvent(
      'debater',
      'failed',
      `Erro no debate: ${error instanceof Error ? error.message : String(error)}`
    ));
    
    throw error;
  }
}
