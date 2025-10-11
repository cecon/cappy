import * as vscode from 'vscode'
import type { ChatService } from '../../../../domains/chat/services/chat-service'
import type { ChatSession } from '../../../../domains/chat/entities/session'

export class ChatPanel {
  static current: ChatPanel | undefined

  static createOrShow(context: vscode.ExtensionContext, chat: ChatService, session: ChatSession | null = null) {
    const column = vscode.ViewColumn.Two
    
    // If panel already exists, just reveal it
    if (ChatPanel.current) {
      try {
        ChatPanel.current.panel.reveal(column)
        if (session) {
          ChatPanel.current.session = session
          ChatPanel.current.loadSession(session)
        }
      } catch (error) {
        console.error('[ChatPanel] Error revealing panel:', error);
        // If error, dispose current and create new
        ChatPanel.current.panel.dispose();
        ChatPanel.current = undefined;
      }
      
      if (ChatPanel.current) {
        return ChatPanel.current;
      }
    }

    const panel = vscode.window.createWebviewPanel(
      'cappyChat',
      'Cappy: Chat',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'out')]
      }
    )

    ChatPanel.current = new ChatPanel(panel, context, chat)
    if (session) {
      ChatPanel.current.session = session
      ChatPanel.current.loadSession(session)
    }
    return ChatPanel.current
  }

  private session: ChatSession | null = null
  private panel: vscode.WebviewPanel
  private chat: ChatService
  private context: vscode.ExtensionContext

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    chat: ChatService
  ) {
    this.panel = panel
    this.context = context
    this.chat = chat
    this.panel.webview.onDidReceiveMessage(this.onMessage.bind(this))
    this.panel.onDidDispose(() => {
      ChatPanel.current = undefined
    })
    this.render()
  }

  private async ensureSession() {
    if (!this.session) {
      this.session = await this.chat.startSession('Chat')
    }
  }

  private loadSession(session: ChatSession) {
    // Send session data to webview
    this.panel.webview.postMessage({
      type: 'sessionLoaded',
      sessionId: session.id,
      sessionTitle: session.title,
      messages: session.messages
    })
  }

  private async onMessage(msg: { type: string; sessionId?: string; content?: string; messageId?: string; response?: string; [k: string]: unknown }) {
    switch (msg.type) {
      case 'sendMessage': {
        await this.ensureSession()
        if (!this.session) return

        const messageId = Date.now().toString()
        this.panel.webview.postMessage({ type: 'streamStart', messageId })

        const stream = await this.chat.sendMessage(this.session, msg.content || '')
        for await (const token of stream) {
          this.panel.webview.postMessage({ type: 'streamToken', messageId, token })
        }
        this.panel.webview.postMessage({ type: 'streamEnd', messageId })
        break
      }
      case 'userPromptResponse': {
        // Forward user prompt response to chat engine
        if (msg.messageId && msg.response !== undefined) {
          const agent = this.chat.getAgent()
          
          // Check if agent has handleUserPromptResponse method (for LangGraphChatEngine)
          if ('handleUserPromptResponse' in agent && typeof agent.handleUserPromptResponse === 'function') {
            console.log(`[ChatPanel] Forwarding user prompt response: ${msg.messageId} -> ${msg.response}`)
            agent.handleUserPromptResponse(msg.messageId, msg.response)
          } else {
            console.warn('[ChatPanel] Agent does not support handleUserPromptResponse')
          }
        }
        break
      }
      default:
        break
    }
  }

  private render() {
    const outPath = vscode.Uri.joinPath(this.context.extensionUri, 'out')
    const scriptUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(outPath, 'main.js'))
    const styleUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(outPath, 'style.css'))

    // Generate nonce for inline scripts
    const nonce = this.getNonce()

    // CSP for React/Vite webview - more restrictive
    const csp = [
      "default-src 'none'",
      `style-src ${this.panel.webview.cspSource} 'unsafe-inline'`, // Keep unsafe-inline for styled-components/emotion if needed
      `script-src ${this.panel.webview.cspSource} 'nonce-${nonce}'`, // Use nonce instead of unsafe-inline/unsafe-eval
      `font-src ${this.panel.webview.cspSource}`,
      `img-src ${this.panel.webview.cspSource} https: data:`,
      `connect-src ${this.panel.webview.cspSource}`
    ].join('; ')

    this.panel.webview.html = `<!DOCTYPE html>
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
    // Debug: log errors and confirm vscode API
    window.addEventListener('error', (e) => {
      console.error('[Cappy Webview] Error:', e.message, e.filename, e.lineno);
      document.getElementById('root').innerHTML = '<div style="padding:20px;color:#f48771;">Error: ' + e.message + '</div>';
    });
    console.log('[Cappy Webview] VSCode API:', typeof acquireVsCodeApi !== 'undefined');
    console.log('[Cappy Webview] Loading React from:', '${scriptUri}');
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
