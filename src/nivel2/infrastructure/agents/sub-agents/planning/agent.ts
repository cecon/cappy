/**
 * @fileoverview Planning agent - creates structured development plans
 * @module sub-agents/planning/agent
 */

import * as vscode from 'vscode'
import { BaseSubAgent } from '../shared/base-agent'
import type { SubAgentContext, SubAgentResponse, Intent } from '../shared/types'
import type { WorkPlan } from '../../codeact/types/work-plan'
import { SavePlanTool } from '../../codeact/tools/save-plan-tool'

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
   * Can handle if user wants a plan/roadmap/strategy or uses /plan prefix
   */
  canHandle(context: SubAgentContext): boolean {
    const { userMessage, intent } = context
    
    const messageLower = userMessage.toLowerCase()
    
    // Check for explicit /plan or @cappy/plan prefix
    if (messageLower.startsWith('/plan') || messageLower.includes('@cappy/plan')) {
      this.log(`✅ Detected /plan prefix`)
      return true
    }
    
    // Keywords that indicate planning request
    const planningKeywords = [
      'plano', 'plan', 'roadmap', 'estratégia', 'strategy',
      'como fazer', 'how to', 'passos', 'steps',
      'desenvolver', 'develop', 'implementar', 'implement',
      'criar', 'create', 'construir', 'build'
    ]
    
    const hasPlanningKeyword = planningKeywords.some(kw => messageLower.includes(kw))
    
    // Also check intent category
    const isPlanningCategory = intent?.category === 'feature-implementation' || 
                               intent?.category === 'architecture'
    
    const canHandle = hasPlanningKeyword && isPlanningCategory
    
    if (canHandle) {
      this.log(`✅ Detected planning request via keywords`)
    }
    
    return canHandle
  }
  
  /**
   * Process with streaming - ask questions and generate plan
   */
  async *processStream(context: SubAgentContext): AsyncIterable<string> {
    this.log('Starting planning with questions...')
    
    let { userMessage } = context
    const { intent, onPromptRequest } = context
    
    // Remove @cappy/plan prefix if present
    userMessage = userMessage.replace(/@cappy\/plan\s*/gi, '').trim()
    
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
      
      // Save plan using SavePlanTool
      yield `💾 Salvando plano...\n\n`
      
      const saveResult = await SavePlanTool.execute({
        plan,
        format: 'both' // Save both JSON and Markdown
      })
      
      yield `\n\n---\n\n`
      yield `✅ ${saveResult}\n\n`
      yield `\n**Próximos passos:**\n`
      yield `1. Revise o plano JSON para validação\n`
      yield `2. Use o comando "execute plan" para executar os steps\n`
      yield `3. O plano Markdown está disponível para leitura\n`
      
    } catch (error) {
      this.log(`Error: ${error}`)
      yield `\n❌ Ocorreu um erro ao criar o plano: ${error instanceof Error ? error.message : 'Erro desconhecido'}\n`
    }
  }
  
  /**
   * Collect planning information through questions
   */
  /**
   * Generate plan using LLM - returns WorkPlan JSON
   */
  private async generatePlan(
    userMessage: string,
    planningData: Record<string, string>,
    intent: Intent | undefined
  ): Promise<WorkPlan> {
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
      
      let response = ''
      for await (const fragment of request.stream) {
        if (fragment instanceof vscode.LanguageModelTextPart) {
          response += fragment.value
        }
      }
      
      // Parse JSON response
      if (!response.trim()) {
        throw new Error('Empty response from LLM')
      }
      
      // Remove markdown code blocks if present
      let jsonStr = response.trim()
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n/, '').replace(/\n```$/, '')
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n/, '').replace(/\n```$/, '')
      }
      
      const plan = JSON.parse(jsonStr) as WorkPlan
      
      // Validate required fields
      if (!plan.id || !plan.goal || !plan.steps || !Array.isArray(plan.steps)) {
        throw new Error('Invalid plan structure from LLM')
      }
      
      return plan
      
    } catch (error) {
      this.log(`Error generating plan: ${error}`)
      return this.buildFallbackPlan(userMessage, planningData)
    }
  }
  
  /**
   * Build prompt for LLM - generates structured JSON WorkPlan
   */
  private buildPlanningPrompt(
    userMessage: string,
    planningData: Record<string, string>,
    intent: Intent | undefined
  ): string {
    return `You are an expert software architect. Create a DETAILED and STRUCTURED work plan in JSON format following the WorkPlan schema.

**User Request:** ${userMessage}

**Collected Information:**
${Object.entries(planningData).map(([k, v]) => `- ${this.formatLabel(k)}: ${v}`).join('\n')}

**Technical Context:**
- Category: ${intent?.category || 'general'}
- Technical Terms: ${intent?.technicalTerms.join(', ') || 'N/A'}

**REQUIRED JSON Structure:**

\`\`\`json
{
  "id": "unique-id-kebab-case",
  "version": "1.0.0",
  "createdAt": "ISO-8601 timestamp",
  "updatedAt": "ISO-8601 timestamp",
  "status": "draft",
  
  "goal": {
    "title": "Brief title",
    "description": "Detailed description",
    "userRequest": "${userMessage}",
    "clarifications": [
      {
        "question": "Question asked",
        "answer": "User's answer",
        "source": "user"
      }
    ]
  },
  
  "requirements": {
    "functional": ["List of functional requirements"],
    "technical": ["List of technical requirements"],
    "constraints": ["List of constraints"]
  },
  
  "context": {
    "relevantFiles": [
      {
        "path": "relative/path/to/file.ts",
        "startLine": 10,
        "endLine": 50,
        "description": "Why this file is relevant"
      }
    ],
    "dependencies": ["list-of-npm-packages-or-libraries"],
    "architecture": "Brief description of architecture pattern",
    "patterns": ["Design patterns to use"]
  },
  
  "steps": [
    {
      "id": "step-1",
      "title": "Step title",
      "description": "What this step accomplishes",
      "status": "pending",
      "action": {
        "type": "create_file|edit_file|run_command",
        "details": "Specific action details",
        "expectedOutput": "What should result"
      },
      "context": {
        "reasoning": "Why this step is needed",
        "constraints": ["Any limitations"],
        "dependencies": ["Other steps or requirements"]
      },
      "relevantFiles": [
        {
          "path": "file/to/modify.ts",
          "startLine": 10,
          "endLine": 20,
          "description": "What part to focus on"
        }
      ],
      "validation": {
        "command": "npm test",
        "expectedResult": "All tests pass"
      }
    }
  ],
  
  "postExecutionHooks": [
    {
      "id": "hook-1",
      "name": "Git Commit",
      "description": "Commit changes after successful execution",
      "enabled": true,
      "order": 1,
      "action": {
        "type": "git_commit",
        "params": {
          "message": "Commit message"
        }
      },
      "condition": {
        "onSuccess": true
      }
    },
    {
      "id": "hook-2",
      "name": "Run Tests",
      "description": "Execute test suite",
      "enabled": true,
      "order": 2,
      "action": {
        "type": "run_tests",
        "command": "npm test"
      }
    },
    {
      "id": "hook-3",
      "name": "Update Embeddings",
      "description": "Reindex semantic search",
      "enabled": true,
      "order": 3,
      "action": {
        "type": "update_embeddings"
      }
    }
  ],
  
  "testing": {
    "strategy": "Testing approach description",
    "testCases": [
      {
        "id": "test-1",
        "description": "What to test",
        "type": "unit|integration|e2e",
        "command": "npm test -- test-file.test.ts"
      }
    ]
  },
  
  "successCriteria": [
    {
      "id": "criteria-1",
      "description": "Measurable success criterion",
      "verified": false
    }
  ],
  
  "metrics": {
    "totalSteps": 0,
    "completedSteps": 0,
    "failedSteps": 0
  }
}
\`\`\`

**CRITICAL REQUIREMENTS:**
1. Return ONLY valid JSON (no markdown code blocks, no explanatory text)
2. Include 3-7 actionable steps with specific file paths and line ranges
3. Each step must have clear validation criteria
4. Include relevant files with actual line numbers
5. Post-execution hooks must be realistic and useful
6. Success criteria must be measurable
7. Use ISO-8601 timestamps for dates
8. All IDs must be kebab-case strings

**IMPORTANT:**
- Be SPECIFIC and TECHNICAL
- Include actual file paths from the project
- Provide realistic time estimates in step descriptions
- Consider the constraints mentioned: ${planningData.restricoes}
- Timeline: ${planningData.prazo}
- Generate a COMPLETE and ACTIONABLE plan`
  }
  
  /**
   * Fallback plan if LLM fails - returns WorkPlan JSON
   */
  private buildFallbackPlan(userMessage: string, planningData: Record<string, string>): WorkPlan {
    const now = new Date().toISOString()
    const planId = userMessage
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/(^-|-$)/g, '')
      .substring(0, 30)
    
    return {
      id: planId,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      
      goal: {
        title: userMessage,
        description: planningData.objetivo || userMessage,
        userRequest: userMessage,
        clarifications: Object.entries(planningData).map(([q, a]) => ({
          question: this.formatLabel(q),
          answer: a,
          source: 'user' as const
        }))
      },
      
      requirements: {
        functional: ['To be detailed based on requirements'],
        technical: ['Follow existing project patterns', 'Maintain code quality'],
        constraints: planningData.restricoes ? [planningData.restricoes] : []
      },
      
      context: {
        relevantFiles: [],
        dependencies: [],
        architecture: 'To be determined based on project structure',
        patterns: ['Follow existing patterns']
      },
      
      steps: [
        {
          id: 'step-1',
          title: 'Setup and Analysis',
          description: 'Analyze requirements and setup development environment',
          status: 'pending',
          action: {
            type: 'custom',
            details: 'Review requirements and identify affected files'
          },
          relevantFiles: []
        },
        {
          id: 'step-2',
          title: 'Core Implementation',
          description: 'Implement main functionality',
          status: 'pending',
          action: {
            type: 'custom',
            details: 'Implement core features'
          },
          relevantFiles: []
        },
        {
          id: 'step-3',
          title: 'Testing and Validation',
          description: 'Add tests and validate implementation',
          status: 'pending',
          action: {
            type: 'run_command',
            details: 'npm test'
          },
          relevantFiles: [],
          validation: {
            command: 'npm test',
            expectedResult: 'All tests pass'
          }
        }
      ],
      
      postExecutionHooks: [
        {
          id: 'hook-git',
          name: 'Git Commit',
          description: 'Commit changes',
          enabled: true,
          order: 1,
          action: {
            type: 'git_commit',
            params: { message: `feat: ${userMessage}` }
          },
          condition: { onSuccess: true }
        },
        {
          id: 'hook-test',
          name: 'Run Tests',
          description: 'Execute test suite',
          enabled: true,
          order: 2,
          action: {
            type: 'run_tests',
            command: 'npm test'
          }
        }
      ],
      
      testing: {
        strategy: 'Unit and integration testing',
        testCases: [
          {
            id: 'test-1',
            description: 'Validate core functionality',
            type: 'unit'
          }
        ]
      },
      
      successCriteria: [
        {
          id: 'criteria-1',
          description: 'All requirements implemented',
          verified: false
        },
        {
          id: 'criteria-2',
          description: 'All tests passing',
          verified: false
        }
      ],
      
      metrics: {
        totalSteps: 3,
        completedSteps: 0,
        failedSteps: 0
      }
    }
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
