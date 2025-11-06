/**
 * @fileoverview Planning agent - creates structured development plans
 * @module sub-agents/planning/agent
 */

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { BaseSubAgent } from '../shared/base-agent'
import type { SubAgentContext, SubAgentResponse, Intent } from '../shared/types'

/**
 * PlanningAgent
 * 
 * Creates development plans by:
 * 1. Asking incremental questions about requirements
 * 2. Analyzing project context
 * 3. Generating structured plan with LLM
 * 4. Saving plan to file
 * 
 * Priority: 85 (between Clarification and Analysis)
 */
export class PlanningAgent extends BaseSubAgent {
  readonly name = 'PlanningAgent'
  readonly priority = 85
  
  /**
   * Can handle if user wants a plan/roadmap/strategy
   */
  canHandle(context: SubAgentContext): boolean {
    const { userMessage, intent } = context
    
    // Keywords that indicate planning request
    const planningKeywords = [
      'plano', 'plan', 'roadmap', 'estratégia', 'strategy',
      'como fazer', 'how to', 'passos', 'steps',
      'desenvolver', 'develop', 'implementar', 'implement',
      'criar', 'create', 'construir', 'build'
    ]
    
    const messageLower = userMessage.toLowerCase()
    const hasPlanningKeyword = planningKeywords.some(kw => messageLower.includes(kw))
    
    // Also check intent category
    const isPlanningCategory = intent?.category === 'feature-implementation' || 
                               intent?.category === 'architecture'
    
    const canHandle = hasPlanningKeyword && isPlanningCategory
    
    if (canHandle) {
      this.log(`✅ Detected planning request`)
    }
    
    return canHandle
  }
  
  /**
   * Process with streaming - ask questions and generate plan
   */
  async *processStream(context: SubAgentContext): AsyncIterable<string> {
    this.log('Starting planning with questions...')
    
    const { userMessage, intent, onPromptRequest } = context
    
    // Close any open reasoning block
    yield '__REASONING_END__\n\n'
    
    // If no prompt callback, fallback
    if (!onPromptRequest) {
      this.log('No onPromptRequest available')
      const response = await this.process(context)
      yield response.content
      return
    }
    
    try {
      yield `🎯 Vou criar um plano de desenvolvimento para: **"${userMessage}"**\n\n`
      yield `Preciso fazer algumas perguntas para entender melhor seus requisitos.\n\n`
      
      // Collect planning information
      const planningData: Record<string, string> = {}
      
      // Question 1: Objetivo
      yield `**1/5:** Qual é o objetivo principal deste desenvolvimento? Seja específico.\n\n`
      
      const objetivo = await onPromptRequest({
        messageId: `planning-objetivo-${Date.now()}`,
        prompt: 'Qual é o objetivo principal deste desenvolvimento? Seja específico.',
        type: 'question'
      })
      planningData.objetivo = objetivo
      yield `✅ **Sua resposta:** ${objetivo}\n\n`
      
      // Question 2: Escopo
      yield `**2/5:** Quais funcionalidades devem fazer parte deste desenvolvimento?\n\n`
      
      const escopo = await onPromptRequest({
        messageId: `planning-escopo-${Date.now()}`,
        prompt: 'Quais funcionalidades devem fazer parte deste desenvolvimento?',
        suggestions: [
          'Funcionalidades básicas apenas',
          'Funcionalidades completas',
          'MVP (Produto Mínimo Viável)',
          'Sistema completo com extras'
        ],
        type: 'choice'
      })
      planningData.escopo = escopo
      yield `✅ **Sua resposta:** ${escopo}\n\n`
      
      // Question 3: Stack
      yield `**3/5:** Qual stack tecnológico você quer usar? (ou deixe em branco para usar o existente)\n\n`
      
      const stack = await onPromptRequest({
        messageId: `planning-stack-${Date.now()}`,
        prompt: 'Qual stack tecnológico você quer usar? (ou deixe em branco para usar o existente)',
        type: 'question'
      })
      planningData.stack = stack || 'Usar stack existente do projeto'
      yield `✅ **Sua resposta:** ${planningData.stack}\n\n`
      
      // Question 4: Restrições
      yield `**4/5:** Há alguma restrição técnica ou de negócio? (ex: performance, compatibilidade, budget)\n\n`
      
      const restricoes = await onPromptRequest({
        messageId: `planning-restricoes-${Date.now()}`,
        prompt: 'Há alguma restrição técnica ou de negócio? (ex: performance, compatibilidade, budget)',
        type: 'question'
      })
      planningData.restricoes = restricoes || 'Nenhuma restrição específica'
      yield `✅ **Sua resposta:** ${planningData.restricoes}\n\n`
      
      // Question 5: Prazo
      yield `**5/5:** Qual o prazo desejado?\n\n`
      
      const prazo = await onPromptRequest({
        messageId: `planning-prazo-${Date.now()}`,
        prompt: 'Qual o prazo desejado?',
        suggestions: [
          '1-2 semanas',
          '1 mês',
          '2-3 meses',
          'Sem prazo definido'
        ],
        type: 'choice'
      })
      planningData.prazo = prazo
      yield `✅ **Sua resposta:** ${prazo}\n\n`
      
      // Show summary
      yield `\n---\n\n`
      yield `✨ **Informações Coletadas:**\n\n`
      for (const [key, value] of Object.entries(planningData)) {
        yield `**${this.formatLabel(key)}:** ${value}\n`
      }
      yield `\n`
      
      // Generate plan with LLM
      yield `🤖 Gerando plano de desenvolvimento estruturado...\n\n`
      
      const plan = await this.generatePlan(userMessage, planningData, intent)
      
      // Save plan to file
      const filePath = await this.savePlanToFile(userMessage, plan)
      
      yield `\n\n---\n\n`
      yield `✅ **Plano salvo em:** \`${filePath}\`\n\n`
      yield `Você pode abrir o arquivo para ver o plano completo.\n`
      
    } catch (error) {
      this.log(`Error: ${error}`)
      yield `\n❌ Ocorreu um erro ao criar o plano: ${error instanceof Error ? error.message : 'Erro desconhecido'}\n`
    }
  }
  
