import type { Message } from '../entities/message'
import type { UserPrompt } from '../entities/prompt'

export interface ChatContext {
  sessionId: string
  history: Message[]
  metadata?: Record<string, unknown>
  onPromptRequest?: (prompt: UserPrompt) => void
}

export interface ChatAgentPort {
  processMessage(message: Message, context: ChatContext): AsyncIterable<string>
}
