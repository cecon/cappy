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
    let isSessionSearchExpanded = false;
    let autoScrollEnabled = true;
    let toolCallsBySession = {};
    let mentionSuggestions = [];
    let mentionSearchToken = '';
    let mentionSelectedIndex = 0;
    let mentionSearchTimer = null;
    let assistantPending = false;

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
     * Returns stable footer status, preventing stale loading text.
     * @returns {string}
     */
    function resolveStatusText() {
      const raw = (state.statusText || '').trim();
      if (state.isStreaming) {
        return raw || 'Pensando...';
      }
      if (/^(pensando|carregando|loading)\\.{0,3}$/i.test(raw)) {
        return 'Pronto';
      }
      return raw;
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
      const select = byId('ui-mode-select');
      if (select) {
        select.value = uiMode;
      }
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
     * Upserts one live tool event in transient timeline for the session.
     * @param {string} sessionId Session identifier.
     * @param {{tool: string, status: 'running' | 'done' | 'error', input?: string, output?: string}} payload Tool payload.
     */
    function applyLiveToolCall(sessionId, payload) {
      const queue = Array.isArray(toolCallsBySession[sessionId]) ? toolCallsBySession[sessionId].slice() : [];
      const lastIndex = queue.length - 1;
      const last = lastIndex >= 0 ? queue[lastIndex] : null;
      if (
        last
        && last.tool === payload.tool
        && last.status === 'running'
        && (payload.status === 'done' || payload.status === 'error')
      ) {
        queue[lastIndex] = Object.assign({}, last, payload);
      } else {
        queue.push(payload);
      }
      toolCallsBySession[sessionId] = queue.slice(-12);
    }

    /**
     * Renders provider/model selector.
     */
    function renderModelSelector() {
      const select = byId('provider-model');
      const current = state.provider && state.provider.model ? state.provider.model : 'gpt-4o-mini';
      const runtimeModels = Array.isArray(state.availableModels) ? state.availableModels : [];
      const options = [current].concat(runtimeModels);
      const unique = Array.from(new Set(options));
      select.innerHTML = unique.map(function(model) {
        return '<option value="' + esc(model) + '">' + esc(model) + '</option>';
      }).join('');
      select.value = current;
    }

    /**
     * Syncs attach/stop visibility based on response activity.
     */
    function renderComposerActions() {
      const running = Boolean(state.isStreaming || assistantPending);
      const promptValue = byId('prompt').value || '';
      const hasPrompt = promptValue.trim().length > 0;
      byId('btn-stop-inline').classList.toggle('hidden', !running);
      byId('btn-send-inline').classList.toggle('hidden', running);
      byId('btn-send-inline').disabled = running || !hasPrompt;
      byId('btn-attach').classList.toggle('hidden', running);
    }

    /**
     * Syncs all visible UI blocks from state.
     */
    function renderAll() {
      renderSessions();
      renderMessages();
      renderModeMenu();
      renderModelSelector();
      const used = Number(state.contextUsage ? state.contextUsage.used : 0) || 0;
      const limit = Number(state.contextUsage ? state.contextUsage.limit : 0) || 0;
      const safeLimit = limit > 0 ? limit : 1;
      const ratio = Math.max(0, Math.min(1, used / safeLimit));
      const usagePercent = Math.round(ratio * 100);
      const usageDegrees = Math.round(ratio * 360);
      byId('context-usage-percent').textContent = String(usagePercent);
      byId('context-usage-text').textContent = used + '/' + limit;
      byId('context-usage').style.setProperty('--context-progress', usageDegrees + 'deg');
      byId('context-usage').setAttribute('title', 'Uso de contexto: ' + usagePercent + '% (' + used + '/' + limit + ')');
      byId('streaming-indicator').classList.toggle('hidden', !state.isStreaming);
      renderComposerActions();
      if (state.provider) {
        byId('baseUrl').value = state.provider.baseUrl || '';
        byId('backend').value = state.provider.backend || 'openai';
      }
      setStatus(resolveStatusText());
    }

    /**
     * Renders search input visibility state in sessions drawer.
     */
    function renderSessionSearch() {
      byId('session-search-wrap').classList.toggle('hidden', !isSessionSearchExpanded);
    }

    /**
     * Toggles compact session search in drawer header.
     */
    function toggleSessionSearch() {
      isSessionSearchExpanded = !isSessionSearchExpanded;
      if (!isSessionSearchExpanded) {
        searchTerm = '';
        byId('session-search').value = '';
        renderSessions();
      }
      renderSessionSearch();
      if (isSessionSearchExpanded) {
        byId('session-search').focus();
      }
    }

    /**
     * Syncs main grid layout with sessions drawer visibility.
     */
    function syncHistoryLayout() {
      const drawerHidden = byId('sessions-drawer').classList.contains('hidden');
      byId('chat-main').classList.toggle('history-collapsed', drawerHidden);
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
      const mentions = extractMentions(prompt);
      const session = getCurrentSession();
      const runtimeMode = mapUIModeToRuntimeMode();
      promptEl.value = '';
      resizePrompt();
      closeMentionMenu();
      assistantPending = true;
      renderComposerActions();
      setStatus('Enviando...');
      vscode.postMessage({
        type: 'chat-send',
        data: {
          sessionId: session ? session.id : undefined,
          mode: runtimeMode,
          uiMode: uiMode,
          prompt: prompt,
          mentions: mentions,
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
     * Extracts unique workspace mentions from prompt.
     * @param {string} prompt Prompt text.
     * @returns {string[]}
     */
    function extractMentions(prompt) {
      const matches = prompt.match(/@([^\\s@]+)/g) || [];
      const unique = Array.from(new Set(matches.map(function(item) {
        return item.slice(1).trim();
      }).filter(Boolean)));
      return unique;
    }

    /**
     * Returns active mention query near caret.
     * @returns {{start: number, end: number, query: string} | null}
     */
    function getActiveMentionQuery() {
      const input = byId('prompt');
      const value = input.value || '';
      const caret = Number(input.selectionStart || 0);
      const beforeCaret = value.slice(0, caret);
      const match = beforeCaret.match(/(?:^|\\s)@([^\\s@]*)$/);
      if (!match) {
        return null;
      }
      const query = match[1] || '';
      const atIndex = beforeCaret.lastIndexOf('@');
      if (atIndex < 0) {
        return null;
      }
      return {
        start: atIndex + 1,
        end: caret,
        query: query,
      };
    }

    /**
     * Renders mention suggestion menu.
     */
    function renderMentionMenu() {
      const menu = byId('mention-menu');
      if (!mentionSuggestions.length) {
        menu.classList.add('hidden');
        menu.innerHTML = '';
        return;
      }
      menu.classList.remove('hidden');
      menu.innerHTML = mentionSuggestions.map(function(item, index) {
        const active = mentionSelectedIndex === index ? 'active' : '';
        return '<button class="mention-item ' + active + '" data-mention-index="' + index + '" title="' + esc(item.path) + '">' + esc(item.path) + '</button>';
      }).join('');
    }

    /**
     * Hides mention menu and clears selection.
     */
    function closeMentionMenu() {
      mentionSuggestions = [];
      mentionSelectedIndex = 0;
      renderMentionMenu();
    }

    /**
     * Replaces active mention token with selected suggestion.
     * @param {number} index Suggestion index.
     * @returns {boolean}
     */
    function applyMentionSuggestion(index) {
      if (!mentionSuggestions.length || index < 0 || index >= mentionSuggestions.length) {
        return false;
      }
      const mention = getActiveMentionQuery();
      if (!mention) {
        return false;
      }
      const input = byId('prompt');
      const value = input.value || '';
      const selected = mentionSuggestions[index];
      input.value = value.slice(0, mention.start) + selected.path + ' ' + value.slice(mention.end);
      const nextCaret = mention.start + selected.path.length + 1;
      input.setSelectionRange(nextCaret, nextCaret);
      closeMentionMenu();
      resizePrompt();
      return true;
    }

    /**
     * Requests workspace mention suggestions from extension.
     */
    function requestMentionSuggestions() {
      const mention = getActiveMentionQuery();
      if (!mention) {
        if (mentionSearchTimer) {
          clearTimeout(mentionSearchTimer);
          mentionSearchTimer = null;
        }
        closeMentionMenu();
        mentionSearchToken = '';
        return;
      }
      mentionSearchToken = mention.query;
      if (mentionSearchTimer) {
        clearTimeout(mentionSearchTimer);
      }
      mentionSearchTimer = setTimeout(function() {
        vscode.postMessage({
          type: 'workspace-mention-search',
          data: {
            query: mention.query,
          },
        });
      }, 120);
    }

    /**
     * Persists provider settings from modal.
     */
    function onSaveProvider() {
      const payload = {
        baseUrl: byId('baseUrl').value.trim(),
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
          if (!state.isStreaming && state.currentSessionId) {
            delete toolCallsBySession[state.currentSessionId];
          }
          if (!state.isStreaming && /^(pronto|erro)/i.test((state.statusText || '').trim())) {
            assistantPending = false;
          }
          renderComposerActions();
          break;
        case 'assistant-stream-start':
          state.isStreaming = true;
          assistantPending = true;
          assistantBufferBySession[msg.data.sessionId] = '';
          setStatus('Pensando...');
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
          assistantPending = false;
          if (msg.data && msg.data.sessionId) {
            delete toolCallsBySession[msg.data.sessionId];
          }
          renderAll();
          setStatus('Pronto');
          break;
        case 'tool-call': {
          const data = msg.data || {};
          if (!data.sessionId) {
            break;
          }
          applyLiveToolCall(data.sessionId, data);
          renderMessages();
          break;
        }
        case 'status':
          setStatus(msg.data);
          if (/^(pronto|erro)/i.test(String(msg.data || '').trim())) {
            assistantPending = false;
            renderComposerActions();
          }
          break;
        case 'workspace-mention-results': {
          const data = msg.data || {};
          if ((data.query || '') !== mentionSearchToken) {
            break;
          }
          mentionSuggestions = Array.isArray(data.items) ? data.items.slice(0, 8) : [];
          mentionSelectedIndex = 0;
          renderMentionMenu();
          break;
        }
      }
    });

    byId('btn-new-chat').addEventListener('click', createSession);
    byId('btn-toggle-session-search').addEventListener('click', toggleSessionSearch);
    byId('btn-toggle-history').addEventListener('click', function() {
      byId('sessions-drawer').classList.toggle('hidden');
      syncHistoryLayout();
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
    byId('btn-stop-inline').addEventListener('click', function() {
      const session = getCurrentSession();
      vscode.postMessage({ type: 'chat-stop-stream', data: { sessionId: session ? session.id : undefined } });
    });
    byId('btn-send-inline').addEventListener('click', function() {
      onSend();
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
      requestMentionSuggestions();
    });
    byId('ui-mode-select').addEventListener('change', function(event) {
      const nextMode = event.target && event.target.value ? event.target.value : 'plan';
      if (nextMode !== 'agent' && nextMode !== 'plan' && nextMode !== 'debug' && nextMode !== 'ask') {
        return;
      }
      uiMode = nextMode;
      vscode.postMessage({ type: 'chat-ui-mode', data: { uiMode: uiMode } });
      renderModeMenu();
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
      const nextModel = event.target && event.target.value ? event.target.value : '';
      if (!nextModel) {
        return;
      }
      vscode.postMessage({ type: 'provider-model-select', data: { model: nextModel } });
    });
    byId('prompt').addEventListener('input', function() {
      resizePrompt();
      requestMentionSuggestions();
      renderComposerActions();
    });
    byId('prompt').addEventListener('keydown', function(event) {
      if (!byId('mention-menu').classList.contains('hidden')) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          mentionSelectedIndex = (mentionSelectedIndex + 1) % mentionSuggestions.length;
          renderMentionMenu();
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          mentionSelectedIndex = (mentionSelectedIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length;
          renderMentionMenu();
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          applyMentionSuggestion(mentionSelectedIndex);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMentionMenu();
          return;
        }
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSend();
      }
    });
    byId('mention-menu').addEventListener('click', function(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest('[data-mention-index]');
      if (!(button instanceof HTMLElement)) {
        return;
      }
      const index = Number(button.getAttribute('data-mention-index'));
      if (Number.isNaN(index)) {
        return;
      }
      applyMentionSuggestion(index);
      byId('prompt').focus();
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
        closeHeaderMenu();
      }
    });
    document.addEventListener('click', function(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (!target.closest('.menu-wrap')) {
        closeHeaderMenu();
      }
      if (!target.closest('.composer-shell')) {
        closeMentionMenu();
      }
    });

    /**
     * Hides header overflow menu.
     */
    function closeHeaderMenu() {
      byId('header-menu').classList.add('hidden');
    }

    renderAll();
    renderSessionSearch();
    syncHistoryLayout();
    resizePrompt();
    vscode.postMessage({ type: 'webview-ready' });
  `;
}

