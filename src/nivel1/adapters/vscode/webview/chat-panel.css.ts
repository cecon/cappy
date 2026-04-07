/**
 * @fileoverview Chat panel CSS styles.
 * @module webview/chat-panel.css
 */

export const CHAT_PANEL_CSS = `
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  font-family: var(--vscode-font-family);
  font-size: 12px;
}
.chat-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--vscode-panel-border);
  padding: 8px 10px;
  gap: 8px;
}
.chat-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.brand-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}
.session-title-btn {
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 12px;
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  max-width: 220px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
.session-title-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.session-title-input {
  width: 220px;
  border: 1px solid var(--vscode-focusBorder);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 4px;
  padding: 4px 6px;
}
.chat-header-actions { display: flex; align-items: center; gap: 4px; position: relative; }
.icon-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  border-radius: 4px;
  cursor: pointer;
}
.icon-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.menu-wrap { position: relative; }
.header-menu {
  position: absolute;
  top: 26px;
  right: 0;
  width: 160px;
  background: var(--vscode-menu-background);
  border: 1px solid var(--vscode-menu-border);
  border-radius: 6px;
  padding: 4px;
  z-index: 40;
}
.menu-item {
  width: 100%;
  text-align: left;
  border: none;
  border-radius: 4px;
  padding: 6px 8px;
  background: transparent;
  color: var(--vscode-menu-foreground);
  cursor: pointer;
}
.menu-item:hover { background: var(--vscode-menu-selectionBackground); }
.chat-main {
  display: grid;
  grid-template-columns: 260px 1fr;
  flex: 1;
  min-height: 0;
}
.sessions-drawer {
  border-right: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.drawer-header { padding: 8px; }
.session-search {
  width: 100%;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, transparent);
  color: var(--vscode-input-foreground);
  border-radius: 4px;
  padding: 6px 8px;
}
.sessions-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 8px 8px;
}
.session-item {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 8px;
  background: transparent;
  cursor: pointer;
}
.session-item.active {
  border-color: var(--vscode-focusBorder);
  background: var(--vscode-list-activeSelectionBackground);
}
.session-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.session-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-meta {
  color: var(--vscode-descriptionForeground);
  font-size: 10px;
  margin-top: 4px;
  display: flex;
  justify-content: space-between;
}
.session-actions {
  display: none;
  gap: 4px;
}
.session-item:hover .session-actions { display: inline-flex; }
.session-action-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
}
.session-action-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.chat-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.msg-wrap {
  max-width: 92%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.msg-wrap.user { align-self: flex-end; align-items: flex-end; }
.msg-wrap.assistant { align-self: flex-start; }
.msg-bubble {
  border-radius: 10px;
  padding: 8px 10px;
  line-height: 1.5;
}
.msg-wrap.user .msg-bubble {
  background: color-mix(in srgb, var(--vscode-focusBorder) 22%, transparent);
}
.msg-wrap.assistant .msg-bubble {
  background: transparent;
}
.msg-bubble pre {
  overflow-x: auto;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 6px;
  padding: 8px;
}
.msg-actions {
  display: none;
  gap: 4px;
}
.msg-wrap:hover .msg-actions { display: inline-flex; }
.msg-action-btn {
  border: none;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
}
.msg-action-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.tool-call {
  border: 1px solid var(--vscode-widget-border, transparent);
  border-radius: 8px;
  padding: 8px;
  background: var(--vscode-input-background);
}
.tool-call summary {
  cursor: pointer;
  font-weight: 600;
}
.tool-status-running { color: var(--vscode-charts-yellow); }
.tool-status-done { color: var(--vscode-charts-green); }
.tool-status-error { color: var(--vscode-errorForeground); }
.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px 8px;
}
.streaming-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vscode-descriptionForeground);
  animation: pulse 1s infinite ease-in-out;
}
.streaming-indicator span:nth-child(2) { animation-delay: 0.15s; }
.streaming-indicator span:nth-child(3) { animation-delay: 0.3s; }
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
}
.input-area {
  border-top: 1px solid var(--vscode-panel-border);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.prompt-input {
  width: 100%;
  resize: none;
  min-height: 28px;
  max-height: 140px;
  border: 1px solid var(--vscode-input-border, transparent);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 6px;
  padding: 8px;
}
.input-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.toolbar-btn, .send-btn, .stop-btn, .mode-selector {
  border: none;
  border-radius: 6px;
  height: 28px;
  padding: 0 10px;
  cursor: pointer;
}
.toolbar-btn, .mode-selector {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
.send-btn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
.stop-btn {
  background: color-mix(in srgb, var(--vscode-errorForeground) 25%, transparent);
  color: var(--vscode-foreground);
}
.mode-selector-wrap { position: relative; }
.mode-selector {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mode-menu {
  position: absolute;
  left: 0;
  bottom: 32px;
  width: 148px;
  border: 1px solid var(--vscode-menu-border);
  background: var(--vscode-menu-background);
  border-radius: 6px;
  padding: 4px;
  z-index: 50;
}
.mode-option {
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--vscode-menu-foreground);
  text-align: left;
  padding: 6px 8px;
  cursor: pointer;
}
.mode-option:hover,
.mode-option.active { background: var(--vscode-menu-selectionBackground); }
.compact-select {
  min-width: 150px;
  border: 1px solid var(--vscode-input-border, transparent);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 6px;
  height: 28px;
}
.context-usage {
  margin-left: auto;
  color: var(--vscode-descriptionForeground);
  font-size: 10px;
}
.status {
  border-top: 1px solid var(--vscode-panel-border);
  padding: 6px 10px;
  color: var(--vscode-descriptionForeground);
  font-size: 10px;
}
.modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 90;
}
.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}
.modal-content {
  position: relative;
  width: min(460px, calc(100vw - 24px));
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.modal-input {
  border: 1px solid var(--vscode-input-border, transparent);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 6px;
  height: 30px;
  padding: 0 8px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}
.modal-btn {
  border: none;
  border-radius: 6px;
  height: 28px;
  padding: 0 10px;
  cursor: pointer;
}
.modal-btn.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
.modal-btn.ghost {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
.hidden { display: none !important; }
`;

