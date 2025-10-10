import * as vscode from 'vscode'
import type { ChatService } from '../../../../domains/chat/services/chat-service'
import type { ChatSession } from '../../../../domains/chat/entities/session'

export class ChatPanel {
  static current: ChatPanel | undefined

  static createOrShow(context: vscode.ExtensionContext, chat: ChatService, session: ChatSession | null = null) {
    const column = vscode.ViewColumn.Two
    if (ChatPanel.current) {
      ChatPanel.current.panel.reveal(column)
      if (session) ChatPanel.current.session = session
      return ChatPanel.current
    }

    const panel = vscode.window.createWebviewPanel(
      'cappyChat',
      'Cappy: Chat',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    )

    ChatPanel.current = new ChatPanel(panel, context, chat)
    if (session) ChatPanel.current.session = session
    return ChatPanel.current
  }

  private session: ChatSession | null = null
  private panel: vscode.WebviewPanel
  private chat: ChatService

  private constructor(
    panel: vscode.WebviewPanel,
    _context: vscode.ExtensionContext,
    chat: ChatService
  ) {
    this.panel = panel
    this.chat = chat
    this.panel.webview.onDidReceiveMessage(this.onMessage.bind(this))
    this.render()
  }

  private async ensureSession() {
    if (!this.session) {
      this.session = await this.chat.startSession('Chat')
    }
  }

  private async onMessage(msg: { type: 'send'; text: string } | { type: string; [k: string]: unknown }) {
    switch (msg.type) {
      case 'send': {
        await this.ensureSession()
        if (!this.session) return
        const stream = await this.chat.sendMessage(this.session, (msg as { text: string }).text)
        for await (const token of stream) {
          this.panel.webview.postMessage({ type: 'stream', token })
        }
        this.panel.webview.postMessage({ type: 'done' })
        break
      }
      default:
        break
    }
  }

  private render() {
    const nonce = Math.random().toString(36).slice(2)
    this.panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this.panel.webview.cspSource}; script-src 'nonce-${nonce}';">
  <style>
    body { font-family: var(--vscode-font-family); margin: 0; padding: 12px; }
    #log { height: 70vh; overflow: auto; border: 1px solid var(--vscode-panel-border); padding: 8px; }
    #input { display: flex; gap: 8px; margin-top: 8px; }
    textarea { flex: 1; resize: vertical; min-height: 48px; }
    button { padding: 6px 12px; }
    .assistant { color: var(--vscode-textLink-foreground); }
  </style>
</head>
<body>
  <div id="log"></div>
  <div id="input">
    <textarea id="msg" placeholder="Pergunte algo..."></textarea>
    <button id="send">Enviar</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const log = document.getElementById('log');
    const input = document.getElementById('msg');
    const send = document.getElementById('send');

    send.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      append('user', text);
      input.value = '';
      vscode.postMessage({ type: 'send', text });
    });

    window.addEventListener('message', (event) => {
      const { type, token } = event.data;
      if (type === 'stream') {
        appendToken('assistant', token);
      } else if (type === 'done') {
        append('\n');
      }
    });

    function append(role, text) {
      const div = document.createElement('div');
      div.className = role;
      div.textContent = (role === 'assistant' ? 'AI: ' : 'Você: ') + text;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

    function appendToken(role, token) {
      let last = log.lastElementChild;
      if (!last || !last.classList.contains(role)) {
        last = document.createElement('div');
        last.className = role;
        last.textContent = (role === 'assistant' ? 'AI: ' : 'Você: ');
        log.appendChild(last);
      }
      last.textContent += token;
      log.scrollTop = log.scrollHeight;
    }
  </script>
</body>
</html>`
  }
}
