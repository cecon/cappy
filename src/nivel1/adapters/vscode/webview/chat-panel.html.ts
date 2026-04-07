/**
 * @fileoverview Chat panel HTML template.
 * @module webview/chat-panel.html
 */

import { CHAT_PANEL_CSS } from './chat-panel.css';
import { generateChatPanelScript } from './chat-panel.js';

/**
 * Input params for HTML generation.
 */
export interface ChatPanelHtmlParams {
  /**
   * Resolved icon URI.
   */
  iconUri: string;
  /**
   * Initial serialized state.
   */
  initialStateJson: string;
}

/**
 * Generates complete HTML for chat panel webview.
 */
export function generateChatPanelHtml(params: ChatPanelHtmlParams): string {
  const script = generateChatPanelScript(params.initialStateJson);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${CHAT_PANEL_CSS}</style>
</head>
<body>
  <div class="chat-shell">
    <header class="chat-header">
      <div class="chat-header-left">
        <img src="${params.iconUri}" alt="Cappy" class="brand-icon" />
        <button id="session-title-btn" class="session-title-btn" title="Editar título">
          <span id="session-title-text">New Chat</span>
        </button>
        <input id="session-title-input" class="session-title-input hidden" maxlength="120" />
      </div>
      <div class="chat-header-actions">
        <button id="btn-new-chat" class="icon-btn" title="New Chat"><svg viewBox="0 0 16 16"><path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/></svg></button>
        <button id="btn-toggle-history" class="icon-btn" title="Histórico"><svg viewBox="0 0 16 16"><path d="M8 1a7 7 0 1 0 7 7h-1a6 6 0 1 1-6-6V1zm-.5 3h1v4.5l3 2-.5.86L7.5 9V4z"/></svg></button>
        <button id="btn-maximize" class="icon-btn" title="Maximizar painel"><svg viewBox="0 0 16 16"><path d="M2 2h5v1H3v4H2V2zm12 0v5h-1V3H9V2h5zM2 9h1v4h4v1H2V9zm11 0h1v5H9v-1h4V9z"/></svg></button>
        <button id="btn-settings" class="icon-btn" title="Configurações"><svg viewBox="0 0 16 16"><path d="M9.6 1l.4 1.6c.3.1.7.2 1 .4L12.5 2l1.5 1.5-1 1.5c.2.3.3.7.4 1l1.6.4v2.1l-1.6.4c-.1.3-.2.7-.4 1l1 1.5-1.5 1.5-1.5-1c-.3.2-.7.3-1 .4L9.6 15H7.5l-.4-1.6c-.3-.1-.7-.2-1-.4l-1.5 1-1.5-1.5 1-1.5c-.2-.3-.3-.7-.4-1L1 8.5V6.4l1.6-.4c.1-.3.2-.7.4-1l-1-1.5L3.5 2l1.5 1c.3-.2.7-.3 1-.4L7.5 1h2.1zM8.5 5.2A2.8 2.8 0 1 0 8.5 10.8 2.8 2.8 0 0 0 8.5 5.2z"/></svg></button>
        <div class="menu-wrap">
          <button id="btn-menu" class="icon-btn" title="Mais opções"><svg viewBox="0 0 16 16"><path d="M3 8a1.5 1.5 0 1 1 0 .001V8zm5 0a1.5 1.5 0 1 1 0 .001V8zm5 0a1.5 1.5 0 1 1 0 .001V8z"/></svg></button>
          <div id="header-menu" class="header-menu hidden">
            <button id="menu-move-panel" class="menu-item">Mover painel</button>
            <button id="menu-export" class="menu-item">Exportar sessão</button>
            <button id="menu-settings" class="menu-item">Configurações</button>
          </div>
        </div>
      </div>
    </header>

    <div class="chat-main">
      <aside id="sessions-drawer" class="sessions-drawer">
        <div class="drawer-header">
          <input id="session-search" class="session-search" placeholder="Buscar sessões..." />
        </div>
        <div id="sessions-list" class="sessions-list"></div>
      </aside>

      <section class="chat-content">
        <div id="messages" class="messages"></div>
        <div id="streaming-indicator" class="streaming-indicator hidden">
          <span></span><span></span><span></span>
          <span class="streaming-label">Gerando resposta...</span>
        </div>

        <footer class="input-area">
          <div class="composer-shell">
          <textarea id="prompt" class="prompt-input" rows="1" placeholder="Ask Cappy..."></textarea>
          <div class="input-toolbar">
            <button id="btn-attach" class="toolbar-btn" title="Anexar contexto"><svg viewBox="0 0 16 16"><path d="M7.5 1a4.5 4.5 0 0 1 4.5 4.5V11a3.5 3.5 0 0 1-7 0V4h1v7a2.5 2.5 0 0 0 5 0V5.5a3.5 3.5 0 0 0-7 0V11a4.5 4.5 0 0 0 9 0V4h1v7a5.5 5.5 0 0 1-11 0V5.5A4.5 4.5 0 0 1 7.5 1z"/></svg></button>

            <div class="mode-selector-wrap">
              <button id="btn-mode" class="mode-selector" title="Selecionar modo">
                <span id="mode-label">Plan</span>
                <span>▾</span>
              </button>
              <div id="mode-menu" class="mode-menu hidden">
                <button data-ui-mode="agent" class="mode-option">Agent</button>
                <button data-ui-mode="plan" class="mode-option">Plan</button>
                <button data-ui-mode="debug" class="mode-option">Debug</button>
                <button data-ui-mode="ask" class="mode-option">Ask</button>
              </div>
            </div>

            <select id="provider-model" class="compact-select"></select>
            <button id="btn-send" class="send-btn" title="Enviar"><svg viewBox="0 0 16 16"><path d="M15 1 1 7l5 2 2 5 7-14zM6.8 8.2l-3.2-1.3 8.7-3.8-5.5 5.1z"/></svg></button>
            <button id="btn-stop-inline" class="stop-btn hidden" title="Parar">Stop</button>
            <span id="context-usage" class="context-usage"><span>0</span><span>/ 0</span></span>
          </div>
          </div>
        </footer>
      </div>
      </section>
    </div>

    <div id="status" class="status"></div>
  </div>

  <div id="settings-modal" class="modal hidden">
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <h3>Configurações do Provider</h3>
      <label>Provider</label>
      <select id="backend" class="modal-input">
        <option value="openai">OpenAI-Compatible</option>
        <option value="openclaude">OpenClaude Externo</option>
      </select>
      <label>Model</label>
      <input id="model" class="modal-input" placeholder="gpt-4o-mini" />
      <label>Base URL</label>
      <input id="baseUrl" class="modal-input" placeholder="https://api.openai.com/v1" />
      <label>API Key</label>
      <input id="apiKey" class="modal-input" type="password" placeholder="sk-..." />
      <label>Token</label>
      <input id="token" class="modal-input" type="password" placeholder="token opcional..." />
      <div class="modal-actions">
        <button id="btn-test-provider" class="modal-btn ghost">Testar conexão</button>
        <button id="btn-cancel-settings" class="modal-btn ghost">Cancelar</button>
        <button id="btn-save-provider" class="modal-btn primary">Salvar</button>
      </div>
    </div>
  </div>

  <script>${script}</script>
</body>
</html>`;
}

