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
  background: var(--vscode-sideBar-background);
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
  padding: 6px 10px;
  gap: 8px;
  background: var(--vscode-sideBar-background);
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
  font-size: 13px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.icon-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
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
  background: var(--vscode-editor-background);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.session-action-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.session-action-btn svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}
.chat-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 12px;
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
  font-size: 12px;
}
.msg-wrap.user .msg-bubble {
  background: color-mix(in srgb, var(--vscode-focusBorder) 15%, var(--vscode-editor-background));
  border: 1px solid color-mix(in srgb, var(--vscode-focusBorder) 35%, transparent);
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
  width: 22px;
  height: 22px;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
.tool-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--vscode-input-background);
  font-size: 10px;
  text-transform: uppercase;
  margin-right: 4px;
}
.tool-status-running { color: var(--vscode-charts-yellow); }
.tool-status-done { color: var(--vscode-charts-green); }
.tool-status-error { color: var(--vscode-errorForeground); }
.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px 8px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
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
.streaming-label {
  margin-left: 2px;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
}
.input-area {
  border-top: 1px solid var(--vscode-panel-border);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: var(--vscode-sideBar-background);
}
.composer-shell {
  border: 1px solid var(--vscode-input-border, transparent);
  border-radius: 8px;
  background: var(--vscode-input-background);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.composer-shell:focus-within {
  border-color: var(--vscode-focusBorder);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--vscode-focusBorder) 35%, transparent);
}
.prompt-input {
  width: 100%;
  resize: none;
  min-height: 28px;
  max-height: 140px;
  border: none;
  background: transparent;
  color: var(--vscode-input-foreground);
  border-radius: 4px;
  padding: 0;
  outline: none;
  font-size: 12px;
  line-height: 1.35;
}
.input-toolbar {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: nowrap;
  overflow-x: hidden;
  padding-bottom: 1px;
}
.toolbar-btn, .send-btn, .stop-btn, .mode-selector {
  border: none;
  border-radius: 5px;
  height: 26px;
  padding: 0 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
}
.toolbar-btn, .mode-selector {
  background: color-mix(in srgb, var(--vscode-button-secondaryBackground) 65%, transparent);
  color: var(--vscode-button-secondaryForeground);
}
.toolbar-btn:hover, .mode-selector:hover {
  background: var(--vscode-toolbar-hoverBackground);
}
.send-btn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  width: 30px;
  padding: 0;
}
.send-btn svg,
.toolbar-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
.stop-btn {
  background: color-mix(in srgb, var(--vscode-errorForeground) 35%, transparent);
  color: var(--vscode-foreground);
  font-size: 11px;
  min-width: 46px;
}
.mode-selector-wrap { position: relative; }
.mode-selector {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 68px;
}
.mode-menu {
  position: absolute;
  left: 0;
  bottom: 32px;
  width: 156px;
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
  position: relative;
}
.mode-option:hover,
.mode-option.active { background: var(--vscode-menu-selectionBackground); }
.mode-option.active::after {
  content: "✓";
  position: absolute;
  right: 8px;
  color: var(--vscode-foreground);
}
.compact-select {
  min-width: 124px;
  border: 1px solid var(--vscode-input-border, transparent);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 6px;
  height: 26px;
  font-size: 12px;
}
.context-usage {
  margin-left: auto;
  color: var(--vscode-descriptionForeground);
  font-size: 10px;
  min-width: 48px;
  text-align: right;
  flex-shrink: 0;
  opacity: 0.9;
  line-height: 1.1;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
}
.context-usage span:first-child { color: var(--vscode-foreground); }
.status {
  border-top: 1px solid var(--vscode-panel-border);
  padding: 5px 10px;
  color: var(--vscode-descriptionForeground);
  font-size: 10px;
  min-height: 22px;
  display: flex;
  align-items: center;
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

