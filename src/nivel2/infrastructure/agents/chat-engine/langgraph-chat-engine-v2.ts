import * as vscode from 'vscode'
import type { ChatAgentPort } from '../../../../domains/chat/ports/agent-port'
import type { Message } from '../../../../domains/chat/entities/message'
import type { AnalystState } from './types'
import { ANALYST_SYSTEM_PROMPT, PHASE_PROMPTS } from './prompts/system-prompts-v2'
import { PhaseOrchestrator } from './phases/phase-orchestrator'
import { detectGreeting, generateSessionId, shouldStopDueToMaxSteps } from './utils/conversation-utils'

const MAX_AGENT_STEPS = 15

/**
 * Refactored LangGraph Chat Engine with modular architecture
 * 
 * Features:
 * - Phase-based workflow (Intent → Context → Questions → Options → Spec)
 * - Modular design with separate handlers for each phase
 * - Improved error handling and JSON parsing
 * - Simple greeting detection
 * - Tool calling support for context retrieval
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

  // private waitForUserResponse(messageId: string): Promise<string> {
  //   return new Promise((resolve) => {
  //     this.promptResolvers.set(messageId, resolve)
  //   })
  // }

  async *processMessage(message: Message): AsyncIterable<string> {
    try {
      console.log(`[LangGraphChatEngine] Processing message: "${message.content}"`)
      
      // Check for simple greetings first
      const greetingInfo = detectGreeting(message.content)
      console.log(`[LangGraphChatEngine] Greeting detection result:`, greetingInfo)
      
      if (greetingInfo.isGreeting && greetingInfo.response) {
        console.log(`[LangGraphChatEngine] ✅ Greeting detected, sending response`)
        yield greetingInfo.response
        return
      }
      
      console.log(`[LangGraphChatEngine] ❌ Not a greeting, proceeding with full analysis`)
      
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

      // Initialize analyst state
      const sessionId = generateSessionId()
      const state: AnalystState = {
        userInput: message.content,
        questions: [],
        answers: [],
        options: [],
        currentPhase: 'intent',
        step: 0
      }

      this.stateMap.set(sessionId, state)
      console.log(`[Analyst] Session ${sessionId} started`)
      console.log(`[Analyst] Initial phase: ${state.currentPhase}`)

      // Main processing loop
      const messages = [
        vscode.LanguageModelChatMessage.User(ANALYST_SYSTEM_PROMPT),
        vscode.LanguageModelChatMessage.User(message.content)
      ]

      console.log('📨 Sending 2 messages to model')
      console.log('🛠️ Available Cappy tools: cappy_create_file, cappy_fetch_web, cappy_retrieve_context')

      let textAccumulator = ''
      let hasGeneratedUserResponse = false

      for (let step = 1; step <= MAX_AGENT_STEPS; step++) {
        if (shouldStopDueToMaxSteps(step, MAX_AGENT_STEPS)) {
          break
        }

        state.step = step
        console.log(`[Analyst] Phase: ${state.currentPhase}, Step: ${step}/${MAX_AGENT_STEPS}`)
        
        // Stop if we already generated a response for unclear requests
        if (hasGeneratedUserResponse && state.intent && state.intent.clarityScore < 0.5) {
          console.log('[Analyst] Already responded to unclear request, stopping')
          break
        }

        // Add phase-specific prompt
        const phasePrompt = this.getPhasePrompt(state)
        if (phasePrompt) {
          messages.push(vscode.LanguageModelChatMessage.User(phasePrompt))
          console.log(`[Analyst] Added phase prompt for ${state.currentPhase}`)
        }

        // Make the request
        const request = await model.sendRequest(
          messages,
          {
            tools: [
              { name: 'cappy_create_file', description: 'Create files in the workspace' },
              { name: 'cappy_fetch_web', description: 'Fetch content from web URLs' },
              { name: 'cappy_retrieve_context', description: 'Retrieve context from codebase' }
            ]
          },
          new vscode.CancellationTokenSource().token
        )

        // Process response
        let stepText = ''
        const toolCalls: vscode.LanguageModelToolCallPart[] = []

        try {
          for await (const fragment of request.stream) {
            if (fragment instanceof vscode.LanguageModelTextPart) {
              stepText += fragment.value
              textAccumulator += fragment.value
              
              // Filter out JSON responses - don't show them to user
              const fragmentValue = fragment.value
              
              // More robust JSON detection
              const containsJsonStructure = fragmentValue.includes('"objective"') || 
                                          fragmentValue.includes('"clarityScore"') ||
                                          fragmentValue.includes('"technicalTerms"') ||
                                          fragmentValue.includes('"ambiguities"')
              
              const isStartOfJson = fragmentValue.trim().startsWith('{')
              const isEndOfJson = fragmentValue.trim().endsWith('}')
              const isJsonFragment = containsJsonStructure || isStartOfJson || isEndOfJson
              
              if (!isJsonFragment) {
                console.log('[Engine] ✅ Yielding fragment to user:', fragmentValue.substring(0, 50))
                yield fragmentValue
                hasGeneratedUserResponse = true
              } else {
                console.log('[Engine] 🚫 Filtering JSON fragment from user display:', fragmentValue.substring(0, 100))
              }
            } else if (fragment instanceof vscode.LanguageModelToolCallPart) {
              toolCalls.push(fragment)
            }
          }
        } catch (error) {
          console.error('[Engine] Error processing stream:', error)
          break
        }

        // Process the current phase first to extract intent
        const phaseResult = await PhaseOrchestrator.processPhase(stepText, state, toolCalls)
        
        // CRITICAL: Stop immediately if we generated a user-facing response in intent phase 
        // BUT ONLY if request is unclear (low clarity score)
        if (hasGeneratedUserResponse && 
            state.currentPhase === 'intent' && 
            state.intent && 
            state.intent.clarityScore < 0.5) {
          console.log('[Analyst] 🛑 STOP: Generated response for unclear request, breaking to prevent repetitions')
          console.log(`[Analyst] Clarity score: ${state.intent.clarityScore}`)
          break
        }

        // Check if we should continue
        if (!PhaseOrchestrator.shouldContinuePhase(state, toolCalls, phaseResult, textAccumulator)) {
          console.log('[Analyst] shouldContinuePhase returned false, breaking loop')
          break
        }

        // Handle phase-specific results
        if (phaseResult.type === 'ask' && phaseResult.data) {
          // Present questions to user and wait for answers
          console.log('[Analyst] Questions generated, stopping to wait for user input')
          break
        }

        if (phaseResult.type === 'done') {
          console.log('[Analyst] Task completed successfully')
          break
        }
        
        // Stop early for unclear requests to avoid repetitions
        if (state.currentPhase === 'questions' && hasGeneratedUserResponse) {
          console.log('[Analyst] Already asked for clarification, stopping to avoid repetitions')
          break
        }
        
        // Emergency brake: if we yielded content and are in intent/questions phase with low clarity
        if (hasGeneratedUserResponse && 
            (state.currentPhase === 'intent' || state.currentPhase === 'questions') &&
            state.intent && state.intent.clarityScore < 0.5) {
          console.log('[Analyst] 🚨 Emergency stop: Low clarity + response generated, breaking loop')
          break
        }
      }

      // Cleanup
      this.stateMap.delete(sessionId)
      console.log('✅ [ChatViewProvider] Message processed successfully with tools')

    } catch (error) {
      console.error('❌ [ChatViewProvider] Error processing message:', error)
      yield `❌ Error processing message: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  private getPhasePrompt(state: AnalystState): string | null {
    const prompt = PHASE_PROMPTS[state.currentPhase]
    if (!prompt) return null

    // Replace placeholders with actual values
    let finalPrompt = prompt
    if (state.intent) {
      finalPrompt = finalPrompt.replace('{objective}', state.intent.objective)
      finalPrompt = finalPrompt.replace('{category}', state.intent.category)
    }

    return finalPrompt
  }
}