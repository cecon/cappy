import type { Message } from '../entities/message'

export interface ChatContext {
  sessionId: string
  history: Message[]
  metadata?: Record<string, unknown>
}

export interface ChatAgentPort {
  processMessage(message: Message, context: ChatContext): AsyncIterable<string>
}
