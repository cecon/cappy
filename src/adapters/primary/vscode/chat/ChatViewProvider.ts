import * as vscode from 'vscode'
import type { ChatService } from '../../../../domains/chat/services/chat-service'
import type { ChatSession } from '../../../../domains/chat/entities/session'
import { ChatWebviewHtml } from './components/ChatWebviewHtml'
import { ChatMessageHandler } from './components/ChatMessageHandler'

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cappy.chatView'
  
  private _view?: vscode.WebviewView
  private session: ChatSession | null = null
  private messageHandler: ChatMessageHandler
  
  constructor(
    private extensionUri: vscode.Uri,
    private chat: ChatService
  ) {
    this.messageHandler = new ChatMessageHandler({
      chat: this.chat,
      getSession: () => this.session,
      ensureSession: this.ensureSession.bind(this),
      postMessage: (msg) => this._view?.webview.postMessage(msg)
    })
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out')]
    }
    const nonce = ChatWebviewHtml.generateNonce()
    const htmlGenerator = new ChatWebviewHtml({
      extensionUri: this.extensionUri,
      webview: webviewView.webview,
      nonce
    })
    webviewView.webview.html = htmlGenerator.generate()
    webviewView.webview.onDidReceiveMessage(async (data) => {
      await this.messageHandler.handle(data)
    })
  }

  private async ensureSession() {
    if (!this.session) {
      this.session = await this.chat.startSession('Chat')
    }
  }
}
