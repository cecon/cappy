import * as vscode from 'vscode'
import * as path from 'path'
import type { Question } from '../types'
import type { ScopeGap } from '../phases/scope-clarity-phase'

/**
 * Scope Question Generator
 * 
 * Gera perguntas contextualizadas baseadas nas lacunas identificadas no escopo.
 * Consulta o projeto atual (package.json, stack.md, config) para sugerir opções
 * relevantes ao contexto do desenvolvedor.
 */
export class ScopeQuestionGenerator {
  /**
   * Gera perguntas contextualizadas baseadas nas lacunas do escopo
   */
  static async generateQuestions(gaps: ScopeGap[]): Promise<Question[]> {
    console.log('[QuestionGenerator] Generating questions for gaps:', gaps.length)
    
    const questions: Question[] = []
    
    // Group gaps by category to avoid duplicate questions
    const gapsByCategory = this.groupGapsByCategory(gaps)
    
    // Generate questions for each category
    if (gapsByCategory.technology.length > 0) {
      const techQuestion = await this.generateTechnologyQuestion()
      questions.push(techQuestion)
    }
    
    if (gapsByCategory.persistence.length > 0) {
      const persistenceQuestion = this.generatePersistenceQuestion(gapsByCategory.persistence[0])
      questions.push(persistenceQuestion)
    }
    
    if (gapsByCategory.requirements.length > 0) {
      const reqQuestion = this.generateRequirementsQuestion(gapsByCategory.requirements[0])
      questions.push(reqQuestion)
    }
    
    if (gapsByCategory.validation.length > 0) {
      const valQuestion = this.generateValidationQuestion(gapsByCategory.validation[0])
      questions.push(valQuestion)
    }
    
    if (gapsByCategory.integration.length > 0) {
      const intQuestion = this.generateIntegrationQuestion(gapsByCategory.integration[0])
      questions.push(intQuestion)
    }
    
    console.log('[QuestionGenerator] Generated questions:', questions.length)
    return questions
  }
  
  /**
   * Agrupa lacunas por categoria
   */
  private static groupGapsByCategory(gaps: ScopeGap[]): Record<string, ScopeGap[]> {
    const grouped: Record<string, ScopeGap[]> = {
      technology: [],
      persistence: [],
      requirements: [],
      validation: [],
      integration: []
    }
    
    gaps.forEach(gap => {
      if (grouped[gap.category]) {
        grouped[gap.category].push(gap)
      }
    })
    
    return grouped
  }
  
  /**
   * Gera pergunta sobre tecnologia de UI
   */
  private static async generateTechnologyQuestion(): Promise<Question> {
    console.log('[QuestionGenerator] Generating technology question...')
    
    // Check project for existing UI patterns
    const projectTech = await this.detectProjectTechnologies()
    
    const options: string[] = []
    
    // Add detected technologies first (with indicator)
    if (projectTech.hasReact) {
      options.push('React (✓ já usado no projeto)')
    }
    if (projectTech.hasVue) {
      options.push('Vue (✓ já usado no projeto)')
    }
    if (projectTech.hasAngular) {
      options.push('Angular (✓ já usado no projeto)')
    }
    if (projectTech.hasWebview) {
      options.push('VS Code Webview (✓ já usado no projeto)')
    }
    
    // Add common VS Code native options
    options.push('VS Code Quick Pick (nativo, leve, para seleções simples)')
    options.push('VS Code TreeView (nativo, hierárquico, para estruturas)')
    options.push('VS Code Settings UI (nativo, integrado com settings.json)')
    
    // Add fallback option
    options.push('Outra tecnologia (especifique)')
    
    return {
      id: 'tech-ui',
      question: 'Qual tecnologia você quer usar para a interface?',
      type: 'technical',
      context: 'A escolha da tecnologia define arquitetura, dependências e padrões de código',
      why: 'Preciso saber a tecnologia para gerar código compatível e aproveitar padrões existentes no projeto',
      options
    }
  }
  
  /**
   * Gera pergunta sobre persistência de dados
   */
  private static generatePersistenceQuestion(gap: ScopeGap): Question {
    console.log('[QuestionGenerator] Generating persistence question...')
    
    return {
      id: 'req-persistence',
      question: 'Onde as configurações devem ser salvas?',
      type: 'technical',
      context: gap.description,
      why: 'Define a estratégia de persistência, acesso e sincronização das configurações',
      options: [
        'VS Code Settings (settings.json) - sincroniza entre máquinas via Settings Sync',
        '.cappy/config.json - arquivo local do projeto, versionável no git',
        'Workspace Settings (.vscode/settings.json) - específico do workspace',
        'Arquivo customizado no workspace (especifique o caminho)',
        'Estado em memória (não persiste entre sessões)'
      ]
    }
  }
  
