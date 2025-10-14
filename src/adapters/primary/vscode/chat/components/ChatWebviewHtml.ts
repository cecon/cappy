import * as vscode from 'vscode'

export interface ChatWebviewOptions {
  extensionUri: vscode.Uri
  webview: vscode.Webview
  nonce: string
}

/**
 * Generates the HTML content for the Chat webview
 * Uses Vite-built React application
 */
export class ChatWebviewHtml {
  private options: ChatWebviewOptions

  constructor(options: ChatWebviewOptions) {
    this.options = options
  }

  generate(): string {
    const { scriptUri, styleUri } = this.getResourceUris()
    const csp = this.generateCSP()
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.generateHead(csp, styleUri)}
</head>
<body>
  ${this.generateBody(scriptUri)}
</body>
</html>`
  }

  private getResourceUris() {
    const outPath = vscode.Uri.joinPath(this.options.extensionUri, 'out')
    return {
      scriptUri: this.options.webview.asWebviewUri(vscode.Uri.joinPath(outPath, 'main.js')),
      styleUri: this.options.webview.asWebviewUri(vscode.Uri.joinPath(outPath, 'main.css'))
    }
  }

  private generateCSP(): string {
    const { webview, nonce } = this.options
    return [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} https: data:`,
      `connect-src ${webview.cspSource}`
    ].join('; ')
  }

  private generateHead(csp: string, styleUri: vscode.Uri): string {
    return `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${styleUri}">
  <title>Cappy Chat</title>
  ${this.generateStyles()}`
  }

  private generateStyles(): string {
    return `
  <style>
    html, body, #root {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #1e1e1e;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #root:empty::before {
      content: 'Loading Cappy Chat...';
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 14px;
      color: #858585;
    }
  </style>`
  }

  private generateBody(scriptUri: vscode.Uri): string {
    const { nonce } = this.options
    return `
  <div id="root"></div>
  <script nonce="${nonce}">
    ${this.generateInlineScript(scriptUri)}
  </script>
  <script type="module" src="${scriptUri}" nonce="${nonce}"></script>`
  }

  private generateInlineScript(scriptUri: vscode.Uri): string {
    return `
    // Acquire VS Code API and make it globally available
    window.vscodeApi = acquireVsCodeApi();
    
    // Debug: log errors and confirm vscode API
    window.addEventListener('error', (e) => {
      console.error('[Cappy Webview] Error:', e.message, e.filename, e.lineno, e.error);
      document.getElementById('root').innerHTML = '<div style="padding:20px;color:#f48771;">Error: ' + e.message + '</div>';
    });
    
    window.addEventListener('load', () => {
      console.log('[Cappy Webview] Window loaded');
      console.log('[Cappy Webview] Script loaded successfully');
      setTimeout(() => {
        const root = document.getElementById('root');
        console.log('[Cappy Webview] Root element:', root ? 'exists' : 'missing');
        console.log('[Cappy Webview] Root innerHTML:', root ? root.innerHTML.substring(0, 100) : 'N/A');
      }, 1000);
    });
    
    console.log('[Cappy Webview] VSCode API:', typeof acquireVsCodeApi !== 'undefined');
    console.log('[Cappy Webview] Loading React from:', '${scriptUri}');`
  }

  static generateNonce(): string {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
  }
}
