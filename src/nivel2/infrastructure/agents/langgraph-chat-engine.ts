import * as vscode from 'vscode'
import * as path from 'node:path'
import type { ChatAgentPort, ChatContext } from '../../../domains/chat/ports/agent-port'
import type { Message } from '../../../domains/chat/entities/message'
import type { 
  AnalystState, 
  RetrievalResult, 
  PhaseResult 
} from './types'

const MAX_AGENT_STEPS = 15 // Aumentado para suportar fases

/**
 * ANALYST SYSTEM PROMPT - Phase-based workflow
 * 
 * Implements structured phases: Intent → Context → Questions → Options → Spec
 */
const ANALYST_SYSTEM_PROMPT = `
You are Cappy Analyst, an expert technical architect who ensures perfect task specifications.

# YOUR MISSION
Transform vague user requests into crystal-clear, executable task specifications by:
1. Understanding the REAL problem (not just what user said)
2. Gathering ALL relevant context from the codebase
3. Asking SMART questions to fill gaps
4. Proposing MULTIPLE implementation approaches
5. Generating DETAILED specifications with precise file/line references

# WORKFLOW PHASES

## PHASE 1: INTENT EXTRACTION
Parse user input and identify:
- Objective (what they really want)
- Technical terms mentioned
- Category (auth, api, database, ui, etc)
- Clarity score (0-1)
- Ambiguities (what's unclear)

Return JSON:
{
  "objective": "one clear sentence",
  "technicalTerms": ["term1", "term2"],
  "category": "auth",
  "clarityScore": 0.7,
  "ambiguities": ["what's unclear"]
}

## PHASE 2: CONTEXT GATHERING
Use cappy_retrieve_context multiple times:

1. Search CODE for existing implementations:
   query: "{objective} implementation"
   sources: ["code"]
   
2. Search PREVENTION rules for category:
   query: "{category} best practices rules"
   sources: ["prevention"]
   
3. Search DOCUMENTATION:
   query: "{objective} architecture patterns"
   sources: ["documentation"]
   
4. Search TASKS for similar work:
   query: "{objective}"
   sources: ["task"]

CRITICAL: You MUST make at least 3 retrieval calls to build complete context.

## PHASE 3: QUESTION GENERATION
Analyze gaps between intent and context:

ONLY ask if:
- Context retrieval returned no relevant results
- Multiple conflicting patterns found
- Technical term mentioned but no implementation exists
- Clarity score < 0.6

Questions MUST:
- Be specific (not "tell me about X")
- Show what you found (transparency)
- Explain WHY you're asking
- Provide options when applicable
- Be asked ONE AT A TIME

Format:
{
  "id": "q1",
  "question": "Specific question?",
  "type": "technical",
  "context": "I found X in the code at file.ts:45-67",
  "why": "Need to know Y to decide Z",
  "options": ["option1", "option2"]
}

Return: {"questions": [...]} or {"questions": []} if context is complete

## PHASE 4: DESIGN OPTIONS
Propose 3 implementation approaches based on:
- Existing patterns found in retrieval
- Prevention rules for the category
- Similar completed tasks
- User's answers (if any)

Each option MUST:
- Reference REAL files/lines from retrieval
- Explain integration with existing code
- List specific modifications needed
- Identify risks
- Estimate effort
- Include code examples from retrieval

Format:
{
  "id": "opt1",
  "name": "Descriptive name",
  "summary": "One sentence",
  "description": "Detailed explanation",
  "integration": "How it fits with file.ts:45-67",
  "modifications": ["file1.ts", "file2.ts"],
  "risks": ["risk1", "risk2"],
  "effort": "2-4 hours",
  "pros": ["+1", "+2"],
  "cons": ["-1", "-2"],
  "codeExamples": [
    {
      "file": "existing.ts",
      "lines": "45-67",
      "description": "Similar pattern we can follow"
    }
  ]
}

## PHASE 5: SPECIFICATION GENERATION
After user chooses an option, generate ULTRA-DETAILED task:

Structure:
# Task: {Title}

## Context
### Relevant Files (from retrieval)
- \`file.ts:45-67\`: Description of what's there
- \`file2.ts:12-34\`: Another relevant piece

### Existing Patterns (from retrieval)
Pattern: {name}
- Used in: file.ts:45
- Example: [code snippet from retrieval]

### Prevention Rules (from retrieval)
[List all prevention rules for the category]

## Objective
[Clear statement of what will be achieved]

## Implementation Approach
[Chosen option with full details]

## Step-by-Step Execution

### Step 1: {Action}
**Objective:** What this step accomplishes

**Files to modify:**
- \`file.ts\`: lines 45-67 (based on retrieval)
  
**Instructions:**
[DETAILED instructions referencing retrieved code]

**Pattern to follow:**
[Code example from retrieval]

**Prevention rules to apply:**
- Rule from category

**Validation:**
- How to test this step worked

**If errors occur:**
- Common issue 1: solution
- Common issue 2: solution

**Estimated time:** 20min

[Repeat for each step]

## Completion Checklist
- [ ] All steps completed
- [ ] Tests passing
- [ ] Prevention rules applied
- [ ] Move task to .cappy/history/YYYY-MM/
- [ ] Add completion summary
- [ ] Run workspace scanner

# CRITICAL RULES
1. ALWAYS call cappy_retrieve_context at least 3 times
2. NEVER make up file paths - only use from retrieval
3. ALWAYS include line numbers from retrieval
4. Questions must be ONE AT A TIME
5. Show your work (what you found)
6. Specifications MUST reference retrieved context
7. If retrieval returns nothing, ASK before proceeding

# RESPONSE MARKERS
- Use <!-- agent:continue --> for intermediate work
- Use <!-- agent:done --> when task is complete
- Use <!-- reasoning:start/end --> to show thinking

# LANGUAGE
Respond in the same language as user input.
`.trim()

