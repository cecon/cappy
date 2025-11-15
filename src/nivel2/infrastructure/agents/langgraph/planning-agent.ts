import * as vscode from 'vscode'
import type { DevelopmentPlan, CriticFeedback } from '../planning/types'
import { PlanPersistence } from '../planning/plan-persistence'

interface AgentTurnParams {
  readonly prompt: string
  readonly sessionId: string
  readonly token?: vscode.CancellationToken
  readonly onToken?: (chunk: string) => void
}

interface InternalAgentState {
  currentPlan: DevelopmentPlan | null
  criticFeedback: CriticFeedback[]
  planFilePath: string | null
  agentPhase: 'planning' | 'critic' | 'clarifying' | 'done'
}

const SYSTEM_PROMPT = `You are Cappy, an intelligent planning assistant that helps developers create detailed development plans.

<YOUR_ROLE>
You are NOT a code generator. Your role is to:
1. Understand the developer's request through self-discovery and minimal user interaction
2. Analyze the workspace context using available tools FIRST
3. Extract relevant information from the codebase autonomously
4. Create comprehensive, step-by-step development plans
</YOUR_ROLE>

<TOOLS_YOU_MUST_USE>
- cappy_retrieve_context: Search for relevant code, documentation, patterns, and rules
- read_file: Read specific files to understand implementation details
- grep_search: Search for patterns, functions, or symbols in the codebase
- list_dir: Explore workspace structure
- semantic_search: Find semantically related code

Use these tools proactively and EXTENSIVELY before asking the user anything.
</TOOLS_YOU_MUST_USE>

<CRITICAL_WORKFLOW>
1. SELF-DISCOVERY FIRST (Use tools to answer your own questions)
   Before asking the user ANYTHING, ask yourself:
   - "Can I find this answer using cappy_retrieve_context?"
   - "Can I search for this pattern with grep_search?"
   - "Can I read files to understand this?"
   
   ALWAYS try to answer questions using tools BEFORE asking the user.
   
2. ASK ONE QUESTION AT A TIME (only if tools cannot answer)
   - If you need clarification, ask ONE specific question
   - Wait for the user's response
   - Then continue gathering context or ask the next question
   - NEVER ask multiple questions in a single message
   
   Example of GOOD interaction:
   ❌ BAD: "What files are involved? What libraries do you use? What's the performance requirement?"
   ✅ GOOD: First use grep_search to find files, then ask: "I found AuthService.ts. Should we modify it or create a new service?"

3. GATHER CONTEXT AUTONOMOUSLY
   - Use cappy_retrieve_context extensively for patterns and similar code
   - Use read_file to understand current implementations
   - Use grep_search to find dependencies and usage
   - Build a complete picture before planning

4. CONFIRM YOUR FINDINGS (not ask open questions)
   - Instead of asking "What files should we modify?"
   - Say: "I found these files: [X, Y, Z]. I'll modify X and Y. Correct?"
   - This shows you've done the research and just need confirmation

5. CREATE THE PLAN
   - Only after gathering extensive context
   - Reference specific files and line numbers you discovered
   - Show evidence from the codebase
</CRITICAL_WORKFLOW>

<QUESTION_PROTOCOL>
When you think about asking a question:

STEP 1: Can I answer this with cappy_retrieve_context?
  → YES: Use the tool and answer yourself
  → NO: Go to STEP 2

STEP 2: Can I answer this with grep_search or read_file?
  → YES: Use the tool and answer yourself
  → NO: Go to STEP 3

STEP 3: Is this critical information I cannot infer?
  → YES: Ask ONE specific question with context
  → NO: Make a reasonable assumption and state it

Example:
❌ DON'T: "What authentication library do you use?"
✅ DO: Use grep_search for "jwt|passport|auth" → Find the answer → State: "I found you're using JWT with jsonwebtoken library"
</QUESTION_PROTOCOL>

<BEHAVIOR>
- Answer in the same language used by the developer
- Be PROACTIVE: discover before asking
- Always use tools EXTENSIVELY before any user interaction
- ONE question at a time, only when tools cannot answer
- Show your research: "I found X by analyzing Y"
- Reference actual files, functions, and patterns from the workspace
- Never invent - if tools don't find it and you need to ask, be explicit about what you couldn't find
</BEHAVIOR>

<OUTPUT_FORMAT>
When creating a plan, use this structure:

## 📋 Development Plan: [Task Name]

### 🎯 Goal
[Clear description of what we're trying to achieve]

### 📦 Context Gathered
- Files analyzed: [list]
- Patterns found: [list]
- Dependencies: [list]

### ❓ Clarifications Needed
[List any remaining questions]

### 📝 Step-by-Step Plan
1. **[Step Name]** (File: \`path/to/file.ts\`)
   - What to do
   - Why this approach
   - Validation criteria
   
2. **[Step Name]** ...

### ⚠️ Risks & Considerations
- [Risk 1]
- [Risk 2]

### ✅ Success Criteria
- [Criterion 1]
- [Criterion 2]
</OUTPUT_FORMAT>

Remember: You are a PLANNER, not a coder. Your value is in analysis, context gathering, and creating clear roadmaps.
`.trim()

