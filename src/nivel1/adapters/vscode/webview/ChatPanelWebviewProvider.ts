/**
 * @fileoverview Webview provider for Cappy chat panel.
 * @module webview/ChatPanelWebviewProvider
 */

import * as vscode from 'vscode';
import type { ChatMode, ChatSession, ProviderSettings } from '../../../../shared/types/agent';
import { generateChatPanelHtml } from './chat-panel.html';

/**
 * Tool-call payload rendered in the chat timeline.
 */
export interface ChatPanelToolCallPayload {
  /**
   * Tool display name.
   */
  tool: string;
  /**
   * Tool execution status.
   */
  status: 'running' | 'done' | 'error';
  /**
   * Optional serialized input.
   */
  input?: string;
  /**
   * Optional serialized output.
   */
  output?: string;
}

/**
 * Message payload sent to webview.
 */
export interface ChatPanelMessagePayload {
  /**
   * Message identifier.
   */
  id: string;
  /**
   * Message role.
   */
  role: string;
  /**
   * Message markdown/text content.
   */
  content: string;
  /**
   * ISO creation timestamp.
   */
  createdAt: string;
  /**
   * Optional mode associated with message.
   */
  mode?: ChatMode;
  /**
   * Optional tool metadata when role is tool.
   */
  toolCall?: ChatPanelToolCallPayload;
}

/**
 * Session payload sent to webview.
 */
export interface ChatPanelSessionPayload {
  /**
   * Session id.
   */
  id: string;
  /**
   * Session title.
   */
  title: string;
  /**
   * Session mode.
   */
  mode: ChatMode;
  /**
   * Session status.
   */
  status: ChatSession['status'];
  /**
   * Pin state.
   */
  pinned: boolean;
  /**
   * Session creation timestamp.
   */
  createdAt: string;
  /**
   * Session last update timestamp.
   */
  updatedAt: string;
  /**
   * Session timeline.
   */
  messages: ChatPanelMessagePayload[];
}

/**
 * Serialized state payload sent to webview.
 */
export interface ChatPanelStatePayload {
  /**
   * Session collection.
   */
  sessions: ChatPanelSessionPayload[];
  /**
   * Current active session id.
   */
  currentSessionId?: string;
  /**
   * Provider configuration projection.
   */
  provider: Pick<ProviderSettings, 'baseUrl' | 'model' | 'backend'> & { token?: string };
  /**
   * Optional status text.
   */
  statusText?: string;
  /**
   * Indicates whether assistant is streaming.
   */
  isStreaming?: boolean;
  /**
   * Last selected UI mode.
   */
  currentUIMode?: 'agent' | 'plan' | 'debug' | 'ask' | 'sandbox';
  /**
   * Lightweight context usage estimate.
   */
  contextUsage?: { used: number; limit: number };
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
  onCreateSession: (mode: ChatMode) => void;
  /**
   * User sent a message.
   */
  onSendMessage: (data: { sessionId?: string; mode: ChatMode; prompt: string; uiMode?: string }) => void;
  /**
   * User saved provider settings.
   */
  onSaveProvider: (data: {
    baseUrl: string;
    model: string;
    backend: 'openai' | 'openclaude';
    apiKey?: string;
    token?: string;
  }) => void;
  /**
   * User requested provider test.
   */
  onTestProvider: () => void;
  /**
   * User selected a session in drawer.
   */
  onSelectSession: (sessionId: string) => void;
  /**
   * User renamed one session.
   */
  onRenameSession: (data: { sessionId: string; title: string }) => void;
  /**
   * User toggled pin on one session.
   */
  onTogglePinSession: (sessionId: string) => void;
  /**
   * User archive/restored one session.
   */
  onArchiveSession: (data: { sessionId: string; archived: boolean }) => void;
  /**
   * User removed one session.
   */
  onDeleteSession: (sessionId: string) => void;
  /**
   * User requested stream cancellation.
   */
  onStopStream: (sessionId?: string) => void;
  /**
   * User requested session export.
   */
  onExportSession: (sessionId?: string) => void;
  /**
   * User requested panel maximize/focus.
   */
  onMaximizePanel: () => void;
  /**
   * User requested panel move.
   */
  onMovePanel: () => void;
  /**
   * User requested extension settings.
   */
  onOpenSettings: () => void;
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
    this.state = { ...this.state, isStreaming: true, currentSessionId: sessionId };
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
    this.state = { ...this.state, isStreaming: false, currentSessionId: sessionId };
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
          this.events?.onCreateSession((message.data?.mode as ChatMode) ?? 'planning');
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
        case 'chat-session-select':
          this.events?.onSelectSession(message.data?.sessionId);
          break;
        case 'chat-session-rename':
          this.events?.onRenameSession(message.data);
          break;
        case 'chat-session-pin':
          this.events?.onTogglePinSession(message.data?.sessionId);
          break;
        case 'chat-session-archive':
          this.events?.onArchiveSession(message.data);
          break;
        case 'chat-session-delete':
          this.events?.onDeleteSession(message.data?.sessionId);
          break;
        case 'chat-stop-stream':
          this.events?.onStopStream(message.data?.sessionId);
          break;
        case 'chat-export-session':
          this.events?.onExportSession(message.data?.sessionId);
          break;
        case 'panel-maximize':
          this.events?.onMaximizePanel();
          break;
        case 'panel-move':
          this.events?.onMovePanel();
          break;
        case 'panel-open-settings':
          this.events?.onOpenSettings();
          break;
      }
    });
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