/**
 * Context retrieval tool information (embedded in ANALYST_SYSTEM_PROMPT above)
 * 
 * Tool: cappy_retrieve_context
 * Purpose: Hybrid retrieval across code, documentation, prevention rules, and tasks
 * Sources: code, documentation, prevention, task
 * 
 * The ANALYST_SYSTEM_PROMPT instructs the LLM to use this tool at least 3 times
 * during PHASE 2 (Context Gathering) to build comprehensive context before
 * generating questions or specifications.
 */

/**
 * Legacy context retrieval documentation
 * (kept for reference, actual instructions are in ANALYST_SYSTEM_PROMPT)
 * 
 * <CONTEXT_RETRIEVAL_TOOL>
 * You have access to cappy_retrieve_context, a powerful hybrid retrieval system that searches across:

**Sources:**
1. **code**: Functions, classes, variables, imports from the knowledge graph (with line numbers!)
2. **documentation**: Project docs, guides, architecture explanations in docs/ folder
3. **prevention**: Categorized rules for avoiding errors (auth, database, api, etc.)
4. **task**: Active and completed tasks from .cappy/tasks/ and .cappy/history/

**How to Use:**
\`\`\`typescript
// Example 1: Find authentication patterns
cappy_retrieve_context({
  query: "JWT authentication implementation",
  sources: ["code", "prevention", "documentation"],
  maxResults: 10,
  minScore: 0.6
})

// Example 2: Find database-related code
cappy_retrieve_context({
  query: "database connection and migrations",
  sources: ["code", "documentation"],
  category: "database",
  includeRelated: true
})

// Example 3: Find similar completed tasks
cappy_retrieve_context({
  query: "user authentication feature",
  sources: ["task"],
  maxResults: 5
})
\`\`\`

**Best Practices:**
* ALWAYS call cappy_retrieve_context BEFORE creating tasks to understand existing patterns
* Use multiple searches with different queries to build complete context
* Request line numbers and file paths are automatically included in results
* Search prevention rules for the category of work you're planning
* Check completed tasks for similar implementations
</CONTEXT_RETRIEVAL_TOOL>

<TASK_FILE_GUIDELINES>
* Task files must be saved as: TASK_YYYY-MM-DD-HH-MM-SS_SLUG.md in the .cappy/tasks/ directory
* **CRITICAL**: Call cappy_retrieve_context multiple times BEFORE writing tasks:
  1. Search "code" source for existing implementations
  2. Search "prevention" source for rules related to the task category
  3. Search "documentation" for architecture and patterns
  4. Search "task" for similar completed work
* When referencing code from the retriever, always include the line numbers received (e.g., "see lines 45-67 in file.ts")
* Include precise file paths and line ranges to help the development agent locate relevant code quickly
* Structure each task with:
  - **Context**: Resources needed (files, documentation, APIs) with file paths and line numbers FROM cappy_retrieve_context
  - **Prevention Rules**: Relevant rules from cappy_retrieve_context for the task category
  - **Objective**: Clear goal statement
  - **Steps**: Numbered action items with dependencies, deliverables, and acceptance criteria
  - **Why It Matters**: Technical rationale for each major component
* ALWAYS add a final step instructing the development agent to:
  1. Move the completed task file to .cappy/history/YYYY-MM/ directory
  2. Create a brief summary (2-3 sentences) of what was accomplished
  3. Run the workspace scanner to update the database with new changes
</TASK_FILE_GUIDELINES>

<QUESTIONING_STRATEGY>
* Call cappy_retrieve_context FIRST to understand the codebase
* Ask questions one at a time, never in batches
* Wait for the user's response before asking the next question
* Continue asking until you have complete clarity about the task
* Confirm assumptions explicitly before proceeding
</QUESTIONING_STRATEGY>

<EFFICIENCY>
* **PRIMARY RULE**: Call cappy_retrieve_context BEFORE every task creation
* Use multiple queries to build comprehensive context (code + docs + rules + tasks)
* Leverage line numbers from retrieval results to create precise references
* Combine related context into cohesive sections
* Reference prevention rules to avoid common mistakes
</EFFICIENCY>

<COMPLETION_PROTOCOL>
* Mark intermediate work that needs continuation with: <!-- agent:continue -->
* Mark final output with: <!-- agent:done -->
* After saving the task file, provide:
  1. A brief thank you message
  2. Confirmation that the task was created
  3. A mini summary (2-3 sentences) of what the task will accomplish
  4. The file path where it was saved
* CRITICAL: Every task MUST include a final step that instructs the development agent to:
  - Move the task file to .cappy/history/YYYY-MM/ after completion
  - Add a completion summary to the file
  - Run the workspace scanner to update the codebase database
  - This ensures the knowledge base stays current with all changes
</COMPLETION_PROTOCOL>

Answer in the same language as the user unless explicitly instructed otherwise.
`.trim()

/**
 * Chat engine using GitHub Copilot's LLM via VS Code Language Model API
 * 
 * Uses vscode.lm.selectChatModels to access Copilot models.
 * Supports: streaming responses, tool calling, reasoning display, phase-based workflow
 */
