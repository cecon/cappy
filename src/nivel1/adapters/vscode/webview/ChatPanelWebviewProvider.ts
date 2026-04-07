/**
 * @fileoverview Webview provider for Cappy chat panel.
 * @module webview/ChatPanelWebviewProvider
 */

import * as vscode from 'vscode';
import type { ChatMode, ChatSession, ProviderSettings } from '../../../../shared/types/agent';
import {
  DEFAULT_PROVIDER_BACKEND,
  DEFAULT_PROVIDER_BASE_URL,
  DEFAULT_PROVIDER_MODEL,
} from '../../../../shared/constants/llm-config';
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
  /**
   * Available provider models for selector.
   */
  availableModels?: string[];
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
  onSendMessage: (data: { sessionId?: string; mode: ChatMode; prompt: string; uiMode?: string; mentions?: string[] }) => void;
  /**
   * User requested workspace mention suggestions.
   */
  onWorkspaceMentionSearch: (query: string) => void;
  /**
   * User saved provider settings.
   */
  onSaveProvider: (data: {
    baseUrl: string;
    backend: 'openai' | 'openclaude';
    apiKey?: string;
    token?: string;
  }) => void;
  /**
   * User selected model from composer dropdown.
   */
  onSelectProviderModel: (model: string) => void;
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
  /**
   * User changed current UI mode selector.
   */
  onSetUIMode: (mode: 'agent' | 'plan' | 'debug' | 'ask' | 'sandbox') => void;
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
      baseUrl: DEFAULT_PROVIDER_BASE_URL,
      model: DEFAULT_PROVIDER_MODEL,
      backend: DEFAULT_PROVIDER_BACKEND,
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
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken,
  ): void {
    void context;
    void token;
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.buildHtml();

    webviewView.webview.onDidReceiveMessage((message: { type: string; data?: Record<string, unknown> }) => {
      const data = message.data ?? {};
      const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
      switch (message.type) {
        case 'webview-ready':
          this.events?.onReady();
          break;
        case 'chat-create-session':
          this.events?.onCreateSession((data.mode as ChatMode) ?? 'planning');
          break;
        case 'chat-send':
          this.events?.onSendMessage(data as {
            sessionId?: string;
            mode: ChatMode;
            prompt: string;
            uiMode?: string;
            mentions?: string[];
          });
          break;
        case 'workspace-mention-search':
          this.events?.onWorkspaceMentionSearch(asString(data.query));
          break;
        case 'provider-save':
          this.events?.onSaveProvider(data as {
            baseUrl: string;
            backend: 'openai' | 'openclaude';
            apiKey?: string;
            token?: string;
          });
          break;
        case 'provider-model-select':
          this.events?.onSelectProviderModel(asString(data.model));
          break;
        case 'provider-test':
          this.events?.onTestProvider();
          break;
        case 'chat-session-select':
          this.events?.onSelectSession(asString(data.sessionId));
          break;
        case 'chat-session-rename':
          this.events?.onRenameSession(data as { sessionId: string; title: string });
          break;
        case 'chat-session-pin':
          this.events?.onTogglePinSession(asString(data.sessionId));
          break;
        case 'chat-session-archive':
          this.events?.onArchiveSession(data as { sessionId: string; archived: boolean });
          break;
        case 'chat-session-delete':
          this.events?.onDeleteSession(asString(data.sessionId));
          break;
        case 'chat-stop-stream':
          this.events?.onStopStream(asString(data.sessionId) || undefined);
          break;
        case 'chat-export-session':
          this.events?.onExportSession(asString(data.sessionId) || undefined);
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
        case 'chat-ui-mode':
          if (
            data.uiMode === 'agent'
            || data.uiMode === 'plan'
            || data.uiMode === 'debug'
            || data.uiMode === 'ask'
            || data.uiMode === 'sandbox'
          ) {
            this.events?.onSetUIMode(data.uiMode);
          }
          break;
      }
    });
  }

  /**
   * Builds HTML with latest state snapshot.
   */
  private buildHtml(): string {
    const nonce = this.createNonce();
    const iconUri = this.view
      ? this.view.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'assets', 'icon.png')).toString()
      : '';
    // Escape serialized payload so inline script parsing stays stable in webview.
    const initialStateJson = JSON.stringify(this.state)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    return generateChatPanelHtml({
      iconUri,
      initialStateJson,
      nonce,
      cspSource: this.view?.webview.cspSource ?? '',
    });
  }

  /**
   * Creates a random nonce for script CSP.
   */
  private createNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let value = '';
    for (let index = 0; index < 32; index += 1) {
      value += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return value;
  }
}

