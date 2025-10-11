import type { Message } from '../entities/message'
import type { ChatSession } from '../entities/session'
import type { ChatAgentPort, ChatContext } from '../ports/agent-port'
import type { ChatHistoryPort } from '../ports/history-port'

function genId() {
  // Simple unique id: timestamp + random
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export interface ChatService {
  startSession(title?: string): Promise<ChatSession>
  sendMessage(session: ChatSession, content: string): Promise<AsyncIterable<string>>
}

export function createChatService(agent: ChatAgentPort, history: ChatHistoryPort): ChatService {
  return {
    async startSession(title = 'New Chat') {
      const session: ChatSession = {
        id: genId(),
        title,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await history.save(session)
      return session
    },
    async sendMessage(session, content) {
      const msg: Message = {
        id: genId(),
        author: 'user',
        content,
        timestamp: Date.now(),
      }
      session.messages.push(msg)
      session.updatedAt = Date.now()
      await history.save(session)

      // Pass message history (excluding current message) to the agent
      // Only include messages that are already complete (both user and assistant pairs)
      const previousMessages = session.messages.slice(0, -1)
      
      console.log(`📊 Session ${session.id} - Total messages in session: ${session.messages.length}`)
      console.log(`📊 Previous messages being sent to agent: ${previousMessages.length}`)
      console.log(`📊 Last 3 messages:`, previousMessages.slice(-3).map(m => ({
        author: m.author,
        content: m.content.substring(0, 50) + '...'
      })))
      
      const context: ChatContext = { 
        sessionId: session.id,
        history: previousMessages
      }
      
      // Create async generator that also saves the assistant response
      async function* streamAndSave() {
        let assistantContent = ''
        const stream = await agent.processMessage(msg, context)
        
        for await (const token of stream) {
          assistantContent += token
          yield token
        }
        
        // Save assistant response after streaming completes
        const assistantMsg: Message = {
          id: genId(),
          author: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
        }
        session.messages.push(assistantMsg)
        session.updatedAt = Date.now()
        await history.save(session)
      }
      
      return streamAndSave()
    },
  }
}