export class LangGraphChatEngine implements ChatAgentPort {
  private readonly promptResolvers = new Map<string, (response: string) => void>()
  private readonly stateMap = new Map<string, AnalystState>()

  handleUserPromptResponse(messageId: string, response: string): void {
    const resolver = this.promptResolvers.get(messageId)
    if (resolver) {
      resolver(response)
      this.promptResolvers.delete(messageId)
    }
  }

  private waitForUserResponse(messageId: string): Promise<string> {
    return new Promise((resolve) => {
      this.promptResolvers.set(messageId, resolve)
    })
  }

  async *processMessage(message: Message, context: ChatContext): AsyncIterable<string> {
    try {
      // Emit reasoning start
      yield '<!-- reasoning:start -->\n'      
      
      // Select a Copilot chat model
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      })

      if (models.length === 0) {
        yield '<!-- reasoning:end -->\n'
        yield 'No Copilot models available. Make sure you have:\n'
        yield '1. GitHub Copilot extension installed\n'
        yield '2. GitHub Copilot subscription active\n'
        yield '3. Signed in to GitHub in VS Code\n'
        return
      }

      const model = models[0]
      yield '<!-- reasoning:end -->\n'

      // === INICIALIZA ESTADO DO ANALYST ===
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const state: AnalystState = {
        userInput: message.content,
        questions: [],
        answers: [],
        options: [],
        currentPhase: 'intent',
        sessionId,
        createdAt: new Date()
      }
      this.stateMap.set(sessionId, state)
      
      console.log(`[Analyst] Session ${sessionId} started`)
      console.log(`[Analyst] Initial phase: ${state.currentPhase}`)