export class LangGraphPlanningAgent {
  private model: vscode.LanguageModelChat | null = null
  private initialized = false
  
  // Internal state for multi-agent system
  private readonly sessionPlans = new Map<string, InternalAgentState>()

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    })

    if (!models.length) {
      throw new Error('No Copilot chat models available')
    }

    this.model = models[0]
    this.initialized = true
    console.log('[PlanningAgent] Multi-agent system initialized with model:', this.model.name)
  }

  async runTurn(params: AgentTurnParams): Promise<string> {
    if (!this.initialized) {
      await this.initialize()
    }

    if (!this.model) {
      throw new Error('Language model not available')
    }

    const { prompt, sessionId, token, onToken } = params

    // Get or create internal state for this session
    const internalState = this.getOrCreateState(sessionId)
    
    // Multi-agent orchestration happens here
    const assistantResponse = await this.orchestrateAgents(
      prompt, 
      internalState, 
      sessionId,
      token, 
      onToken
    )

    return assistantResponse
  }

  private getOrCreateState(sessionId: string): InternalAgentState {
    if (!this.sessionPlans.has(sessionId)) {
      this.sessionPlans.set(sessionId, {
        currentPlan: null,
        criticFeedback: [],
        planFilePath: null,
        agentPhase: 'planning'
      })
    }
    return this.sessionPlans.get(sessionId)!
  }

  /**
   * Orchestrates multiple specialized agents internally
   * while presenting a unified interface to the user
   */
  private async orchestrateAgents(
    userPrompt: string,
    state: InternalAgentState,
    _sessionId: string,
    token?: vscode.CancellationToken,
    onToken?: (chunk: string) => void
  ): Promise<string> {
    console.log(`[PlanningAgent] Phase: ${state.agentPhase}`)

    switch (state.agentPhase) {
      case 'planning':
        return await this.runPlanningPhase(userPrompt, state, token, onToken)
      
      case 'critic':
        return await this.runCriticPhase(userPrompt, state, token, onToken)
      
      case 'clarifying':
        return await this.runClarificationPhase(userPrompt, state, token, onToken)
      
      case 'done':
        return await this.runCompletionPhase(state)
      
      default:
        return 'Unexpected state. Please try again.'
    }
  }

  /**
   * PHASE 1: Planning - Creates initial plan with extensive context gathering
   */
  private async runPlanningPhase(
    userPrompt: string,
    state: InternalAgentState,
    token?: vscode.CancellationToken,
    onToken?: (chunk: string) => void
  ): Promise<string> {
    console.log('[PlanningAgent/Planning] Creating initial development plan...')
    
    const planningPrompt = `${SYSTEM_PROMPT}

<CURRENT_PHASE>PLANNING</CURRENT_PHASE>

<USER_REQUEST>
${userPrompt}
</USER_REQUEST>

<TASK>
Create an initial development plan. Use tools EXTENSIVELY to gather context.
After gathering context, create a comprehensive plan with:
- Clear goal statement
- Context gathered (files analyzed, patterns found, dependencies)
- Detailed steps with file paths and line numbers
- Initial clarifications needed
- Risks and mitigation strategies
- Success criteria

Format your response as a markdown plan that I can parse.
</TASK>`

    const response = await this.runAgentWithTools(planningPrompt, token, onToken)
    
    // Parse response and create plan structure
    const plan = this.parsePlanFromResponse(response, userPrompt)
    state.currentPlan = plan
    
    // Persist plan to disk
    try {
      const planPath = await PlanPersistence.savePlan(plan)
      state.planFilePath = planPath
      console.log(`[PlanningAgent] Plan saved to: ${planPath}`)
    } catch (error) {
      console.error('[PlanningAgent] Failed to save plan:', error)
    }
    
    // After planning, move to critic phase
    state.agentPhase = 'critic'
    
    return response
  }

  /**
   * PHASE 2: Critic - Reviews plan and identifies gaps
   */
  private async runCriticPhase(
    userPrompt: string,
    state: InternalAgentState,
    token?: vscode.CancellationToken,
    onToken?: (chunk: string) => void
  ): Promise<string> {
    console.log('[PlanningAgent/Critic] Reviewing plan for gaps and ambiguities...')
    
    const criticPrompt = `You are a CRITIC agent reviewing a development plan.

<TASK>
Analyze the current plan JSON and identify:
1. Missing information (file paths, dependencies, etc.)
2. Ambiguous steps
3. Unclear requirements
4. Potential risks not considered

For each issue found, determine if it's CRITICAL (blocks implementation) or optional.
If there are CRITICAL issues, prepare ONE specific question to ask the user.
If no critical issues, approve the plan.

Be HARSH but constructive. A good plan should be implementable by an LLM without guessing.
</TASK>

Current Plan:
${JSON.stringify(state.currentPlan, null, 2)}

User's Latest Input:
${userPrompt}`

    const criticResponse = await this.runAgentWithTools(criticPrompt, token, onToken)
    
    // Parse critic response and update feedback
    state.criticFeedback = this.parseCriticFeedback(criticResponse)
    
    // Parse critic response to determine next phase
    const hasCriticalIssues = state.criticFeedback.some(f => f.severity === 'critical')
    
    if (hasCriticalIssues && state.currentPlan) {
      state.agentPhase = 'clarifying'
      state.currentPlan.status = 'clarifying'
      state.currentPlan.updatedAt = new Date().toISOString()
      
      // Update persisted plan
      if (state.planFilePath) {
        await PlanPersistence.updatePlan(state.currentPlan.id, state.currentPlan)
      }
    } else {
      state.agentPhase = 'done'
      if (state.currentPlan) {
        state.currentPlan.status = 'ready'
        state.currentPlan.updatedAt = new Date().toISOString()
        
        // Update persisted plan
        if (state.planFilePath) {
          await PlanPersistence.updatePlan(state.currentPlan.id, state.currentPlan)
        }
      }
    }
    
    return criticResponse
  }

  /**
   * PHASE 3: Clarification - Asks ONE question to user
   */
  private async runClarificationPhase(
    userPrompt: string,
    state: InternalAgentState,
    token?: vscode.CancellationToken,
    onToken?: (chunk: string) => void
  ): Promise<string> {
    console.log('[PlanningAgent/Clarification] Asking clarifying question...')
    
    // If user provided an answer, record it first
    if (userPrompt && state.currentPlan && state.currentPlan.clarifications.length > 0) {
      const lastClarification = state.currentPlan.clarifications.at(-1)
      if (lastClarification && !lastClarification.answer) {
        lastClarification.answer = userPrompt
        state.currentPlan.updatedAt = new Date().toISOString()
        
        // Update persisted plan
        if (state.planFilePath) {
          await PlanPersistence.updatePlan(state.currentPlan.id, state.currentPlan)
        }
        
        // Go back to critic to re-evaluate with new answer
        state.agentPhase = 'critic'
        return 'Thank you for the clarification. Let me review the plan again with this information.'
      }
    }
    
    const clarificationPrompt = `You are a CLARIFICATION agent.

<TASK>
Based on the critic feedback, ask the user ONE specific, context-rich question.

Rules:
- Ask ONLY ONE question
- Include context you already found (show your research)
- Be specific, not vague
- Give options when possible

Example GOOD question:
"I found you have src/services/ and src/lib/ directories.
 For the JWT service, should I create it in:
 a) src/services/auth/jwt-service.ts (with other services)
 b) src/lib/auth.ts (as a utility)
 
 What's your preference?"

Example BAD question:
"Where should I put the JWT service?"
</TASK>

Critic Feedback:
${JSON.stringify(state.criticFeedback, null, 2)}

Current Plan:
${JSON.stringify(state.currentPlan, null, 2)}`

    const question = await this.runAgentWithTools(clarificationPrompt, token, onToken)
    
    // Add clarification to plan
    if (state.currentPlan) {
      const clarificationId = `clarif-${state.currentPlan.clarifications.length + 1}`
      state.currentPlan.clarifications.push({
        id: clarificationId,
        question,
        critical: true,
        relatedSteps: []
      })
      state.currentPlan.updatedAt = new Date().toISOString()
      
      // Update persisted plan
      if (state.planFilePath) {
        await PlanPersistence.updatePlan(state.currentPlan.id, state.currentPlan)
      }
    }
    
    return question
  }

  /**
   * PHASE 4: Completion - Plan is ready
   */
  private async runCompletionPhase(
    state: InternalAgentState
  ): Promise<string> {
    console.log('[PlanningAgent/Completion] Plan approved and finalized')
    
    const completion = `✅ **Development Plan Complete!**

📄 Plan saved at: \`${state.planFilePath}\`

The plan has been reviewed and is ready for implementation. It includes:
- ${state.currentPlan?.steps.length || 0} actionable steps
- ${state.currentPlan?.clarifications.filter(c => c.answer).length || 0} clarifications resolved
- ${state.currentPlan?.risks.length || 0} risks identified
- ${state.currentPlan?.successCriteria.length || 0} success criteria

Would you like to:
1. Review the plan (I can open it in the editor)
2. Make adjustments
3. Send it to the development agent`
    
    return completion
  }

  /**
   * Runs agent with tools and handles tool execution loop
   */
  private async runAgentWithTools(
    systemPrompt: string,
    token?: vscode.CancellationToken,
    onToken?: (chunk: string) => void
  ): Promise<string> {
    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(systemPrompt)
    ]

    const cancellation = new vscode.CancellationTokenSource()
    if (token) {
      token.onCancellationRequested(() => {
        cancellation.cancel()
      })
    }

    // Get all available tools (Cappy + Copilot)
    const allTools = vscode.lm.tools
    const toolsArray = Array.from(allTools)
    
    // Filter to planning-relevant tools only (no code generation/editing)
    const planningTools = toolsArray.filter(tool => {
      const name = tool.name
      // Include analysis and context tools
      if (name.startsWith('cappy_')) return true
      if (['read_file', 'grep_search', 'list_dir', 'semantic_search', 'file_search'].includes(name)) return true
      // Exclude code generation/editing tools
      if (['create_file', 'replace_string_in_file', 'run_in_terminal', 'run_task'].includes(name)) return false
      return false
    })

    const conversationMessages = [...messages]
    let finalTextResponse = ''
    const maxIterations = 10
    let iteration = 0

    // Tool execution loop
    while (iteration < maxIterations) {
      iteration++

      const response = await this.model!.sendRequest(
        conversationMessages,
        { 
          justification: 'Cappy Planning Agent - Multi-phase context gathering',
          tools: planningTools
        },
        cancellation.token
      )

      const { textContent, toolCalls } = await this.collectResponseParts(response, onToken)

      if (textContent.trim()) {
        finalTextResponse += textContent
      }

      if (toolCalls.length === 0) {
        break
      }
      
      const toolResults = await this.executeToolCalls(toolCalls, planningTools, cancellation.token)

      if (textContent.trim()) {
        conversationMessages.push(vscode.LanguageModelChatMessage.Assistant(textContent))
      }

      conversationMessages.push(...toolResults)
    }

    return finalTextResponse.trim()
  }

  private async collectResponseParts(
    response: vscode.LanguageModelChatResponse,
    onToken?: (chunk: string) => void
  ): Promise<{
    textContent: string
    toolCalls: Array<{ id: string; name: string; input: unknown }>
  }> {
    let textContent = ''
    const toolCalls: Array<{ id: string; name: string; input: unknown }> = []

    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        textContent += part.value
        onToken?.(part.value)
      } else if (part instanceof vscode.LanguageModelToolCallPart) {
        console.log(`[PlanningAgent] Tool call detected: ${part.name}`)
        toolCalls.push({
          id: part.callId,
          name: part.name,
          input: part.input
        })
      }
    }

    return { textContent, toolCalls }
  }

  private async executeToolCalls(
    toolCalls: Array<{ id: string; name: string; input: unknown }>,
    toolsArray: readonly vscode.LanguageModelToolInformation[],
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatMessage[]> {
    const toolResults: vscode.LanguageModelChatMessage[] = []

    for (const toolCall of toolCalls) {
      try {
        const tool = toolsArray.find(t => t.name === toolCall.name)
        
        if (!tool) {
          console.warn(`[PlanningAgent] Tool not found: ${toolCall.name}`)
          toolResults.push(
            vscode.LanguageModelChatMessage.User(`Tool "${toolCall.name}" not found`)
          )
          continue
        }

        console.log(`[PlanningAgent] Executing tool: ${toolCall.name}`)
        console.log(`[PlanningAgent] Tool input:`, toolCall.input)

        const result = await vscode.lm.invokeTool(
          toolCall.name,
          {
            input: toolCall.input as object,
            toolInvocationToken: undefined
          },
          token
        )

        const resultText = this.extractToolResultText(result)

        console.log(`[PlanningAgent] Tool result (${resultText.length} chars):`, 
          resultText.substring(0, 200))

        toolResults.push(
          vscode.LanguageModelChatMessage.User(resultText || 'Tool executed successfully')
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[PlanningAgent] Tool execution failed:`, errorMessage)
        
        toolResults.push(
          vscode.LanguageModelChatMessage.User(`Tool execution failed: ${errorMessage}`)
        )
      }
    }

    return toolResults
  }

  private extractToolResultText(result: vscode.LanguageModelToolResult): string {
    let resultText = ''
    
    for (const part of result.content) {
      if (part instanceof vscode.LanguageModelTextPart) {
        resultText += part.value
      }
    }
    
    return resultText
  }

  /**
   * Parse LLM response into DevelopmentPlan structure
   */
  private parsePlanFromResponse(response: string, originalRequest: string): DevelopmentPlan {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const now = new Date().toISOString()

    // Simple parsing - extract sections from markdown response
    // In production, you might want more sophisticated parsing or ask LLM to return JSON
    
    return {
      id: planId,
      title: this.extractTitle(response, originalRequest),
      goal: originalRequest,
      context: {
        filesAnalyzed: this.extractFilesAnalyzed(response),
        patternsFound: [],
        dependencies: [],
        assumptions: []
      },
      steps: this.extractSteps(response),
      clarifications: [],
      risks: this.extractRisks(response),
      successCriteria: this.extractSuccessCriteria(response),
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      version: 1
    }
  }

  private extractTitle(response: string, fallback: string): string {
    const titleRegex = /^#\s+(.+)$/m
    const titleMatch = titleRegex.exec(response)
    if (titleMatch) return titleMatch[1].replace(/^Development Plan:\s*/i, '').trim()
    return fallback.substring(0, 100)
  }

  private extractFilesAnalyzed(response: string): string[] {
    const files: string[] = []
    const fileMatches = response.matchAll(/`([^`]+\.(ts|js|tsx|jsx|json|md|yaml|yml))`/g)
    for (const match of fileMatches) {
      if (!files.includes(match[1])) {
        files.push(match[1])
      }
    }
    return files
  }

  private extractSteps(response: string): Array<{
    id: string
    title: string
    description: string
    file?: string
    lineStart?: number
    lineEnd?: number
    dependencies: string[]
    validation: string
    rationale: string
    status: 'pending' | 'clarifying' | 'ready' | 'completed'
  }> {
    const steps: Array<{
      id: string
      title: string
      description: string
      file?: string
      dependencies: string[]
      validation: string
      rationale: string
      status: 'pending' | 'clarifying' | 'ready' | 'completed'
    }> = []
    
    // Match numbered steps - simplified regex
    const stepRegex = /(\d+)\.\s+\*\*([^*]+)\*\*/g
    const stepMatches = response.matchAll(stepRegex)
    
    for (const match of stepMatches) {
      const stepNum = match[1]
      const title = match[2].trim()
      
      // Extract description after the title
      const matchIndex = match.index ?? 0
      const afterTitle = response.substring(matchIndex + match[0].length)
      const nextStepIdx = afterTitle.search(/\n\d+\.\s+\*\*/)
      const description = nextStepIdx > 0 
        ? afterTitle.substring(0, nextStepIdx).trim()
        : afterTitle.substring(0, 200).trim()
      
      steps.push({
        id: `step-${stepNum}`,
        title,
        description,
        dependencies: [],
        validation: 'Manual review required',
        rationale: '',
        status: 'pending'
      })
    }
    
    return steps
  }

  private extractRisks(response: string): Array<{
    id: string
    description: string
    severity: 'low' | 'medium' | 'high'
    mitigation: string
  }> {
    const risks: Array<{
      id: string
      description: string
      severity: 'low' | 'medium' | 'high'
      mitigation: string
    }> = []
    
    const riskRegex = /###\s+(?:⚠️\s*)?Risks?\s*&?\s*Considerations?([^#]*)/i
    const riskSection = riskRegex.exec(response)
    if (riskSection) {
      const riskItems = riskSection[1].matchAll(/[-*]\s+([^\n]+)/g)
      let riskId = 1
      for (const match of riskItems) {
        risks.push({
          id: `risk-${riskId++}`,
          description: match[1].trim(),
          severity: 'medium',
          mitigation: 'To be determined'
        })
      }
    }
    
    return risks
  }

  private extractSuccessCriteria(response: string): string[] {
    const criteria: string[] = []
    
    const criteriaRegex = /###\s+(?:✅\s*)?Success\s+Criteria([^#]*)/i
    const criteriaSection = criteriaRegex.exec(response)
    if (criteriaSection) {
      const criteriaItems = criteriaSection[1].matchAll(/[-*]\s+([^\n]+)/g)
      for (const match of criteriaItems) {
        criteria.push(match[1].trim())
      }
    }
    
    return criteria
  }

  private parseCriticFeedback(criticResponse: string): CriticFeedback[] {
    const feedback: CriticFeedback[] = []
    
    // Look for patterns like "CRITICAL:", "WARNING:", "INFO:"
    const criticalMatches = criticResponse.matchAll(/(?:❌|CRITICAL):\s*([^\n]+)/gi)
    for (const match of criticalMatches) {
      feedback.push({
        issue: match[1].trim(),
        severity: 'critical',
        suggestion: '',
        requiresClarification: true
      })
    }
    
    const warningMatches = criticResponse.matchAll(/(?:⚠️|WARNING):\s*([^\n]+)/gi)
    for (const match of warningMatches) {
      feedback.push({
        issue: match[1].trim(),
        severity: 'warning',
        suggestion: '',
        requiresClarification: false
      })
    }
    
    return feedback
  }
}
