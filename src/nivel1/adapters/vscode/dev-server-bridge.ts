import { WebSocketServer, WebSocket } from 'ws';
import type { ChatService } from '../../../domains/chat/services/chat-service';

/**
 * WebSocket server para permitir desenvolvimento no browser
 * conectando com a extensão rodando no VS Code
 */
export class DevServerBridge {
  private wss: WebSocketServer;
  private chatService: ChatService;
  
  constructor(port: number, chatService: ChatService) {
    this.chatService = chatService;
    this.wss = new WebSocketServer({ port });
    
    console.log(`🔌 [DevBridge] WebSocket server listening on port ${port}`);
    
    this.wss.on('connection', (ws) => {
      console.log('✅ [DevBridge] Client connected');
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(message, ws);
        } catch (error) {
          console.error('❌ [DevBridge] Error handling message:', error);
          ws.send(JSON.stringify({ type: 'error', error: String(error) }));
        }
      });
      
      ws.on('close', () => {
        console.log('🔌 [DevBridge] Client disconnected');
      });
      
      ws.on('error', (error) => {
        console.error('❌ [DevBridge] WebSocket error:', error);
      });
    });
  }
  
  private async handleMessage(message: unknown, ws: WebSocket) {
    const msg = message as { type: string; [key: string]: unknown };
    console.log('📨 [DevBridge] Received:', msg.type);
    
    switch (msg.type) {
      case 'sendMessage':
        await this.handleChatMessage(msg as typeof msg & { text: string }, ws);
        break;
        
      case 'userPromptResponse': {
        // Forward to chat service
        const agent = this.chatService.getAgent();
        if (agent && 'handleUserPromptResponse' in agent) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (agent as any).handleUserPromptResponse(msg.messageId, msg.response);
        }
        break;
      }
        
      default:
        console.warn('⚠️ [DevBridge] Unknown message type:', msg.type);
    }
  }
  
  private async handleChatMessage(message: { messageId?: string; text: string; history?: Array<{ role: string; content: string }>; sessionId?: string }, ws: WebSocket) {
    const { messageId, text, history } = message;
    
    try {
      // Create or get session
      let session;
      if (message.sessionId) {
        session = {
          id: message.sessionId,
          title: 'Dev Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      } else {
        session = await this.chatService.startSession('Dev Chat');
      }
      
      console.log('🤖 [DevBridge] Processing message through LangGraph...');
      
      // Callback for tool confirmation prompts
      const onPromptRequest = (prompt: { messageId: string; question?: string; toolCall?: { name: string; input: unknown } }) => {
        ws.send(JSON.stringify({
          type: 'promptRequest',
          messageId,
          promptMessageId: prompt.messageId,
          prompt: {
            question: prompt.question,
            toolCall: prompt.toolCall
          }
        }));
      };
      
      // Stream response from chat service (uses Copilot)
      const stream = await this.chatService.sendMessage(session, text, history, onPromptRequest);
      
      for await (const token of stream) {
        ws.send(JSON.stringify({
          type: 'textDelta',
          text: token
        }));
      }
      
      // Signal completion
      ws.send(JSON.stringify({ type: 'done' }));
      
      console.log('✅ [DevBridge] Message processed');
      
    } catch (error) {
      console.error('❌ [DevBridge] Error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
  
  dispose() {
    this.wss.close();
    console.log('🔌 [DevBridge] WebSocket server closed');
  }
}