      // Build message array using ANALYST_SYSTEM_PROMPT
      const messages = this.buildMessages(context, ANALYST_SYSTEM_PROMPT)
      messages.push(vscode.LanguageModelChatMessage.User(message.content))
      
      console.log(`📨 Sending ${messages.length} messages to model`)

      // Get available tools
      const tools = vscode.lm.tools
      const cappyTools = tools.filter((tool: vscode.LanguageModelToolInformation) => tool.name.startsWith('cappy_'))
      
      console.log(`🛠️ Available Cappy tools: ${cappyTools.map((t: vscode.LanguageModelToolInformation) => t.name).join(', ')}`)

      // Send request with tools enabled and justification
      const options: vscode.LanguageModelChatRequestOptions = {
        justification: 'Cappy Analyst processing user request with phase-based workflow',
        tools: cappyTools
      }
      
      const cancellationSource = new vscode.CancellationTokenSource()

      // === LOOP AGENTICO POR FASES ===
      for (let step = 1; step <= MAX_AGENT_STEPS; step++) {
        console.log(`[Analyst] Phase: ${state.currentPhase}, Step: ${step}/${MAX_AGENT_STEPS}`)
        
        // Adiciona contexto da fase atual
        const phasePrompt = this.getPhasePrompt(state)
        if (phasePrompt) {
          messages.push(vscode.LanguageModelChatMessage.User(phasePrompt))
          console.log(`[Analyst] Added phase prompt for ${state.currentPhase}`)
        }

        const response = await model.sendRequest(messages, options, cancellationSource.token)

        const assistantParts: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = []
        const toolCalls: vscode.LanguageModelToolCallPart[] = []
        let textAccumulator = ''

        for await (const part of response.stream) {
          if (part instanceof vscode.LanguageModelTextPart) {
            assistantParts.push(part)
            textAccumulator += part.value
            yield part.value
          } else if (part instanceof vscode.LanguageModelToolCallPart) {
            assistantParts.push(part)
            toolCalls.push(part)
          }
        }

        if (assistantParts.length > 0) {
          messages.push(vscode.LanguageModelChatMessage.Assistant(assistantParts))
        }

        // === PROCESSAMENTO POR FASE ===
        const phaseResult = await this.processPhase(
          state,
          textAccumulator,
          toolCalls,
          messages,
          cancellationSource.token
        )

        if (phaseResult.type === 'yield') {
          yield* phaseResult.content
        }

        if (phaseResult.type === 'wait_user') {
          // Pausa para aguardar resposta do usuário
          console.log(`[Analyst] Waiting for user response to ${phaseResult.messageId}`)
          const userResponse = await this.waitForUserResponse(phaseResult.messageId)
          
          if (state.currentPhase === 'questions') {
            // Adiciona resposta às answers
            const currentQuestion = state.questions[state.answers.length]
            if (currentQuestion) {
              state.answers.push({
                questionId: currentQuestion.id,
                answer: userResponse,
                timestamp: new Date()
              })
              
              console.log(`[Analyst] Received answer ${state.answers.length}/${state.questions.length}`)
              
              // Adiciona resposta à conversa
              messages.push(vscode.LanguageModelChatMessage.User(
                `Answer to "${currentQuestion.question}": ${userResponse}`
              ))
              
              // Se ainda tem perguntas, continua
              if (state.answers.length < state.questions.length) {
                continue
              } else {
                // Todas respondidas, vai para opções
                state.currentPhase = 'options'
                console.log('[Analyst] Phase transition: questions → options (all answered)')
                continue
              }
            }
          }

          if (state.currentPhase === 'options') {
            // Usuário escolheu uma opção
            const chosenOption = state.options.find(opt => opt.id === userResponse || opt.name === userResponse)
            if (chosenOption) {
              state.chosenOption = chosenOption
              state.currentPhase = 'spec'
              
              console.log(`[Analyst] User chose option: ${chosenOption.name}`)
              console.log('[Analyst] Phase transition: options → spec')
              
              messages.push(vscode.LanguageModelChatMessage.User(
                `User chose option: ${chosenOption.name}. Now generate the detailed specification based on this option.`
              ))
            }
            
            continue
          }
        }

        if (phaseResult.type === 'done') {
          // Salva task e finaliza
          console.log('[Analyst] Specification complete, persisting task...')
          
          try {
            const savedInfo = await this.persistPlanFromText(state.specification!)
            if (savedInfo) {
              yield '\n\n---\n\n'
              yield '✅ **Especificação técnica criada com sucesso!**\n\n'
              yield `📄 Arquivo: \`${savedInfo.relativePath}\`\n\n`
              yield `📋 **Resumo da Análise**:\n`
              yield `- 📊 **Fase**: ${state.currentPhase}\n`
              yield `- 🔍 **Contexto coletado**: ${state.context?.code.length || 0} código, ${state.context?.documentation.length || 0} docs, ${state.context?.prevention.length || 0} regras\n`
              yield `- ❓ **Perguntas respondidas**: ${state.answers.length}\n`
              yield `- 🎯 **Opções analisadas**: ${state.options.length}\n`
              yield `- ✨ **Opção escolhida**: ${state.chosenOption?.name || 'N/A'}\n\n`
            } else {
              yield '\n\n⚠️ Não foi possível encontrar conteúdo válido para salvar a task.\n\n'
            }
          } catch (persistError) {
            const persistMessage = persistError instanceof Error ? persistError.message : 'Erro desconhecido ao salvar task.'
            yield `\n\n❌ Não foi possível salvar a task: ${persistMessage}\n\n`
          }
          
          // Limpa estado
          this.stateMap.delete(sessionId)
          return
        }

        if (toolCalls.length === 0 && phaseResult.type === 'continue') {
          // Se não há tool calls e não há ação especial, continua o loop
          if (textAccumulator.includes('<!-- agent:continue -->')) {
            continue
          }
          
          // Se não tem nada para fazer, encerra
          console.log('[Analyst] No tool calls and no phase action, finishing')
          return
        }
      }

