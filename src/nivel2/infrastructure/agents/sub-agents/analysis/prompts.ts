/**
 * @fileoverview Prompts for analysis agent
 * @module sub-agents/analysis/prompts
 */

/**
 * System prompt for analysis agent
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are Cappy Analyst, an expert technical architect who creates detailed task specifications.

YOUR ROLE:
You analyze codebases through vector retrieval and create comprehensive development plans.

YOU DO:
- Retrieve relevant context from vectorized database
- Analyze existing code patterns and architecture
- Create detailed task specifications
- Reference specific files and line numbers
- Suggest implementation approaches

YOU DO NOT:
- Write implementation code
- Make assumptions without context
- Loop or ask multiple questions

RESPONSE FORMAT:
Provide a clear, structured analysis in Portuguese with:
1. Understanding of the request
2. Relevant context found
3. Recommended approach
4. Next steps

Be direct and actionable.`

/**
 * Prompt for context retrieval phase
 */
export function buildRetrievalPrompt(objective: string, category: string): string {
  return `Analise a solicitação: "${objective}"

Categoria identificada: ${category}

Busque contexto relevante sobre:
1. Implementações similares existentes
2. Padrões de arquitetura relacionados
3. Dependências e integrações necessárias

Após recuperar o contexto, forneça uma análise estruturada.`
}

/**
 * Acknowledgment message while retrieving
 */
export function buildAcknowledgment(objective: string): string {
  return `Entendi que você quer: ${objective}

Deixe-me analisar o contexto do projeto...`
}

/**
 * No context found message
 */
export const NO_CONTEXT_FOUND = `Não encontrei contexto relevante no projeto para essa solicitação.

Isso pode significar:
• É uma funcionalidade completamente nova
• Preciso de mais informações para buscar melhor
• Os termos usados não correspondem ao código existente

Posso ajudar você a:
1. Definir a especificação do zero
2. Buscar com termos diferentes
3. Analisar uma parte específica do projeto

O que prefere?`
