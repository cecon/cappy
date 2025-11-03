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

    // Load HTML from chat.html in workspace root (Vite build output)
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'chat.html');
    
    if (!fs.existsSync(htmlPath.fsPath)) {
      const errorMsg = `Chat HTML not found at: ${htmlPath.fsPath}\n\nMake sure you've run 'npm run build' to generate the chat.html file.`;
      console.error('❌ [ChatViewProvider]', errorMsg);
      // Return a fallback error page instead of throwing
      return this.getErrorHtml(errorMsg, nonce);
    }
    
    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
    console.log('✅ [ChatViewProvider] Loaded HTML from:', htmlPath.fsPath);

    // Get webview URIs for assets (for CSS if embedded in HTML)
    const chatCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'chat.css')
    );

    // Replace CSS path if present in HTML (but leave script src untouched for Vite)
    if (htmlContent.includes('./chat.css')) {
      htmlContent = htmlContent.replace('./chat.css', chatCssUri.toString());
    }

    // Remove modulepreload links (not needed in webview)
    htmlContent = htmlContent.replaceAll(/<link rel="modulepreload"[^>]*>/g, '');

    // Add CSP if not present
    if (!htmlContent.includes('Content-Security-Policy')) {
      htmlContent = htmlContent.replace(
        '<meta name="viewport"',
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}; img-src ${cspSource} data: https:; font-src ${cspSource}; connect-src ${cspSource}; worker-src ${cspSource}; object-src 'none';">\n    <meta name="viewport"`
      );
    }

    // Add nonce to all script tags
    htmlContent = htmlContent.replaceAll('<script type="module"', `<script type="module" nonce="${nonce}"`);

    // Inject VS Code API into the window object
    const vscodeApiScript = `
      <script nonce="${nonce}">
        window.vscodeApi = acquireVsCodeApi();
      </script>
    `;
    htmlContent = htmlContent.replace('</head>', `${vscodeApiScript}\n  </head>`);

    console.log('📄 [ChatViewProvider] HTML prepared, length:', htmlContent.length);
    return htmlContent;
  }

  private getErrorHtml(message: string, nonce: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cappy Chat - Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #1e1e1e;
      color: #d4d4d4;
      margin: 0;
      padding: 20px;
      line-height: 1.6;
    }
    .error-container {
      max-width: 600px;
      background: #252526;
      border: 1px solid #3e3e42;
      border-radius: 4px;
      padding: 20px;
      margin: 20px auto;
    }
    h2 {
      color: #f48771;
      margin-top: 0;
    }
    pre {
      background: #1e1e1e;
      padding: 10px;
      border-radius: 3px;
      overflow-x: auto;
      font-size: 12px;
      color: #ce9178;
    }
    .hint {
      background: #1e3a1f;
      border-left: 3px solid #4ec9b0;
      padding: 10px;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h2>⚠️ Cappy Chat - Build Required</h2>
    <pre>${message}</pre>
    <div class="hint">
      <strong>💡 Fix:</strong> Open terminal and run: <code>npm run build</code>
    </div>
  </div>
</body>
</html>`;
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
