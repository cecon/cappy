import * as vscode from "vscode";

import type { ChatEvent } from "./sessionTypes";
import { SessionStore } from "./SessionStore";

const VIEW_TYPE = "cappy.session";

/**
 * Custom editor for `.cappy` files (JSONL transcripts).
 *
 * Each `.cappy` file is the chat document of one session living under
 * `~/.cappy/sessions/<id>/chat.cappy`. On `resolveCustomTextEditor` this provider
 * renders the chat surface inside the editor area and replays the existing JSONL
 * to the webview. The full chat UI (Timeline + Drawer) is wired in a follow-up
 * step — for now this scaffold renders a minimal placeholder that proves the
 * end-to-end plumbing (file open → custom editor → webview) works.
 */
export class CappyEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = VIEW_TYPE;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: SessionStore,
  ) {}

  public static register(
    context: vscode.ExtensionContext,
    store: SessionStore,
  ): vscode.Disposable {
    const provider = new CappyEditorProvider(context, store);
    return vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    const sessionId = sessionIdFromDocumentUri(document.uri);
    webviewPanel.webview.options = { enableScripts: true, localResourceRoots: [] };
    webviewPanel.webview.html = renderPlaceholder({
      sessionId,
      filePath: document.uri.fsPath,
    });

    const events = await this.loadEvents(sessionId);
    await webviewPanel.webview.postMessage({
      type: "transcript:replay",
      sessionId,
      events,
    });

    const sub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) {
        return;
      }
      void this.loadEvents(sessionId).then((next) =>
        webviewPanel.webview.postMessage({
          type: "transcript:replay",
          sessionId,
          events: next,
        }),
      );
    });
    webviewPanel.onDidDispose(() => sub.dispose());
  }

  private async loadEvents(sessionId: string | null): Promise<ChatEvent[]> {
    if (!sessionId) {
      return [];
    }
    return this.store.readEvents(sessionId).catch(() => []);
  }
}

/**
 * Derives the session id from the `.cappy` file path. Supports both the canonical
 * `~/.cappy/sessions/<id>/chat.cappy` layout and arbitrary paths (returns null when
 * the parent folder name cannot be used as id).
 */
function sessionIdFromDocumentUri(uri: vscode.Uri): string | null {
  const parts = uri.fsPath.split(/[\\/]/u).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  return parts[parts.length - 2] ?? null;
}

function renderPlaceholder(input: { sessionId: string | null; filePath: string }): string {
  const idLabel = input.sessionId ?? "(no session)";
  const path = escapeHtml(input.filePath);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
    <title>Cappy Session</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        margin: 0; padding: 24px;
        background: var(--vscode-editor-background, #1e1e1e);
        color: var(--vscode-editor-foreground, #d4d4d4);
      }
      h1 { font-size: 16px; margin: 0 0 4px 0; font-weight: 600; }
      .meta { font-size: 12px; opacity: 0.7; margin-bottom: 24px; }
      pre {
        background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.1));
        border-left: 4px solid var(--vscode-textBlockQuote-border, #3794ff);
        padding: 12px; margin: 0;
        white-space: pre-wrap; word-break: break-word;
        font-family: var(--vscode-editor-font-family, ui-monospace, monospace);
        font-size: 12px;
      }
      .events { display: flex; flex-direction: column; gap: 6px; }
      .event {
        padding: 8px 10px; border-radius: 4px;
        background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.08));
        font-size: 12px;
      }
      .event b { font-weight: 600; }
      .empty { opacity: 0.6; font-style: italic; }
    </style>
  </head>
  <body>
    <h1>Cappy Session</h1>
    <div class="meta"><span>${escapeHtml(idLabel)}</span> &middot; <span>${path}</span></div>
    <div id="events" class="events"><div class="empty">Loading transcript…</div></div>
    <script>
      const vscode = acquireVsCodeApi();
      const root = document.getElementById("events");
      function render(events) {
        if (!events || events.length === 0) {
          root.innerHTML = '<div class="empty">No events yet.</div>';
          return;
        }
        root.innerHTML = "";
        for (const ev of events) {
          const el = document.createElement("div");
          el.className = "event";
          const ts = new Date(ev.t).toISOString();
          el.innerHTML = '<b>' + ev.kind + '</b> &middot; ' + ts;
          root.appendChild(el);
        }
      }
      window.addEventListener("message", (e) => {
        const msg = e.data;
        if (msg && msg.type === "transcript:replay") {
          render(msg.events);
        }
      });
    </script>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
