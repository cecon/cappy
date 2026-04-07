/**
 * @fileoverview Chat panel client JavaScript.
 * @module webview/chat-panel.js
 */

/**
 * Builds the script injected in chat panel webview.
 */
export function generateChatPanelScript(initialStateJson: string): string {
  return `
    const vscode = acquireVsCodeApi();
    let state = ${initialStateJson};
    let assistantBufferBySession = {};
    let uiMode = state.currentUIMode || 'plan';
    let searchTerm = '';
    let autoScrollEnabled = true;
    let toolCallsBySession = {};

    /**
     * Returns one DOM element by id.
     * @param {string} id Element id.
     * @returns {HTMLElement}
     */
    function byId(id) {
      return document.getElementById(id);
    }

    /**
     * Escapes one text value for HTML insertion.
     * @param {string | undefined | null} value Raw text.
     * @returns {string}
     */
    function esc(value) {
      const div = document.createElement('div');
      div.textContent = value ?? '';
      return div.innerHTML;
    }

    /**
     * Formats one ISO date into short timestamp.
     * @param {string} iso ISO timestamp.
     * @returns {string}
     */
    function formatTs(iso) {
      try {
        return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch {
        return '';
      }
    }

    /**
     * Converts markdown to lightweight HTML.
     * @param {string} markdown Markdown content.
     * @returns {string}
     */
    function renderMarkdown(markdown) {
      const source = esc(markdown || '');
      const blocks = source.split(/\\n\\n+/g).map(function(part) {
        if (/^#{1,3}\\s/.test(part)) {
          const level = (part.match(/^#+/) || ['#'])[0].length;
          return '<h' + level + '>' + part.replace(/^#{1,3}\\s*/, '') + '</h' + level + '>';
        }
        if (/^\\s*[-*]\\s+/m.test(part)) {
          const items = part.split(/\\n/).map(function(line) {
            return line.replace(/^\\s*[-*]\\s+/, '');
          });
          return '<ul>' + items.map(function(item) { return '<li>' + item + '</li>'; }).join('') + '</ul>';
        }
        if (/^\\s*\\d+\\.\\s+/m.test(part)) {
          const items = part.split(/\\n/).map(function(line) {
            return line.replace(/^\\s*\\d+\\.\\s+/, '');
          });
          return '<ol>' + items.map(function(item) { return '<li>' + item + '</li>'; }).join('') + '</ol>';
        }
        if (/^\\\`\\\`\\\`[\\s\\S]*\\\`\\\`\\\`$/.test(part.trim())) {
          const clean = part.trim().replace(/^\\\`\\\`\\\`[a-zA-Z0-9_-]*\\n?/, '').replace(/\\\`\\\`\\\`$/, '');
          return '<pre><code>' + clean + '</code></pre>';
        }
        const inline = part
          .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
          .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
          .replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>')
          .replace(/\\n/g, '<br/>');
        return '<p>' + inline + '</p>';
      });
      return blocks.join('');
    }

    /**
     * Updates footer status text.
     * @param {string | undefined} text Status value.
     */
    function setStatus(text) {
      byId('status').textContent = text || '';
    }

    /**
     * Returns active session from state.
     * @returns {any}
     */
    function getCurrentSession() {
      return (state.sessions || []).find(function(session) {
        return session.id === state.currentSessionId;
      });
    }

    /**
     * Requests session title inline editing.
     */
    function startEditingSessionTitle() {
      const session = getCurrentSession();
      if (!session) {
        return;
      }
      const input = byId('session-title-input');
      byId('session-title-btn').classList.add('hidden');
      input.classList.remove('hidden');
      input.value = session.title;
      input.focus();
      input.select();
    }

    /**
     * Saves session title after inline editing.
     */
    function saveSessionTitle() {
      const session = getCurrentSession();
      if (!session) {
        return;
      }
      const input = byId('session-title-input');
      const title = (input.value || '').trim();
      input.classList.add('hidden');
      byId('session-title-btn').classList.remove('hidden');
      if (!title || title === session.title) {
        return;
      }
      vscode.postMessage({
        type: 'chat-session-rename',
        data: {
          sessionId: session.id,
          title: title,
        },
      });
    }

    /**
     * Renders session title in header.
     */
    function renderSessionTitle() {
      const session = getCurrentSession();
      byId('session-title-text').textContent = session ? session.title : 'New Chat';
    }

    /**
     * Renders mode dropdown state.
     */
    function renderModeMenu() {
      byId('mode-label').textContent = uiMode === 'plan' ? 'Plan' : uiMode === 'agent' ? 'Agent' : uiMode === 'debug' ? 'Debug' : 'Ask';
      Array.from(document.querySelectorAll('.mode-option')).forEach(function(option) {
        option.classList.toggle('active', option.getAttribute('data-ui-mode') === uiMode);
      });
    }

    /**
     * Builds one session row.
     * @param {any} session Session payload.
     * @returns {string}
     */
    function renderSessionRow(session) {
      const pinned = session.pinned ? 'pin' : '';
      const status = session.status === 'archived' ? 'archived' : 'active';
      const pinIcon = session.pinned
        ? '<svg viewBox="0 0 16 16"><path d="M6 1h4v1l1 2v1l-2 1v4l-1 1-1-1V6L5 5V4l1-2V1z"/></svg>'
        : '<svg viewBox="0 0 16 16"><path d="M8 2.2c-1 0-1.8.8-1.8 1.8 0 .8.5 1.4 1.1 1.7v5.1l.7.7.7-.7V5.7c.6-.3 1.1-.9 1.1-1.7 0-1-.8-1.8-1.8-1.8z"/></svg>';
      const archiveIcon = status === 'archived'
        ? '<svg viewBox="0 0 16 16"><path d="M7 3 3 7l4 4V8h3a3 3 0 1 1 0 6H6v1h4a4 4 0 1 0 0-8H7V3z"/></svg>'
        : '<svg viewBox="0 0 16 16"><path d="M2 2h12v3H2V2zm1 4h10v8H3V6zm2 2v1h6V8H5z"/></svg>';
      const deleteIcon = '<svg viewBox="0 0 16 16"><path d="M3 4h10v1H3V4zm2 1h1v8H5V5zm5 0h1v8h-1V5zM6 2h4l1 1h2v1H3V3h2l1-1z"/></svg>';
      return '<div class="session-item ' + (session.id === state.currentSessionId ? 'active' : '') + '" data-session-id="' + esc(session.id) + '">'
        + '<div class="session-item-head">'
        + '<span class="session-title">' + esc(session.title) + '</span>'
        + '<span class="session-actions">'
        + '<button class="session-action-btn" data-action="pin" title="Pin">' + pinIcon + '</button>'
        + '<button class="session-action-btn" data-action="archive" title="' + (status === 'archived' ? 'Restaurar' : 'Arquivar') + '">' + archiveIcon + '</button>'
        + '<button class="session-action-btn" data-action="delete" title="Excluir">' + deleteIcon + '</button>'
        + '</span>'
        + '</div>'
        + '<div class="session-meta"><span>' + esc(formatTs(session.updatedAt)) + '</span><span>' + (pinned ? ('pin · ' + status) : status) + '</span></div>'
        + '</div>';
    }

    /**
     * Renders all sessions in drawer.
     */
    function renderSessions() {
      const target = byId('sessions-list');
      const sessions = (state.sessions || []).filter(function(session) {
        if (!searchTerm) {
          return true;
        }
        return session.title.toLowerCase().includes(searchTerm.toLowerCase());
      });
      target.innerHTML = sessions.map(renderSessionRow).join('') || '<div class="session-meta">Nenhuma sessão.</div>';
      renderSessionTitle();
    }

    /**
     * Returns html for one tool-call block.
     * @param {any} tool Tool call payload.
     * @returns {string}
     */
    function renderToolCall(tool) {
      const statusClass = tool.status === 'running' ? 'tool-status-running' : tool.status === 'error' ? 'tool-status-error' : 'tool-status-done';
      return '<details class="tool-call" open>'
        + '<summary><span class="tool-icon">tool</span>' + esc(tool.tool) + ' <span class="' + statusClass + '">' + esc(tool.status) + '</span></summary>'
        + (tool.input ? '<pre><code>' + esc(tool.input) + '</code></pre>' : '')
        + (tool.output ? '<pre><code>' + esc(tool.output) + '</code></pre>' : '')
        + '</details>';
    }

    /**
     * Builds one message row.
     * @param {any} message Message payload.
     * @returns {string}
     */
    function renderMessage(message) {
      if (message.role === 'tool' && message.toolCall) {
        return '<div class="msg-wrap assistant">' + renderToolCall(message.toolCall) + '</div>';
      }
      const kind = message.role === 'user' ? 'user' : 'assistant';
      return '<div class="msg-wrap ' + kind + '">'
        + '<div class="msg-bubble">' + renderMarkdown(message.content || '') + '</div>'
        + '<div class="msg-actions">'
        + '<button class="msg-action-btn" title="Copiar" data-msg-action="copy" data-msg-id="' + esc(message.id || '') + '">⧉</button>'
        + '<button class="msg-action-btn" title="Reenviar" data-msg-action="resend" data-msg-id="' + esc(message.id || '') + '">↻</button>'
        + '<button class="msg-action-btn" data-msg-action="up" data-msg-id="' + esc(message.id || '') + '">👍</button>'
        + '<button class="msg-action-btn" data-msg-action="down" data-msg-id="' + esc(message.id || '') + '">👎</button>'
        + '</div>'
        + '</div>';
    }

    /**
     * Keeps timeline pinned to bottom while streaming.
     */
    function scrollToLatestIfNeeded() {
      if (!autoScrollEnabled) {
        return;
      }
      const target = byId('messages');
      target.scrollTop = target.scrollHeight;
    }

    /**
     * Renders the current chat timeline.
     */
    function renderMessages() {
      const target = byId('messages');
      const session = getCurrentSession();
      if (!session) {
        target.innerHTML = '<div class="msg-wrap assistant"><div class="msg-bubble">Sem sessão ativa.</div></div>';
        return;
      }
      const persisted = (session.messages || []).slice();
      const transientTools = toolCallsBySession[session.id] || [];
      const timeline = persisted.concat(transientTools.map(function(item) {
        return {
          id: 'tool-' + item.tool + '-' + item.status + '-' + Date.now(),
          role: 'tool',
          content: '',
          toolCall: item,
        };
      }));
      target.innerHTML = timeline.map(renderMessage).join('');
      scrollToLatestIfNeeded();
    }

    /**
     * Renders provider/model selector.
     */
    function renderModelSelector() {
      const select = byId('provider-model');
      const current = state.provider && state.provider.model ? state.provider.model : 'gpt-4o-mini';
      const options = [current, 'gpt-4.1-mini', 'gpt-4o-mini', 'claude-sonnet'];
      const unique = Array.from(new Set(options));
      select.innerHTML = unique.map(function(model) {
        return '<option value="' + esc(model) + '">' + esc(model) + '</option>';
      }).join('');
      select.value = current;
    }

    /**
     * Syncs all visible UI blocks from state.
     */
    function renderAll() {
      renderSessions();
      renderMessages();
      renderModeMenu();
      renderModelSelector();
      byId('context-usage').innerHTML = '<span>' + (state.contextUsage ? state.contextUsage.used : 0) + '</span><span>/ ' + (state.contextUsage ? state.contextUsage.limit : 0) + '</span>';
      byId('streaming-indicator').classList.toggle('hidden', !state.isStreaming);
      byId('btn-stop-inline').classList.toggle('hidden', !state.isStreaming);
      byId('btn-send').classList.toggle('hidden', !!state.isStreaming);
      if (state.provider) {
        byId('baseUrl').value = state.provider.baseUrl || '';
        byId('model').value = state.provider.model || '';
        byId('backend').value = state.provider.backend || 'openai';
      }
      setStatus(state.statusText || '');
    }

    /**
     * Applies partial state update from extension.
     * @param {any} partial New payload.
     */
    function applyState(partial) {
      state = Object.assign({}, state, partial || {});
      if (state.currentUIMode) {
        uiMode = state.currentUIMode;
      }
      renderAll();
    }

    /**
     * Maps UI mode into orchestrator mode.
     * @returns {'planning' | 'agent' | 'sandbox'}
     */
    function mapUIModeToRuntimeMode() {
      if (uiMode === 'agent') {
        return 'agent';
      }
      if (uiMode === 'debug') {
        return 'sandbox';
      }
      return 'planning';
    }

    /**
     * Sends user prompt to extension.
     */
    function onSend() {
      const promptEl = byId('prompt');
      const prompt = (promptEl.value || '').trim();
      if (!prompt) {
        return;
      }
      const session = getCurrentSession();
      const runtimeMode = mapUIModeToRuntimeMode();
      promptEl.value = '';
      resizePrompt();
      setStatus('Enviando...');
      vscode.postMessage({
        type: 'chat-send',
        data: {
          sessionId: session ? session.id : undefined,
          mode: runtimeMode,
          uiMode: uiMode,
          prompt: prompt,
        },
      });
    }

    /**
     * Creates a new chat session from active mode.
     */
    function createSession() {
      vscode.postMessage({
        type: 'chat-create-session',
        data: {
          mode: mapUIModeToRuntimeMode(),
        },
      });
    }

    /**
     * Adjusts prompt textarea height between 1 and 6 rows.
     */
    function resizePrompt() {
      const input = byId('prompt');
      input.style.height = 'auto';
      const lineHeight = 20;
      const max = lineHeight * 6 + 12;
      input.style.height = Math.min(max, input.scrollHeight) + 'px';
    }

    /**
     * Persists provider settings from modal.
     */
    function onSaveProvider() {
      const payload = {
        baseUrl: byId('baseUrl').value.trim(),
        model: byId('model').value.trim(),
        backend: byId('backend').value,
        apiKey: byId('apiKey').value.trim(),
        token: byId('token').value.trim(),
      };
      vscode.postMessage({ type: 'provider-save', data: payload });
      byId('apiKey').value = '';
      byId('token').value = '';
      closeSettingsModal();
    }

    /**
     * Requests provider connectivity test.
     */
    function onTestProvider() {
      vscode.postMessage({ type: 'provider-test' });
    }

    /**
     * Opens settings modal.
     */
    function openSettingsModal() {
      byId('settings-modal').classList.remove('hidden');
    }

    /**
     * Closes settings modal.
     */
    function closeSettingsModal() {
      byId('settings-modal').classList.add('hidden');
    }

    /**
     * Handles click events for session rows/actions.
     * @param {MouseEvent} event Browser click.
     */
    function onSessionsClick(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const actionBtn = target.closest('[data-action]');
      const row = target.closest('.session-item');
      if (!(row instanceof HTMLElement)) {
        return;
      }
      const sessionId = row.getAttribute('data-session-id');
      if (!sessionId) {
        return;
      }
      if (actionBtn instanceof HTMLElement) {
        event.stopPropagation();
        const action = actionBtn.getAttribute('data-action');
        if (action === 'pin') {
          vscode.postMessage({ type: 'chat-session-pin', data: { sessionId: sessionId } });
        } else if (action === 'archive') {
          const session = (state.sessions || []).find(function(item) { return item.id === sessionId; });
          const archived = session ? session.status !== 'archived' : true;
          vscode.postMessage({ type: 'chat-session-archive', data: { sessionId: sessionId, archived: archived } });
        } else if (action === 'delete') {
          vscode.postMessage({ type: 'chat-session-delete', data: { sessionId: sessionId } });
        }
        return;
      }
      state.currentSessionId = sessionId;
      vscode.postMessage({ type: 'chat-session-select', data: { sessionId: sessionId } });
      renderAll();
    }

    /**
     * Handles click actions over message rows.
     * @param {MouseEvent} event Browser click.
     */
    function onMessagesClick(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const actionBtn = target.closest('[data-msg-action]');
      if (!(actionBtn instanceof HTMLElement)) {
        return;
      }
      const action = actionBtn.getAttribute('data-msg-action');
      const messageId = actionBtn.getAttribute('data-msg-id');
      const session = getCurrentSession();
      const message = session && (session.messages || []).find(function(item) { return item.id === messageId; });
      if (!message) {
        return;
      }
      if (action === 'copy') {
        navigator.clipboard.writeText(message.content || '');
      } else if (action === 'resend') {
        byId('prompt').value = message.content || '';
        resizePrompt();
      } else if (action === 'up' || action === 'down') {
        setStatus(action === 'up' ? 'Feedback positivo registrado.' : 'Feedback negativo registrado.');
      }
    }

    /**
     * Handles messages sent by extension backend.
     */
    window.addEventListener('message', function(event) {
      const msg = event.data || {};
      switch (msg.type) {
        case 'state':
          applyState(msg.data);
          break;
        case 'assistant-stream-start':
          state.isStreaming = true;
          assistantBufferBySession[msg.data.sessionId] = '';
          renderAll();
          break;
        case 'assistant-stream-chunk': {
          const id = msg.data.sessionId;
          assistantBufferBySession[id] = (assistantBufferBySession[id] || '') + msg.data.chunk;
          const session = (state.sessions || []).find(function(item) { return item.id === id; });
          if (!session) {
            break;
          }
          const messages = session.messages || [];
          if (!messages.length || messages[messages.length - 1].role !== 'assistant') {
            messages.push({
              id: 'stream-' + id,
              role: 'assistant',
              content: assistantBufferBySession[id],
              createdAt: new Date().toISOString(),
              mode: mapUIModeToRuntimeMode(),
            });
          } else {
            messages[messages.length - 1].content = assistantBufferBySession[id];
          }
          renderMessages();
          break;
        }
        case 'assistant-stream-end':
          state.isStreaming = false;
          renderAll();
          setStatus('Pronto');
          break;
        case 'tool-call': {
          const data = msg.data || {};
          if (!data.sessionId) {
            break;
          }
          toolCallsBySession[data.sessionId] = [data];
          renderMessages();
          break;
        }
        case 'status':
          setStatus(msg.data);
          break;
      }
    });

    byId('btn-new-chat').addEventListener('click', createSession);
    byId('btn-toggle-history').addEventListener('click', function() {
      byId('sessions-drawer').classList.toggle('hidden');
    });
    byId('btn-maximize').addEventListener('click', function() {
      vscode.postMessage({ type: 'panel-maximize' });
    });
    byId('btn-settings').addEventListener('click', openSettingsModal);
    byId('menu-settings').addEventListener('click', function() {
      closeHeaderMenu();
      openSettingsModal();
      vscode.postMessage({ type: 'panel-open-settings' });
    });
    byId('menu-move-panel').addEventListener('click', function() {
      closeHeaderMenu();
      vscode.postMessage({ type: 'panel-move' });
    });
    byId('menu-export').addEventListener('click', function() {
      closeHeaderMenu();
      const session = getCurrentSession();
      vscode.postMessage({ type: 'chat-export-session', data: { sessionId: session ? session.id : undefined } });
    });
    byId('btn-menu').addEventListener('click', function() {
      byId('header-menu').classList.toggle('hidden');
    });
    byId('btn-send').addEventListener('click', onSend);
    byId('btn-stop-inline').addEventListener('click', function() {
      const session = getCurrentSession();
      vscode.postMessage({ type: 'chat-stop-stream', data: { sessionId: session ? session.id : undefined } });
    });
    byId('btn-save-provider').addEventListener('click', onSaveProvider);
    byId('btn-test-provider').addEventListener('click', onTestProvider);
    byId('btn-cancel-settings').addEventListener('click', closeSettingsModal);
    byId('settings-modal').addEventListener('click', function(event) {
      if (event.target instanceof HTMLElement && event.target.classList.contains('modal-backdrop')) {
        closeSettingsModal();
      }
    });
    byId('btn-attach').addEventListener('click', function() {
      const prompt = byId('prompt');
      prompt.value = (prompt.value || '') + ' @';
      prompt.focus();
      resizePrompt();
    });
    byId('btn-mode').addEventListener('click', function() {
      byId('mode-menu').classList.toggle('hidden');
    });
    Array.from(document.querySelectorAll('.mode-option')).forEach(function(option) {
      option.addEventListener('click', function() {
        uiMode = option.getAttribute('data-ui-mode') || 'plan';
        byId('mode-menu').classList.add('hidden');
        renderModeMenu();
      });
    });
    byId('session-title-btn').addEventListener('click', startEditingSessionTitle);
    byId('session-title-input').addEventListener('blur', saveSessionTitle);
    byId('session-title-input').addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        saveSessionTitle();
      }
      if (event.key === 'Escape') {
        byId('session-title-input').classList.add('hidden');
        byId('session-title-btn').classList.remove('hidden');
      }
    });
    byId('session-search').addEventListener('input', function(event) {
      searchTerm = event.target.value || '';
      renderSessions();
    });
    byId('provider-model').addEventListener('change', function(event) {
      byId('model').value = event.target.value;
    });
    byId('prompt').addEventListener('input', resizePrompt);
    byId('prompt').addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSend();
      }
    });
    byId('messages').addEventListener('scroll', function() {
      const target = byId('messages');
      const distance = target.scrollHeight - (target.scrollTop + target.clientHeight);
      autoScrollEnabled = distance < 60;
    });
    byId('messages').addEventListener('click', onMessagesClick);
    byId('sessions-list').addEventListener('click', onSessionsClick);
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        closeSettingsModal();
        byId('mode-menu').classList.add('hidden');
        closeHeaderMenu();
      }
    });
    document.addEventListener('click', function(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (!target.closest('.mode-selector-wrap')) {
        byId('mode-menu').classList.add('hidden');
      }
      if (!target.closest('.menu-wrap')) {
        closeHeaderMenu();
      }
    });

    /**
     * Hides header overflow menu.
     */
    function closeHeaderMenu() {
      byId('header-menu').classList.add('hidden');
    }

    renderAll();
    resizePrompt();
    vscode.postMessage({ type: 'webview-ready' });
  `;
}

