/**
 * @fileoverview Webview provider for Cappy chat panel.
 * @module webview/ChatPanelWebviewProvider
 */

import * as vscode from 'vscode';
import type { ChatSession, ProviderSettings } from '../../../../shared/types/agent';
import { generateChatPanelHtml } from './chat-panel.html';

/**
 * Serialized state payload sent to webview.
 */
export interface ChatPanelStatePayload {
  /**
   * Session collection.
   */
  sessions: Array<Pick<ChatSession, 'id' | 'title'> & { messages: Array<{ role: string; content: string }> }>;
  /**
   * Current active session id.
   */
  currentSessionId?: string;
  /**
   * Provider configuration projection.
   */
  provider: Pick<ProviderSettings, 'baseUrl' | 'model' | 'backend'>;
  /**
   * Optional status text.
   */
  statusText?: string;
}

/**
 * Event callbacks consumed by bootstrap.
 */
export interface ChatPanelEvents {
  /**
   * Webview asks state sync.
   */
  onReady: () => void;
  /**
   * User requested new session.
   */
  onCreateSession: (mode: 'planning' | 'sandbox') => void;
  /**
   * User sent a message.
   */
  onSendMessage: (data: { sessionId?: string; mode: 'planning' | 'sandbox'; prompt: string }) => void;
  /**
   * User saved provider settings.
   */
  onSaveProvider: (data: { baseUrl: string; model: string; backend: 'openai' | 'openclaude'; apiKey?: string }) => void;
  /**
   * User requested provider test.
   */
  onTestProvider: () => void;
}

/**
 * Chat panel webview bridge.
 */
export class ChatPanelWebviewProvider implements vscode.WebviewViewProvider {
  /**
   * Contributed view id.
   */
  public static readonly viewType = 'cappy.dashboard';

  private view: vscode.WebviewView | null = null;
  private events: ChatPanelEvents | null = null;
  private state: ChatPanelStatePayload = {
    sessions: [],
    provider: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      backend: 'openai',
    },
  };

  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Registers callback handlers from bootstrap.
   */
  setEvents(events: ChatPanelEvents): void {
    this.events = events;
  }

  /**
   * Replaces current panel state and notifies UI.
   */
  updateState(state: ChatPanelStatePayload): void {
    this.state = state;
    this.postMessage({ type: 'state', data: state });
    this.rerender();
  }

  /**
   * Sends status text to footer.
   */
  updateStatus(text: string): void {
    this.postMessage({ type: 'status', data: text });
  }

  /**
   * Starts assistant stream updates in webview.
   */
  startAssistantStream(sessionId: string): void {
    this.postMessage({ type: 'assistant-stream-start', data: { sessionId } });
  }

  /**
   * Sends one assistant chunk to webview.
   */
  pushAssistantChunk(sessionId: string, chunk: string): void {
    this.postMessage({ type: 'assistant-stream-chunk', data: { sessionId, chunk } });
  }

  /**
   * Marks assistant stream completion.
   */
  endAssistantStream(sessionId: string): void {
    this.postMessage({ type: 'assistant-stream-end', data: { sessionId } });
  }

  /**
   * Posts typed message to the webview instance.
   */
  postMessage(message: unknown): void {
    this.view?.webview.postMessage(message);
  }

  /**
   * Resolves and wires webview lifecycle.
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.buildHtml();

    webviewView.webview.onDidReceiveMessage((message: { type: string; data?: any }) => {
      switch (message.type) {
        case 'webview-ready':
          this.events?.onReady();
          break;
        case 'chat-create-session':
          this.events?.onCreateSession(message.data?.mode ?? 'planning');
          break;
        case 'chat-send':
          this.events?.onSendMessage(message.data);
          break;
        case 'provider-save':
          this.events?.onSaveProvider(message.data);
          break;
        case 'provider-test':
          this.events?.onTestProvider();
          break;
      }
    });
  }

  /**
   * Rerenders full HTML to keep initial state coherent.
   */
  private rerender(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = this.buildHtml();
  }

  /**
   * Builds HTML with latest state snapshot.
   */
  private buildHtml(): string {
    const iconUri = this.view
      ? this.view.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'assets', 'icon.png')).toString()
      : '';
    return generateChatPanelHtml({
      iconUri,
      initialStateJson: JSON.stringify(this.state),
    });
  }
}