      yield `\n\nAgentic iteration limit reached. Please adjust your request or complete manually.\n\n`
    } catch (error) {
      if (error instanceof vscode.LanguageModelError) {
        yield `\n\nLanguage Model Error: ${error.message}\n\n`
        
        // Handle specific error codes
        if (error.code === 'NoPermissions') {
          yield 'You need to grant permission to use the language model.\n'
          yield 'The first request will show a consent dialog.\n'
        } else if (error.code === 'NotFound') {
          yield 'The requested model was not found.\n'
          yield 'Make sure GitHub Copilot is installed and active.\n'
        } else if (error.code === 'Blocked') {
          yield 'Request blocked due to quota or rate limits.\n'
          yield 'Please try again later.\n'
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        yield `\n\nError: ${errorMessage}\n`
      }
    }
  }

  private extractTaskContent(rawText: string): { content: string; title: string } | null {
    // Remove agent markers for cleaner content
    const cleanText = rawText
        .replace(/<!-- agent:done -->/g, '')
        .replace(/<!-- agent:continue -->/g, '')
      .trim()

    if (!cleanText) {
      return null
    }

    // Try to extract a title from the markdown
    const titleMatch = /^#\s+(.+)/m.exec(cleanText)
    const title = titleMatch?.[1]?.trim() || 'task'

    return { content: cleanText, title }
  }

  private static slugify(value: string): string {
    return value
      .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+/g, '')
        .replace(/-+$/g, '')
      .toLowerCase() || 'task'
  }

  private async persistPlanFromText(rawText: string): Promise<{ absolutePath: string; relativePath: string } | null> {
    const extracted = this.extractTaskContent(rawText)

    if (!extracted) {
      return null
    }

    const slug = LangGraphChatEngine.slugify(extracted.title)
    
    // Format: TASK_YYYY-MM-DD-HH-MM-SS_SLUG.md
    const now = new Date()
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join('-')

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      throw new Error('Workspace não encontrado para salvar a task.')
    }

    const tasksDirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'tasks')
    await vscode.workspace.fs.createDirectory(tasksDirUri)

    const fileName = `TASK_${timestamp}_${slug}.md`
    const fileUri = vscode.Uri.joinPath(tasksDirUri, fileName)
    const fileContent = Buffer.from(extracted.content, 'utf8')

    await vscode.workspace.fs.writeFile(fileUri, fileContent)

    return {
      absolutePath: fileUri.fsPath,
      relativePath: path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath)
    }
  }

  /**
   * Get phase-specific prompt based on current state
   */
  private getPhasePrompt(state: AnalystState): string | null {
    switch (state.currentPhase) {
      case 'intent':
        return `
PHASE 1: INTENT EXTRACTION

Analyze the user input and extract:
- objective
- technicalTerms
- category
- clarityScore
- ambiguities

User input: "${state.userInput}"

Return JSON with the intent analysis, then move to PHASE 2.
`.trim()

      case 'context':
        if (!state.intent) return null
        
        return `
PHASE 2: CONTEXT GATHERING

You have the intent:
${JSON.stringify(state.intent, null, 2)}

Now use cappy_retrieve_context AT LEAST 3 times:
1. Search "code" for: "${state.intent.objective} implementation"
2. Search "prevention" for category: "${state.intent.category}"
3. Search "documentation" for: "${state.intent.objective} patterns"
4. Search "task" for similar completed work

After gathering context, analyze gaps and move to PHASE 3.
`.trim()

      case 'questions':
        if (!state.context) return null
        
        return `
PHASE 3: QUESTION GENERATION

Context gathered:
- Code results: ${state.context.code.length}
- Prevention rules: ${state.context.prevention.length}
- Docs: ${state.context.documentation.length}
- Similar tasks: ${state.context.tasks.length}

Gaps identified: ${JSON.stringify(state.context.gaps)}

Generate questions to fill gaps. Remember: ONE AT A TIME.
If no gaps, return {"questions": []} and move to PHASE 4.
`.trim()

      case 'options':
        return `
PHASE 4: DESIGN OPTIONS

Generate 3 implementation approaches based on:
- Retrieved context
- User answers: ${JSON.stringify(state.answers)}

Each option must reference real files/lines from retrieval.
Return options array then wait for user choice.
`.trim()

      case 'spec':
        if (!state.chosenOption) return null
        
        return `
PHASE 5: SPECIFICATION GENERATION

Generate ULTRA-DETAILED task for chosen option: ${state.chosenOption.name}

Include:
- Context section with file:line references
- Prevention rules
- Step-by-step with validation
- Code examples from retrieval

Mark with <!-- agent:done --> when complete.
`.trim()

      default:
        return null
    }
  }

  /**
   * Process current phase and determine next action
   */
  private async processPhase(
    state: AnalystState,
    text: string,
    toolCalls: vscode.LanguageModelToolCallPart[],
    messages: vscode.LanguageModelChatMessage[],
    token: vscode.CancellationToken
  ): Promise<PhaseResult> {
    // Detecta conclusão
    if (text.includes('<!-- agent:done -->')) {
      state.specification = text
      state.currentPhase = 'done'
      return { type: 'done' }
    }

    // FASE 1: INTENT EXTRACTION
    if (state.currentPhase === 'intent' && text.includes('"objective"')) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*?"objective"[\s\S]*?\}/)?.[0]
        if (jsonMatch) {
          state.intent = JSON.parse(jsonMatch)
          state.currentPhase = 'context'
          console.log('[Analyst] Phase transition: intent → context')
        }
      } catch (e) {
        console.warn('[Analyst] Failed to parse intent JSON:', e)
      }
    }

    // FASE 2: CONTEXT GATHERING
    if (state.currentPhase === 'context') {
      // Inicializa contexto se necessário
      if (!state.context) {
        state.context = {
          code: [],
          documentation: [],
          prevention: [],
          tasks: [],
          existingPatterns: [],
          gaps: []
        }
      }

      // Processa tool calls de retrieval
      for (const toolCall of toolCalls) {
        if (toolCall.name === 'cappy_retrieve_context') {
          console.log('[Analyst] Processing retrieval call...')
          
          // Executa a tool
          const result = await this.executeTool(toolCall, messages, token)
          
          // Parse result e adiciona ao contexto
          const parsed = this.parseRetrievalResult(result)
          
          // Determina source baseado no input
          const input = toolCall.input as any
          const sources = input.sources || ['code']
          const primarySource = sources[0] || 'code'
          
          // Adiciona ao contexto apropriado
          if (primarySource === 'code') {
            state.context.code.push(...parsed)
          } else if (primarySource === 'documentation') {
            state.context.documentation.push(...parsed)
          } else if (primarySource === 'prevention') {
            state.context.prevention.push(...parsed)
          } else if (primarySource === 'task') {
            state.context.tasks.push(...parsed)
          }
          
          console.log(`[Analyst] Retrieved ${parsed.length} results for ${primarySource}`)
        }
      }

      // Verifica se coletou contexto suficiente (pelo menos 3 retrievals)
      const totalRetrievals = state.context.code.length +
                              state.context.documentation.length +
                              state.context.prevention.length +
                              state.context.tasks.length

      if (totalRetrievals >= 3 || toolCalls.length === 0) {
        // Analisa gaps
        state.context.gaps = this.identifyGaps(state.intent, state.context)
        state.currentPhase = 'questions'
        console.log('[Analyst] Phase transition: context → questions')
        console.log(`[Analyst] Gaps identified: ${state.context.gaps.join(', ')}`)
      }
    }

    // FASE 3: QUESTIONS
    if (state.currentPhase === 'questions' && text.includes('"questions"')) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*?"questions"[\s\S]*?\}/)?.[0]
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch)
          state.questions = parsed.questions || []
          
          if (state.questions.length === 0) {
            // Sem perguntas, vai direto pras opções
            state.currentPhase = 'options'
            console.log('[Analyst] Phase transition: questions → options (no questions needed)')
            return { type: 'continue' }
          }
          
          // Tem perguntas, apresenta a próxima
          const nextQuestion = state.questions[state.answers.length]
          if (nextQuestion) {
            console.log(`[Analyst] Asking question ${state.answers.length + 1}/${state.questions.length}`)
            
            return {
              type: 'wait_user',
              messageId: nextQuestion.id,
              question: nextQuestion
            }
          } else {
            // Todas as perguntas respondidas
            state.currentPhase = 'options'
            console.log('[Analyst] Phase transition: questions → options (all answered)')
          }
        }
      } catch (e) {
        console.warn('[Analyst] Failed to parse questions JSON:', e)
      }
    }

    // FASE 4: OPTIONS
    if (state.currentPhase === 'options' && text.includes('"options"')) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*?"options"[\s\S]*?\}/)?.[0]
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch)
          state.options = parsed.options || []
          
          if (state.options.length > 0) {
            console.log(`[Analyst] Generated ${state.options.length} design options`)
            
            // Apresenta opções ao usuário
            return {
              type: 'yield',
              content: this.formatOptionsUI(state)
            }
          }
        }
      } catch (e) {
        console.warn('[Analyst] Failed to parse options JSON:', e)
      }
    }

    // FASE 5: SPEC
    if (state.currentPhase === 'spec') {
      // Aguarda o agente gerar a especificação completa
      // A transição para 'done' acontece quando detectar <!-- agent:done -->
    }

    return { type: 'continue' }
  }

  /**
   * Identify gaps in context that need clarification
   */
  private identifyGaps(intent: AnalystState['intent'], context: AnalystState['context']): string[] {
    if (!intent || !context) return []
    
    const gaps: string[] = []

    // Sem código relevante
    if (context.code.length === 0) {
      gaps.push('no_code_examples')
    }

    // Sem prevention rules
    if (context.prevention.length === 0 && intent.category) {
      gaps.push(`no_prevention_rules_for_${intent.category}`)
    }

    // Termos técnicos sem pattern
    for (const term of intent.technicalTerms) {
      const hasCode = context.code.some((c: RetrievalResult) => 
        c.content.toLowerCase().includes(term.toLowerCase())
      )
      if (!hasCode) {
        gaps.push(`no_implementation_of_${term}`)
      }
    }

    // Clarity score baixo
    if (intent.clarityScore < 0.6) {
      gaps.push('low_clarity_score')
    }

    return gaps
  }

  /**
   * Parse retrieval result from tool output
   */
  private parseRetrievalResult(toolResult: string): RetrievalResult[] {
    try {
      // Tenta parsear como JSON primeiro
      const parsed = JSON.parse(toolResult)
      if (Array.isArray(parsed)) {
        return parsed as RetrievalResult[]
      }
      
      // Se não for array, converte objeto único
      if (parsed.content && parsed.score !== undefined) {
        return [parsed as RetrievalResult]
      }
      
      // Fallback: extrai informações do texto
      const results: RetrievalResult[] = []
      const lines = toolResult.split('\n')
      let currentResult: Partial<RetrievalResult> | null = null
      
      for (const line of lines) {
        if (line.includes('File:') || line.includes('file:')) {
          if (currentResult && currentResult.content) {
            results.push(currentResult as RetrievalResult)
          }
          currentResult = {
            content: '',
            metadata: { source: 'code' },
            score: 0.5
          }
          
          // Extrai file path
          const fileMatch = line.match(/(?:File|file):\s*(.+?)(?:\s|$)/)
          if (fileMatch && currentResult.metadata) {
            currentResult.metadata.filePath = fileMatch[1]
          }
        } else if (line.includes('Lines:') || line.includes('lines:')) {
          const linesMatch = line.match(/(\d+)-(\d+)/)
          if (linesMatch && currentResult?.metadata) {
            currentResult.metadata.lineStart = parseInt(linesMatch[1])
            currentResult.metadata.lineEnd = parseInt(linesMatch[2])
          }
        } else if (currentResult && line.trim()) {
          currentResult.content += line + '\n'
        }
      }
      
      if (currentResult && currentResult.content) {
        results.push(currentResult as RetrievalResult)
      }
      
      return results
    } catch (e) {
      console.warn('[parseRetrievalResult] Failed to parse:', e)
      return []
    }
  }

  /**
   * Format design options UI for user choice
   */
  private async *formatOptionsUI(state: AnalystState): AsyncIterable<string> {
    yield '\n\n## 📋 Opções de Implementação\n\n'
    
    for (const opt of state.options) {
      yield `### ${opt.name}\n`
      yield `${opt.summary}\n\n`
      yield `**Esforço:** ${opt.effort}\n\n`
      yield `**Prós:**\n${opt.pros.map(p => `- ✅ ${p}`).join('\n')}\n\n`
      yield `**Contras:**\n${opt.cons.map(c => `- ⚠️ ${c}`).join('\n')}\n\n`
      
      if (opt.codeExamples && opt.codeExamples.length > 0) {
        yield `**Exemplos de código existente:**\n`
        for (const example of opt.codeExamples) {
          yield `- \`${example.file}:${example.lines}\`: ${example.description}\n`
        }
        yield '\n'
      }
      
      yield '---\n\n'
    }
    
    const messageId = `opt_${Date.now()}`
    yield `__PROMPT_REQUEST__:${JSON.stringify({
      messageId,
      question: 'Escolha uma opção:',
      options: state.options.map(opt => ({ id: opt.id, label: opt.name }))
    })}\n\n`
  }

  /**
   * Execute a tool and add result to messages
   */
  private async executeTool(
    toolCall: vscode.LanguageModelToolCallPart,
    messages: vscode.LanguageModelChatMessage[],
    token: vscode.CancellationToken
  ): Promise<string> {
    const result = await vscode.lm.invokeTool(
      toolCall.name,
      { input: toolCall.input, toolInvocationToken: undefined },
      token
    )

    const resultText = result.content
      .filter((c): c is vscode.LanguageModelTextPart => c instanceof vscode.LanguageModelTextPart)
      .map(c => c.value)
      .join('')

    // Adiciona resultado à conversa
    const toolResultPart = new vscode.LanguageModelToolResultPart(
      toolCall.callId,
      [new vscode.LanguageModelTextPart(resultText)]
    )
    messages.push(vscode.LanguageModelChatMessage.User([toolResultPart]))

    return resultText
  }

  /**
   * Build message array with history
   */
  private buildMessages(
    context: ChatContext,
    systemPrompt: string
  ): vscode.LanguageModelChatMessage[] {
    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(systemPrompt)
    ]

    const recentHistory = context.history.slice(-10)
    
    for (const msg of recentHistory) {
      if (msg.author === 'user') {
        messages.push(vscode.LanguageModelChatMessage.User(msg.content))
      } else if (msg.author === 'assistant') {
        messages.push(vscode.LanguageModelChatMessage.Assistant(msg.content))
      }
    }

    return messages
  }
}
