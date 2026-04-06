/**
 * @fileoverview Dashboard client-side JavaScript
 * Extracted from the monolithic cappy-webview.ts following SOLID/SRP.
 * Returns a string of JS to be injected into the webview <script> tag.
 */

/**
 * Generate the client-side JavaScript for the Dashboard webview.
 * @param initialStatusJson - JSON string of the initial status, or 'null'
 */
export function generateDashboardScript(initialStatusJson: string): string {
  return `
    const vscode = acquireVsCodeApi();
    // ── UI Actions ──
    function refresh() { vscode.postMessage({ type: 'refresh' }); }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // ── Scheduler ──

    var schedulerTasks = [];

    function toggleSchedForm(show) {
      document.getElementById('sched-form').classList.toggle('hidden', !show);
      document.getElementById('btn-add-sched').classList.toggle('hidden', show);
      if (show) document.getElementById('sched-name').focus();
    }

    function addScheduledTask() {
      var name = document.getElementById('sched-name').value.trim();
      var workflow = document.getElementById('sched-workflow').value.trim();
      var interval = parseInt(document.getElementById('sched-interval').value, 10);
      var execMode = document.getElementById('sched-mode').value;
      var runMode = document.getElementById('sched-runmode').value;

      if (!name || !workflow || !interval || interval < 1) return;

      var data = { name: name, workflow: workflow, intervalMinutes: interval, executionMode: execMode, runMode: runMode };
      if (runMode === 'once') data.delayMinutes = interval;

      vscode.postMessage({ type: 'scheduler-add', data: data });

      document.getElementById('sched-name').value = '';
      document.getElementById('sched-workflow').value = '';
      document.getElementById('sched-interval').value = '30';
      document.getElementById('sched-runmode').value = 'recurring';
      onRunModeChange();
      toggleSchedForm(false);
    }

    function onRunModeChange() {
      var mode = document.getElementById('sched-runmode').value;
      document.getElementById('sched-interval-label').textContent = mode === 'once' ? 'Atraso (min)' : 'Intervalo (min)';
    }

    function toggleSchedulerTask(taskId) { vscode.postMessage({ type: 'scheduler-toggle', data: taskId }); }
    function removeSchedulerTask(taskId) { vscode.postMessage({ type: 'scheduler-remove', data: taskId }); }
    function runSchedulerTask(taskId) { vscode.postMessage({ type: 'scheduler-run', data: taskId }); }

    function renderSchedulerTasks(tasks) {
      schedulerTasks = tasks;
      var list = document.getElementById('scheduler-list');
      var countEl = document.getElementById('sched-count');

      if (!tasks || tasks.length === 0) {
        list.innerHTML = '<div class="sched-empty" id="sched-empty"><svg style="width:24px;height:24px;fill:currentColor;opacity:0.3;display:block;margin:0 auto 6px" viewBox="0 0 16 16"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12zm2.85-8.85L8 8V4H7v4.5l3.15 2.35.6-.85L8 8z"/></svg>Nenhuma tarefa agendada.<br/>Clique em + para criar uma.</div>';
        countEl.textContent = '';
        return;
      }

      countEl.textContent = '(' + tasks.length + ')';
      list.innerHTML = tasks.map(function(t) {
        var dotClass = t.lastStatus === 'running' ? 'sched-dot-running'
          : t.lastStatus === 'error' ? 'sched-dot-error'
          : t.enabled ? 'sched-dot-active' : 'sched-dot-paused';
        var statusText = t.lastStatus === 'running' ? 'Executando...'
          : t.enabled ? 'Ativa' : 'Pausada';
        var lastRun = t.lastRun
          ? new Date(t.lastRun).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '\\u2014';
        var toggleIcon = t.enabled
          ? '<svg viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>'
          : '<svg viewBox="0 0 16 16"><path d="M3 2l10 6-10 6V2z"/></svg>';

        var isOnce = t.runMode === 'once';
        var timeLabel = isOnce
          ? '1x em ' + (t.delayMinutes || t.intervalMinutes) + 'min'
          : 'a cada ' + t.intervalMinutes + 'min';

        return '<div class="sched-item" data-id="' + t.id + '">'
          + '<div class="sched-info">'
          + '<div class="sched-name">' + escapeHtml(t.name) + '</div>'
          + '<div class="sched-meta">'
          + '<span class="sched-status-dot ' + dotClass + '"></span>'
          + statusText
          + ' \\u00b7 ' + escapeHtml(t.workflow)
          + ' \\u00b7 ' + timeLabel
          + ' \\u00b7 ' + (t.executionMode === 'terminal' ? '\\ud83d\\udcbb Terminal' : '\\ud83d\\udcac Chat')
          + ' \\u00b7 \\u00daltimo: ' + lastRun
          + '</div></div>'
          + '<div class="sched-actions">'
          + '<button class="sched-btn" title="Executar agora" onclick="runSchedulerTask(\\'' + t.id + '\\')">' + '<svg viewBox="0 0 16 16"><path d="M3 2l10 6-10 6V2z"/></svg></button>'
          + (isOnce ? '' : '<button class="sched-btn" title="' + (t.enabled ? 'Pausar' : 'Ativar') + '" onclick="toggleSchedulerTask(\\'' + t.id + '\\')">' + toggleIcon + '</button>')
          + '<button class="sched-btn" title="Remover" onclick="removeSchedulerTask(\\'' + t.id + '\\')">' + '<svg viewBox="0 0 16 16"><path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/></svg></button>'
          + '</div></div>';
      }).join('');
    }

    function updateSchedulerTaskStatus(taskId, status) {
      var task = schedulerTasks.find(function(t) { return t.id === taskId; });
      if (task) {
        task.lastStatus = status;
        if (status !== 'running') task.lastRun = new Date().toISOString();
        renderSchedulerTasks(schedulerTasks);
      }
    }

    // ── Message Listener (extension → webview) ──

    window.addEventListener('message', function(event) {
      var msg = event.data;
      switch (msg.type) {
        case 'scheduler-tasks': renderSchedulerTasks(msg.data); break;
        case 'scheduler-running': updateSchedulerTaskStatus(msg.data, 'running'); break;
        case 'scheduler-complete': updateSchedulerTaskStatus(msg.data.taskId, msg.data.status); break;
      }
    });

    // ── Initialization ──

    // Reserved for future startup state payloads.
    var __INITIAL_STATUS__ = ${initialStatusJson};
    void __INITIAL_STATUS__;

    // Notify extension that webview JS is ready (for postMessage-based updates)
    vscode.postMessage({ type: 'webview-ready' });
  `;
}
