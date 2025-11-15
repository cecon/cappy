import * as vscode from 'vscode'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph-checkpoint'
import type { DevelopmentPlan, CriticFeedback, AgentMessage } from './types'
import { PlanPersistence } from './plan-persistence'

/**
 * State definition for multi-agent planning system
 */
const PlanningStateAnnotation = Annotation.Root({
  // Current plan being worked on
  plan: Annotation<DevelopmentPlan | null>({
    reducer: (_, right) => right,
    default: () => null
  }),
  
  // Messages between agents and user
  messages: Annotation<AgentMessage[]>({
    reducer: (left, right) => left.concat(Array.isArray(right) ? right : [right]),
    default: () => []
  }),
  
  // Feedback from critic agent
  criticFeedback: Annotation<CriticFeedback[]>({
    reducer: (_, right) => right,
    default: () => []
  }),
  
  // Current clarification being asked
  currentClarification: Annotation<string | null>({
    reducer: (_, right) => right,
    default: () => null
  }),
  
  // User input
  userInput: Annotation<string>({
    reducer: (_, right) => right,
    default: () => ''
  }),
  
  // Next step to execute
  nextStep: Annotation<'plan' | 'critic' | 'clarify' | 'end'>({
    reducer: (_, right) => right,
    default: () => 'plan'
  })
})

/**
 * Multi-agent planning system using LangGraph
 * 
 * Workflow:
 * 1. Planning Agent → Creates initial plan
 * 2. Critic Agent → Reviews and identifies gaps
 * 3. Clarification Agent → Asks ONE question to user
 * 4. Loop until plan is complete
 */
export class MultiAgentPlanningSystem {
  private readonly checkpointer = new MemorySaver()
  private model: vscode.LanguageModelChat | null = null
  private initialized = false

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
    console.log('[MultiAgentPlanningSystem] Initialized')
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
   * Planning Node - Creates or updates the development plan
   */
  private async planningNode(state: typeof PlanningStateAnnotation.State) {
    if (!this.model) {
      await this.initialize()
    }

    console.log('[PlanningAgent] Creating development plan...')

    const systemPrompt = `You are a planning agent. Create a comprehensive development plan.

User Request: ${state.userInput}

Use tools to gather context about:
- Existing files and patterns
- Dependencies and architecture
- Similar implementations

Return a detailed plan with steps, context, and success criteria.`

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(systemPrompt)
    ]

    const response = await this.model!.sendRequest(messages, {
      justification: 'Creating development plan'
    })

    let planText = ''
    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        planText += part.value
      }
    }

    // Create plan structure
    const plan: DevelopmentPlan = {
      id: `plan-${Date.now()}`,
      title: state.userInput.substring(0, 100),
      goal: state.userInput,
      context: {
        filesAnalyzed: [],
        patternsFound: [],
        dependencies: [],
        assumptions: []
      },
      steps: [],
      clarifications: [],
      risks: [],
      successCriteria: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      version: 1
    }

    // Save plan
    await PlanPersistence.savePlan(plan)

    return {
      ...state,
      plan,
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
   * Critic Node - Reviews plan and provides feedback
   */
  private async criticNode(state: typeof PlanningStateAnnotation.State) {
    if (!this.model) {
      await this.initialize()
    }

    console.log('[CriticAgent] Reviewing plan...')

    if (!state.plan) {
      return state
    }

    const systemPrompt = `You are a critic agent. Review the following plan and identify issues:

Plan:
${JSON.stringify(state.plan, null, 2)}

Identify:
1. Missing information
2. Ambiguous steps
3. Unclear requirements
4. Potential risks

Mark issues as CRITICAL, WARNING, or INFO.`

    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(systemPrompt)
    ]

    const response = await this.model!.sendRequest(messages, {
      justification: 'Reviewing development plan'
    })

    let feedbackText = ''
    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        feedbackText += part.value
      }
    }

    // Parse feedback
    const feedback: CriticFeedback[] = []
    const criticalMatches = feedbackText.matchAll(/CRITICAL:\s*([^\n]+)/gi)
    for (const match of criticalMatches) {
      feedback.push({
        issue: match[1].trim(),
        severity: 'critical',
        suggestion: '',
        requiresClarification: true
      })
    }

    return {
      ...state,
      criticFeedback: feedback,
      messages: [
        ...state.messages,
        {
          role: 'critic' as const,
          content: feedbackText,
          timestamp: new Date().toISOString()
        }
      ]
    }
  }

  /**
   * Clarification Node - Asks ONE question to user
   */
  private async clarificationNode(state: typeof PlanningStateAnnotation.State) {
    if (!this.model) {
      await this.initialize()
    }

    console.log('[ClarificationAgent] Preparing question...')

    if (!state.criticFeedback.length) {
      return state
    }

    const firstCritical = state.criticFeedback.find(f => f.severity === 'critical')
    if (!firstCritical) {
      return state
    }

    const question = `I need clarification about: ${firstCritical.issue}\n\nCould you please provide more details?`

    return {
      ...state,
      currentClarification: question,
      messages: [
        ...state.messages,
        {
          role: 'clarification' as const,
          content: question,
          timestamp: new Date().toISOString()
        }
      ]
    }
  }

  /**
   * Router Node - Decides next step
   */
  private async routerNode(state: typeof PlanningStateAnnotation.State) {
    // Routing logic
    const hasCriticalFeedback = state.criticFeedback.some(f => f.severity === 'critical')
    
    if (hasCriticalFeedback && !state.currentClarification) {
      // Need to ask clarification
      return {
        ...state,
        nextStep: 'clarify' as const
      }
    } else if (state.currentClarification && state.userInput) {
      // User answered, go back to critic
      return {
        ...state,
        nextStep: 'critic' as const,
        currentClarification: null
      }
    } else if (!hasCriticalFeedback && state.plan) {
      // Plan is good, we're done
      if (state.plan) {
        state.plan.status = 'ready'
        state.plan.updatedAt = new Date().toISOString()
        await PlanPersistence.updatePlan(state.plan.id, state.plan)
      }
      
      return {
        ...state,
        nextStep: 'end' as const
      }
    }

    // Default to end
    return {
      ...state,
      nextStep: 'end' as const
    }
  }
}
