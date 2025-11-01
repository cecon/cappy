/**
 * Author type for chat messages
 * Represents who sent the message in a conversation
 */
export type Author = 'user' | 'assistant'

/**
 * Chat message entity
 * Represents a single message in a chat conversation between user and assistant
 * 
 * @property id - Unique identifier for the message
 * @property author - Who sent the message (user or assistant)
 * @property content - The text content of the message
 * @property timestamp - Unix timestamp when the message was created
 * @property metadata - Optional additional data associated with the message
 */
export interface Message {
  id: string
  author: Author
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}
