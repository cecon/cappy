import type { AnalystState, PhaseResult } from '../types'

export interface ScopeClarityScore {
  score: number // 0-100
  gaps: ScopeGap[]
  vagueTerms: string[]
  isSpecific: boolean
  detectedTech?: string[]
  hasRequirements: boolean
  hasPersistence: boolean
}

export interface ScopeGap {
  category: 'technology' | 'requirements' | 'integration' | 'validation' | 'persistence'
  description: string
  critical: boolean
  suggestion?: string
}

/**
 * Scope Clarity Phase Handler
 * 
 * Analisa a qualidade do escopo fornecido pelo usuário ANTES de disparar o retriever.
 * Detecta vagueza, identifica lacunas críticas e decide se precisa fazer perguntas
 * de clarificação antes de prosseguir.
 * 
 * CRITÉRIOS:
 * - Score < 60: VAGO → gera perguntas de clarificação
 * - Score ≥ 60: CLARO → prossegue para 'intent' phase
 */
export class ScopeClarityPhaseHandler {
  private static readonly CLARITY_THRESHOLD = 60
  
  /**
   * Analisa qualidade do escopo e identifica lacunas críticas
   */
  static process(text: string, state: AnalystState): PhaseResult {
    console.log('[ScopeClarityPhase] Analyzing scope quality...')
    
    const clarity = this.analyzeClarity(text)
    
    // Store clarity analysis in state
    if (!state.scopeClarity) {
      state.scopeClarity = clarity
    }
    
    console.log(`[ScopeClarityPhase] Clarity score: ${clarity.score}/100`)
    console.log(`[ScopeClarityPhase] Gaps found: ${clarity.gaps.length}`)
    console.log(`[ScopeClarityPhase] Vague terms: ${clarity.vagueTerms.join(', ') || 'none'}`)
    
    if (clarity.score < this.CLARITY_THRESHOLD) {
      console.log(`[ScopeClarityPhase] ⚠️ Vague scope detected (score: ${clarity.score})`)
      console.log(`[ScopeClarityPhase] Critical gaps:`, clarity.gaps.filter(g => g.critical))
      
      return {
        type: 'ask',
        data: {
          nextPhase: 'scope-questions',
          gaps: clarity.gaps,
          clarityScore: clarity.score,
          message: this.generateClarityMessage(clarity)
        }
      }
    }
    
    console.log(`[ScopeClarityPhase] ✅ Scope is clear (score: ${clarity.score})`)
    return {
      type: 'continue',
      data: { nextPhase: 'intent' }
    }
  }
  
