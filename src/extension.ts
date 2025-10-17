import * as vscode from 'vscode';
import * as path from 'path';
import { GraphPanel } from './adapters/primary/vscode/graph/GraphPanel';
import { ChatViewProvider } from './adapters/primary/vscode/chat/ChatViewProvider';
import { CreateFileTool } from './adapters/secondary/tools/create-file-tool';
import { FetchWebTool } from './adapters/secondary/tools/fetch-web-tool';
import { LangGraphChatEngine } from './adapters/secondary/agents/langgraph-chat-engine';
import { createChatService } from './domains/chat/services/chat-service';
import { registerScanWorkspaceCommand } from './adapters/primary/vscode/commands/scan-workspace';
import { registerProcessSingleFileCommand } from './commands/process-single-file';
import { registerDebugCommand } from './commands/debug';
import { FileMetadataDatabase } from './services/file-metadata-database';
import { FileProcessingQueue } from './services/file-processing-queue';
import { FileProcessingWorker } from './services/file-processing-worker';
import { FileProcessingAPI } from './services/file-processing-api';

// Global instances for file processing system
let fileDatabase: FileMetadataDatabase | null = null;
let fileQueue: FileProcessingQueue | null = null;
let fileAPI: FileProcessingAPI | null = null;

/**
 * Cappy Extension - React + Vite Version
 * 
 * This is the main entry point for the Cappy extension.
 * Currently migrating functions from old/ folder one by one.
 */

export function activate(context: vscode.ExtensionContext) {
    console.log('🦫 Cappy extension is now active! (React + Vite version)');

    // Initialize file processing system
    initializeFileProcessingSystem(context).catch(error => {
        console.error('Failed to initialize file processing system:', error);
        vscode.window.showErrorMessage(`Failed to start file processing API: ${error.message}`);
    });

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

    // Register workspace scan command
    registerScanWorkspaceCommand(context);
    console.log('✅ Registered command: cappy.scanWorkspace');

    // Register process single file command
    registerProcessSingleFileCommand(context);
    console.log('✅ Registered command: cappy.processSingleFile');

    // Register debug command
    registerDebugCommand(context);
    console.log('✅ Registered command: cappy.debug');

    // Create chat service with LangGraph engine (includes tools)
    const chatEngine = new LangGraphChatEngine();
    const chatService = createChatService(chatEngine);

    // Register Chat View Provider for sidebar
    const chatViewProvider = new ChatViewProvider(context.extensionUri, chatService);
    const chatViewDisposable = vscode.window.registerWebviewViewProvider(
        ChatViewProvider.viewType, 
        chatViewProvider
    );
    context.subscriptions.push(chatViewDisposable);
    console.log('✅ Registered Chat View Provider: cappy.chatView');
    
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
 * Initializes the file processing system (database, queue, worker, API)
 */
async function initializeFileProcessingSystem(context: vscode.ExtensionContext): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        console.warn('No workspace folder found, skipping file processing system initialization');
        return;
    }

    try {
        // Initialize database
        const dbPath = path.join(context.globalStorageUri.fsPath, 'file-metadata.db');
        fileDatabase = new FileMetadataDatabase(dbPath);
        await fileDatabase.initialize();
        console.log('✅ File metadata database initialized');

        // Initialize services for worker
        const { ParserService } = await import('./services/parser-service.js');
        const { FileHashService } = await import('./services/file-hash-service.js');
        const parserService = new ParserService();
        const hashService = new FileHashService();

        // Initialize worker
        const worker = new FileProcessingWorker(parserService, hashService);
        console.log('✅ File processing worker created');

        // Initialize queue
        fileQueue = new FileProcessingQueue(fileDatabase, worker, {
            concurrency: 2,
            maxRetries: 3,
            autoStart: true
        });
        console.log('✅ File processing queue started');

        // Initialize and start API server
        fileAPI = new FileProcessingAPI(fileQueue, fileDatabase, workspaceRoot, 3456);
        await fileAPI.start();
        console.log('✅ File processing API started on http://localhost:3456');

        // Register cleanup on deactivation
        context.subscriptions.push({
            dispose: async () => {
                if (fileAPI) {
                    await fileAPI.stop();
                    console.log('🛑 File processing API stopped');
                }
                if (fileQueue) {
                    await fileQueue.stop();
                    console.log('🛑 File processing queue stopped');
                }
                if (fileDatabase) {
                    fileDatabase.close();
                    console.log('🛑 File metadata database closed');
                }
            }
        });

        vscode.window.showInformationMessage('✅ File processing system ready on port 3456');
    } catch (error) {
        console.error('Failed to initialize file processing system:', error);
        throw error;
    }
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