  /**
   * Gera pergunta sobre requisitos funcionais
   */
  private static generateRequirementsQuestion(gap: ScopeGap): Question {
    console.log('[QuestionGenerator] Generating requirements question...')
    
    return {
      id: 'req-functional',
      question: 'Quais são as principais funcionalidades dessa interface?',
      type: 'business',
      context: gap.description,
      why: 'Define os campos, botões e ações que precisam ser implementados',
      options: [
        'Editar configurações existentes (CRUD)',
        'Apenas visualizar configurações (read-only)',
        'Importar/exportar configurações',
        'Resetar para padrões',
        'Validar configurações em tempo real'
      ]
    }
  }
  
  /**
   * Gera pergunta sobre validações
   */
  private static generateValidationQuestion(gap: ScopeGap): Question {
    console.log('[QuestionGenerator] Generating validation question...')
    
    return {
      id: 'validation',
      question: 'Quais validações são necessárias nas configurações?',
      type: 'technical',
      context: gap.description,
      why: 'Define regras de negócio e prevenção de erros na entrada de dados',
      options: [
        'Formato de campos (ex: URL válida, email, API key)',
        'Valores obrigatórios (campos não podem estar vazios)',
        'Ranges numéricos (min/max)',
        'Dependências entre campos (se X então Y é obrigatório)',
        'Validação customizada (regex ou função)',
        'Nenhuma validação especial'
      ]
    }
  }
  
  /**
   * Gera pergunta sobre pontos de integração
   */
  private static generateIntegrationQuestion(gap: ScopeGap): Question {
    console.log('[QuestionGenerator] Generating integration question...')
    
    return {
      id: 'integration',
      question: 'A interface precisa integrar com quais sistemas/serviços?',
      type: 'clarification',
      context: gap.description,
      why: 'Identifica dependências externas e pontos de integração necessários',
      options: [
        'Comandos VS Code (executar actions ao salvar)',
        'APIs externas (validar chaves, buscar dados)',
        'Sistema de arquivos (ler/escrever configs)',
        'Outros serviços do Cappy (retriever, scanner, etc)',
        'Nenhuma integração externa'
      ]
    }
  }
  
  /**
   * Detecta tecnologias já usadas no projeto
   */
  private static async detectProjectTechnologies(): Promise<{
    hasReact: boolean
    hasVue: boolean
    hasAngular: boolean
    hasWebview: boolean
    hasSvelte: boolean
  }> {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('[QuestionGenerator] No workspace folder found')
      return {
        hasReact: false,
        hasVue: false,
        hasAngular: false,
        hasWebview: false,
        hasSvelte: false
      }
    }
    
    try {
      const packageJsonPath = path.join(workspaceFolders[0].uri.fsPath, 'package.json')
      const packageJsonUri = vscode.Uri.file(packageJsonPath)
      
      console.log('[QuestionGenerator] Reading package.json from:', packageJsonPath)
      
      const packageJsonData = await vscode.workspace.fs.readFile(packageJsonUri)
      const content = JSON.parse(Buffer.from(packageJsonData).toString())
      
      const allDeps = {
        ...content.dependencies,
        ...content.devDependencies
      }
      
      const depKeys = Object.keys(allDeps).map(k => k.toLowerCase())
      
      return {
        hasReact: depKeys.some(d => d.includes('react')),
        hasVue: depKeys.some(d => d.includes('vue')),
        hasAngular: depKeys.some(d => d.includes('angular')),
        hasWebview: depKeys.some(d => d.includes('webview')) || this.hasWebviewInCode(),
        hasSvelte: depKeys.some(d => d.includes('svelte'))
      }
    } catch (error) {
      console.warn('[QuestionGenerator] Error reading package.json:', error)
      return {
        hasReact: false,
        hasVue: false,
        hasAngular: false,
        hasWebview: false,
        hasSvelte: false
      }
    }
  }
  
  /**
   * Verifica se há uso de webview no código
   */
  private static hasWebviewInCode(): boolean {
    // Simple heuristic: check if webview-related files exist
    // This is a simplified check - in real implementation,
    // we could use workspace.findFiles for more accurate detection
    return false // TODO: Implement proper detection
  }
}
