import type { ChatAgentPort, ChatContext } from '../../../domains/chat/ports/agent-port'
import type { Message } from '../../../domains/chat/entities/message'

// Stub implementation: streams back an echo response
export class LangGraphChatEngine implements ChatAgentPort {
  async *processMessage(message: Message, context: ChatContext): AsyncIterable<string> {
    void context.sessionId
    const reply = `Echo: ${message.content}`
    for (const chunk of reply.split(/(\s+)/)) {
      if (chunk) {
        yield chunk
        await new Promise(r => setTimeout(r, 20))
      }
    }
  }
}
