import type { ChatService } from '../../../../../domains/chat/services/chat-service'
import type { ChatSession } from '../../../../../domains/chat/entities/session'
import type { UserPrompt } from '../../../../../domains/chat/entities/prompt'

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

  async handle(msg: { type: string; sessionId?: string; content?: string; text?: string; history?: Array<{role: string; content: string}>; messageId?: string; response?: string; [k: string]: unknown }) {
    console.log('[ChatMessageHandler] Received message:', { type: msg.type, messageId: msg.messageId, response: msg.response })
    
    switch (msg.type) {
      case 'sendMessage':
        await this.handleSendMessage(
          msg.text || msg.content || '', 
          msg.history || [],
          msg.messageId
        )
        break
      
      case 'userPromptResponse':
        await this.handleUserPromptResponse(msg.messageId, msg.response)
        break
      
      default:
        console.warn('[ChatMessageHandler] Unknown message type:', msg.type)
        break
    }
  }

  private async handleSendMessage(content: string, history: Array<{role: string; content: string}>, messageId?: string) {
    await this.options.ensureSession()
    const session = this.options.getSession()
    if (!session) return

    // Use provided messageId or generate new one
    const msgId = messageId || Date.now().toString()
    
    this.options.postMessage({ type: 'streamStart', messageId: msgId })

    // Callback to send prompt requests to frontend
    const onPromptRequest = (prompt: UserPrompt) => {
      this.options.postMessage({ 
        type: 'promptRequest',
        messageId: msgId, // Streaming messageId for frontend to match
        promptMessageId: prompt.messageId, // Prompt messageId for backend response
        prompt 
      })
    }

    // Pass history and callback to chat service
    const stream = await this.options.chat.sendMessage(session, content, history, onPromptRequest)
    let accumulatedText = ''
    
    for await (const token of stream) {
      accumulatedText += token
      
      // Check if we have a complete __PROMPT_REQUEST__ marker
      const promptMatch = accumulatedText.match(/__PROMPT_REQUEST__:(.+?)(?:\n\n|$)/)
      if (promptMatch) {
        try {
          const promptData = JSON.parse(promptMatch[1])
          console.log('[ChatMessageHandler] Detected promptRequest:', promptData)
          
          // Send promptRequest message to frontend
          this.options.postMessage({ 
            type: 'promptRequest',
            messageId: msgId, // Streaming messageId for frontend to match
            promptMessageId: promptData.messageId, // Prompt messageId for backend response
            prompt: {
              question: promptData.question,
              toolCall: promptData.toolCall
            }
          })
          
          // Remove the marker from accumulated text but keep streaming other content
          accumulatedText = accumulatedText.replace(/__PROMPT_REQUEST__:.+?(?:\n\n|$)/, '')
          continue // Don't send the marker as a token
        } catch (e) {
          console.warn('[ChatMessageHandler] Failed to parse promptRequest:', e)
        }
      }
      
      // Send normal tokens
      this.options.postMessage({ type: 'streamToken', messageId: msgId, token })
    }
    
    this.options.postMessage({ type: 'streamEnd', messageId: msgId })
  }

  private async handleUserPromptResponse(messageId: string | undefined, response: string | undefined) {
    console.log('[ChatMessageHandler] handleUserPromptResponse called with:', { messageId, response })
    
    if (!messageId || response === undefined) {
      console.warn('[ChatMessageHandler] Invalid messageId or response')
      return
    }

    const agent = this.options.chat.getAgent()
    console.log('[ChatMessageHandler] Agent type:', agent?.constructor?.name)
    
    if ('handleUserPromptResponse' in agent && typeof agent.handleUserPromptResponse === 'function') {
      console.log(`[ChatMessageHandler] Forwarding user prompt response: ${messageId} -> ${response}`)
      agent.handleUserPromptResponse(messageId, response)
    } else {
      console.warn('[ChatMessageHandler] Agent does not support handleUserPromptResponse')
    }
  }
}
