/**
 * @fileoverview Dashboard HTML template
 * Extracted from the monolithic cappy-webview.ts following SOLID/SRP.
 */

import { DASHBOARD_CSS } from './dashboard.css';
import { generateDashboardScript } from './dashboard.js';

export interface DashboardParams {
  iconUri: string;
  initialStatusJson: string;
  initialNotebooksJson: string;
}

/**
 * Generate the full HTML document for the Dashboard webview.
 */
export function generateDashboardHtml(params: DashboardParams): string {
  const { iconUri, initialStatusJson, initialNotebooksJson } = params;
  const script = generateDashboardScript(initialStatusJson, initialNotebooksJson);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${DASHBOARD_CSS}</style>
</head>
<body>

  <!-- ── Header ── -->
  <div class="header">
    <img src="${iconUri}" alt="Cappy" />
    <div class="header-text">
      <span class="header-title">Cappy</span>
      <span class="header-sub">WhatsApp Dev Bridge</span>
    </div>
  </div>

  <!-- ── Hero Status Card ── -->
  <div class="card" id="hero-card">
    <div id="status-ring" class="status-ring ring-disconnected">
      <span class="ring-icon"><svg viewBox="0 0 16 16"><path d="M11 1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM5 2h6v10H5V2zm2.5 11.5a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0z"/></svg></span>
    </div>
    <div id="status-label" class="status-label">Desconectado</div>
    <div id="status-hint" class="status-hint">Conecte ao WhatsApp para começar</div>

    <div id="qr-area" class="hidden">
      <div class="qr-container">
        <div class="qr-frame">
          <img id="qr-img" class="qr-img" alt="QR Code" />
        </div>
        <div class="qr-steps">
          <b>1.</b> Abra o WhatsApp<br/>
          <b>2.</b> Dispositivos Conectados<br/>
          <b>3.</b> Conectar Dispositivo
        </div>
      </div>
    </div>

    <button id="btn-connect" class="btn btn-cta" onclick="connect()">
      Conectar WhatsApp
    </button>
  </div>

  <!-- ── Tab Bar ── -->
  <div class="tab-bar">
    <button class="tab-btn active" data-tab="whatsapp" onclick="switchTab('whatsapp')">
      <svg viewBox="0 0 16 16"><path d="M14 1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3.5l2.5 3 2.5-3H14a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM14 10h-3.87L8 12.87 5.87 10H2V2h12v8z"/></svg>
      WhatsApp
      <span class="tab-badge" id="tab-badge-whatsapp"></span>
    </button>
    <button class="tab-btn" data-tab="tarefas" onclick="switchTab('tarefas')">
      <svg viewBox="0 0 16 16"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12zm2.85-8.85L8 8V4H7v4.5l3.15 2.35.6-.85L8 8z"/></svg>
      Tarefas
      <span class="tab-badge" id="tab-badge-tarefas"></span>
    </button>
    <button class="tab-btn" data-tab="notebooks" onclick="switchTab('notebooks')">
      <svg viewBox="0 0 16 16"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm0 1v12h10V2H3zm2 2h6v1H5V4zm0 3h6v1H5V7zm0 3h4v1H5v-1z"/></svg>
      Notebooks
      <span class="tab-badge" id="tab-badge-notebooks"></span>
    </button>
  </div>

  <!-- ═══════════════════ TAB: WhatsApp ═══════════════════ -->
  <div class="tab-panel active" id="tab-whatsapp">

    <!-- Info Chips (visible when connected) -->
    <div id="info-area" class="hidden">
      <div class="info-chips">
        <span class="chip">
          <span class="chip-icon" id="role-icon"><svg viewBox="0 0 16 16"><path d="M5.56 14.56a.5.5 0 0 1-.09-.98L9.43 8H6a.5.5 0 0 1-.46-.7l3-7a.5.5 0 1 1 .92.4L6.6 7H10a.5.5 0 0 1 .43.76l-4.5 6.5a.5.5 0 0 1-.37.3z"/></svg></span>
          <span id="role-text">—</span>
        </span>
        <span class="chip">
          <span class="chip-icon"><svg viewBox="0 0 16 16"><path d="M14.5 3H7.71l-.86-.86A.48.48 0 0 0 6.5 2h-5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5zM14 13H2V3h4.29l.86.86a.48.48 0 0 0 .35.14H14v9z"/></svg></span>
          <span id="project-count">0</span> projeto(s)
        </span>
      </div>
      <div id="project-tags" class="project-tags"></div>
    </div>

    <!-- Messages Card -->
    <div class="card" id="messages-card">
      <div class="card-label">
        <span style="display:flex;align-items:center;gap:5px;"><svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M14 1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3.5l2.5 3 2.5-3H14a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM14 10h-3.87L8 12.87 5.87 10H2V2h12v8z"/></svg> Mensagens</span>
        <span id="msg-count" style="font-size:10px;opacity:0.6;"></span>
      </div>
      <div id="chat-area" class="chat-area">
        <div class="chat-empty" id="chat-empty">
          <span class="chat-empty-icon"><svg viewBox="0 0 16 16"><path d="M14 1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3.5l2.5 3 2.5-3H14a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM14 10h-3.87L8 12.87 5.87 10H2V2h12v8z"/></svg></span>
          <span class="chat-empty-text">Nenhuma mensagem ainda.<br/>As mensagens do WhatsApp aparecerão aqui.</span>
        </div>
      </div>
    </div>

    <!-- Settings Accordion -->
    <div class="accordion" style="margin-bottom:10px;">
      <button class="accordion-trigger" onclick="toggleAccordion(this)" aria-expanded="false">
        <span style="display:flex;align-items:center;gap:5px;"><svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.7-1.3 2 .8.8 2-1.3.7.3.5 2.4h1.2l.5-2.4.7-.3 2 1.3.8-.8-1.3-2 .3-.7 2.4-.5V6.8l-2.4-.5-.3-.7 1.3-2-.8-.8-2 1.3-.7-.3zM9.4 1l.5 2.4L12 2.1l2 2-1.4 2.1 2.4.4v2.8l-2.4.5L14 12l-2 2-2.1-1.4-.5 2.4H6.6l-.5-2.4L4 13.9l-2-2 1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.4.4-2.4h2.8zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-1a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg> Configurações</span>
        <span class="chevron"><svg viewBox="0 0 16 16"><path d="M8 10.5l-4.5-4.5h9z"/></svg></span>
      </button>
      <div class="accordion-content" id="settings-content">
        <label class="setting-label">Modo Bridge</label>
        <select id="setting-mode" class="select-field" onchange="changeSetting('mode', this.value)">
          <option value="auto">Auto (terminal se disponível)</option>
          <option value="agent">Agent (planning interno)</option>
          <option value="terminal">Terminal (relay para AI)</option>
        </select>

        <label class="setting-label">Filtro de Mensagens</label>
        <select id="setting-filter" class="select-field" onchange="changeSetting('chatFilter', this.value)">
          <option value="self">Só self-chat (mais seguro)</option>
          <option value="group">Grupo específico</option>
          <option value="allow_all">Todas (não recomendado)</option>
        </select>

        <div id="group-setting" class="hidden">
          <label class="setting-label">Nome do Grupo</label>
          <input id="setting-group" class="input-field" type="text" placeholder="Cappy Dev" onchange="changeSetting('allowedGroupName', this.value)" />
        </div>
      </div>
    </div>

  </div>

  <!-- ═══════════════════ TAB: Tarefas ═══════════════════ -->
  <div class="tab-panel" id="tab-tarefas">

    <div class="card" id="scheduler-card">
      <div class="card-label">
        <span style="display:flex;align-items:center;gap:5px;"><svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12zm2.85-8.85L8 8V4H7v4.5l3.15 2.35.6-.85L8 8z"/></svg> Tarefas Agendadas</span>
        <span id="sched-count" style="font-size:10px;opacity:0.6;"></span>
      </div>

      <div id="scheduler-list" class="scheduler-list">
        <div class="sched-empty" id="sched-empty">
          <svg style="width:24px;height:24px;fill:currentColor;opacity:0.3;display:block;margin:0 auto 6px" viewBox="0 0 16 16"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12zm2.85-8.85L8 8V4H7v4.5l3.15 2.35.6-.85L8 8z"/></svg>
          Nenhuma tarefa agendada.<br/>Clique em + para criar uma.
        </div>
      </div>

      <div id="sched-form" class="sched-form hidden">
        <label class="setting-label" style="margin-top:0">Nome da Tarefa</label>
        <input id="sched-name" class="input-field" type="text" placeholder="Ex: Build Automático" />
        <label class="setting-label">Workflow</label>
        <input id="sched-workflow" class="input-field" type="text" placeholder="Ex: /build" />
        <div class="sched-form-row">
          <div style="flex:1">
            <label class="setting-label">Tipo</label>
            <select id="sched-runmode" class="select-field" style="margin-top:4px" onchange="onRunModeChange()">
              <option value="recurring">Recorrente</option>
              <option value="once">Única (1x)</option>
            </select>
          </div>
          <div style="flex:1">
            <label class="setting-label" id="sched-interval-label">Intervalo (min)</label>
            <input id="sched-interval" class="input-field" type="number" min="1" value="30" />
          </div>
        </div>
        <div class="sched-form-row">
          <div style="flex:1">
            <label class="setting-label">Modo de Execução</label>
            <select id="sched-mode" class="select-field" style="margin-top:4px">
              <option value="new_chat">Novo Chat</option>
              <option value="terminal">Terminal</option>
            </select>
          </div>
        </div>
        <div class="sched-form-row">
          <div style="flex:1">
            <label class="setting-label">Notificar WhatsApp</label>
            <select id="sched-notify" class="select-field" style="margin-top:4px">
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:4px">
          <button class="btn btn-cta btn-sm" style="flex:1" onclick="addScheduledTask()">Criar Tarefa</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleSchedForm(false)">Cancelar</button>
        </div>
      </div>

      <button class="btn btn-ghost" id="btn-add-sched" onclick="toggleSchedForm(true)" style="margin-top:8px;gap:5px;">
        <svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/></svg> Nova Tarefa
      </button>
    </div>

  </div>

  <!-- ═══════════════════ TAB: Notebooks ═══════════════════ -->
  <div class="tab-panel" id="tab-notebooks">

    <div class="card" id="notebooks-card">
      <div class="card-label">
        <span style="display:flex;align-items:center;gap:5px;"><svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm0 1v12h10V2H3zm2 2h6v1H5V4zm0 3h6v1H5V7zm0 3h4v1H5v-1z"/></svg> Notebooks RAG</span>
        <span id="notebook-count" style="font-size:10px;opacity:0.6;"></span>
      </div>

      <div id="notebook-list" class="notebook-list">
        <div class="notebook-empty" id="notebook-empty">
          <span class="notebook-empty-icon"><svg viewBox="0 0 16 16"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm0 1v12h10V2H3zm2 2h6v1H5V4zm0 3h6v1H5V7zm0 3h4v1H5v-1z"/></svg></span>
          <span class="notebook-empty-text">Nenhum notebook encontrado.<br/>Use <b>@cappy /ingest</b> para criar um.</span>
        </div>
      </div>

      <button class="btn btn-ghost" onclick="refreshNotebooks()" style="margin-top:8px;gap:5px;">
        <svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M13.5 2A.5.5 0 0 0 13 2.5V5a.5.5 0 0 0 .5.5H16a.5.5 0 0 0 0-1h-1.05A5.98 5.98 0 0 0 8.05 2 6 6 0 0 0 2 8a6 6 0 0 0 6 6 5.97 5.97 0 0 0 4.95-2.63.5.5 0 0 0-.83-.56A4.98 4.98 0 0 1 8 13a5 5 0 0 1-5-5 5 5 0 0 1 5-5 4.98 4.98 0 0 1 4.38 2.5H11a.5.5 0 0 0 0 1h3a.5.5 0 0 0 .5-.5V2.5a.5.5 0 0 0-.5-.5h-.5z"/></svg> Atualizar
      </button>
    </div>

  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <button class="btn btn-ghost" onclick="refresh()" style="gap:5px;"><svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M13.5 2A.5.5 0 0 0 13 2.5V5a.5.5 0 0 0 .5.5H16a.5.5 0 0 0 0-1h-1.05A5.98 5.98 0 0 0 8.05 2 6 6 0 0 0 2 8a6 6 0 0 0 6 6 5.97 5.97 0 0 0 4.95-2.63.5.5 0 0 0-.83-.56A4.98 4.98 0 0 1 8 13a5 5 0 0 1-5-5 5 5 0 0 1 5-5 4.98 4.98 0 0 1 4.38 2.5H11a.5.5 0 0 0 0 1h3a.5.5 0 0 0 .5-.5V2.5a.5.5 0 0 0-.5-.5h-.5z"/></svg> Atualizar</button>
  </div>

  <script>${script}</script>
</body>
</html>`;
}
