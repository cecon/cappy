/**
 * User prompt types for inline chat confirmations
 */

export type PromptType = 'confirm' | 'input' | 'select'

export interface UserPrompt {
  messageId: string
  options?: string[]
}

/**
 * Chat event types for backend-frontend communication
 */
export type ChatEvent = 
  | { type: 'thinking'; messageId: string; text?: string }
  | { type: 'streamStart'; messageId: string }
  | { type: 'streamToken'; messageId: string; token: string }
  | { type: 'streamEnd'; messageId: string }
  | { type: 'streamError'; messageId: string; error: string }
  | { type: 'userPrompt'; messageId: string; prompt: UserPrompt }
  | { type: 'userPromptResponse'; messageId: string; response: string; cancelled?: boolean }
