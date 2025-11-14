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
   * Creates the LangGraph workflow
   */
  private createGraph() {
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

    // TODO: Implement planning logic with tools
    // - Use cappy_retrieve_context
    // - Use grep_search
    // - Create initial plan structure

    return state
  }

  /**
   * Critic Node - Reviews plan and provides feedback
   */
  private async criticNode(state: typeof PlanningStateAnnotation.State) {
    if (!this.model) {
      await this.initialize()
    }

    console.log('[CriticAgent] Reviewing plan...')

    // TODO: Implement critic logic
    // - Analyze plan steps
    // - Identify missing information
    // - Check for ambiguities
    // - Generate feedback

    return state
  }

  /**
   * Clarification Node - Asks ONE question to user
   */
  private async clarificationNode(state: typeof PlanningStateAnnotation.State) {
    if (!this.model) {
      await this.initialize()
    }

    console.log('[ClarificationAgent] Preparing question...')

    // TODO: Implement clarification logic
    // - Based on critic feedback
    // - Ask ONE specific question
    // - Wait for user response
    // - Update plan with answer

    return state
  }

  /**
   * Router Node - Decides next step
   */
  private async routerNode(state: typeof PlanningStateAnnotation.State) {
    // TODO: Implement routing logic
    // - If plan is complete → 'end'
    // - If needs clarification → 'clarify'
    // - If needs revision → 'critic'
    // - If needs more context → 'plan'

    return {
      ...state,
      nextStep: 'end' as const
    }
  }
}
