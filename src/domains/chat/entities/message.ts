export type Author = 'user' | 'assistant'

export interface Message {
  id: string
  author: Author
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}
