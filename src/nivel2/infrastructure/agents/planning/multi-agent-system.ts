import * as vscode from 'vscode'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph-checkpoint'
import type { DevelopmentPlan, CriticFeedback, AgentMessage } from './types'
import { PlanPersistence } from './plan-persistence'

/**
 * State definition for multi-agent planning system
 * 
 * This state grows through iterations, transforming vague requirements
 * into a complete, executable project scope
 */
const PlanningStateAnnotation = Annotation.Root({
  // Current development plan (the growing scope document)
  plan: Annotation<DevelopmentPlan | null>({
    reducer: (_, right) => right,
    default: () => null
  }),
  
  // Agent conversation history
  messages: Annotation<AgentMessage[]>({
    reducer: (left, right) => left.concat(Array.isArray(right) ? right : [right]),
    default: () => []
  }),
  
  // Critical feedback from critic agent
  criticFeedback: Annotation<CriticFeedback[]>({
    reducer: (_, right) => right,
    default: () => []
  }),
  
  // Current question awaiting user response
  currentClarification: Annotation<string | null>({
    reducer: (_, right) => right,
    default: () => null
  }),
  
  // Original user request
  userInput: Annotation<string>({
    reducer: (_, right) => right,
    default: () => ''
  }),
  
  // User's answer to clarification question
  userAnswer: Annotation<string | null>({
    reducer: (_, right) => right,
    default: () => null
  }),
  
  // Maturity score (0-100) calculated by router
  maturityScore: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0
  }),
  
  // Next workflow step
  nextStep: Annotation<'plan' | 'critic' | 'clarify' | 'end'>({
    reducer: (_, right) => right,
    default: () => 'plan'
  }),
  
  // Iteration counter to prevent infinite loops
  iterationCount: Annotation<number>({
    reducer: (left, right) => right ?? left + 1,
    default: () => 0
  })
})

/**
 * Multi-agent planning system using LangGraph
 * 
 * PURPOSE: Transform vague requirements into executable project specifications
 * 
 * This system acts as an automated Project Analyst that:
 * 1. Takes minimal user input ("breadcrumbs")
 * 2. Generates comprehensive project scope through multi-agent collaboration
 * 3. Produces "idiot-proof" specifications ready for code generation
 * 
 * WORKFLOW (Iterative Refinement):
 * 
 *   START → Planning Agent → Critic Agent → Router → [next action]
 *                              ↓              ↓
 *                         Feedback      Maturity Check
 *                                            ↓
 *                      ┌──────────────────────┴───────────────────────┐
 *                      ↓                      ↓                       ↓
 *              Clarification Agent    Planning Agent (refine)      END
 *                      ↓                      ↓                       ↓
 *                  Ask User           Update Plan              Ready Scope
 *                      ↓                                            
 *                  Get Answer → Planning Agent (incorporate)
 * 
 * AGENTS:
 * 
 * 1. Planning Agent (Skeleton Generator)
 *    - Decomposes vague requests into structured outline
 *    - Identifies system parts, dependencies, assumptions
 *    - Flags uncertainties
 * 
 * 2. Critic Agent (Technical Reviewer)
 *    - Reviews like a senior architect
 *    - Detects scope gaps, implicit assumptions, missing dependencies
 *    - Identifies risks and inconsistencies
 * 
 * 3. Clarification Agent (Requirements Analyst)
 *    - Asks ONE specific, actionable question at a time
 *    - Converts uncertainties into solid information
 *    - Examples: "JWT or session auth?", "Multi-tenant?", "Which database?"
 * 
 * 4. Router (Maturity Supervisor)
 *    - Calculates maturity score (0-100)
 *    - Decides: clarify | critic | plan | end
 *    - Ensures scope is complete before marking ready
 * 
 * RESULT:
 * 
 * A complete DevelopmentPlan with:
 * - Context & Problem definition
 * - Functional & Non-functional requirements
 * - System components & architecture
 * - User flows
 * - Technical decisions
 * - Questions answered
 * - Assumptions documented
 * - Risks identified
 * - Atomic tasks ready for execution
 * 
 * This output is comprehensive enough for a simple LLM to:
 * - Generate complete code
 * - Create database schemas
 * - Build APIs
 * - Design UIs
 * - Write tests
 */
