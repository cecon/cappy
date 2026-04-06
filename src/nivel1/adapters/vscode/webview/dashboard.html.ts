/**
 * @fileoverview Dashboard HTML template
 * Extracted from the monolithic cappy-webview.ts following SOLID/SRP.
 */

import { DASHBOARD_CSS } from './dashboard.css';
import { generateDashboardScript } from './dashboard.js';

export interface DashboardParams {
  iconUri: string;
  initialStatusJson: string;
}

/**
 * Generate the full HTML document for the Dashboard webview.
 */
export function generateDashboardHtml(params: DashboardParams): string {
  const { iconUri, initialStatusJson } = params;
  const script = generateDashboardScript(initialStatusJson);

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
      <span class="header-sub">AI Planning Companion</span>
    </div>
  </div>

  <!-- ── Hero Status Card ── -->
  <div class="card" id="hero-card">
    <div id="status-ring" class="status-ring ring-connected">
      <span class="ring-icon"><svg viewBox="0 0 16 16"><path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"/></svg></span>
    </div>
    <div id="status-label" class="status-label">Ativo na IDE</div>
    <div id="status-hint" class="status-hint">Painel focado em planejamento e automações locais.</div>
  </div>

  <!-- ── Scheduler Card ── -->
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
      <div style="display:flex;gap:6px;margin-top:4px">
        <button class="btn btn-cta btn-sm" style="flex:1" onclick="addScheduledTask()">Criar Tarefa</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleSchedForm(false)">Cancelar</button>
      </div>
    </div>

    <button class="btn btn-ghost" id="btn-add-sched" onclick="toggleSchedForm(true)" style="margin-top:8px;gap:5px;">
      <svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/></svg> Nova Tarefa
    </button>
  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <button class="btn btn-ghost" onclick="refresh()" style="gap:5px;"><svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M13.5 2A.5.5 0 0 0 13 2.5V5a.5.5 0 0 0 .5.5H16a.5.5 0 0 0 0-1h-1.05A5.98 5.98 0 0 0 8.05 2 6 6 0 0 0 2 8a6 6 0 0 0 6 6 5.97 5.97 0 0 0 4.95-2.63.5.5 0 0 0-.83-.56A4.98 4.98 0 0 1 8 13a5 5 0 0 1-5-5 5 5 0 0 1 5-5 4.98 4.98 0 0 1 4.38 2.5H11a.5.5 0 0 0 0 1h3a.5.5 0 0 0 .5-.5V2.5a.5.5 0 0 0-.5-.5h-.5z"/></svg> Atualizar</button>
  </div>

  <script>${script}</script>
</body>
</html>`;
}
