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
  <div class="app">
    <div class="header">
      <img src="${params.iconUri}" alt="Cappy" />
      <div>
        <div class="title">Cappy Chat Agent</div>
        <div class="subtitle">Planning + Sandbox</div>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <div>
          <div class="label">Sessão</div>
          <select id="session" class="select"></select>
        </div>
        <div style="max-width:130px;">
          <div class="label">Modo</div>
          <select id="mode" class="select">
            <option value="planning">Planning</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </div>
        <div style="max-width:110px;display:flex;align-items:end;">
          <button id="btn-new-session" class="btn btn-ghost">Nova</button>
        </div>
      </div>
    </div>

    <div class="card card-messages">
      <div class="label">Mensagens</div>
      <div id="messages" class="messages"></div>
    </div>

    <div class="card">
      <div class="label">Prompt</div>
      <textarea id="prompt" class="textarea" placeholder="Descreva a tarefa..."></textarea>
      <div class="row" style="margin-top:8px;">
        <button id="btn-send" class="btn btn-primary">Enviar</button>
      </div>
      <div id="status" class="status"></div>
    </div>

    <div class="card">
      <div class="label">Provider</div>
      <div class="row">
        <div>
          <div class="label">Backend</div>
          <select id="backend" class="select">
            <option value="openai">OpenAI-Compatible</option>
            <option value="openclaude">OpenClaude Externo</option>
          </select>
        </div>
        <div>
          <div class="label">Model</div>
          <input id="model" class="input" placeholder="gpt-4o-mini" />
        </div>
      </div>
      <div style="margin-top:8px;">
        <div class="label">Base URL</div>
        <input id="baseUrl" class="input" placeholder="https://api.openai.com/v1" />
      </div>
      <div style="margin-top:8px;">
        <div class="label">API Key (opcional)</div>
        <input id="apiKey" class="input" type="password" placeholder="sk-..." />
      </div>
      <div class="row" style="margin-top:8px;">
        <button id="btn-save-provider" class="btn btn-primary">Salvar</button>
        <button id="btn-test-provider" class="btn btn-ghost">Testar</button>
      </div>
    </div>
  </div>

  <script>${script}</script>
</body>
</html>`;
}

