/**
 * @fileoverview Quick test for CodeAct agent
 * Run this to test the new CappyAgent implementation
 */

import { CappyAgentAdapter } from './src/nivel2/infrastructure/agents/codeact'

/**
 * Quick test of the CodeAct agent
 */
async function testCodeActAgent() {
  console.log('🚀 Testing CappyAgent (CodeAct pattern)...\n')
  
  try {
    // 1. Create adapter
    console.log('1️⃣ Creating CappyAgentAdapter...')
    const adapter = new CappyAgentAdapter({
      maxIterations: 5,
      temperature: 0.7,
      enableThinking: true
    })
    
    // 2. Initialize
    console.log('2️⃣ Initializing (connecting to LLM)...')
    await adapter.initialize()
    console.log('✅ Agent initialized\n')
    
    // 3. Create a test message
    const testMessage = {
      id: 'test-1',
      author: 'user' as const,
      content: 'Hello! Can you help me understand how the CodeAct pattern works?',
      timestamp: Date.now()
    }
    
    const context = {
      sessionId: 'test-session',
      history: []
    }
    
    console.log('3️⃣ Sending message:', testMessage.content)
    console.log('─'.repeat(80))
    console.log()
    
    // 4. Process message with streaming
    for await (const chunk of adapter.processMessage(testMessage, context)) {
      process.stdout.write(chunk)
    }
    
    console.log()
    console.log('─'.repeat(80))
    console.log('✅ Test completed successfully!\n')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Stack:', error.stack)
    }
  }
}

// Run test
testCodeActAgent().catch(console.error)
