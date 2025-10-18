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
import { registerDebugCommand, registerDebugDatabaseCommand, registerDebugAddTestDataCommand } from './commands/debug';
import { reanalyzeRelationships } from './commands/reanalyze-relationships';
import { FileMetadataDatabase } from './services/file-metadata-database';
import { FileProcessingQueue } from './services/file-processing-queue';
import { FileProcessingWorker } from './services/file-processing-worker';
import { FileProcessingAPI } from './services/file-processing-api';
import type { VectorStorePort, GraphStorePort } from './domains/graph/ports/indexing-port';

// Global instances for file processing system
let fileDatabase: FileMetadataDatabase | null = null;
let fileQueue: FileProcessingQueue | null = null;
let fileAPI: FileProcessingAPI | null = null;
let graphStore: GraphStorePort | null = null;

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

    // Initialize file processing system (pass graphPanel to refresh on updates)
    initializeFileProcessingSystem(context, graphPanel).catch(error => {
        console.error('Failed to initialize file processing system:', error);
        vscode.window.showErrorMessage(`Failed to start file processing API: ${error.message}`);
    });
    
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

    // Register debug database commands
    registerDebugDatabaseCommand(context);
    console.log('✅ Registered command: cappy.debugDatabase');
    
    registerDebugAddTestDataCommand(context);
    console.log('✅ Registered command: cappy.debugAddTestData');

    // Register reanalyze relationships command
    const reanalyzeCommand = vscode.commands.registerCommand('cappy.reanalyzeRelationships', async () => {
        if (!graphStore) {
            vscode.window.showErrorMessage('Graph store not initialized');
            return;
        }
        await reanalyzeRelationships(graphStore);
    });
    context.subscriptions.push(reanalyzeCommand);
    console.log('✅ Registered command: cappy.reanalyzeRelationships');

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
async function initializeFileProcessingSystem(context: vscode.ExtensionContext, graphPanel: GraphPanel): Promise<void> {
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
        const { EmbeddingService } = await import('./services/embedding-service.js');
        const { IndexingService } = await import('./services/indexing-service.js');
        const { SQLiteAdapter } = await import('./adapters/secondary/graph/sqlite-adapter.js');
        const { ConfigService } = await import('./services/config-service.js');
        
        const parserService = new ParserService();
        const hashService = new FileHashService();
        
        // Initialize indexing services
        const configService = new ConfigService(workspaceRoot);
        const embeddingService = new EmbeddingService();
        await embeddingService.initialize();
        console.log('✅ Embedding service initialized');
        
        // Initialize graph database
        const sqlitePath = configService.getKuzuPath(workspaceRoot);
        const graphStoreInstance = new SQLiteAdapter(sqlitePath);
        await graphStoreInstance.initialize();
        console.log('✅ Graph store initialized');
        
        // Store globally for reanalyze command
        graphStore = graphStoreInstance;
        
        // Initialize indexing service (null for vector store, we only use graph)
        const indexingService = new IndexingService(
            null as unknown as VectorStorePort, // VectorStore not needed for now
            graphStoreInstance,
            embeddingService
        );
        console.log('✅ Indexing service initialized');

        // Initialize worker WITH indexing service
        const worker = new FileProcessingWorker(parserService, hashService, indexingService);
        console.log('✅ File processing worker created (with indexing)');

        // Initialize queue
        fileQueue = new FileProcessingQueue(fileDatabase, worker, {
            concurrency: 2,
            maxRetries: 3,
            autoStart: true
        });
        console.log('✅ File processing queue started');

        // Auto-refresh Graph panel when a file completes processing
        try {
            fileQueue.on('file:complete', async () => {
                await graphPanel.refreshSubgraph(2);
            });
        } catch (e) {
            console.warn('Could not attach graph refresh listener:', e);
        }

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