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

  private async ensureSession() {
    if (!this.session) {
      this.session = await this.chat.startSession('Chat')
    }
  }

  private async onMessage(msg: { type: string; sessionId?: string; content?: string; [k: string]: unknown }) {
    switch (msg.type) {
      case 'sendMessage': {
        await this.ensureSession()
        if (!this.session) return

        const messageId = Date.now().toString()
        this._view?.webview.postMessage({ type: 'streamStart', messageId })

        const stream = await this.chat.sendMessage(this.session, msg.content || '')
        for await (const token of stream) {
          this._view?.webview.postMessage({ type: 'streamToken', messageId, token })
        }
        this._view?.webview.postMessage({ type: 'streamEnd', messageId })
        break
      }
      default:
        break
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'main.js'))
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'style.css'))

    // CSP for React/Vite webview
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'`,
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
  <script>
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
}
