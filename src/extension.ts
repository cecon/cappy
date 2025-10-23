import * as vscode from 'vscode';
import * as path from 'path';
import { GraphPanel } from './adapters/primary/vscode/graph/GraphPanel';
import { ChatViewProvider } from './adapters/primary/vscode/chat/ChatViewProvider';
import { DocumentsViewProvider } from './adapters/primary/vscode/documents/DocumentsViewProvider';
import { CreateFileTool } from './adapters/secondary/tools/create-file-tool';
import { FetchWebTool } from './adapters/secondary/tools/fetch-web-tool';
import { ContextRetrievalTool } from './domains/chat/tools/native/context-retrieval';
import { LangGraphChatEngine } from './adapters/secondary/agents/langgraph-chat-engine';
import { createChatService } from './domains/chat/services/chat-service';
import { registerScanWorkspaceCommand } from './adapters/primary/vscode/commands/scan-workspace';
import { registerProcessSingleFileCommand } from './commands/process-single-file';
import { registerDebugRetrievalCommand } from './commands/debug-retrieval';
import { registerDebugCommand, registerDebugDatabaseCommand, registerDebugAddTestDataCommand } from './commands/debug';
import { reanalyzeRelationships } from './commands/reanalyze-relationships';
import { registerResetDatabaseCommand } from './commands/reset-database';
import { FileMetadataDatabase } from './services/file-metadata-database';
import { FileProcessingQueue } from './services/file-processing-queue';
import { FileProcessingWorker } from './services/file-processing-worker';
import { FileProcessingAPI } from './services/file-processing-api';
import { createVectorStore } from './adapters/secondary/vector/sqlite-vector-adapter';
import type { GraphStorePort } from './domains/graph/ports/indexing-port';

