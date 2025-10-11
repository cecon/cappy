import * as vscode from 'vscode'
import type { ChatService } from '../../../../domains/chat/services/chat-service'
import type { ChatSession } from '../../../../domains/chat/entities/session'

/**
 * WebView Provider for Chat - renders directly in the sidebar
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cappy.chatView'
  
  private _view?: vscode.WebviewView
  private session: ChatSession | null = null
  private _extensionUri: vscode.Uri
  private chat: ChatService
  
  constructor(extensionUri: vscode.Uri, chat: ChatService) {
    this._extensionUri = extensionUri
    this.chat = chat
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    __context: vscode.WebviewViewResolveContext,
    __token: vscode.CancellationToken,
  ) {
    void __context; void __token; // Parâmetros ignorados
    
    // Prevent multiple revivals
    if (this._view && this._view === webviewView) {
      console.log('[ChatViewProvider] View already resolved, skipping');
      return;
    }
    
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'out')
      ]
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      await this.onMessage(data)
    })
    
    // Clean up when view is disposed
    webviewView.onDidDispose(() => {
      this._view = undefined;
    });
  }

  public async loadSession(session: ChatSession) {
    this.session = session
    if (this._view) {
      this._view.webview.postMessage({
        type: 'sessionLoaded',
        sessionId: session.id,
        sessionTitle: session.title,
        messages: session.messages
      })
    }
  }

  public async clearSession() {
    // Create a new session and clear UI
    this.session = await this.chat.startSession('New Chat')
    if (this._view) {
      this._view.webview.postMessage({
        type: 'sessionLoaded',
        sessionId: this.session.id,
        sessionTitle: this.session.title,
        messages: []
      })
    }
  }

  private async ensureSession() {
    if (!this.session) {
      this.session = await this.chat.startSession('Chat')
    }
  }

  private isProcessing = false;

  private async onMessage(msg: { type: string; sessionId?: string; content?: string; [k: string]: unknown }) {
    switch (msg.type) {
      case 'sendMessage': {
        // Prevent multiple simultaneous messages
        if (this.isProcessing) {
          console.warn('[ChatViewProvider] Already processing a message, ignoring new request');
          return;
        }

        await this.ensureSession()
        if (!this.session) return

        this.isProcessing = true;
        const messageId = Date.now().toString()
        
        // Send thinking status with detailed reasoning
        this._view?.webview.postMessage({ 
          type: 'thinking', 
          messageId,
          text: '🧠 Analisando sua pergunta...'
        })
        
        // Small delay to ensure UI is ready
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Start streaming
        this._view?.webview.postMessage({ type: 'streamStart', messageId })

        try {
          const stream = await this.chat.sendMessage(this.session, msg.content || '')
          for await (const token of stream) {
            this._view?.webview.postMessage({ type: 'streamToken', messageId, token })
          }
          this._view?.webview.postMessage({ type: 'streamEnd', messageId })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          this._view?.webview.postMessage({ 
            type: 'streamError', 
            messageId, 
            error: errorMessage 
          })
        } finally {
          this.isProcessing = false;
        }
        break
      }
      default:
        break
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'main.js'))
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'style.css'))

    // Generate nonce for inline scripts
    const nonce = this.getNonce()

    // CSP for React/Vite webview - more restrictive
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`, // Keep unsafe-inline for styled-components/emotion if needed
      `script-src ${webview.cspSource} 'nonce-${nonce}'`, // Use nonce instead of unsafe-inline/unsafe-eval
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} https: data:`,
      `connect-src ${webview.cspSource}`
    ].join('; ')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${styleUri}">
  <title>Cappy Chat</title>
  <style>
    html, body, #root {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #1e1e1e;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #root:empty::before {
      content: 'Loading Cappy Chat...';
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 14px;
      color: #858585;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    // Acquire VS Code API once and make it globally available
    window.vscodeApi = acquireVsCodeApi();
    
    // Debug: log errors
    window.addEventListener('error', (e) => {
      console.error('[Cappy Webview] Error:', e.message, e.filename, e.lineno);
      const root = document.getElementById('root');
      if (root) {
        root.innerHTML = '<div style="padding:20px;color:#f48771;">Error: ' + e.message + '</div>';
      }
    });
    
    console.log('[Cappy Webview] Ready, loading React...');
  </script>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`
  }

  private getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
