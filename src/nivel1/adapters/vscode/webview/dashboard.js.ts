/**
 * @fileoverview Dashboard client-side JavaScript
 * Extracted from the monolithic cappy-webview.ts following SOLID/SRP.
 * Returns a string of JS to be injected into the webview <script> tag.
 */

/**
 * Generate the client-side JavaScript for the Dashboard webview.
 * @param initialStatusJson - JSON string of the initial status, or 'null'
 * @param initialNotebooksJson - JSON string of the initial notebooks list, or '[]'
 */
export function generateDashboardScript(initialStatusJson: string, initialNotebooksJson: string): string {
  return `
    const vscode = acquireVsCodeApi();
    let currentState = 'disconnected';

    // ── Status Management ──

    function setWAStatus(status) {
      currentState = status;
      const ring = document.getElementById('status-ring');
      const label = document.getElementById('status-label');
      const hint = document.getElementById('status-hint');
      const btn = document.getElementById('btn-connect');
      const infoArea = document.getElementById('info-area');

      ring.className = 'status-ring';

      switch (status) {
        case 'connected':
          ring.classList.add('ring-connected');
          ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"/></svg>';
          label.textContent = 'Conectado';
          hint.textContent = 'WhatsApp ativo e recebendo mensagens';
          btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 16 16"><path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"/></svg> Conectado';
          btn.disabled = true;
          btn.className = 'btn btn-primary';
          infoArea.classList.remove('hidden');
          break;

        case 'connecting':
          ring.classList.add('ring-connecting');
          ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M2.006 8.267L.78 9.5 0 8.73l2.09-2.07.76.01 2.09 2.12-.76.76-1.167-1.18a5 5 0 0 0 9.4 1.96l.96.4a6 6 0 0 1-11.36-2.45z"/></svg>';
          label.textContent = 'Conectando...';
          hint.textContent = 'Estabelecendo conexão com o WhatsApp';
          btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor;animation:ring-spin 1.2s linear infinite" viewBox="0 0 16 16"><path d="M2.006 8.267L.78 9.5 0 8.73l2.09-2.07.76.01 2.09 2.12-.76.76-1.167-1.18a5 5 0 0 0 9.4 1.96l.96.4a6 6 0 0 1-11.36-2.45z"/></svg> Conectando...';
          btn.disabled = true;
          btn.className = 'btn btn-primary';
          infoArea.classList.add('hidden');
          break;

        case 'qr_ready':
          ring.classList.add('ring-qr');
          ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M6 1H1v5h5V1zM2 2h3v3H2V2zm13-1h-5v5h5V1zm-4 1h3v3h-3V2zM1 10h5v5H1v-5zm1 1v3h3v-3H2zm9-1h1v1h-1v-1zm-1 1h1v1h-1v1h-1v-2h1zm2 0h1v1h2v2h-1v-1h-1v2h-2v-1h1v-1h-1v-1h1v-1zm1 0h2v1h-2v-1zm1 3h1v2h-2v-1h1v-1z"/></svg>';
          label.textContent = 'Escaneie o QR Code';
          hint.textContent = 'Use o WhatsApp no seu celular';
          btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 16 16"><path d="M6 1H1v5h5V1zM2 2h3v3H2V2zm13-1h-5v5h5V1zm-4 1h3v3h-3V2zM1 10h5v5H1v-5zm1 1v3h3v-3H2z"/></svg> Aguardando escaneamento...';
          btn.disabled = true;
          btn.className = 'btn btn-primary';
          infoArea.classList.add('hidden');
          break;

        default:
          ring.classList.add('ring-disconnected');
          ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M11 1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM5 2h6v10H5V2zm2.5 11.5a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0z"/></svg>';
          label.textContent = 'Desconectado';
          hint.textContent = 'Conecte ao WhatsApp para começar';
          btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 16 16"><path d="M11 1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM5 2h6v10H5V2zm2.5 11.5a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0z"/></svg> Conectar WhatsApp';
          btn.disabled = false;
          btn.className = 'btn btn-cta';
          infoArea.classList.add('hidden');
          break;
      }
    }

    function setSatelliteStatus(serverInfo) {
      currentState = 'satellite';
      const ring = document.getElementById('status-ring');
      const label = document.getElementById('status-label');
      const hint = document.getElementById('status-hint');
      const btn = document.getElementById('btn-connect');
      const infoArea = document.getElementById('info-area');

      ring.className = 'status-ring ring-connected';
      ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M8 1a.5.5 0 0 0-.5.5v3.03a4.5 4.5 0 0 0-4 4.47.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5 4.5 4.5 0 0 0-4-4.47V1.5A.5.5 0 0 0 8 1zm0 5a3.5 3.5 0 0 1 3.43 3H4.57A3.5 3.5 0 0 1 8 6zM1 12h14v1H1v-1zm2 2h10v1H3v-1z"/></svg>';
      label.textContent = 'Conectado como Satellite';
      hint.innerHTML = 'Server ativo no workspace <b>' + escapeHtml(serverInfo.serverProject) + '</b>';
      btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 16 16"><path d="M8 1a.5.5 0 0 0-.5.5v3.03a4.5 4.5 0 0 0-4 4.47.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5 4.5 4.5 0 0 0-4-4.47V1.5A.5.5 0 0 0 8 1z"/></svg> Server: ' + escapeHtml(serverInfo.serverProject);
      btn.disabled = true;
      btn.className = 'btn btn-primary';
      infoArea.classList.remove('hidden');
    }

    function updateStatus(status) {
      const roleEl = document.getElementById('role-text');
      const roleIcon = document.getElementById('role-icon');
      if (status.role) {
        roleEl.textContent = status.role === 'server' ? 'Server' : 'Satellite';
        roleIcon.innerHTML = status.role === 'server'
          ? '<svg viewBox="0 0 16 16"><path d="M3 3h10v4H3V3zm1 1v2h8V4H4zm-1 5h10v4H3V9zm1 1v2h8v-2H4z"/></svg>'
          : '<svg viewBox="0 0 16 16"><path d="M8 1a.5.5 0 0 0-.5.5v3.03a4.5 4.5 0 0 0-4 4.47.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5 4.5 4.5 0 0 0-4-4.47V1.5A.5.5 0 0 0 8 1zm0 5a3.5 3.5 0 0 1 3.43 3H4.57A3.5 3.5 0 0 1 8 6zM1 12h14v1H1v-1zm2 2h10v1H3v-1z"/></svg>';
      } else {
        roleEl.textContent = '\\u2014';
      }

      if (status.role === 'client' && status.serverInfo) {
        setSatelliteStatus(status.serverInfo);
      } else {
        setWAStatus(status.whatsapp);
      }

      document.getElementById('project-count').textContent = status.projects.length;
      const tags = document.getElementById('project-tags');
      tags.innerHTML = status.projects
        .map(function(p) { return '<span class="project-tag"><svg style="width:11px;height:11px;fill:currentColor;vertical-align:-1px;margin-right:3px" viewBox="0 0 16 16"><path d="M14.5 3H7.71l-.86-.86A.48.48 0 0 0 6.5 2h-5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5zM14 13H2V3h4.29l.86.86a.48.48 0 0 0 .35.14H14v9z"/></svg>' + escapeHtml(p) + '</span>'; })
        .join('');
    }

    function updateSettings(settings) {
      document.getElementById('setting-mode').value = settings.mode;
      document.getElementById('setting-filter').value = settings.chatFilter;
      document.getElementById('setting-group').value = settings.allowedGroupName;
      document.getElementById('group-setting').classList.toggle('hidden', settings.chatFilter !== 'group');
    }

    // ── Tab Switching ──

    var activeTab = 'whatsapp';

    function switchTab(tabId) {
      activeTab = tabId;
      // Update tab buttons
      var btns = document.querySelectorAll('.tab-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].getAttribute('data-tab') === tabId);
      }
      // Update tab panels
      var panels = document.querySelectorAll('.tab-panel');
      for (var j = 0; j < panels.length; j++) {
        panels[j].classList.toggle('active', panels[j].id === 'tab-' + tabId);
      }
    }

    // ── UI Actions ──

    function connect() { vscode.postMessage({ type: 'connect' }); }
    function refresh() { vscode.postMessage({ type: 'refresh' }); }

    function changeSetting(key, value) {
      vscode.postMessage({ type: 'setting', key: key, value: value });
      if (key === 'chatFilter') {
        document.getElementById('group-setting').classList.toggle('hidden', value !== 'group');
      }
    }

    function toggleAccordion(btn) {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      document.getElementById('settings-content').classList.toggle('open', !expanded);
    }

    function showQR(dataUri) {
      document.getElementById('qr-area').classList.remove('hidden');
      document.getElementById('qr-img').src = dataUri;
      setWAStatus('qr_ready');
    }

    // ── Messages ──

    var msgCount = 0;

    function addMessage(data) {
      var empty = document.getElementById('chat-empty');
      if (empty) empty.remove();

      var area = document.getElementById('chat-area');
      var bubble = document.createElement('div');
      bubble.className = 'msg-bubble msg-' + data.direction;

      var arrowSvg = data.direction === 'in'
        ? '<svg style="width:11px;height:11px;fill:currentColor;vertical-align:-1px" viewBox="0 0 16 16"><path d="M7.5 1v9.8L4.15 7.45l-.71.71L8 12.72l4.56-4.56-.71-.71L8.5 10.8V1h-1z"/></svg>'
        : '<svg style="width:11px;height:11px;fill:currentColor;vertical-align:-1px" viewBox="0 0 16 16"><path d="M8.5 15V5.2l3.35 3.35.71-.71L8 3.28 3.44 7.84l.71.71L7.5 5.2V15h1z"/></svg>';
      bubble.innerHTML =
        '<div class="msg-from">' + arrowSvg + ' ' + escapeHtml(data.from) + '</div>' +
        '<div class="msg-text">' + escapeHtml(data.text) + '</div>' +
        '<div class="msg-time">' + data.time + '</div>';

      area.appendChild(bubble);
      area.scrollTop = area.scrollHeight;
      msgCount++;
      document.getElementById('msg-count').textContent = '(' + msgCount + ')';
    }

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
      var notify = document.getElementById('sched-notify').value === 'true';
      var execMode = document.getElementById('sched-mode').value;
      var runMode = document.getElementById('sched-runmode').value;

      if (!name || !workflow || !interval || interval < 1) return;

      var data = { name: name, workflow: workflow, intervalMinutes: interval, notifyWhatsApp: notify, executionMode: execMode, runMode: runMode };
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

    // ── Notebooks ──

    function refreshNotebooks() {
      vscode.postMessage({ type: 'notebook-refresh' });
    }

    function renderNotebooks(notebooks) {
      var list = document.getElementById('notebook-list');
      var countEl = document.getElementById('notebook-count');
      var badge = document.getElementById('tab-badge-notebooks');

      if (!notebooks || notebooks.length === 0) {
        list.innerHTML = '<div class="notebook-empty" id="notebook-empty">'
          + '<span class="notebook-empty-icon"><svg viewBox="0 0 16 16"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm0 1v12h10V2H3zm2 2h6v1H5V4zm0 3h6v1H5V7zm0 3h4v1H5v-1z"/></svg></span>'
          + '<span class="notebook-empty-text">Nenhum notebook encontrado.<br/>Use <b>@cappy /ingest</b> para criar um.</span>'
          + '</div>';
        countEl.textContent = '';
        badge.textContent = '';
        return;
      }

      countEl.textContent = '(' + notebooks.length + ')';
      badge.textContent = notebooks.length;
      list.innerHTML = notebooks.map(function(nb) {
        var updated = nb.updated ? new Date(nb.updated).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '\\u2014';
        return '<div class="notebook-item">'
          + '<div class="notebook-icon"><svg viewBox="0 0 16 16"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm0 1v12h10V2H3zm2 2h6v1H5V4zm0 3h6v1H5V7zm0 3h4v1H5v-1z"/></svg></div>'
          + '<div class="notebook-info">'
          + '<div class="notebook-name">' + escapeHtml(nb.name) + '</div>'
          + '<div class="notebook-meta">'
          + nb.chunkCount + ' chunks \\u00b7 ' + nb.sourceCount + ' fonte(s) \\u00b7 ' + updated
          + '</div></div></div>';
      }).join('');
    }

    // ── Message Listener (extension → webview) ──

    window.addEventListener('message', function(event) {
      var msg = event.data;
      switch (msg.type) {
        case 'qr': showQR(msg.data); break;
        case 'qr-clear':
          document.getElementById('qr-area').classList.add('hidden');
          setWAStatus('connected');
          break;
        case 'status': updateStatus(msg.data); break;
        case 'settings': updateSettings(msg.data); break;
        case 'message': addMessage(msg.data); break;
        case 'scheduler-tasks': renderSchedulerTasks(msg.data); break;
        case 'scheduler-running': updateSchedulerTaskStatus(msg.data, 'running'); break;
        case 'scheduler-complete': updateSchedulerTaskStatus(msg.data.taskId, msg.data.status); break;
        case 'notebooks-list': renderNotebooks(msg.data); break;
      }
    });

    // ── Initialization ──

    // Apply initial status injected at render time (no postMessage dependency)
    var __INITIAL_STATUS__ = ${initialStatusJson};
    if (__INITIAL_STATUS__) {
      updateStatus(__INITIAL_STATUS__);
    }

    // Apply initial notebooks
    var __INITIAL_NOTEBOOKS__ = ${initialNotebooksJson};
    if (__INITIAL_NOTEBOOKS__ && __INITIAL_NOTEBOOKS__.length > 0) {
      renderNotebooks(__INITIAL_NOTEBOOKS__);
    }

    // Notify extension that webview JS is ready (for postMessage-based updates)
    vscode.postMessage({ type: 'webview-ready' });
  `;
}
