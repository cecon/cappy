import * as vscode from 'vscode';
import { createChatService } from './domains/chat/services/chat-service';
import { LangGraphChatEngine } from './adapters/secondary/agents/langgraph-chat-engine';
import { createInMemoryHistory } from './adapters/secondary/history/in-memory-history';
import { ChatPanel } from './adapters/primary/vscode/chat/ChatPanel';
import type { ChatSession } from './domains/chat/entities/session';

/**
 * Cappy Extension - React + Vite Version
 * 
 * This is the main entry point for the Cappy extension.
 * Currently migrating functions from old/ folder one by one.
 */

export function activate(context: vscode.ExtensionContext) {
    console.log('🦫 Cappy extension is now active! (React + Vite version)');
    
    // Register the graph visualization command
    const openGraphCommand = vscode.commands.registerCommand('cappy.openGraph', () => {
        openGraphVisualization(context);
    });
    
    context.subscriptions.push(openGraphCommand);

    // Create adapters and service for chat
    const agent = new LangGraphChatEngine();
    const history = createInMemoryHistory();
    const chatService = createChatService(agent, history);

    // Register TreeDataProvider for the Chat view (sidebar)
    const chatTreeProvider = new ChatTreeProvider(history);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('cappy.chatView', chatTreeProvider)
    );

    // Command to focus the custom Cappy activity container
    const focusActivityCommand = vscode.commands.registerCommand('cappy.focusActivity', async () => {
        // Built-in command for custom view containers: workbench.view.extension.<containerId>
        await vscode.commands.executeCommand('workbench.view.extension.cappy');
    });
    context.subscriptions.push(focusActivityCommand);

    // Register command to open Chat panel
    // Open selected session in ChatPanel
    const openChatCommand = vscode.commands.registerCommand('cappy.openChat', async (session?: ChatSession) => {
        ChatPanel.createOrShow(context, chatService, session ?? null);
    });
    context.subscriptions.push(openChatCommand);

    // New session command
    const newSessionCommand = vscode.commands.registerCommand('cappy.chat.newSession', async () => {
        const session = await chatService.startSession('New Chat');
        chatTreeProvider.refresh();
        ChatPanel.createOrShow(context, chatService, session);
    });
    context.subscriptions.push(newSessionCommand);

    // Rename session command
    const renameSessionCommand = vscode.commands.registerCommand('cappy.chat.renameSession', async (session: ChatSession) => {
        const newTitle = await vscode.window.showInputBox({ prompt: 'Novo nome da sessão', value: session.title });
        if (newTitle && newTitle !== session.title) {
            session.title = newTitle;
            session.updatedAt = Date.now();
            await history.save(session);
            chatTreeProvider.refresh();
        }
    });
    context.subscriptions.push(renameSessionCommand);

    // Delete session command
    const deleteSessionCommand = vscode.commands.registerCommand('cappy.chat.deleteSession', async (session: ChatSession) => {
        const confirm = await vscode.window.showWarningMessage(`Apagar sessão "${session.title}"?`, { modal: true }, 'Apagar');
        if (confirm === 'Apagar') {
            await history.delete(session.id);
            chatTreeProvider.refresh();
        }
    });
    context.subscriptions.push(deleteSessionCommand);
    
    // Add a Status Bar shortcut to open the graph
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = '$(graph) Cappy Graph';
    statusBar.tooltip = 'Open Cappy Graph';
    statusBar.command = 'cappy.openGraph';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Log available Cappy commands for debugging purposes
    vscode.commands.getCommands(true).then((commands) => {
        const cappyCommands = commands.filter((command) => command.startsWith('cappy'));
        console.log('Cappy Commands Registered:', cappyCommands);
    });

    vscode.window.showInformationMessage('Cappy (React + Vite) loaded successfully!');
}

/**
 * Opens the graph visualization webview
 * 
 * @param context - Extension context
 */
