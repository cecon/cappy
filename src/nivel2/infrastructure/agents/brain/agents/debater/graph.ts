/**
 * @fileoverview Debater Agent Graph
 * @module agents/brain/agents/debater/graph
 */

import * as vscode from 'vscode';
import type { DebaterState } from './state';
import type { ProgressCallback } from '../../../common/types';
import { createProgressEvent } from '../../../types/progress-events';

const DEBATER_PROMPT = `You are a COLLABORATIVE brainstorm partner that CONTRIBUTES ideas actively.

Given:
- User's request: {{userRequest}}
- Research findings: {{research}}
- Conversation history: {{conversation}}

Your job is to ACTIVELY PARTICIPATE in the brainstorm by:
1. Analyzing the research findings FIRST
2. Proposing concrete ideas, solutions, or approaches
3. Highlighting pros/cons of different paths
4. Providing a clear recommendation

IMPORTANT RULES:
- NEVER ask questions without providing substantial analysis first
- ALWAYS base your contribution on the research findings
- If research is empty or insufficient, state "Need more context" and stop
- Only ask clarifying questions AFTER you've shared your analysis

EXAMPLES OF GOOD BRAINSTORM CONTRIBUTIONS:
"Baseado na estrutura do projeto em TypeScript com testes em /test:
1. JWT pode ser implementado como middleware em src/middleware/auth.ts
2. Armazenamento de secrets pode usar variáveis de ambiente via dotenv
3. A verificação pode ser integrada nos controllers existentes

Recomendo começar com uma implementação simples usando jsonwebtoken. 
Prefere stateless (apenas JWT) ou precisa de refresh tokens?"

EXAMPLES OF BAD RESPONSES (NEVER do this):
- "O JWT será usado para autenticação ou autorização?" (no analysis, just questions)
- "Qual tipo de sistema?" (should be answered by research first)
- "Pode detalhar mais?" (lazy, no contribution)

Respond with JSON:
{
  "contribution": "your active brainstorm with analysis and ideas based on research",
  "analysis": {
    "pros": ["advantage 1", "advantage 2"],
    "cons": ["tradeoff 1", "tradeoff 2"],
    "alternatives": ["option 1", "option 2"]
  },
  "recommendation": "your suggested next step based on project context"
}

If research is insufficient, respond:
{
  "contribution": "Need more context - research did not find relevant information about [topic]",
  "recommendation": "Need to search for: [specific files or patterns]"
}`;

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
    const conversation = state.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
    
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
    
    progressCallback?.(createProgressEvent(
      'debater',
      'completed',
      'Contribuição ao brainstorm concluída!',
      { 
        hasAlternatives: parsed.analysis?.alternatives?.length > 0,
        prosCount: parsed.analysis?.pros?.length || 0,
        consCount: parsed.analysis?.cons?.length || 0
      }
    ));
    
    // Always proceed with contribution - no blocking
    return {
      ...state,
      analysis: parsed.analysis,
      recommendation: parsed.recommendation,
      phase: 'planning',
      awaitingUser: false,
      metadata: {
        ...state.metadata,
        debaterContribution: parsed.contribution
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
