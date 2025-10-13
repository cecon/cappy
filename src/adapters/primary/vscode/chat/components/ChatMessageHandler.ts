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
        await this.handleSendMessage(msg.content || '', msg.messageId)
        break
      
      case 'userPromptResponse':
        await this.handleUserPromptResponse(msg.messageId, msg.response)
        break
      
      default:
        console.warn('[ChatMessageHandler] Unknown message type:', msg.type)
        break
    }
  }

  private async handleSendMessage(content: string, messageId?: string) {
    await this.options.ensureSession()
    const session = this.options.getSession()
    if (!session) return

    // Use provided messageId or generate new one
    const msgId = messageId || Date.now().toString()
    console.log('[ChatMessageHandler] Processing message with ID:', msgId)
    
    this.options.postMessage({ type: 'streamStart', messageId: msgId })

    const stream = await this.options.chat.sendMessage(session, content)
    for await (const token of stream) {
      this.options.postMessage({ type: 'streamToken', messageId: msgId, token })
    }
    
    this.options.postMessage({ type: 'streamEnd', messageId: msgId })
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
