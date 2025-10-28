import * as vscode from 'vscode';
import type { ChatService } from '../../../../domains/chat/services/chat-service';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cappy.chatView';
  
  private readonly extensionUri: vscode.Uri;
  private readonly chatService: ChatService;
  private sessionId?: string;
  
  constructor(extensionUri: vscode.Uri, chatService: ChatService) {
    this.extensionUri = extensionUri;
    this.chatService = chatService;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
  ) {
    console.log('🔧 [ChatViewProvider] Resolving webview view...');
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out')]
    };

    // Load the React app (same as main chat)
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    
    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      console.log('📨 [ChatViewProvider] Received message:', message.type);
      await this.handleMessage(message, webviewView.webview);
    });
    
    console.log('✅ [ChatViewProvider] Webview HTML set successfully');
  }
  
  private async handleMessage(message: { type: string; [key: string]: unknown }, webview: vscode.Webview) {
    switch (message.type) {
      case 'sendMessage':
        console.log('💬 [ChatViewProvider] Processing chat message...');
        // Use VS Code's language model to handle the chat
        await this.handleChatMessage(message as unknown as { messageId: string; text: string; history?: Array<{ role: string; content: string }> }, webview);
        break;
      case 'userPromptResponse': {
        console.log('✅ [ChatViewProvider] User prompt response:', message.response);
        // Forward the response to the LangGraph engine
        const agent = this.chatService.getAgent();
        if (agent && 'handleUserPromptResponse' in agent && typeof agent.handleUserPromptResponse === 'function') {
          agent.handleUserPromptResponse(message.messageId as string, message.response as string);
        }
        break;
      }
      default:
        console.warn('⚠️ [ChatViewProvider] Unknown message type:', message.type);
    }
  }
  
  private async handleChatMessage(message: { messageId: string; text: string; history?: Array<{ role: string; content: string }> }, webview: vscode.Webview) {
    const { messageId, text, history } = message;
    
    try {
      // Ensure we have a session
      let session;
      if (this.sessionId) {
        // Reconstruct session object
        session = {
          id: this.sessionId,
          title: 'Sidebar Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      } else {
        session = await this.chatService.startSession('Sidebar Chat');
        this.sessionId = session.id;
        console.log('📝 [ChatViewProvider] Created session:', this.sessionId);
      }
      
      console.log('🤖 [ChatViewProvider] Sending message through LangGraph engine with tools...');
      
      // Callback to handle prompt requests from the agent
      const onPromptRequest = (prompt: import('../../../../domains/chat/entities/prompt').UserPrompt & { question?: string; toolCall?: { name: string; input: unknown } }) => {
        console.log('🔧 [ChatViewProvider] onPromptRequest called:', prompt);
        webview.postMessage({
          type: 'promptRequest',
          messageId,
          promptMessageId: prompt.messageId,
          prompt: {
            question: prompt.question,
            toolCall: prompt.toolCall
          }
        });
      };
      
      // Use the chat service which includes LangGraph with tools
      const stream = await this.chatService.sendMessage(session, text, history, onPromptRequest);
      
      // Stream the response
      for await (const token of stream) {
        console.log('📦 [ChatViewProvider] Token:', token.substring(0, 100));
        
        // Check if token contains a __PROMPT_REQUEST__ marker
        if (token.includes('__PROMPT_REQUEST__:')) {
          console.log('🔍 [ChatViewProvider] Found __PROMPT_REQUEST__ in token');
          const promptRegex = /__PROMPT_REQUEST__:({.+})/;
          const match = promptRegex.exec(token);
          if (match) {
            try {
              const promptData = JSON.parse(match[1]);
              webview.postMessage({
                type: 'promptRequest',
                messageId,
                promptMessageId: promptData.messageId,
                prompt: {
                  question: promptData.question,
                  toolCall: promptData.toolCall
                }
              });
              console.log('🔧 [ChatViewProvider] Sent promptRequest:', promptData);
              continue; // Don't send the raw token
            } catch (e) {
              console.warn('⚠️ [ChatViewProvider] Failed to parse __PROMPT_REQUEST__:', e);
            }
          }
        }
        
        // Send normal token
        webview.postMessage({
          type: 'streamToken',
          messageId,
          token
        });
      }
      
      // Signal end of stream
      webview.postMessage({
        type: 'streamEnd',
        messageId
      });
      
      console.log('✅ [ChatViewProvider] Message processed successfully with tools');
      
    } catch (error) {
      console.error('❌ [ChatViewProvider] Error processing message:', error);
      webview.postMessage({
        type: 'streamError',
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'main.css')
    );

    console.log('📁 [ChatViewProvider] Script URI:', scriptUri.toString());
    console.log('🎨 [ChatViewProvider] Style URI:', styleUri.toString());

    const nonce = this.getNonce();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>Cappy Chat</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    console.log('[Webview] Initializing vscodeApi...');
    window.vscodeApi = acquireVsCodeApi();
    console.log('[Webview] vscodeApi ready:', !!window.vscodeApi);
  </script>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    
    console.log('📄 [ChatViewProvider] HTML generated, length:', html.length);
    return html;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
