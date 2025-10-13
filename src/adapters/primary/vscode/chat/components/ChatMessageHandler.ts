import type { ChatService } from '../../../../../domains/chat/services/chat-service'
import type { ChatSession } from '../../../../../domains/chat/entities/session'

export interface MessageHandlerOptions {
  chat: ChatService
  getSession: () => ChatSession | null
  ensureSession: () => Promise<void>
  postMessage: (message: unknown) => void
}

/**
 * Handles messages received from the Chat webview
 */
export class ChatMessageHandler {
  private options: MessageHandlerOptions

  constructor(options: MessageHandlerOptions) {
    this.options = options
  }

  async handle(msg: { type: string; sessionId?: string; content?: string; messageId?: string; response?: string; [k: string]: unknown }) {
    switch (msg.type) {
      case 'sendMessage':
        await this.handleSendMessage(msg.content || '')
        break
      
      case 'userPromptResponse':
        await this.handleUserPromptResponse(msg.messageId, msg.response)
        break
      
      default:
        console.warn('[ChatMessageHandler] Unknown message type:', msg.type)
        break
    }
  }

  private async handleSendMessage(content: string) {
    await this.options.ensureSession()
    const session = this.options.getSession()
    if (!session) return

    const messageId = Date.now().toString()
    this.options.postMessage({ type: 'streamStart', messageId })

    const stream = await this.options.chat.sendMessage(session, content)
    for await (const token of stream) {
      this.options.postMessage({ type: 'streamToken', messageId, token })
    }
    
    this.options.postMessage({ type: 'streamEnd', messageId })
  }

  private async handleUserPromptResponse(messageId: string | undefined, response: string | undefined) {
    if (!messageId || response === undefined) return

    const agent = this.options.chat.getAgent()
    
    if ('handleUserPromptResponse' in agent && typeof agent.handleUserPromptResponse === 'function') {
      console.log(`[ChatMessageHandler] Forwarding user prompt response: ${messageId} -> ${response}`)
      agent.handleUserPromptResponse(messageId, response)
    } else {
      console.warn('[ChatMessageHandler] Agent does not support handleUserPromptResponse')
    }
  }
}
