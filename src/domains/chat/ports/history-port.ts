import type { ChatSession } from '../entities/session'

export interface ChatHistoryPort {
  save(session: ChatSession): Promise<void>
  load(sessionId: string): Promise<ChatSession | null>
  list(): Promise<ChatSession[]>
  delete(sessionId: string): Promise<void>
}
