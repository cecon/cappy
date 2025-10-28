import type { Message } from '../entities/message'
import type { ChatSession } from '../entities/session'
import type { ChatAgentPort, ChatContext } from '../ports/agent-port'

function genId() {
  // Simple unique id: timestamp + random
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

import type { UserPrompt } from '../entities/prompt'

export interface ChatService {
  startSession(title?: string): Promise<ChatSession>
  sendMessage(
    session: ChatSession, 
    content: string, 
    externalHistory?: Array<{role: string; content: string}>,
    onPromptRequest?: (prompt: UserPrompt) => void
  ): Promise<AsyncIterable<string>>
  getAgent(): ChatAgentPort
}

export function createChatService(agent: ChatAgentPort): ChatService {
  return {
    getAgent() {
      return agent
    },
    async startSession(title = 'New Chat') {
      const session: ChatSession = {
        id: genId(),
        title,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      return session
    },
    async sendMessage(session, content, externalHistory, onPromptRequest) {
      // Convert external history from @assistant-ui to internal format
      const conversationHistory: Message[] = (externalHistory || []).map(msg => ({
        id: genId(),
        author: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: Date.now()
      }))
      
      const context: ChatContext = { 
        sessionId: session.id,
        history: conversationHistory,
        onPromptRequest
      }
      
      const msg: Message = {
        id: genId(),
        author: 'user',
        content,
        timestamp: Date.now(),
      }
      
      // Stream response from agent
      // @assistant-ui manages history - we just stream the response
      const stream = await agent.processMessage(msg, context)
      return stream
    },
  }
}