  /**
   * Analisa qualidade do escopo com scoring detalhado
   * Public method for use by other agents
   */
  static analyzeClarity(text: string): ScopeClarityScore {
    const gaps: ScopeGap[] = []
    const vagueTerms: string[] = []
    const detectedTech: string[] = []
    let score = 100
    
    // 1. Check for technology specification (25 points)
    const techPatterns = [
      { regex: /\b(react|reactjs)\b/i, name: 'React' },
      { regex: /\b(vue|vuejs)\b/i, name: 'Vue' },
      { regex: /\b(angular)\b/i, name: 'Angular' },
      { regex: /\b(webview|web view)\b/i, name: 'Webview' },
      { regex: /\b(quick\s*pick|quickpick)\b/i, name: 'QuickPick' },
      { regex: /\b(tree\s*view|treeview)\b/i, name: 'TreeView' },
      { regex: /\b(svelte)\b/i, name: 'Svelte' },
      { regex: /\b(html|css|javascript|typescript)\b/i, name: 'Web Tech' }
    ]
    
    let hasTechMention = false
    for (const pattern of techPatterns) {
      if (pattern.regex.test(text)) {
        hasTechMention = true
        detectedTech.push(pattern.name)
      }
    }
    
    if (!hasTechMention) {
      gaps.push({
        category: 'technology',
        description: 'Tecnologia de UI não especificada',
        critical: true,
        suggestion: 'Ex: React, Vue, VS Code Webview, QuickPick nativo'
      })
      score -= 25
    }
    
    // 2. Check for vague terms (10 points each, max -30)
    const vaguePatterns = [
      { term: 'tela', penalty: 10 },
      { term: 'interface', penalty: 8 },
      { term: 'config', penalty: 5 },
      { term: 'configuração', penalty: 5 },
      { term: 'elegante', penalty: 10 },
      { term: 'bonito', penalty: 10 },
      { term: 'legal', penalty: 10 },
      { term: 'sistema', penalty: 8 },
      { term: 'coisa', penalty: 12 },
      { term: 'negócio', penalty: 12 }
    ]
    
    let vaguePenalty = 0
    for (const pattern of vaguePatterns) {
      if (new RegExp(`\\b${pattern.term}\\b`, 'i').test(text)) {
        vagueTerms.push(pattern.term)
        vaguePenalty += pattern.penalty
      }
    }
    
    // Cap vague penalty at 30
    vaguePenalty = Math.min(vaguePenalty, 30)
    score -= vaguePenalty
    
    // 3. Check for persistence mention (20 points)
    const persistencePatterns = /\b(salvar|persistir|gravar|arquivo|file|banco|database|settings|storage|json|yaml|xml|localStorage|sessionStorage)\b/i
    const hasPersistence = persistencePatterns.test(text)
    
    if (!hasPersistence) {
      gaps.push({
        category: 'persistence',
        description: 'Estratégia de persistência não especificada',
        critical: true,
        suggestion: 'Ex: VS Code Settings, arquivo .cappy/config.json, localStorage'
      })
      score -= 20
    }
    
    // 4. Check for specific requirements (15 points)
    const requirementPatterns = /\b(campo|input|botão|button|validar|validate|exibir|mostrar|display|listar|list|formulário|form|dropdown|checkbox|switch)\b/i
    const hasRequirements = requirementPatterns.test(text)
    
    if (!hasRequirements) {
      gaps.push({
        category: 'requirements',
        description: 'Requisitos funcionais não especificados (campos, botões, validações)',
        critical: false,
        suggestion: 'Ex: campos de texto, dropdowns, botões de ação'
      })
      score -= 15
    }
    
    // 5. Check for validation mention (10 points)
    const validationPatterns = /\b(validar|validate|validation|obrigatório|required|formato|format|regex|regra|rule)\b/i
    const hasValidation = validationPatterns.test(text)
    
    if (!hasValidation && hasRequirements) {
      gaps.push({
        category: 'validation',
        description: 'Regras de validação não especificadas',
        critical: false,
        suggestion: 'Ex: campos obrigatórios, formato de dados, validações customizadas'
      })
      score -= 10
    }
    
    // 6. Check for integration points (10 points)
    const integrationPatterns = /\b(integrar|integrate|chamar|call|api|endpoint|serviço|service|comando|command)\b/i
    const hasIntegration = integrationPatterns.test(text)
    
    if (!hasIntegration && hasRequirements) {
      gaps.push({
        category: 'integration',
        description: 'Pontos de integração não especificados',
        critical: false,
        suggestion: 'Ex: APIs, comandos VS Code, serviços existentes'
      })
      score -= 10
    }
    
    // 7. Bonus points for specificity
    const specificPatterns = [
      /\b(src\/[a-z0-9\-_/]+)\b/i, // File paths
      /\b([a-z][a-z0-9]*\.[a-z]{2,4})\b/i, // File extensions
      /\b(npm|yarn|pnpm)\s+(install|add)\b/i, // Package managers
      /\b(import|require|from)\b/i, // Code references
      /\b(class|function|interface|type)\s+[A-Z][a-z0-9]*\b/i // Code identifiers
    ]
    
    let bonusPoints = 0
    for (const pattern of specificPatterns) {
      if (pattern.test(text)) {
        bonusPoints += 5
      }
    }
    
    score += Math.min(bonusPoints, 15) // Cap bonus at 15
    
    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score))
    
    return {
      score,
      gaps,
      vagueTerms,
      isSpecific: score >= this.CLARITY_THRESHOLD,
      detectedTech: detectedTech.length > 0 ? detectedTech : undefined,
      hasRequirements,
      hasPersistence
    }
  }
  
  /**
   * Gera mensagem informativa sobre a clareza do escopo
   */
  private static generateClarityMessage(clarity: ScopeClarityScore): string {
    const criticalGaps = clarity.gaps.filter(g => g.critical)
    
    let message = `📋 **Análise de Escopo** (Clareza: ${clarity.score}/100)\n\n`
    
    if (clarity.detectedTech && clarity.detectedTech.length > 0) {
      message += `✅ Tecnologia detectada: ${clarity.detectedTech.join(', ')}\n`
    }
    
    if (criticalGaps.length > 0) {
      message += `\n⚠️ **Informações Críticas Faltando:**\n`
      criticalGaps.forEach(gap => {
        message += `- ${gap.description}\n`
        if (gap.suggestion) {
          message += `  💡 ${gap.suggestion}\n`
        }
      })
    }
    
    const nonCriticalGaps = clarity.gaps.filter(g => !g.critical)
    if (nonCriticalGaps.length > 0) {
      message += `\n💭 **Informações Adicionais Recomendadas:**\n`
      nonCriticalGaps.forEach(gap => {
        message += `- ${gap.description}\n`
      })
    }
    
    if (clarity.vagueTerms.length > 0) {
      message += `\n🔍 **Termos Vagos Detectados:** ${clarity.vagueTerms.join(', ')}\n`
    }
    
    message += `\n💬 **Vou fazer algumas perguntas para clarificar seu pedido...**`
    
    return message
  }
}
