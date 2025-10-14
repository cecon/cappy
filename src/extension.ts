import * as vscode from 'vscode';
import { createChatService } from './domains/chat/services/chat-service';
import { LangGraphChatEngine } from './adapters/secondary/agents/langgraph-chat-engine';
import { ChatPanel } from './adapters/primary/vscode/chat/ChatPanel';
import { ChatViewProvider } from './adapters/primary/vscode/chat/ChatViewProvider';
import { GraphPanel } from './adapters/primary/vscode/graph/GraphPanel';
import { CreateFileTool } from './adapters/secondary/tools/create-file-tool';
import { FetchWebTool } from './adapters/secondary/tools/fetch-web-tool';
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

    const fetchWebTool = vscode.lm.registerTool('cappy_fetch_web', new FetchWebTool());
    context.subscriptions.push(fetchWebTool);
    console.log('✅ Registered Language Model Tool: cappy_fetch_web');
    
    // Create output channel for graph logs
    const graphOutputChannel = vscode.window.createOutputChannel('Cappy Graph');
    context.subscriptions.push(graphOutputChannel);
    
    // Create graph panel instance
    const graphPanel = new GraphPanel(context, graphOutputChannel);
    
    // Register the graph visualization command
    const openGraphCommand = vscode.commands.registerCommand('cappy.openGraph', async () => {
        await graphPanel.show();
    });
    
    context.subscriptions.push(openGraphCommand);

    // Create adapters and service for chat
    const agent = new LangGraphChatEngine();
    const chatService = createChatService(agent);

    // Register Chat View Provider for sidebar
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

    // Command to open chat in a panel
    const openChatCommand = vscode.commands.registerCommand('cappy.openChat', async (session?: ChatSession) => {
        try {
            ChatPanel.createOrShow(context, chatService, session);
        } catch (error) {
            console.error('Error opening chat:', error);
        }
    });
    context.subscriptions.push(openChatCommand);

    // New session command - creates and opens a new session
    const newSessionCommand = vscode.commands.registerCommand('cappy.chat.newSession', async () => {
        try {
            const session = await chatService.startSession('New Chat');
            ChatPanel.createOrShow(context, chatService, session);
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
// Old implementation removed - now using GraphPanel class

export function deactivate() {
    console.log('🦫 Cappy extension deactivated');
}

// TreeDataProvider removido - agora usamos WebviewView diretamente na sidebar