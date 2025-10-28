import type { Message } from './message'

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}
