/**
 * @fileoverview Dashboard CSS styles
 * Extracted from the monolithic cappy-webview.ts following SOLID/SRP.
 */
export const DASHBOARD_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --cappy-green: #25D366;
  --cappy-green-dim: rgba(37, 211, 102, 0.12);
  --cappy-green-glow: rgba(37, 211, 102, 0.3);
  --cappy-red: #ef4444;
  --cappy-red-dim: rgba(239, 68, 68, 0.12);
  --cappy-amber: #f59e0b;
  --cappy-amber-dim: rgba(245, 158, 11, 0.12);
  --cappy-blue: #3b82f6;
  --cappy-blue-dim: rgba(59, 130, 246, 0.12);
  --cappy-radius: 10px;
  --cappy-radius-sm: 6px;
  --cappy-transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
  padding: 10px;
  overflow-x: hidden;
}

/* ── Header / Brand ── */
.header { display: flex; align-items: center; gap: 10px; padding: 6px 0 14px; }
.header img { width: 32px; height: 32px; border-radius: 8px; }
.header-text { display: flex; flex-direction: column; }
.header-title { font-size: 14px; font-weight: 700; letter-spacing: -0.3px; }
.header-sub { font-size: 10px; color: var(--vscode-descriptionForeground); letter-spacing: 0.2px; }

/* ── Cards ── */
.card {
  margin-bottom: 10px; padding: 14px;
  background: var(--vscode-editor-background);
  border-radius: var(--cappy-radius);
  border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06));
  transition: border-color var(--cappy-transition);
}
.card:hover { border-color: var(--vscode-focusBorder); }
.card-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.8px; color: var(--vscode-descriptionForeground);
  margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;
}

/* ── Status Indicator (hero ring) ── */
.status-ring {
  width: 64px; height: 64px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 12px; position: relative; transition: all var(--cappy-transition);
}
.status-ring::before {
  content: ''; position: absolute; inset: -4px; border-radius: 50%;
  border: 2.5px solid transparent; transition: border-color var(--cappy-transition);
}
.status-ring .ring-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
.status-ring .ring-icon svg { width: 28px; height: 28px; fill: currentColor; }

.ring-disconnected { background: var(--cappy-red-dim); }
.ring-disconnected::before { border-color: var(--cappy-red); }
.ring-connected { background: var(--cappy-green-dim); }
.ring-connected::before { border-color: var(--cappy-green); animation: ring-glow 2.5s ease-in-out infinite; }
.ring-connecting { background: var(--cappy-amber-dim); }
.ring-connecting::before { border-color: var(--cappy-amber); animation: ring-spin 1.2s linear infinite; }
.ring-qr { background: var(--cappy-blue-dim); }
.ring-qr::before { border-color: var(--cappy-blue); animation: ring-glow 1.5s ease-in-out infinite; }

@keyframes ring-glow {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 transparent; }
  50% { opacity: 0.7; box-shadow: 0 0 12px var(--cappy-green-glow); }
}
@keyframes ring-spin { to { transform: rotate(360deg); } }

.status-label { text-align: center; font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.status-hint { text-align: center; font-size: 10px; color: var(--vscode-descriptionForeground); margin-bottom: 12px; line-height: 1.4; }

/* ── Buttons ── */
.btn {
  width: 100%; padding: 9px 14px; border: none; border-radius: var(--cappy-radius-sm);
  cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all var(--cappy-transition); position: relative; overflow: hidden;
}
.btn::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.06), transparent); pointer-events: none; }
.btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
.btn:active { transform: translateY(0); }
.btn:disabled { opacity: 0.5; pointer-events: none; transform: none; }
.btn-cta { background: var(--cappy-green); color: #fff; box-shadow: 0 2px 8px rgba(37, 211, 102, 0.25); }
.btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.btn-ghost { background: transparent; color: var(--vscode-descriptionForeground); font-weight: 500; font-size: 11px; padding: 6px 10px; }
.btn-ghost:hover { color: var(--vscode-foreground); background: var(--vscode-input-background); }
.btn-sm { padding: 6px 10px; font-size: 11px; }

/* ── QR Area ── */
.qr-container { display: flex; flex-direction: column; align-items: center; padding: 8px; gap: 10px; }
.qr-frame { background: #fff; padding: 10px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); max-width: 200px; width: 100%; transition: transform var(--cappy-transition); }
.qr-frame:hover { transform: scale(1.03); }
.qr-img { width: 100%; image-rendering: pixelated; border-radius: 4px; }
.qr-steps { font-size: 10px; color: var(--vscode-descriptionForeground); text-align: center; line-height: 1.5; }
.qr-steps b { color: var(--vscode-foreground); }

/* ── Info chips ── */
.info-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; background: var(--vscode-input-background); border: 1px solid var(--vscode-widget-border, transparent); transition: background var(--cappy-transition); }
.chip-icon { display: inline-flex; align-items: center; }
.chip-icon svg { width: 12px; height: 12px; fill: currentColor; }

/* ── Chat / Messages ── */
.chat-area { max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 2px 0; scroll-behavior: smooth; }
.chat-area::-webkit-scrollbar { width: 4px; }
.chat-area::-webkit-scrollbar-track { background: transparent; }
.chat-area::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 4px; }
.chat-empty { display: flex; flex-direction: column; align-items: center; padding: 20px 8px; gap: 6px; }
.chat-empty-icon { opacity: 0.4; display: flex; align-items: center; justify-content: center; }
.chat-empty-icon svg { width: 28px; height: 28px; fill: currentColor; }
.chat-empty-text { font-size: 11px; color: var(--vscode-descriptionForeground); text-align: center; line-height: 1.4; }

