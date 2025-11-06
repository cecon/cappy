/**
 * @fileoverview Example of migrating from old architecture to CodeAct agent
 * @module examples/migration-example
 */

// ============================================================================
// BEFORE: Using OrchestratedChatEngine with multiple sub-agents
// ============================================================================

/*
import { OrchestratedChatEngine } from './nivel2/infrastructure/agents/chat-engine/orchestrated-chat-engine'
import { createChatService } from './domains/chat/services/chat-service'

// Create orchestrated engine with sub-agents
const chatEngine = new OrchestratedChatEngine(retrieveContextUseCase)

// Create chat service
const chatService = createChatService(chatEngine)

// Use it
const session = await chatService.startSession('New Chat')
const stream = await chatService.sendMessage(session, 'Help me with authentication', [])

for await (const chunk of stream) {
  console.log(chunk)
}
*/

// ============================================================================
// AFTER: Using CappyAgentAdapter with CodeAct pattern
// ============================================================================

import { CappyAgentAdapter } from '../../src/nivel2/infrastructure/agents/codeact/cappy-agent-adapter'
import { createChatService } from '../../src/domains/chat/services/chat-service'
import type { RetrieveContextUseCase } from '../../src/domains/retrieval/use-cases/retrieve-context-use-case'

async function setupChatWithCodeActAgent(retrieveContextUseCase?: RetrieveContextUseCase) {
  // Create adapter with configuration
  const cappyAgent = new CappyAgentAdapter(
    {
      maxIterations: 10,
      temperature: 0.7,
      enableThinking: true,
      enableTools: true
    },
    retrieveContextUseCase
  )
  
  // Initialize (connects to LLM)
  await cappyAgent.initialize()
  
  // Create chat service with adapter
  const chatService = createChatService(cappyAgent)
  
  return chatService
}

// Usage
export async function exampleUsage(retrieveContextUseCase?: RetrieveContextUseCase) {
  const chatService = await setupChatWithCodeActAgent(retrieveContextUseCase)
  
  // Start session
  const session = await chatService.startSession('CodeAct Chat')
  
  // Send message with streaming
  const stream = await chatService.sendMessage(
    session,
    'Help me understand the authentication flow in this codebase',
    [] // external history
  )
  
  // Stream response
  for await (const chunk of stream) {
    console.log(chunk)
  }
}

// ============================================================================
// BENEFITS OF NEW ARCHITECTURE
// ============================================================================

/*
1. SIMPLER CODE
   - Single agent instead of 5+ sub-agents
   - No complex orchestration logic
   - Clear step-by-step execution

2. BETTER DEBUGGING
   - Unified State with complete history
   - Every action and observation is logged
   - Easy to trace what went wrong

3. EASIER TO EXTEND
   - Just add a new Tool class
   - No need to create entire sub-agent
   - Tools are reusable

4. MORE CONTROL
   - Explicit action/observation pattern
   - Clear state management
   - Predictable behavior

5. BETTER PERFORMANCE
   - No orchestration overhead
   - Direct LLM calls
   - Efficient state management
*/

// ============================================================================
// MIGRATION CHECKLIST
// ============================================================================

/*
✅ 1. Replace OrchestratedChatEngine with CappyAgentAdapter
✅ 2. Initialize agent with await adapter.initialize()
✅ 3. Pass same RetrieveContextUseCase for context retrieval
✅ 4. Configure maxIterations, temperature as needed
✅ 5. Test streaming behavior
✅ 6. Monitor logs for any issues
✅ 7. Remove old sub-agents when confident
*/
