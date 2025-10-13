import * as vscode from 'vscode'
import type { ChatService } from '../../../../domains/chat/services/chat-service'
import type { ChatSession } from '../../../../domains/chat/entities/session'
import { ChatWebviewHtml } from './components/ChatWebviewHtml'
import { ChatMessageHandler } from './components/ChatMessageHandler'

/**
 * WebView Provider for Chat - renders directly in the sidebar
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cappy.chatView'
  
  private _view?: vscode.WebviewView
  private session: ChatSession | null = null
  private _extensionUri: vscode.Uri
  private chat: ChatService
  private messageHandler: ChatMessageHandler
  
  constructor(extensionUri: vscode.Uri, chat: ChatService) {
    this._extensionUri = extensionUri
    this.chat = chat
    
    // Initialize message handler with proper callbacks
    this.messageHandler = new ChatMessageHandler({
      chat: this.chat,
      getSession: () => this.session,
      ensureSession: this.ensureSession.bind(this),
      postMessage: (msg) => this._view?.webview.postMessage(msg)
    })
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

    // Handle messages from the webview using ChatMessageHandler
    webviewView.webview.onDidReceiveMessage(async (data) => {
      await this.messageHandler.handle(data)
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

  private _getHtmlForWebview(webview: vscode.Webview) {
    const nonce = ChatWebviewHtml.generateNonce()
    const htmlGenerator = new ChatWebviewHtml({
      extensionUri: this._extensionUri,
      webview: webview,
      nonce
    })
    return htmlGenerator.generate()
  }
}