.msg-bubble { max-width: 88%; padding: 8px 12px; border-radius: 12px; font-size: 12px; line-height: 1.45; word-break: break-word; animation: msg-in 0.2s ease-out; position: relative; }
@keyframes msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.msg-in { align-self: flex-start; background: var(--vscode-input-background); border: 1px solid var(--vscode-widget-border, transparent); border-bottom-left-radius: 4px; }
.msg-out { align-self: flex-end; background: var(--cappy-green-dim); border: 1px solid rgba(37, 211, 102, 0.2); border-bottom-right-radius: 4px; }
.msg-from { font-size: 10px; font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 3px; }
.msg-out .msg-from { color: var(--cappy-green); }
.msg-time { font-size: 9px; color: var(--vscode-descriptionForeground); text-align: right; margin-top: 3px; opacity: 0.7; }
.msg-text { white-space: pre-wrap; }

/* ── Accordion (Settings) ── */
.accordion { border-radius: var(--cappy-radius); overflow: hidden; }
.accordion-trigger {
  width: 100%; background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06));
  border-radius: var(--cappy-radius); padding: 10px 14px;
  font-size: 11px; font-weight: 600; font-family: inherit;
  color: var(--vscode-descriptionForeground); cursor: pointer;
  display: flex; align-items: center; justify-content: space-between;
  transition: all var(--cappy-transition); text-transform: uppercase; letter-spacing: 0.6px;
}
.accordion-trigger:hover { color: var(--vscode-foreground); border-color: var(--vscode-focusBorder); }
.accordion-trigger .chevron { transition: transform var(--cappy-transition); display: inline-flex; align-items: center; }
.accordion-trigger .chevron svg { width: 10px; height: 10px; fill: currentColor; }
.accordion-trigger[aria-expanded="true"] .chevron { transform: rotate(180deg); }
.accordion-trigger[aria-expanded="true"] { border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom-color: transparent; }
.accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out, padding 0.3s ease-out; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06)); border-top: none; border-bottom-left-radius: var(--cappy-radius); border-bottom-right-radius: var(--cappy-radius); padding: 0 14px; }
.accordion-content.open { max-height: 500px; padding: 10px 14px 14px; }

/* ── Form fields ── */
.select-field { width: 100%; padding: 7px 10px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: var(--cappy-radius-sm); font-size: 12px; font-family: inherit; margin-top: 4px; margin-bottom: 8px; transition: border-color var(--cappy-transition); }
.input-field { width: 100%; padding: 7px 10px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: var(--cappy-radius-sm); font-size: 12px; font-family: inherit; margin-top: 4px; outline: none; transition: border-color var(--cappy-transition); }
.input-field:focus, .select-field:focus { border-color: var(--vscode-focusBorder); outline: none; }
.setting-label { font-size: 10px; font-weight: 500; color: var(--vscode-descriptionForeground); margin-top: 8px; display: block; text-transform: uppercase; letter-spacing: 0.3px; }

/* ── Project Tags ── */
.project-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.project-tag { font-size: 11px; padding: 2px 8px; border-radius: 12px; background: var(--cappy-blue-dim); color: var(--cappy-blue); font-weight: 500; }