// Global instances for file processing system
let fileDatabase: FileMetadataDatabase | null = null;
let fileQueue: FileProcessingQueue | null = null;
let fileAPI: FileProcessingAPI | null = null;
let graphStore: GraphStorePort | null = null;
let contextRetrievalToolInstance: ContextRetrievalTool | null = null;

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

    // Create context retrieval tool instance (will be initialized later with graph data)
    contextRetrievalToolInstance = new ContextRetrievalTool();
    const contextRetrievalTool = vscode.lm.registerTool('cappy_retrieve_context', contextRetrievalToolInstance);
    context.subscriptions.push(contextRetrievalTool);
    console.log('✅ Registered Language Model Tool: cappy_retrieve_context');

    // List all registered tools for debugging (longer wait to ensure LM runtime loads)
    setTimeout(() => {
        const allTools = vscode.lm.tools;
        const cappyTools = allTools.filter(t => t.name.startsWith('cappy_'));
        console.log('🛠️ All Cappy tools registered:', cappyTools.map(t => t.name).join(', '));
        console.log('🛠️ Total Language Model tools available:', allTools.length);
        console.log('🛠️ Tool names:', allTools.map(t => t.name).join(', '));
        
        // Log tool registration to console instead of showing a user-facing notification
        if (cappyTools.length > 0) {
            console.log(`✅ Cappy tools registered: ${cappyTools.map(t => t.name).join(', ')}`);
        } else {
            console.warn('⚠️ Cappy: Nenhuma ferramenta foi registrada!');
        }
    }, 5000); // Wait 5 seconds for all tools to register
    
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

    // Register interactive hybrid search command
    const searchCommand = vscode.commands.registerCommand('cappy.search', async () => {

    const vscode = await import('vscode');
    const { HybridRetriever } = await import('./services/hybrid-retriever.js');

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Prompt for query
        const query = await vscode.window.showInputBox({
            title: 'Cappy Hybrid Search',
            prompt: 'Enter your search query (code, docs, rules, tasks)',
            ignoreFocusOut: true
        });
        if (!query) {
            return;
        }

        // Create retriever and run search
        const retriever = new HybridRetriever();
        let result;
        try {
            result = await retriever.retrieve(query, {
                maxResults: 10,
                minScore: 0.3,
                sources: ['code', 'documentation', 'prevention', 'task'],
                includeRelated: true,
                rerank: true
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Hybrid search failed: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }

        if (!result || !result.contexts.length) {
            vscode.window.showInformationMessage(`No relevant context found for: "${query}"`);
            return;
        }

        // Show results in QuickPick
        type QuickPickItem = {
            label: string;
            description?: string;
            detail?: string;
            ctx: typeof result.contexts[0];
        };
        const items: QuickPickItem[] = result.contexts.map(ctx => ({
            label: `${ctx.source === 'code' ? '💻' : ctx.source === 'documentation' ? '📚' : ctx.source === 'prevention' ? '🛡️' : ctx.source === 'task' ? '✅' : '📄'} ${ctx.metadata.title || ctx.id}`,
            description: ctx.filePath ? `${ctx.filePath}` : undefined,
            detail: ctx.snippet ? ctx.snippet.replace(/\n/g, ' ').slice(0, 200) : ctx.content.slice(0, 200),
            ctx
        }));

        const picked = await vscode.window.showQuickPick(items, {
            title: `Hybrid Search Results (${result.contexts.length})` ,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Select a context to copy snippet to clipboard',
        });
        if (picked && typeof picked === 'object' && 'ctx' in picked && picked.ctx) {
            await vscode.env.clipboard.writeText(picked.ctx.content);
            vscode.window.showInformationMessage('Context copied to clipboard!');
        }
    });
    context.subscriptions.push(searchCommand);
    console.log('✅ Registered command: cappy.search');

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

    // Register retrieval debug command
    registerDebugRetrievalCommand(context);
    console.log('✅ Registered command: cappy.debugRetrieval');
    
    registerDebugAddTestDataCommand(context);
    console.log('✅ Registered command: cappy.debugAddTestData');

    // Register reanalyze relationships command
    const reanalyzeCommand = vscode.commands.registerCommand('cappy.reanalyzeRelationships', async () => {
        if (!graphStore) {
            vscode.window.showErrorMessage('Graph store not initialized');
            return;
        }
        if (!fileDatabase) {
            vscode.window.showErrorMessage('File database not initialized');
            return;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        await reanalyzeRelationships(graphStore, workspaceRoot, fileDatabase);
    });
    context.subscriptions.push(reanalyzeCommand);
    console.log('✅ Registered command: cappy.reanalyzeRelationships');

    // Register diagnose graph command
    const diagnoseCommand = vscode.commands.registerCommand('cappy.diagnoseGraph', async () => {
        if (!graphStore) {
            vscode.window.showErrorMessage('Graph store not initialized');
            return;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        const { diagnoseGraph } = await import('./commands/diagnose-graph.js');
        const outputChannel = vscode.window.createOutputChannel('Cappy Graph Diagnostics');
        await diagnoseGraph(graphStore, outputChannel, workspaceRoot);
    });
    context.subscriptions.push(diagnoseCommand);
    console.log('✅ Registered command: cappy.diagnoseGraph');

    // Register reset database command
    registerResetDatabaseCommand(context);
    console.log('✅ Registered command: cappy.resetDatabase');

    // Register test retriever command
    const testRetrieverCommand = vscode.commands.registerCommand('cappy.testRetriever', async () => {
        try {
            const query = await vscode.window.showInputBox({
                prompt: 'Enter search query to test the retriever',
                placeHolder: 'e.g., workspace scanner, graph service, authentication',
                value: 'workspace scanner'
            });
            
            if (!query) {
                return;
            }
            
            if (!contextRetrievalToolInstance) {
                vscode.window.showErrorMessage('Context retrieval tool not initialized');
                return;
            }
            
            const outputChannel = vscode.window.createOutputChannel('Cappy Retriever Test');
            outputChannel.show();
            outputChannel.appendLine(`🔍 Testing retriever with query: "${query}"`);
            outputChannel.appendLine('━'.repeat(60));
            
            vscode.window.showInformationMessage(`✅ Test command ready. Use GitHub Copilot Chat:\n@workspace use cappy_retrieve_context to search for "${query}"`);
            outputChannel.appendLine(`\n� To test the retriever:`);
            outputChannel.appendLine(`   Open GitHub Copilot Chat and run:`);
            outputChannel.appendLine(`   @workspace use cappy_retrieve_context to search for "${query}"`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Retriever test failed: ${error}`);
            console.error('Retriever test error:', error);
        }
    });
    context.subscriptions.push(testRetrieverCommand);
    console.log('✅ Registered command: cappy.testRetriever');

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
    
    // Register Documents View Provider for sidebar
    const documentsViewProvider = new DocumentsViewProvider(context.extensionUri);
    const documentsViewDisposable = vscode.window.registerWebviewViewProvider(
        DocumentsViewProvider.viewType,
        documentsViewProvider
    );
    context.subscriptions.push(documentsViewDisposable);
    console.log('✅ Registered Documents View Provider: cappy.documentsView');
    
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
        // Initialize database in workspace .cappy/data folder
        const cappyDataDir = path.join(workspaceRoot, '.cappy', 'data');
        const dbPath = path.join(cappyDataDir, 'file-metadata.db');
        fileDatabase = new FileMetadataDatabase(dbPath);
        await fileDatabase.initialize();
        console.log('✅ File metadata database initialized at:', dbPath);

        // Initialize services for worker
        const { ParserService } = await import('./services/parser-service.js');
        const { FileHashService } = await import('./services/file-hash-service.js');
        const { EmbeddingService } = await import('./services/embedding-service.js');
        const { IndexingService } = await import('./services/indexing-service.js');
        const { SQLiteAdapter } = await import('./adapters/secondary/graph/sqlite-adapter.js');
        const { ConfigService } = await import('./services/config-service.js');
        
        const parserService = new ParserService();
        // Enable enhanced parsing with LLM entity extraction for documents (.md, .pdf, .docx)
        parserService.enableEnhancedParsing(true);
        console.log('✅ Enhanced document parsing enabled (with LLM entity extraction)');
        
        const hashService = new FileHashService();
        
        // Initialize indexing services
        const configService = new ConfigService(workspaceRoot);
        const embeddingService = new EmbeddingService();
        await embeddingService.initialize();
        console.log('✅ Embedding service initialized');
        
        // Initialize graph database
    const sqlitePath = configService.getGraphDataPath(workspaceRoot);
        const graphStoreInstance = new SQLiteAdapter(sqlitePath);
        await graphStoreInstance.initialize();
        console.log('✅ Graph store initialized');
        
        // Store globally for reanalyze command
        graphStore = graphStoreInstance;
        
        // Create vector store (needs to be before context tool initialization)
        const vectorStore = createVectorStore(graphStoreInstance, embeddingService);
        
        // Initialize context retrieval tool with graphStore
        if (contextRetrievalToolInstance && graphStoreInstance) {
            try {
                // Pass graphStore to HybridRetriever so it can search the database
                const { HybridRetriever } = await import('./services/hybrid-retriever.js');
                const hybridRetriever = new HybridRetriever(undefined, graphStoreInstance);
                
                // Update the EXISTING instance (don't create a new one!)
                contextRetrievalToolInstance.setRetriever(hybridRetriever);
                console.log('✅ Context retrieval tool initialized with hybrid retriever and graph store');
            } catch (error) {
                console.error('❌ Failed to initialize context retrieval tool:', error);
            }
        }
        
        // Initialize VSCode LLM Provider for entity discovery
        let llmProvider;
        try {
            const { VSCodeLLMProvider } = await import('./services/entity-discovery/providers/VSCodeLLMProvider.js');
            llmProvider = new VSCodeLLMProvider();
            await llmProvider.initialize();
            console.log('✅ VSCode LLM Provider initialized for entity discovery');
        } catch (error) {
            console.warn('⚠️ Failed to initialize LLM provider for entity discovery:', error);
            llmProvider = undefined;
        }
        
        // Initialize indexing service
        const indexingService = new IndexingService(
            vectorStore, // Vector store usando SQLite plugin (sqlite-vss)
            graphStoreInstance,
            embeddingService,
            workspaceRoot,
            llmProvider
        );
        console.log('✅ Indexing service initialized');

        // Initialize worker WITH indexing service and graph store
        const worker = new FileProcessingWorker(
            parserService,
            hashService,
            workspaceRoot,
            indexingService,
            graphStore
        );
        console.log('✅ File processing worker created (with indexing and graph store)');

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

        // Initialize and start API server (pass graphStore for file removal)
        fileAPI = new FileProcessingAPI(
            fileQueue,
            fileDatabase,
            workspaceRoot,
            3456,
            graphStoreInstance,
            async () => {
                try {
                    console.log('[Extension] 🔍 API requested workspace scan');
                    await vscode.commands.executeCommand('cappy.scanWorkspace');
                } catch (e) {
                    console.error('[Extension] ❌ Failed to run cappy.scanWorkspace from API:', e);
                    throw e;
                }
            }
        );
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