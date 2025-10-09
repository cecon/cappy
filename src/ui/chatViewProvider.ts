import * as vscode from 'vscode';

/**
 * Provider for the Cappy Chat webview
 * Integrates LangGraph + Assistant UI with VS Code Extension
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cappy.chatView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'out'),
        vscode.Uri.joinPath(this._extensionUri, 'resources')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (data) => {
        switch (data.type) {
          case 'sendMessage':
            await this._handleChatMessage(data.content);
            break;
          case 'executeCommand':
            await this._handleCommandExecution(data.command);
            break;
          case 'getContext':
            await this._sendContext();
            break;
          case 'getActiveTask':
            await this._sendActiveTask();
            break;
          case 'log':
            console.log('[Cappy Chat]', data.message);
            break;
          case 'error':
            console.error('[Cappy Chat Error]', data.message);
            vscode.window.showErrorMessage(`Chat Error: ${data.message}`);
            break;
        }
      },
      undefined,
      this._context.subscriptions
    );
  }

  /**
   * Handle chat messages from webview
   */
  private async _handleChatMessage(content: string) {
    try {
      // Import LangGraph runtime dynamically (Node.js side)
      const { LangGraphRuntime } = await import('../services/langgraph/runtime');
      
      if (!this._runtime) {
        this._runtime = new LangGraphRuntime();
      }

      // Process message with LangGraph
      const response = await this._runtime.processMessage(content);
      
      // Send response back to webview
      this._view?.webview.postMessage({
        type: 'chatResponse',
        content: response.content
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Cappy Chat] Error processing message:', errorMessage);
      
      this._view?.webview.postMessage({
        type: 'error',
        message: `Failed to process message: ${errorMessage}`
      });
    }
  }

  private _runtime?: any; // LangGraphRuntime instance

  /**
   * Execute terminal commands from chat
   */
  private async _handleCommandExecution(command: string) {
    try {
      const terminal = vscode.window.createTerminal('Cappy Chat');
      terminal.show();
      terminal.sendText(command);
      
      this._view?.webview.postMessage({
        type: 'commandResult',
        result: {
          success: true,
          message: `Command executed: ${command}`
        }
      });
    } catch (error) {
      this._view?.webview.postMessage({
        type: 'commandResult',
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * Send workspace context to chat
   */
  private async _sendContext() {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const activeEditor = vscode.window.activeTextEditor;
      
      const context = {
        workspace: workspaceFolders?.[0]?.uri.fsPath,
        activeFile: activeEditor?.document.fileName,
        selection: activeEditor?.selection ? {
          start: activeEditor.selection.start,
          end: activeEditor.selection.end
        } : undefined,
        language: activeEditor?.document.languageId
      };

      this._view?.webview.postMessage({
        type: 'context',
        data: context
      });
    } catch (error) {
      console.error('Failed to send context:', error);
    }
  }

  /**
   * Send active task information to chat
   */
  private async _sendActiveTask() {
    try {
      const taskXml = await vscode.commands.executeCommand('cappy.getActiveTask') as string;
      
      this._view?.webview.postMessage({
        type: 'activeTask',
        data: { taskXml }
      });
    } catch (error) {
      console.error('Failed to get active task:', error);
      this._view?.webview.postMessage({
        type: 'activeTask',
        data: { taskXml: '', error: 'No active task found' }
      });
    }
  }

  /**
   * Generate HTML for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get URIs for resources
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'components', 'chat-new', 'Chat.css')
    );
    
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'components', 'chat-new', 'chatBundle.js')
    );

    // Generate nonce for CSP
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="${styleUri}" rel="stylesheet">
      <title>CAPPY Chat</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          height: 100vh;
          overflow: hidden;
        }
        #root {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script nonce="${nonce}">
        // VS Code API for webview communication
        const vscode = acquireVsCodeApi();
        
        // Make vscode API available globally
        window.vscodeApi = vscode;
        
        // Helper functions for communication
        window.executeCommand = (command) => {
          vscode.postMessage({ type: 'executeCommand', command });
        };
        
        window.getContext = () => {
          vscode.postMessage({ type: 'getContext' });
        };
        
        window.getActiveTask = () => {
          vscode.postMessage({ type: 'getActiveTask' });
        };
        
        window.logMessage = (message) => {
          vscode.postMessage({ type: 'log', message });
        };
        
        window.logError = (message) => {
          vscode.postMessage({ type: 'error', message });
        };
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
          const message = event.data;
          window.postMessage(message, '*');
        });
      </script>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }
}

/**
 * Generate a nonce for Content Security Policy
 */
function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
