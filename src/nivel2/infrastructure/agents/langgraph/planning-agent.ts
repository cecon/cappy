import * as vscode from 'vscode'
import { Annotation, END, START, StateGraph, type AnnotationRoot } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph-checkpoint'
import type { RunnableConfig } from '@langchain/core/runnables'
import type { DevelopmentPlan, CriticFeedback } from '../planning/types'
import { PlanPersistence } from '../planning/plan-persistence'

interface ChatMemoryMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

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

const ChatStateDefinition: AnnotationRoot<{
  messages: ReturnType<typeof Annotation<ChatMemoryMessage[]>>
}> = Annotation.Root({
  messages: Annotation<ChatMemoryMessage[]>({
    reducer: (left: ChatMemoryMessage[], right: ChatMemoryMessage | ChatMemoryMessage[]) => {
      if (!right) {
        return left
      }

      if (Array.isArray(right)) {
        if (right.length === 0) {
          return left
        }
        return left.concat(right)
      }

      return left.concat([right])
    },
    default: () => []
  })
})

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
  private readonly checkpointer = new MemorySaver()
  private readonly graph = this.createGraph()
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
    if (!this.initialized || !this.model) {
      await this.initialize()
    }

    if (!this.model) {
      throw new Error('Language model not available')
    }

    const { prompt, sessionId, token, onToken } = params
    const abortController = new AbortController()

    if (token) {
      token.onCancellationRequested(() => {
        abortController.abort()
      })
    }

    const config: RunnableConfig = {
      configurable: { thread_id: sessionId },
      signal: abortController.signal
    }

    // Get or create internal state for this session
    const internalState = this.getOrCreateState(sessionId)

    const updatedState = await this.graph.invoke(
      { messages: [{ role: 'user', content: prompt }] },
      config
    )

    const history = updatedState.messages ?? []
    
    // Multi-agent orchestration happens here
    const assistantResponse = await this.orchestrateAgents(
      history, 
      internalState, 
      sessionId,
      token, 
      onToken
    )

    if (assistantResponse) {
      await this.graph.invoke(
        { messages: [{ role: 'assistant', content: assistantResponse }] },
        config
      )
    }

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
    history: ReadonlyArray<ChatMemoryMessage>,
    state: InternalAgentState,
    sessionId: string,
    token?: vscode.CancellationToken,
    onToken?: (chunk: string) => void
  ): Promise<string> {
    console.log(`[PlanningAgent] Phase: ${state.agentPhase}`)

    switch (state.agentPhase) {
      case 'planning':
        return await this.runPlanningPhase(history, state, sessionId, token, onToken)
      
      case 'critic':
        return await this.runCriticPhase(history, state, sessionId, token, onToken)
      
      case 'clarifying':
        return await this.runClarificationPhase(history, state, sessionId, token, onToken)
      
      case 'done':
        return await this.runCompletionPhase(state, token, onToken)
      
      default:
        return 'Unexpected state. Please try again.'
    }
  }

  private createGraph() {
    const graphBuilder = new StateGraph(ChatStateDefinition)
      .addNode('noop', async () => ({}))
      .addEdge(START, 'noop')
      .addEdge('noop', END)

    return graphBuilder.compile({
      checkpointer: this.checkpointer
    })
  }

  private async generateAssistantResponse(
    history: ReadonlyArray<ChatMemoryMessage>,
    token?: vscode.CancellationToken,
    onToken?: (chunk: string) => void
  ): Promise<string> {
    const messages = this.buildChatMessages(history)

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
    
    console.log(`[PlanningAgent] Planning tools available: ${planningTools.length}`)
    console.log(`[PlanningAgent] Tools: ${planningTools.map(t => t.name).join(', ')}`)

    const conversationMessages = [...messages]
    let finalTextResponse = ''
    const maxIterations = 10
    let iteration = 0

    // Tool execution loop
    while (iteration < maxIterations) {
      iteration++
      console.log(`[PlanningAgent] Planning iteration ${iteration}`)

      const response = await this.model!.sendRequest(
        conversationMessages,
        { 
          justification: 'Cappy Planning Agent - Context gathering and plan creation',
          tools: planningTools
        },
        cancellation.token
      )

      const { textContent, toolCalls } = await this.collectResponseParts(response, onToken)

      if (textContent.trim()) {
        finalTextResponse += textContent
      }

      if (toolCalls.length === 0) {
        console.log(`[PlanningAgent] No more context needed, plan complete`)
        break
      }

      console.log(`[PlanningAgent] Gathering context: ${toolCalls.length} tool call(s)`)
      
      const toolResults = await this.executeToolCalls(toolCalls, planningTools, cancellation.token)

      if (textContent.trim()) {
        conversationMessages.push(vscode.LanguageModelChatMessage.Assistant(textContent))
      }

      conversationMessages.push(...toolResults)
    }

    if (iteration >= maxIterations) {
      console.warn(`[PlanningAgent] Max planning iterations reached (${maxIterations})`)
      finalTextResponse += '\n\n_Note: Reached maximum context gathering iterations. Plan may need refinement._'
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

  private buildChatMessages(history: ReadonlyArray<ChatMemoryMessage>): vscode.LanguageModelChatMessage[] {
    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT)
    ]

    for (const item of history) {
      if (!item.content) {
        continue
      }

      if (item.role === 'user') {
        messages.push(vscode.LanguageModelChatMessage.User(item.content))
      } else {
        messages.push(vscode.LanguageModelChatMessage.Assistant(item.content))
      }
    }

    return messages
  }
}
