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
      const previousMessages = session.messages.slice(0, -1)
      const context: ChatContext = { 
        sessionId: session.id,
        history: previousMessages
      }
      return agent.processMessage(msg, context)
    },
  }
}
