import * as vscode from 'vscode';
import * as fs from 'node:fs';
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
      case 'webview-ready':
        console.log('✅ [ChatViewProvider] Webview reported ready');
        // Webview is ready, can send initial state if needed
        break;
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
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;

    // Load Vite-built HTML from out/chat.html (like GraphPanel does with dashboard.html)
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'out', 'chat.html');
    
    if (!fs.existsSync(htmlPath.fsPath)) {
      const errorMsg = `Chat HTML not found: ${htmlPath.fsPath}. Run 'npm run build' to generate it.`;
      console.error('❌ [ChatViewProvider]', errorMsg);
      throw new Error(errorMsg);
    }
    
    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
    console.log('✅ [ChatViewProvider] Loaded HTML from:', htmlPath.fsPath);

    // Get webview URIs for assets
    const chatJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'chat.js')
    );
    const chatCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'chat.css')
    );

    // Replace relative paths with webview URIs
    htmlContent = htmlContent
      .replace('./chat.js', chatJsUri.toString())
      .replace('./chat.css', chatCssUri.toString());

    // Remove modulepreload links (not needed in webview)
    htmlContent = htmlContent.replaceAll(/<link rel="modulepreload"[^>]*>/g, '');

    // Add CSP if not present
    if (!htmlContent.includes('Content-Security-Policy')) {
      htmlContent = htmlContent.replace(
        '<meta name="viewport"',
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}; img-src ${cspSource} data: https:; font-src ${cspSource}; connect-src ${cspSource};">\n    <meta name="viewport"`
      );
    }

    // Add nonce to all script tags
    htmlContent = htmlContent.replaceAll('<script type="module"', `<script type="module" nonce="${nonce}"`);

    console.log('📄 [ChatViewProvider] HTML prepared, length:', htmlContent.length);
    return htmlContent;
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