async function openGraphVisualization(context: vscode.ExtensionContext) {
    // Create the webview panel
    const panel = vscode.window.createWebviewPanel(
        'cappyGraphVisualization',
        'Cappy: Open Graph',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'out'),
                vscode.Uri.joinPath(context.extensionUri, 'dist')
            ]
        }
    );

    // Set the webview HTML content
    panel.webview.html = getGraphWebviewContent(panel.webview, context.extensionUri);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'ready':
                    vscode.window.showInformationMessage('Graph visualization ready!');
                    break;
                case 'error':
                    vscode.window.showErrorMessage(`Graph error: ${message.error}`);
                    break;
                default:
                    console.log('Unknown message from graph webview:', message);
            }
        },
        undefined,
        context.subscriptions
    );
}

/**
 * Generates the HTML content for the graph webview
 * 
 * @param webview - Webview instance
 * @param extensionUri - Extension URI
 * @returns HTML content string
 */
function getGraphWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Get the local path to main script run in the webview
    const scriptPathOnDisk = vscode.Uri.joinPath(extensionUri, 'out', 'main.js');
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

    // Get the local path to CSS
    const stylesPathOnDisk = vscode.Uri.joinPath(extensionUri, 'out', 'main.css');
    const stylesUri = webview.asWebviewUri(stylesPathOnDisk);

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; 
              style-src ${webview.cspSource} 'unsafe-inline'; 
              script-src 'nonce-${nonce}' ${webview.cspSource};
              img-src ${webview.cspSource} data:;">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${stylesUri}" rel="stylesheet">
        <title>Cappy Knowledge Graph</title>
        <style>
            body, html {
                margin: 0;
                padding: 0;
                height: 100vh;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                font-family: var(--vscode-font-family);
            }
            #root {
                height: 100vh;
                display: flex;
                flex-direction: column;
            }
            .loading {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                flex-direction: column;
                gap: 16px;
            }
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid var(--vscode-progressBar-background);
                border-top: 3px solid var(--vscode-progressBar-foreground);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div id="root">
            <div class="loading">
                <div class="loading-spinner"></div>
                <h2>🦫 Loading Cappy Knowledge Graph...</h2>
                <p>Preparing graph visualization with React + D3.js</p>
            </div>
        </div>
        <script nonce="${nonce}">
            // VS Code API
            const vscode = acquireVsCodeApi();
            
            // Initialize React app
            window.addEventListener('load', () => {
                // Signal that webview is ready
                vscode.postMessage({ command: 'ready' });
                
                // TODO: Load React graph component
                console.log('🦫 Graph webview loaded');
            });
            
            // Error handling
            window.addEventListener('error', (event) => {
                vscode.postMessage({ 
                    command: 'error', 
                    error: event.error?.message || 'Unknown error'
                });
            });
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

/**
 * Generates a nonce for Content Security Policy
 */
function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function deactivate() {
    console.log('🦫 Cappy extension deactivated');
}

/**
 * Minimal TreeDataProvider for the Chat view in the Activity Bar.
 * Shows an empty state for now; will be wired to Chat sessions later.
 */
class ChatTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private history: ReturnType<typeof createInMemoryHistory>;

    constructor(history: ReturnType<typeof createInMemoryHistory>) {
        this.history = history;
    }
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(): Promise<vscode.TreeItem[]> {
        const sessions = await this.history.list();
        if (!sessions.length) {
            const info = new vscode.TreeItem('Nenhuma sessão de chat', vscode.TreeItemCollapsibleState.None);
            info.description = 'Use o menu ou palette para criar uma nova sessão.';
            info.iconPath = new vscode.ThemeIcon('comment');
            return [info];
        }
        return sessions.map(session => {
            const item = new ChatSessionTreeItem(session);
            return item;
        });
    }
}

class ChatSessionTreeItem extends vscode.TreeItem {
    session: ChatSession;
    constructor(session: ChatSession) {
        super(session.title, vscode.TreeItemCollapsibleState.None);
        this.session = session;
        this.description = new Date(session.updatedAt).toLocaleString();
        this.iconPath = new vscode.ThemeIcon('comment-discussion');
        this.contextValue = 'chatSession';
        this.command = {
            command: 'cappy.openChat',
            title: 'Abrir Chat',
            arguments: [session]
        };
    }
}