import * as vscode from 'vscode';
import { createChatService } from './domains/chat/services/chat-service';
import { LangGraphChatEngine } from './adapters/secondary/agents/langgraph-chat-engine';
import { createInMemoryHistory } from './adapters/secondary/history/in-memory-history';
import { ChatViewProvider } from './adapters/primary/vscode/chat/ChatViewProvider';
import { CreateFileTool } from './adapters/secondary/tools/create-file-tool';
import type { ChatSession } from './domains/chat/entities/session';

/**
 * Cappy Extension - React + Vite Version
 * 
 * This is the main entry point for the Cappy extension.
 * Currently migrating functions from old/ folder one by one.
 */

export function activate(context: vscode.ExtensionContext) {
    console.log('🦫 Cappy extension is now active! (React + Vite version)');

    // Register Language Model Tools
    const createFileTool = vscode.lm.registerTool('cappy_create_file', new CreateFileTool());
    context.subscriptions.push(createFileTool);
    console.log('✅ Registered Language Model Tool: cappy_create_file');
    
    // Register the graph visualization command
    const openGraphCommand = vscode.commands.registerCommand('cappy.openGraph', () => {
        openGraphVisualization(context);
    });
    
    context.subscriptions.push(openGraphCommand);

    // Create adapters and service for chat
    const agent = new LangGraphChatEngine();
    const history = createInMemoryHistory();
    const chatService = createChatService(agent, history);

    // Register WebviewView Provider for Chat in the sidebar
    const chatViewProvider = new ChatViewProvider(context.extensionUri, chatService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider)
    );

    // Command to focus the custom Cappy activity container
    const focusActivityCommand = vscode.commands.registerCommand('cappy.focusActivity', async () => {
        // Built-in command for custom view containers: workbench.view.extension.<containerId>
        await vscode.commands.executeCommand('workbench.view.extension.cappy');
    });
    context.subscriptions.push(focusActivityCommand);

    // Command to focus and load a session in the chat view
    const openChatCommand = vscode.commands.registerCommand('cappy.openChat', async (session?: ChatSession) => {
        try {
            await vscode.commands.executeCommand('cappy.chatView.focus');
            // Wait a bit for the view to be ready before loading session
            if (session) {
                await new Promise(resolve => setTimeout(resolve, 100));
                await chatViewProvider.loadSession(session);
            }
        } catch (error) {
            console.error('Error opening chat:', error);
        }
    });
    context.subscriptions.push(openChatCommand);

    // New session command - creates and loads a new session
    const newSessionCommand = vscode.commands.registerCommand('cappy.chat.newSession', async () => {
        try {
            const session = await chatService.startSession('New Chat');
            await vscode.commands.executeCommand('cappy.chatView.focus');
            // Wait a bit for the view to be ready before loading session
            await new Promise(resolve => setTimeout(resolve, 100));
            await chatViewProvider.loadSession(session);
        } catch (error) {
            console.error('Error creating new session:', error);
        }
    });
    context.subscriptions.push(newSessionCommand);
    
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
function getGraphWebviewContent(webview: vscode.Webview, _extensionUri: vscode.Uri): string {
    void _extensionUri; // Parâmetro mantido para compatibilidade
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
                <h2>🦫 Cappy Knowledge Graph</h2>
                <p>Graph visualization será implementado em breve...</p>
                <p>Por enquanto, teste o chat na sidebar!</p>
            </div>
        </div>
        <script nonce="${nonce}">
            // VS Code API
            const vscode = acquireVsCodeApi();
            
            // Initialize
            window.addEventListener('load', () => {
                // Signal that webview is ready
                vscode.postMessage({ command: 'ready' });
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

// TreeDataProvider removido - agora usamos WebviewView diretamente na sidebar