  /**
   * Collect planning information through questions
   */
  /**
   * Generate plan using LLM
   */
  private async generatePlan(
    userMessage: string,
    planningData: Record<string, string>,
    intent: Intent | undefined
  ): Promise<string> {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      })
      
      if (models.length === 0) {
        throw new Error('LLM not available')
      }
      
      const model = models[0]
      
      const prompt = this.buildPlanningPrompt(userMessage, planningData, intent)
      
      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ]
      
      const request = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token)
      
      let plan = ''
      for await (const fragment of request.stream) {
        if (fragment instanceof vscode.LanguageModelTextPart) {
          plan += fragment.value
        }
      }
      
      return plan || this.buildFallbackPlan(userMessage, planningData)
      
    } catch (error) {
      this.log(`Error generating plan: ${error}`)
      return this.buildFallbackPlan(userMessage, planningData)
    }
  }
  
  /**
   * Build prompt for LLM
   */
  private buildPlanningPrompt(
    userMessage: string,
    planningData: Record<string, string>,
    intent: Intent | undefined
  ): string {
    return `Você é um arquiteto de software experiente. Crie um plano de desenvolvimento DETALHADO e ESTRUTURADO em Markdown.

**Solicitação Original:** ${userMessage}

**Informações Coletadas:**
${Object.entries(planningData).map(([k, v]) => `- ${this.formatLabel(k)}: ${v}`).join('\n')}

**Contexto Técnico:**
- Categoria: ${intent?.category || 'geral'}
- Termos técnicos: ${intent?.technicalTerms.join(', ') || 'N/A'}

**Estrutura OBRIGATÓRIA do Plano:**

# Plano de Desenvolvimento: [Título]

## 1. Visão Geral
- Objetivo
- Justificativa
- Benefícios esperados

## 2. Requisitos
### 2.1 Funcionais
- Lista detalhada de funcionalidades

### 2.2 Não-Funcionais
- Performance, segurança, usabilidade, etc.

## 3. Arquitetura Proposta
### 3.1 Componentes Principais
- Descrição de cada componente

### 3.2 Tecnologias
- Stack escolhido e justificativa

### 3.3 Diagramas (texto)
- Fluxo de dados
- Arquitetura de componentes

## 4. Plano de Implementação
### Fase 1: Fundação (X dias)
- [ ] Tarefa 1
- [ ] Tarefa 2

### Fase 2: Core (X dias)
- [ ] Tarefa 1
- [ ] Tarefa 2

### Fase 3: Refinamento (X dias)
- [ ] Tarefa 1
- [ ] Tarefa 2

## 5. Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| ...   | ...          | ...     | ...       |

## 6. Critérios de Sucesso
- Como medir se o projeto foi bem-sucedido

## 7. Próximos Passos
- Ações imediatas para começar

---

**IMPORTANTE:** 
- Seja ESPECÍFICO e TÉCNICO
- Use exemplos de código quando relevante
- Inclua estimativas realistas
- Considere as restrições mencionadas
- Gere um plano COMPLETO e ACIONÁVEL`
  }
  
  /**
   * Fallback plan if LLM fails
   */
  private buildFallbackPlan(userMessage: string, planningData: Record<string, string>): string {
    return `# Plano de Desenvolvimento: ${userMessage}

## 1. Visão Geral

**Objetivo:** ${planningData.objetivo}

**Escopo:** ${planningData.escopo}

**Stack Tecnológico:** ${planningData.stack}

**Restrições:** ${planningData.restricoes}

**Prazo:** ${planningData.prazo}

## 2. Requisitos

### 2.1 Funcionais
- [A ser detalhado]

### 2.2 Não-Funcionais
- Performance
- Segurança
- Usabilidade

## 3. Arquitetura Proposta

### 3.1 Componentes
- [A ser detalhado]

### 3.2 Tecnologias
${planningData.stack}

## 4. Plano de Implementação

### Fase 1: Setup
- [ ] Configurar ambiente
- [ ] Estrutura inicial

### Fase 2: Desenvolvimento
- [ ] Implementar core
- [ ] Testes

### Fase 3: Finalização
- [ ] Documentação
- [ ] Deploy

## 5. Próximos Passos
1. Revisar este plano
2. Começar implementação
`
  }
  
  /**
   * Save plan to file
   */
  private async savePlanToFile(userMessage: string, plan: string): Promise<string> {
    // Get workspace root
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      throw new Error('No workspace folder found')
    }
    
    const workspaceRoot = workspaceFolder.uri.fsPath
    
    // Create plans directory
    const plansDir = path.join(workspaceRoot, 'docs', 'plans')
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true })
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const slug = userMessage
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/(^-|-$)/g, '')
      .substring(0, 50)
    
    const filename = `${timestamp}-${slug}.md`
    const filePath = path.join(plansDir, filename)
    
    // Write file
    fs.writeFileSync(filePath, plan, 'utf-8')
    
    // Return relative path
    return path.relative(workspaceRoot, filePath)
  }
  
  /**
   * Format label for display
   */
  private formatLabel(key: string): string {
    const labels: Record<string, string> = {
      objetivo: 'Objetivo',
      escopo: 'Escopo',
      stack: 'Stack Tecnológico',
      restricoes: 'Restrições',
      prazo: 'Prazo'
    }
    return labels[key] || key
  }
  
  /**
   * Fallback to non-streaming mode
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_context: SubAgentContext): Promise<SubAgentResponse> {
    return this.createResponse(
      'Para criar um plano de desenvolvimento, preciso fazer algumas perguntas. Por favor, use o chat interativo.',
      true
    )
  }
}
