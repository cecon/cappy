/**
 * @fileoverview Chat panel CSS styles.
 * @module webview/chat-panel.css
 */

export const CHAT_PANEL_CSS = `
* { box-sizing: border-box; }
html, body {
  height: 100%;
}
body {
  margin: 0;
  padding: 10px;
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  overflow: hidden;
}
.app {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}
.header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}
.title {
  font-size: 13px;
  font-weight: 700;
}
.subtitle {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
}
.card {
  border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.1));
  border-radius: 10px;
  background: var(--vscode-editor-background);
  padding: 10px;
}
.card-messages {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 180px;
}
.row {
  display: flex;
  gap: 6px;
}
.row > * { flex: 1; }
.label {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 4px;
  text-transform: uppercase;
}
.input, .select, .textarea {
  width: 100%;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
  border-radius: 6px;
  padding: 7px;
  font-size: 12px;
}
.textarea {
  min-height: 88px;
  resize: vertical;
}
.btn {
  border: none;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
}
.btn-primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
.btn-ghost {
  background: transparent;
  color: var(--vscode-descriptionForeground);
}
.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.msg {
  border-radius: 8px;
  padding: 8px;
  border: 1px solid var(--vscode-widget-border, transparent);
  font-size: 12px;
  white-space: pre-wrap;
}
.msg-user {
  background: rgba(59, 130, 246, 0.12);
}
.msg-assistant {
  background: var(--vscode-input-background);
}
.status {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  margin-top: 6px;
}
`;

