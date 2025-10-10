import type { ChatHistoryPort } from '../../../domains/chat/ports/history-port'
import type { ChatSession } from '../../../domains/chat/entities/session'

export function createInMemoryHistory(): ChatHistoryPort {
  const map = new Map<string, ChatSession>()
  return {
    async save(session) {
      map.set(session.id, { ...session })
    },
    async load(sessionId) {
      return map.get(sessionId) ?? null
    },
    async list() {
      return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt)
    },
    async delete(sessionId) {
      map.delete(sessionId)
    },
  }
}
