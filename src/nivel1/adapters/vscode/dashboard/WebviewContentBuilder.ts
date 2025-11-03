import * as vscode from 'vscode';
import * as fs from 'node:fs';

export class WebviewContentBuilder {
  private readonly context: vscode.ExtensionContext;
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  build(panel: vscode.WebviewPanel): string {
    const nonce = this.getNonce();
    const cspSource = panel.webview.cspSource;

    // Strict: require Vite-built HTML under out/
    const htmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'dashboard.html');
    if (!fs.existsSync(htmlPath.fsPath)) {
      throw new Error(`Dashboard HTML not found: ${htmlPath.fsPath}. Run 'npm run build' to generate it.`);
    }
    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

    const graphJsUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'dashboard.js')
    );
    const indexJsUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'chat.js')
    );
    const graphCssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'dashboard.css')
    );
    const mainCssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'chat.css')
    );
    const faviconUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'icons', 'cappy-activity.svg')
    );

    htmlContent = htmlContent
      .replace('./dashboard.js', graphJsUri.toString())
      .replace('./chat.js', indexJsUri.toString())
      .replace('./dashboard.css', graphCssUri.toString())
      .replace('./chat.css', mainCssUri.toString());

    const mainCssFsPath = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'chat.css').fsPath;
    if (!htmlContent.includes('chat.css') && fs.existsSync(mainCssFsPath)) {
      htmlContent = htmlContent.replace('</head>', `  <link rel="stylesheet" href="${mainCssUri}">\n</head>`);
    }

    if (!htmlContent.includes('rel="icon"')) {
      htmlContent = htmlContent.replace('</head>', `  <link rel="icon" type="image/svg+xml" href="${faviconUri}">\n</head>`);
    }

    if (!htmlContent.includes('cappy-scroll-override')) {
      htmlContent = htmlContent.replace('</head>', `<style id="cappy-scroll-override">html,body{overflow:auto !important;}#root{overflow:auto !important;}</style>\n</head>`);
    }

  htmlContent = htmlContent.replaceAll(/<link rel="modulepreload"[^>]*>/g, '');

    if (!htmlContent.includes('Content-Security-Policy')) {
      htmlContent = htmlContent.replace(
        '<meta name="viewport"',
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}; img-src ${cspSource} data: https:; font-src ${cspSource}; connect-src ${cspSource};">\n    <meta name="viewport"`
      );
    }

    htmlContent = htmlContent.replaceAll('<script type="module"', `<script type="module" nonce="${nonce}"`);

    return htmlContent;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
