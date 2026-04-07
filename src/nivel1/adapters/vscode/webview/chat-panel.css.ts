/**
 * @fileoverview Chat panel CSS styles.
 * @module webview/chat-panel.css
 */

export const CHAT_PANEL_CSS = `
.solutionHeading {
  margin-top: 40px;
}
pre:focus-visible {
  border: 1px solid var(--vscode-focusBorder);
  outline: none;
}
pre {
  margin-bottom: 6px;
  display: block;
  padding: 9.5px;
  line-height: 1.42857143;
  word-break: break-all;
  word-wrap: break-word;
  border: 1px solid #ccc;
  border-radius: 4px;
  border: 1px solid var(--vscode-notebook-cellBorderColor);
  white-space: pre-wrap;
  font-size: var(--vscode-editor-font-size);
}
pre.shiki {
  padding: 0.5em 0.7em;
  margin-top: 1em;
  margin-bottom: 1em;
  border-radius: 4px;
}
code {
  background-color: transparent;
}
`;

