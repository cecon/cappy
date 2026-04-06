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

    function byId(id) { return document.getElementById(id); }
    function esc(value) {
      const div = document.createElement('div');
      div.textContent = value ?? '';
      return div.innerHTML;
    }

    function setStatus(text) {
      byId('status').textContent = text || '';
    }

    function renderSessions() {
      const select = byId('session');
      const sessions = state.sessions || [];
      const current = state.currentSessionId || '';
      select.innerHTML = sessions.map(s => '<option value="' + esc(s.id) + '">' + esc(s.title) + '</option>').join('');
      if (current) select.value = current;
    }

    function renderMessages() {
      const target = byId('messages');
      const session = (state.sessions || []).find(s => s.id === state.currentSessionId);
      if (!session) {
        target.innerHTML = '<div class="msg msg-assistant">Sem sessão ativa.</div>';
        return;
      }
      target.innerHTML = (session.messages || []).map(function(m) {
        return '<div class="msg ' + (m.role === 'user' ? 'msg-user' : 'msg-assistant') + '">' + esc(m.content) + '</div>';
      }).join('');
      target.scrollTop = target.scrollHeight;
    }

    function applyState(partial) {
      state = { ...state, ...partial };
      renderSessions();
      renderMessages();
      if (partial.provider) {
        byId('baseUrl').value = partial.provider.baseUrl || '';
        byId('model').value = partial.provider.model || '';
        byId('backend').value = partial.provider.backend || 'openai';
      }
    }

    function createSession() {
      const mode = byId('mode').value;
      vscode.postMessage({ type: 'chat-create-session', data: { mode } });
    }

    function onSend() {
      const prompt = byId('prompt').value.trim();
      if (!prompt) return;
      const mode = byId('mode').value;
      const sessionId = byId('session').value || undefined;
      byId('prompt').value = '';
      setStatus('Enviando...');
      vscode.postMessage({ type: 'chat-send', data: { sessionId, mode, prompt } });
    }

    function onSaveProvider() {
      const baseUrl = byId('baseUrl').value.trim();
      const model = byId('model').value.trim();
      const backend = byId('backend').value;
      const apiKey = byId('apiKey').value.trim();
      vscode.postMessage({ type: 'provider-save', data: { baseUrl, model, backend, apiKey } });
      byId('apiKey').value = '';
    }

    function onTestProvider() {
      vscode.postMessage({ type: 'provider-test' });
    }

    byId('btn-new-session').addEventListener('click', createSession);
    byId('btn-send').addEventListener('click', onSend);
    byId('btn-save-provider').addEventListener('click', onSaveProvider);
    byId('btn-test-provider').addEventListener('click', onTestProvider);
    byId('session').addEventListener('change', function() {
      state.currentSessionId = byId('session').value;
      renderMessages();
    });

    window.addEventListener('message', function(event) {
      const msg = event.data;
      switch (msg.type) {
        case 'state':
          applyState(msg.data);
          setStatus(msg.data.statusText || '');
          break;
        case 'assistant-stream-start':
          assistantBufferBySession[msg.data.sessionId] = '';
          break;
        case 'assistant-stream-chunk': {
          const id = msg.data.sessionId;
          assistantBufferBySession[id] = (assistantBufferBySession[id] || '') + msg.data.chunk;
          const session = (state.sessions || []).find(s => s.id === id);
          if (!session) break;
          const messages = session.messages || [];
          if (!messages.length || messages[messages.length - 1].role !== 'assistant') {
            messages.push({ role: 'assistant', content: assistantBufferBySession[id] });
          } else {
            messages[messages.length - 1].content = assistantBufferBySession[id];
          }
          renderMessages();
          break;
        }
        case 'assistant-stream-end':
          setStatus('Pronto');
          break;
        case 'status':
          setStatus(msg.data);
          break;
      }
    });

    vscode.postMessage({ type: 'webview-ready' });
  `;
}