export class MultiAgentPlanningSystem {
  private readonly checkpointer = new MemorySaver()
  private model: vscode.LanguageModelChat | null = null
  private initialized = false
  private progressCallback?: (message: string) => void

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    })

    if (!models.length) {
      throw new Error('No suitable language model found')
    }

    this.model = models[0]
    this.initialized = true
  }

  /**
   * Set progress callback for UI updates
   */
  setProgressCallback(callback: (message: string) => void): void {
    this.progressCallback = callback
  }

  private logProgress(message: string): void {
    console.log(message)
    this.progressCallback?.(message)
  }

  /**
   * Simplified run method for compatibility
   * TODO: Implement full graph-based workflow
   */
  async runTurn(params: {
    prompt: string
    sessionId: string
    onToken?: (chunk: string) => void
  }): Promise<string> {
    if (!this.model) {
      await this.initialize()
    }

    console.log(`[MultiAgentPlanningSystem] Processing: ${params.prompt}`)
    
    const response = `# Development Plan

## Goal
${params.prompt}

## Status
Multi-agent planning system initialized. This is a simplified response until the full LangGraph workflow is implemented.

## Next Steps
1. Use the planning commands (cappy.planning.newPlan) for full functionality
2. The system will create detailed plans with context analysis
3. Critic and clarification agents will refine the plan

## Implementation Note
This response is generated by MultiAgentPlanningSystem - your single source of truth for planning.
The full graph-based workflow with planning → critic → clarification cycle is available via commands.
`

    // Simulate token streaming
    if (params.onToken) {
      const words = response.split(' ')
      for (const word of words) {
        params.onToken(word + ' ')
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    return response
  }

  /**
   * Creates the LangGraph workflow (skeleton for future implementation)
   * This method is not currently used but serves as documentation for
   * a potential full LangGraph implementation
   */
  createGraph() {
    const graph = new StateGraph(PlanningStateAnnotation)
      // Planning node - creates initial plan
      .addNode('planning', this.planningNode.bind(this))
      
      // Critic node - reviews plan and identifies gaps
      .addNode('critic', this.criticNode.bind(this))
      
      // Clarification node - asks ONE question to user
      .addNode('clarification', this.clarificationNode.bind(this))
      
      // Router - decides next step
      .addNode('router', this.routerNode.bind(this))

    // Define edges
    graph
      .addEdge(START, 'planning')
      .addEdge('planning', 'critic')
      .addEdge('critic', 'router')
      .addConditionalEdges(
        'router',
        (state) => state.nextStep,
        {
          clarify: 'clarification',
          critic: 'critic',
          plan: 'planning',
          end: END
        }
      )
      .addEdge('clarification', 'critic')

    return graph.compile({ checkpointer: this.checkpointer })
  }

  /**
   * Planning Agent - Skeleton Generator
   * 
   * Role: Transform vague ideas into structured project outline
   * Focus: Decomposition, structure, and uncertainty identification
   * 
   * This agent creates the initial draft of the plan with:
   * - Minimal parts of the system
   * - Dependencies between parts
   * - Explicit assumptions being made
   * - Areas with high uncertainty
   */
  private async planningNode(state: typeof PlanningStateAnnotation.State) {
    if (!this.model) {
      await this.initialize()
    }

    this.logProgress(`📋 Planning Agent (Iteração ${state.iterationCount + 1}/3)`)
    console.log('[PlanningAgent] ========================================')
    console.log('[PlanningAgent] Generating project skeleton...')
    console.log('[PlanningAgent] User input:', state.userInput)
    console.log('[PlanningAgent] Is update:', state.plan !== null)
    console.log('[PlanningAgent] ========================================')

    const isUpdate = state.plan !== null
    const previousAnswers = state.userAnswer ? `\n\nUser clarification: ${state.userAnswer}` : ''

    const systemPrompt = `You are a PROJECT SKELETON GENERATOR - an expert at transforming vague requirements into structured outlines.

<YOUR_ROLE>
Transform the user's request into a DRAFT project scope by:
1. Breaking down the request into minimal system parts
2. Identifying what depends on what
3. Enumerating explicit assumptions you're making
4. Flagging areas where you're uncertain
</YOUR_ROLE>

<USER_REQUEST>
${state.userInput}${previousAnswers}
</USER_REQUEST>

<EXISTING_PLAN>
${isUpdate && state.plan ? JSON.stringify(state.plan, null, 2) : 'None - creating from scratch'}
</EXISTING_PLAN>

<YOUR_TASK>
${isUpdate ? 'UPDATE the existing plan incorporating new information' : 'CREATE an initial project skeleton'}

Generate a structured scope covering:

1. **Context & Problem**
   - What problem are we solving?
   - Who are the target users?
   - What's the business objective?

2. **Functional Requirements** (what must it do?)
   - List 3-7 core features
   - User stories when applicable
   - Acceptance criteria

3. **System Components** (building blocks)
   - Services, modules, databases, APIs, UIs
   - What each component is responsible for
   - Dependencies between components

4. **Technical Decisions** (choices to make)
   - Database choice
   - Authentication approach
   - API design
   - Technology stack

5. **Assumptions** (what you're assuming)
   - Mark which assumptions are CRITICAL
   - Flag assumptions that need validation

6. **Uncertainties** (what you don't know)
   - List areas where information is missing
   - Questions that need answering

Output as structured JSON matching the DevelopmentPlan interface.
</YOUR_TASK>

<CRITICAL_RULES>
- DON'T invent details - FLAG uncertainties instead
- DO decompose into small, clear parts
- DO make dependencies explicit
- DO enumerate ALL assumptions
- Focus on STRUCTURE over implementation details
</CRITICAL_RULES>`

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(systemPrompt)
    ]

    console.log('[PlanningAgent] Sending request to LLM...')
    const response = await this.model!.sendRequest(messages, {
      justification: 'Generating project skeleton'
    })
    console.log('[PlanningAgent] LLM response received, streaming...')

    let planText = ''
    let chunkCount = 0
    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        planText += part.value
        chunkCount++
        if (chunkCount % 10 === 0) {
          console.log(`[PlanningAgent] Received ${chunkCount} chunks, ${planText.length} chars so far`)
        }
      }
    }
    console.log(`[PlanningAgent] Streaming complete! Total: ${chunkCount} chunks, ${planText.length} chars`)

    // Create or update plan structure
    const plan: DevelopmentPlan = state.plan || {
      id: `plan-${Date.now()}`,
      title: state.userInput.substring(0, 100),
      context: {
        problem: state.userInput,
        objective: '',
        filesAnalyzed: [],
        patternsFound: [],
        externalDependencies: []
      },
      functionalRequirements: [],
      nonFunctionalRequirements: [],
      components: [],
      userFlows: [],
      decisions: [],
      questions: [],
      assumptions: [],
      glossary: [],
      risks: [],
      atomicTasks: [],
      successCriteria: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      version: 1
    }

    // Try to hydrate plan with the structured response from the LLM
    const parsedPlan = this.parsePlanResponse(planText)
    if (parsedPlan) {
      this.mergePlanData(plan, parsedPlan)
    } else {
      console.warn('[PlanningAgent] Unable to parse plan JSON; keeping fallback skeleton')
    }

    // Update timestamp and version
    plan.updatedAt = new Date().toISOString()
    if (isUpdate) {
      plan.version++
    }

    // Save plan
    await PlanPersistence.savePlan(plan)

    return {
      ...state,
      plan,
      userAnswer: null, // Clear the answer after processing
      messages: [
        ...state.messages,
        {
          role: 'planning' as const,
          content: planText,
          planUpdate: plan,
          timestamp: new Date().toISOString()
        }
      ]
    }
  }

  /**
   * Critic Agent - Technical Requirements Reviewer
   * 
   * Role: Review the plan like a senior architect would
   * Focus: Completeness, consistency, risk detection
   * 
   * This agent adds technical depth by detecting:
   * - Scope gaps (missing requirements/components)
   * - Implicit assumptions (things assumed but not stated)
   * - Missing dependencies (components that depend on undefined parts)
   * - Inconsistencies (conflicting requirements/decisions)
   * - Technical risks (scalability, security, performance issues)
   */
  private async criticNode(state: typeof PlanningStateAnnotation.State) {
    if (!this.model) {
      await this.initialize()
    }

    this.logProgress(`⚖️ Critic Agent revisando (Iteração ${state.iterationCount + 1}/3)`)
    console.log('[CriticAgent] Performing technical review...')

    if (!state.plan) {
      return state
    }

    const systemPrompt = `You are a SENIOR TECHNICAL REVIEWER - an expert architect reviewing project scopes.

<YOUR_ROLE>
Review this project plan with the critical eye of a senior engineer who has seen projects fail due to:
- Incomplete requirements
- Hidden assumptions
- Missing dependencies
- Scope ambiguities
- Technical risks
</YOUR_ROLE>

<PLAN_TO_REVIEW>
${JSON.stringify(state.plan, null, 2)}
</PLAN_TO_REVIEW>

<REVIEW_CHECKLIST>

1. **Scope Gaps** - What's missing?
   - Are all functional requirements testable?
   - Are non-functional requirements defined (performance, security, scalability)?
   - Are edge cases considered?
   - Is error handling specified?

2. **Implicit Assumptions** - What's assumed but not stated?
   - Authentication/authorization approach?
   - Data validation rules?
   - Transaction boundaries?
   - Caching strategy?
   - API versioning?

3. **Missing Dependencies** - What's needed but not defined?
   - External services/APIs
   - Third-party libraries
   - Database schemas
   - Infrastructure requirements
   - Development tools

4. **Inconsistencies** - What conflicts?
   - Do components have circular dependencies?
   - Do requirements contradict each other?
   - Are technical decisions aligned with requirements?
   - Do user flows match the defined components?

5. **Technical Risks** - What could go wrong?
   - Performance bottlenecks
   - Security vulnerabilities
   - Scalability limits
   - Data loss scenarios
   - Integration failures

</REVIEW_CHECKLIST>

<OUTPUT_FORMAT>
For each issue found, provide:

**Category**: [scope-gap | implicit-assumption | missing-dependency | inconsistency | risk]
**Severity**: [info | warning | critical]
**Target**: [affected component/requirement ID]
**Issue**: Clear description of the problem
**Suggestion**: Specific, actionable improvement
**Requires Clarification**: [true/false] - does this need user input?
**Impact**: What happens if this isn't addressed?

Example:
{
  "category": "implicit-assumption",
  "severity": "critical",
  "target": "auth-component",
  "issue": "Authentication method is not specified",
  "suggestion": "Define authentication approach: JWT, session-based, OAuth2, or other",
  "requiresClarification": true,
  "impact": "Cannot design API security layer without knowing auth method"
}
</OUTPUT_FORMAT>

<CRITICAL_RULES>
- Be SPECIFIC, not vague ("add more details" is useless)
- Suggest CONCRETE improvements
- Focus on what MUST be defined, not nice-to-haves
- Flag items that REQUIRE user clarification vs. can be decided later
- Prioritize CRITICAL issues over minor improvements
</CRITICAL_RULES>`

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(systemPrompt)
    ]

    const response = await this.model!.sendRequest(messages, {
      justification: 'Performing technical review of plan'
    })

    let feedbackText = ''
    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        feedbackText += part.value
      }
    }

    // Parse feedback (improved parsing)
    const feedback: CriticFeedback[] = []
    
    // Try to parse as JSON array first
    try {
      const jsonMatch = new RegExp(/\[[\s\S]*\]/).exec(feedbackText);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        feedback.push(...parsed)
      }
    } catch {
      // Fallback: parse text patterns
      const patterns = {
        critical: /CRITICAL:\s*(.+?)(?=\n|$)/gi,
        warning: /WARNING:\s*(.+?)(?=\n|$)/gi,
        info: /INFO:\s*(.+?)(?=\n|$)/gi
      }

      for (const [severity, pattern] of Object.entries(patterns)) {
        const matches = feedbackText.matchAll(pattern)
        for (const match of matches) {
          feedback.push({
            category: 'scope-gap',
            issue: match[1].trim(),
            severity: severity as 'info' | 'warning' | 'critical',
            suggestion: '',
            requiresClarification: severity === 'critical'
          })
        }
      }
    }

    return {
      ...state,
      criticFeedback: feedback,
      messages: [
        ...state.messages,
        {
          role: 'critic' as const,
          content: feedbackText,
          feedback,
          timestamp: new Date().toISOString()
        }
      ]
    }
  }

  /**
   * Clarification Agent - Requirements Analyst
   * 
   * Role: Convert uncertainties into solid information
   * Focus: Asking highly specific, actionable questions
   * 
   * This agent creates questions that are:
   * - SPECIFIC (not "tell me more")
   * - ACTIONABLE (answers lead to concrete decisions)
   * - FOCUSED (one clear topic at a time)
   * 
   * Examples of good questions:
   * - "Should this API endpoint be public or require authentication?"
   * - "Do you plan to support multi-tenant architecture?"
   * - "Can users edit a resource after creation, or is it immutable?"
   * - "Which database: PostgreSQL, MySQL, MongoDB, or other?"
   */
  private async clarificationNode(state: typeof PlanningStateAnnotation.State) {
    if (!this.model) {
      await this.initialize()
    }

    console.log('[ClarificationAgent] Formulating specific question...')

    if (!state.criticFeedback.length) {
      return state
    }

    // Find the most critical item that requires clarification
    const criticalItems = state.criticFeedback
      .filter(f => f.requiresClarification && f.severity === 'critical')
      .sort((a, b) => {
        // Prioritize by category importance
        const priority: Record<string, number> = {
          'scope-gap': 1,
          'implicit-assumption': 2,
          'missing-dependency': 3,
          'inconsistency': 4,
          'risk': 5
        }
        return (priority[a.category] || 99) - (priority[b.category] || 99)
      })

    if (!criticalItems.length) {
      return state
    }

    const criticalItem = criticalItems[0]

    const systemPrompt = `You are a REQUIREMENTS ANALYST specializing in asking precise, actionable questions.

<YOUR_ROLE>
Transform a vague issue into ONE highly specific question that:
1. Can be answered with concrete information
2. Leads to an actionable decision
3. Eliminates the uncertainty completely
</YOUR_ROLE>

<CRITICAL_ISSUE>
Category: ${criticalItem.category}
Issue: ${criticalItem.issue}
Suggestion: ${criticalItem.suggestion}
Impact: ${criticalItem.impact || 'Not specified'}
</CRITICAL_ISSUE>

<CURRENT_PLAN_CONTEXT>
${JSON.stringify(state.plan, null, 2)}
</CURRENT_PLAN_CONTEXT>

<YOUR_TASK>
Create ONE specific question that will resolve this issue.

BAD question examples (too vague):
- "Can you provide more details?"
- "What did you have in mind?"
- "Tell me about the architecture"

GOOD question examples (specific and actionable):
- "Should the authentication use JWT tokens or session cookies?"
- "Do you need to support multiple databases (multi-tenant), or a single shared database?"
- "Should users be able to delete their own posts, or only admins?"
- "Which payment gateway: Stripe, PayPal, or custom?"

Return ONLY the question text, nothing else.
</YOUR_TASK>

<CRITICAL_RULES>
- Ask about ONE thing only
- Make it answerable with specific information
- Avoid compound questions (no "and" or "or" unless presenting clear options)
- Include context from the plan when relevant
- Frame as a choice when possible (A, B, C, or other?)
</CRITICAL_RULES>`

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(systemPrompt)
    ]

    const response = await this.model!.sendRequest(messages, {
      justification: 'Formulating clarification question'
    })

    let question = ''
    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        question += part.value
      }
    }

    question = question.trim()

    // Add context about what this resolves
    const contextualQuestion = `**Clarification Needed** (${criticalItem.category})

${question}

_This will help resolve: ${criticalItem.issue}_`

    return {
      ...state,
      currentClarification: contextualQuestion,
      messages: [
        ...state.messages,
        {
          role: 'clarification' as const,
          content: contextualQuestion,
          timestamp: new Date().toISOString()
        }
      ]
    }
  }

  /**
   * Router - Maturity Supervisor
   * 
   * Role: Measure plan completeness and decide next action
   * Focus: Is the scope ready for implementation?
   * 
   * This node calculates a maturity score (0-100) based on:
   * - Completeness of requirements
   * - Quality of component definitions
   * - Clarity of decisions
   * - Number of unresolved issues
   * - Risk assessment coverage
   * 
   * Routing decisions:
   * - clarify: Critical uncertainties need user input
   * - critic: Plan needs another review round
   * - plan: Significant changes needed, regenerate
   * - end: Plan is mature and ready
   */
  private async routerNode(state: typeof PlanningStateAnnotation.State) {
    this.logProgress(`🧭 Router avaliando maturidade (Score: ${state.maturityScore}/100)`)
    console.log('[Router] Evaluating plan maturity...')
    console.log(`[Router] Iteration count: ${state.iterationCount}`)

    if (!state.plan) {
      return {
        ...state,
        nextStep: 'end' as const
      }
    }

    // SAFETY: Prevent infinite loops - max 3 iterations
    if (state.iterationCount >= 3) {
      console.log('[Router] → END (max iterations reached)')
      state.plan.status = 'ready'
      state.plan.updatedAt = new Date().toISOString()
      await PlanPersistence.updatePlan(state.plan.id, state.plan)
      
      return {
        ...state,
        nextStep: 'end' as const,
        maturityScore: state.maturityScore
      }
    }

    // Calculate maturity score
    let maturityScore = 0
    const plan = state.plan

    // 1. Context completeness (0-20 points)
    if (plan.context.problem) maturityScore += 5
    if (plan.context.objective) maturityScore += 5
    if (plan.context.filesAnalyzed.length > 0) maturityScore += 5
    if (plan.context.externalDependencies.length > 0) maturityScore += 5

    // 2. Requirements definition (0-25 points)
    if (plan.functionalRequirements.length >= 3) maturityScore += 10
    if (plan.nonFunctionalRequirements.length >= 2) maturityScore += 10
    if (plan.functionalRequirements.some(r => r.acceptanceCriteria.length > 0)) maturityScore += 5

    // 3. Architecture clarity (0-20 points)
    if (plan.components.length >= 2) maturityScore += 10
    if (plan.proposedArchitecture) maturityScore += 5
    if (plan.userFlows.length > 0) maturityScore += 5

    // 4. Decision quality (0-15 points)
    if (plan.decisions.length >= 2) maturityScore += 10
    if (plan.decisions.some(d => d.status === 'approved')) maturityScore += 5

    // 5. Risk awareness (0-10 points)
    if (plan.risks.length >= 2) maturityScore += 5
    if (plan.risks.some(r => r.mitigation)) maturityScore += 5

    // 6. Execution readiness (0-10 points)
    if (plan.atomicTasks.length >= 3) maturityScore += 5
    if (plan.successCriteria.length >= 2) maturityScore += 5

    // Update state with maturity score
    plan.maturityScore = maturityScore
    state.maturityScore = maturityScore

    console.log(`[Router] Maturity score: ${maturityScore}/100`)

    // Count critical issues
    const criticalIssues = state.criticFeedback.filter(f => 
      f.severity === 'critical' && f.requiresClarification
    ).length

    const hasWarnings = state.criticFeedback.some(f => f.severity === 'warning')
    const hasInfos = state.criticFeedback.some(f => f.severity === 'info')

    // Routing logic based on maturity and feedback
    
    // If there are critical issues requiring user input
    if (criticalIssues > 0 && !state.currentClarification) {
      console.log(`[Router] → CLARIFY (${criticalIssues} critical issues need user input)`)
      return {
        ...state,
        nextStep: 'clarify' as const,
        maturityScore,
        iterationCount: state.iterationCount + 1
      }
    }

    // If user just answered, incorporate answer and re-plan
    if (state.currentClarification && state.userAnswer) {
      console.log('[Router] → PLAN (incorporating user answer)')
      return {
        ...state,
        nextStep: 'plan' as const,
        currentClarification: null,
        maturityScore,
        iterationCount: state.iterationCount + 1
      }
    }

    // If maturity is low, need more planning
    if (maturityScore < 50 && !criticalIssues) {
      console.log(`[Router] → PLAN (maturity too low: ${maturityScore}/100)`)
      this.logProgress(`🔄 Refinando plano (Score: ${maturityScore}/100)`)
      return {
        ...state,
        nextStep: 'plan' as const,
        maturityScore,
        iterationCount: state.iterationCount + 1
      }
    }

    // If there are warnings or infos, run another critic round
    if ((hasWarnings || hasInfos) && maturityScore < 80) {
      console.log('[Router] → CRITIC (has warnings, needs refinement)')
      this.logProgress(`🔍 Revisão adicional necessária (Score: ${maturityScore}/100)`)
      return {
        ...state,
        nextStep: 'critic' as const,
        maturityScore,
        iterationCount: state.iterationCount + 1
      }
    }

    // Plan is mature enough!
    if (maturityScore >= 70) {
      console.log(`[Router] → END (plan is mature: ${maturityScore}/100)`)
      this.logProgress(`✅ Plano completo! (Score: ${maturityScore}/100)`)
      plan.status = 'ready'
      plan.updatedAt = new Date().toISOString()
      await PlanPersistence.updatePlan(plan.id, plan)

      return {
        ...state,
        nextStep: 'end' as const,
        maturityScore
      }
    }

    // Default: continue refining
    console.log('[Router] → CRITIC (default: continue refining)')
    return {
      ...state,
      nextStep: 'critic' as const,
      maturityScore
    }
  }

  private parsePlanResponse(raw: string): Partial<DevelopmentPlan> | null {
    const payload = this.extractJsonPayload(raw)
    if (!payload) {
      return null
    }

    try {
      return JSON.parse(payload)
    } catch (error) {
      console.warn('[PlanningAgent] Failed to parse structured plan response', error)
      return null
    }
  }

  private extractJsonPayload(raw: string): string | null {
    const blockRegex = /```json([\s\S]*?)```/i
    const blockMatch = blockRegex.exec(raw)
    if (blockMatch) {
      return blockMatch[1].trim()
    }

    const firstBrace = raw.indexOf('{')
    const lastBrace = raw.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return raw.slice(firstBrace, lastBrace + 1).trim()
    }

    return null
  }

  private mergePlanData(plan: DevelopmentPlan, partial: Partial<DevelopmentPlan>): void {
    if (partial.title) {
      plan.title = partial.title
    }

    if (partial.context) {
      plan.context = {
        ...plan.context,
        ...partial.context,
        filesAnalyzed: partial.context.filesAnalyzed ?? plan.context.filesAnalyzed,
        patternsFound: partial.context.patternsFound ?? plan.context.patternsFound,
        externalDependencies: partial.context.externalDependencies ?? plan.context.externalDependencies
      }
    }

    const arrayFields: Array<keyof Pick<DevelopmentPlan,
      'functionalRequirements' |
      'nonFunctionalRequirements' |
      'components' |
      'userFlows' |
      'decisions' |
      'questions' |
      'assumptions' |
      'glossary' |
      'risks' |
      'atomicTasks' |
      'successCriteria'
    >> = [
      'functionalRequirements',
      'nonFunctionalRequirements',
      'components',
      'userFlows',
      'decisions',
      'questions',
      'assumptions',
      'glossary',
      'risks',
      'atomicTasks',
      'successCriteria'
    ]

    for (const field of arrayFields) {
      const incoming = partial[field]
      if (Array.isArray(incoming) && incoming.length) {
        ;(plan[field] as unknown) = incoming
      }
    }

    if (partial.proposedArchitecture) {
      plan.proposedArchitecture = partial.proposedArchitecture
    }

    if (partial.status) {
      plan.status = partial.status
    }
  }
}
