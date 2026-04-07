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
        <button id="btn-new-chat" class="icon-btn" title="New Chat">+</button>
        <button id="btn-toggle-history" class="icon-btn" title="Histórico">🕘</button>
        <button id="btn-maximize" class="icon-btn" title="Maximizar painel">⛶</button>
        <button id="btn-settings" class="icon-btn" title="Configurações">⚙</button>
        <div class="menu-wrap">
          <button id="btn-menu" class="icon-btn" title="Mais opções">⋯</button>
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
          <button id="btn-stop-stream" class="stop-btn">Stop</button>
        </div>

        <footer class="input-area">
          <textarea id="prompt" class="prompt-input" rows="1" placeholder="Ask Cappy..."></textarea>
          <div class="input-toolbar">
            <button id="btn-attach" class="toolbar-btn" title="Anexar contexto">@</button>

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
            <button id="btn-send" class="send-btn" title="Enviar">➤</button>
            <button id="btn-stop-inline" class="stop-btn hidden" title="Parar">Stop</button>
            <span id="context-usage" class="context-usage">0 / 0</span>
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