/* ── Scheduler ── */
.scheduler-list { display: flex; flex-direction: column; gap: 8px; }
.sched-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--vscode-input-background); border-radius: var(--cappy-radius-sm); border: 1px solid var(--vscode-widget-border, transparent); transition: all var(--cappy-transition); }
.sched-item:hover { border-color: var(--vscode-focusBorder); }
.sched-info { flex: 1; min-width: 0; }
.sched-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sched-meta { font-size: 10px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.sched-status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.sched-dot-active { background: var(--cappy-green); }
.sched-dot-paused { background: var(--cappy-amber); }
.sched-dot-error { background: var(--cappy-red); }
.sched-dot-running { background: var(--cappy-blue); animation: ring-glow 1s ease-in-out infinite; }
.sched-actions { display: flex; gap: 4px; flex-shrink: 0; }
.sched-btn { width: 26px; height: 26px; border: none; border-radius: var(--cappy-radius-sm); background: transparent; color: var(--vscode-descriptionForeground); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--cappy-transition); }
.sched-btn:hover { background: var(--vscode-input-background); color: var(--vscode-foreground); }
.sched-btn svg { width: 14px; height: 14px; fill: currentColor; }
.sched-empty { text-align: center; padding: 12px 8px; font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.5; }
.sched-form { display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--vscode-input-background); border-radius: var(--cappy-radius-sm); border: 1px solid var(--vscode-widget-border, transparent); margin-top: 8px; }
.sched-form-row { display: flex; gap: 6px; }
.sched-form-row .input-field, .sched-form-row .select-field { margin-top: 0; }
.sched-form .input-field { margin-top: 0; }

/* ── Tab Bar ── */
.tab-bar {
  display: flex; gap: 0; margin-bottom: 10px;
  background: var(--vscode-editor-background);
  border-radius: var(--cappy-radius);
  border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06));
  padding: 3px; overflow: hidden;
}
.tab-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 8px 6px; border: none; border-radius: var(--cappy-radius-sm);
  background: transparent; color: var(--vscode-descriptionForeground);
  font-size: 11px; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: all var(--cappy-transition);
  position: relative; white-space: nowrap;
}
.tab-btn:hover { color: var(--vscode-foreground); background: rgba(255,255,255,0.04); }
.tab-btn.active {
  color: var(--cappy-green); background: var(--cappy-green-dim);
  box-shadow: 0 1px 4px rgba(37, 211, 102, 0.12);
}
.tab-btn svg { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }
.tab-badge {
  font-size: 9px; font-weight: 700; min-width: 16px; height: 16px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px; background: var(--cappy-green); color: #fff;
  padding: 0 4px; margin-left: 2px;
}
.tab-badge:empty { display: none; }

.tab-panel { display: none; animation: tab-in 0.2s ease-out; }
.tab-panel.active { display: block; }
@keyframes tab-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

/* ── Notebook List ── */
.notebook-list { display: flex; flex-direction: column; gap: 8px; }
.notebook-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: var(--vscode-input-background); border-radius: var(--cappy-radius-sm);
  border: 1px solid var(--vscode-widget-border, transparent);
  transition: all var(--cappy-transition); cursor: default;
}
.notebook-item:hover { border-color: var(--vscode-focusBorder); }
.notebook-icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--cappy-blue-dim); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.notebook-icon svg { width: 16px; height: 16px; fill: var(--cappy-blue); }
.notebook-info { flex: 1; min-width: 0; }
.notebook-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.notebook-meta { font-size: 10px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.notebook-empty { text-align: center; padding: 20px 8px; }
.notebook-empty-icon { opacity: 0.3; display: block; margin: 0 auto 8px; }
.notebook-empty-icon svg { width: 28px; height: 28px; fill: currentColor; }
.notebook-empty-text { font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.5; }

.drop-zone {
  border: 2px dashed var(--vscode-widget-border, rgba(255,255,255,0.15));
  border-radius: var(--cappy-radius);
  padding: 24px 12px; text-align: center; cursor: pointer;
  transition: all var(--cappy-transition); margin-top: 8px;
}
.drop-zone:hover {
  border-color: var(--cappy-blue); background: var(--cappy-blue-dim);
}
.drop-zone-icon { opacity: 0.4; transition: opacity var(--cappy-transition); }
.drop-zone:hover .drop-zone-icon { opacity: 0.8; }
.drop-zone-icon svg { width: 32px; height: 32px; fill: currentColor; display: block; margin: 0 auto 8px; }
.drop-zone-text { font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.5; }
.drop-zone:hover .drop-zone-text { color: var(--vscode-foreground); }
.drop-zone.ingesting { border-color: var(--cappy-amber); background: var(--cappy-amber-dim); pointer-events: none; }
.drop-zone.ingesting .drop-zone-icon svg { animation: ring-spin 1.2s linear infinite; }

/* ── Utility ── */
.hidden { display: none !important; }
.footer { display: flex; justify-content: center; padding-top: 6px; }
`;
