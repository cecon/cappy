/**
 * @fileoverview Prompts for clarification agent
 * @module sub-agents/clarification/prompts
 */

/**
 * Generic clarification prompt
 */
export const GENERIC_CLARIFICATION = `Preciso entender melhor o que você quer fazer. Pode me explicar com mais detalhes?`

/**
 * Clarification with context
 */
export function buildClarificationPrompt(
  userMessage: string,
  ambiguities: string[]
): string {
  if (ambiguities.length === 0) {
    return GENERIC_CLARIFICATION
  }
  
  const ambiguityList = ambiguities.map(amb => `• ${amb}`).join('\n')
  
  return `Entendi que você mencionou "${userMessage}", mas preciso de mais informações:

${ambiguityList}

Pode me dar mais detalhes sobre o que você precisa?`
}

/**
 * Clarification with suggestions
 */
export function buildClarificationWithOptions(
  userMessage: string,
  category: string
): string {
  const suggestions = {
    'other': [
      'Analisar código existente',
      'Criar um novo componente/funcionalidade',
      'Corrigir um problema',
      'Gerar documentação',
      'Revisar arquitetura'
    ],
    'implementation': [
      'Implementar do zero',
      'Integrar com sistema existente',
      'Refatorar código existente'
    ],
    'documentation': [
      'Criar documentação nova',
      'Atualizar documentação existente',
      'Gerar documentação automática'
    ]
  }
  
  const options = suggestions[category as keyof typeof suggestions] || suggestions.other
  const optionsList = options.map(opt => `• ${opt}`).join('\n')
  
  return `Entendi que você quer trabalhar com "${userMessage}". Você gostaria de:

${optionsList}

Ou algo diferente?`
}
