import * as vscode from 'vscode'
import type { ChatService } from '../../../../domains/chat/services/chat-service'
import type { ChatSession } from '../../../../domains/chat/entities/session'
import { ChatWebviewHtml } from './components/ChatWebviewHtml'
import { ChatMessageHandler } from './components/ChatMessageHandler'

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
  private messageHandler: ChatMessageHandler

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    chat: ChatService
  ) {
    this.panel = panel
    this.context = context
    this.chat = chat
    
    // Initialize message handler
    this.messageHandler = new ChatMessageHandler({
      chat: this.chat,
      getSession: () => this.session,
      ensureSession: this.ensureSession.bind(this),
      postMessage: (msg) => this.panel.webview.postMessage(msg)
    })
    
    this.panel.webview.onDidReceiveMessage((msg) => this.messageHandler.handle(msg))
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

  private render() {
    const nonce = ChatWebviewHtml.generateNonce()
    const htmlGenerator = new ChatWebviewHtml({
      extensionUri: this.context.extensionUri,
      webview: this.panel.webview,
      nonce
    })
    this.panel.webview.html = htmlGenerator.generate()
  }
}
