import * as crypto from "node:crypto";

import * as vscode from "vscode";

/**
 * HTML shell served to every Cappy webview (sidebar view + editor tab).
 * Loads the bundled React app from `out/webview/main.js` and styles from
 * `out/webview/main.css` (esbuild emits CSS alongside JS when CSS is imported).
 */
export function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "out", "webview", "main.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "out", "webview", "styles.css"),
  );
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      "node_modules",
      "@vscode",
      "codicons",
      "dist",
      "codicon.css",
    ),
  );

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${webview.cspSource}`,
  ].join("; ");

  return /* html */ `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <link rel="stylesheet" href="${codiconsUri}" />
    <title>Cappy</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">window.__CAPPY__ = { nonce: "${nonce}" };</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}
