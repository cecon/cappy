import * as vscode from 'vscode';
import * as fs from 'fs';

export class WebviewContentBuilder {
  private readonly context: vscode.ExtensionContext;
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  build(panel: vscode.WebviewPanel): string {
    const nonce = this.getNonce();
    const cspSource = panel.webview.cspSource;

    const graphHtmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'graph.html');
    let htmlContent = fs.readFileSync(graphHtmlPath.fsPath, 'utf8');

    const graphJsUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'graph.js')
    );
    const indexJsUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'index.js')
    );
    const graphCssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'graph.css')
    );
    const mainCssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'main.css')
    );
    const faviconUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'icons', 'cappy-activity.svg')
    );

    htmlContent = htmlContent
      .replace('./graph.js', graphJsUri.toString())
      .replace('./index.js', indexJsUri.toString())
      .replace('./graph.css', graphCssUri.toString())
      .replace('./main.css', mainCssUri.toString());

    const mainCssFsPath = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'main.css').fsPath;
    if (!htmlContent.includes('main.css') && fs.existsSync(mainCssFsPath)) {
      htmlContent = htmlContent.replace('</head>', `  <link rel="stylesheet" href="${mainCssUri}">\n</head>`);
    }

    if (!htmlContent.includes('rel="icon"')) {
      htmlContent = htmlContent.replace('</head>', `  <link rel="icon" type="image/svg+xml" href="${faviconUri}">\n</head>`);
    }

    if (!htmlContent.includes('cappy-scroll-override')) {
      htmlContent = htmlContent.replace('</head>', `<style id="cappy-scroll-override">html,body{overflow:auto !important;}#root{overflow:auto !important;}</style>\n</head>`);
    }

    htmlContent = htmlContent.replace(/<link rel="modulepreload"[^>]*>/g, '');

    if (!htmlContent.includes('Content-Security-Policy')) {
      htmlContent = htmlContent.replace(
        '<meta name="viewport"',
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}; img-src ${cspSource} data: https:; font-src ${cspSource}; connect-src ${cspSource} http://localhost:3456;">\n    <meta name="viewport"`
      );
    }

    htmlContent = htmlContent.replace(/<script type="module"/g, `<script type="module" nonce="${nonce}"`);

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
