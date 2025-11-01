import * as vscode from 'vscode';
import * as path from 'node:path';
import { GraphPanel } from './nivel1/adapters/vscode/dashboard/GraphPanel';
import { ChatViewProvider } from './nivel1/adapters/vscode/chat/ChatViewProvider';
import { DocumentsViewProvider } from './nivel1/adapters/vscode/documents/DocumentsViewProvider';
import { CreateFileTool } from './nivel2/infrastructure/tools/create-file-tool';
import { FetchWebTool } from './nivel2/infrastructure/tools/fetch-web-tool';
import { ContextRetrievalTool } from './domains/chat/tools/native/context-retrieval';
import { LangGraphChatEngine } from './nivel2/infrastructure/agents/langgraph-chat-engine';
import { createChatService } from './domains/chat/services/chat-service';
import { registerScanWorkspaceCommand } from './nivel1/adapters/vscode/commands/scan-workspace';
import { 
  registerProcessSingleFileCommand,
  registerDebugRetrievalCommand,
  registerDebugCommand,
  registerDebugDatabaseCommand,
  registerDebugAddTestDataCommand,
  registerReanalyzeRelationshipsCommand,
  registerResetDatabaseCommand,
  registerDiagnoseGraphCommand,
  registerCleanInvalidFilesCommand
} from './nivel1/adapters/vscode/commands';
import { FileMetadataDatabase } from './nivel2/infrastructure/services/file-metadata-database';
import type { FileProcessingStatus } from './nivel2/infrastructure/services/file-metadata-database';
import { FileProcessingQueue } from './nivel2/infrastructure/services/file-processing-queue';
import { FileProcessingWorker } from './nivel2/infrastructure/services/file-processing-worker';
import { FileChangeWatcher } from './nivel2/infrastructure/services/file-change-watcher';
import { createVectorStore } from './nivel2/infrastructure/vector/sqlite-vector-adapter';
import type { GraphStorePort } from './domains/dashboard/ports/indexing-port';
import { SQLiteAdapter } from './nivel2/infrastructure/database/index.js';
import { GraphCleanupService } from './nivel2/infrastructure/services/graph-cleanup-service';

// Global instances for file processing system
let fileDatabase: FileMetadataDatabase | null = null;
let fileQueue: FileProcessingQueue | null = null;
let fileWatcher: FileChangeWatcher | null = null;
let graphStore: GraphStorePort | null = null;
let cleanupService: GraphCleanupService | null = null;
let contextRetrievalToolInstance: ContextRetrievalTool | null = null;
let documentsViewProviderInstance: DocumentsViewProvider | null = null;

/**
 * Cappy Extension - React + Vite Version
 * 
 * This is the main entry point for the Cappy extension.
 * Currently migrating functions from old/ folder one by one.
 */

export function activate(context: vscode.ExtensionContext) {
    console.log('🚩 [Extension] activate() starting - preparing services and views');
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

    // NOTE: File processing system initialization is now lightweight
    // (no HTTP API, just database and queue setup)
    const startProcessingCommand = vscode.commands.registerCommand('cappy.startProcessing', async () => {
        try {
            await initializeFileProcessingSystem(context, graphPanel);
            vscode.window.showInformationMessage('✅ Cappy: File processing system started');
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('Failed to initialize file processing system:', error);
            vscode.window.showErrorMessage(`Failed to start file processing: ${errMsg}`);
        }
    });
    context.subscriptions.push(startProcessingCommand);
    
    // Auto-start file processing system on activation
    console.log('🚀 Auto-starting file processing system...');
    initializeFileProcessingSystem(context, graphPanel)
        .then(() => {
            console.log('✅ File processing system auto-started successfully');
        })
        .catch((error: unknown) => {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('❌ Failed to auto-start file processing system:', error);
            vscode.window.showWarningMessage(
                `Cappy: File processing system failed to start. Use "Cappy: Start File Processing" command to retry. Error: ${errMsg}`,
                'Retry'
            ).then(selection => {
                if (selection === 'Retry') {
                    vscode.commands.executeCommand('cappy.startProcessing');
                }
            });
        });
    
    // Register the graph visualization command
    const openGraphCommand = vscode.commands.registerCommand('cappy.openGraph', async () => {
        await graphPanel.show();
    });
    
    context.subscriptions.push(openGraphCommand);
    
    // Expose a command to fetch paginated files for the dashboard webview
    // This allows the GraphPanel to retrieve document lists without tight coupling
    const getFilesPaginatedCmd = vscode.commands.registerCommand(
        'cappy.getFilesPaginated',
        async (options: {
            page?: number;
            limit?: number;
            status?: FileProcessingStatus;
            sortBy?: 'id' | 'created_at' | 'updated_at';
            sortOrder?: 'asc' | 'desc';
        } = {}) => {
            if (!fileDatabase) {
                throw new Error('File database is not initialized yet');
            }
            const page = options.page ?? 1;
            const limit = options.limit ?? 10;
            const sortBy = options.sortBy ?? 'updated_at';
            const sortOrder = options.sortOrder ?? 'desc';
            // Pass-through status when provided
            return await fileDatabase.getFilesPaginated({ page, limit, status: options.status, sortBy, sortOrder });
        }
    );
    context.subscriptions.push(getFilesPaginatedCmd);

    // Expose a command to fetch document details (embeddings, graph node, relationships)
    const getDocumentDetailsCmd = vscode.commands.registerCommand(
        'cappy.getDocumentDetails',
        async (options: { fileId: string }) => {
            if (!fileDatabase) {
                throw new Error('File database is not initialized yet');
            }
            if (!graphStore) {
                throw new Error('Graph store is not initialized yet');
            }

            const { fileId } = options;
            const file = await fileDatabase.getFile(fileId);
            
            if (!file) {
                return {
                    file: null,
                    chunks: [],
                    graphNode: null,
                    relationships: []
                };
            }

            // Get chunks/embeddings
            const chunks = await graphStore.getFileChunks(file.filePath);
            
            // Get graph node (cast to include new methods)
            // IMPORTANT: Graph nodes use filePath as ID, not the file database UUID
            const store = graphStore as typeof graphStore & {
                getNode: (nodeId: string) => Promise<{ id: string; type: string; properties: Record<string, unknown> } | null>;
                getRelationships: (nodeId: string) => Promise<Array<{ from: string; to: string; type: string }>>;
            };
            const graphNode = await store.getNode(file.filePath);
            
            // Get relationships
            const relationships = graphNode 
                ? await store.getRelationships(graphNode.id)
                : [];

            return {
                file: {
                    id: file.id,
                    filePath: file.filePath,
                    fileName: file.fileName
                },
                chunks,
                graphNode,
                relationships
            };
        }
    );
    context.subscriptions.push(getDocumentDetailsCmd);

    // Expose a command to reprocess a document (delete graph data and re-queue)
    const reprocessDocumentCmd = vscode.commands.registerCommand(
        'cappy.reprocessDocument',
        async (options: { fileId: string; filePath: string }) => {
            console.log('🔄 [Extension] cappy.reprocessDocument command called');
            console.log('🔄 [Extension] fileId:', options.fileId);
            console.log('🔄 [Extension] filePath:', options.filePath);

            if (!fileDatabase) {
                throw new Error('File database is not initialized yet');
            }
            if (!graphStore) {
                throw new Error('Graph store is not initialized yet');
            }

            const { fileId, filePath } = options;

            try {
                // 1. Delete all graph nodes/chunks/edges for this file
                console.log('🔄 [Extension] Deleting file nodes from graph...');
                const store = graphStore as typeof graphStore & {
                    deleteFileNodes: (filePath: string) => Promise<void>;
                };
                if (typeof store.deleteFileNodes === 'function') {
                    await store.deleteFileNodes(filePath);
                    console.log('✅ [Extension] File nodes deleted');
                } else {
                    console.warn('⚠️ [Extension] deleteFileNodes method not available on graphStore');
                }

                // 2. Mark file as pending in file database (will be picked up by queue)
                console.log('🔄 [Extension] Marking file as pending...');
                await fileDatabase.updateFile(fileId, {
                    status: 'pending',
                    currentStep: 'Queued for reprocessing',
                    progress: 0,
                    errorMessage: undefined
                });
                console.log('✅ [Extension] File marked as pending');

                console.log('✅ [Extension] Reprocess completed successfully');
            } catch (error) {
                console.error('❌ [Extension] Reprocess failed:', error);
                throw error;
            }
        }
    );
    context.subscriptions.push(reprocessDocumentCmd);

    // Register interactive hybrid search command
    const searchCommand = vscode.commands.registerCommand('cappy.search', async () => {

    const vscode = await import('vscode');
    const { HybridRetriever } = await import('./nivel2/infrastructure/services/hybrid-retriever.js');

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

        if (!result?.contexts?.length) {
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
        const items: QuickPickItem[] = result.contexts.map(ctx => {
            let icon: string;
            if (ctx.source === 'code') {
                icon = '💻';
            } else if (ctx.source === 'documentation') {
                icon = '📚';
            } else if (ctx.source === 'prevention') {
                icon = '🛡️';
            } else if (ctx.source === 'task') {
                icon = '✅';
            } else {
                icon = '📄';
            }
            return {
                label: `${icon} ${ctx.metadata.title || ctx.id}`,
                description: ctx.filePath ? `${ctx.filePath}` : undefined,
                detail: ctx.snippet ? ctx.snippet.replaceAll('\n', ' ').slice(0, 200) : ctx.content.slice(0, 200),
                ctx
            };
        });

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

    // Register clean invalid files command
    registerCleanInvalidFilesCommand(context);
    console.log('✅ Registered command: cappy.cleanInvalidFiles');

    // Register reanalyze relationships command (needs graphStore and fileDatabase)
    if (graphStore && fileDatabase) {
        registerReanalyzeRelationshipsCommand(context, graphStore, fileDatabase);
        console.log('✅ Registered command: cappy.reanalyzeRelationships');
    }

    // Register queue control commands
    const pauseQueueCommand = vscode.commands.registerCommand('cappy.pauseQueue', () => {
        if (!fileQueue) {
            vscode.window.showWarningMessage('Queue processor not initialized');
            return;
        }
        fileQueue.pause();
        vscode.window.showInformationMessage('⏸️ Processing queue paused');
    });
    context.subscriptions.push(pauseQueueCommand);
    console.log('✅ Registered command: cappy.pauseQueue');

    const resumeQueueCommand = vscode.commands.registerCommand('cappy.resumeQueue', () => {
        if (!fileQueue) {
            vscode.window.showWarningMessage('Queue processor not initialized');
            return;
        }
        fileQueue.resume();
        vscode.window.showInformationMessage('▶️ Processing queue resumed');
    });
    context.subscriptions.push(resumeQueueCommand);
    console.log('✅ Registered command: cappy.resumeQueue');

    const queueStatusCommand = vscode.commands.registerCommand('cappy.queueStatus', async () => {
        if (!fileDatabase || !fileQueue) {
            vscode.window.showWarningMessage('Queue system not initialized');
            return;
        }
        
        const stats = await fileDatabase.getStats();
        
        const message = [
            `📊 Queue Status:`,
            `   Running: ${fileQueue['isRunning'] ? '✅' : '❌'}`,
            `   Paused: ${fileQueue['isPaused'] ? '⏸️' : '▶️'}`,
            ``,
            `📁 Files:`,
            `   Total: ${stats.total}`,
            `   Pending: ${stats.pending}`,
            `   Processing: ${stats.processing}`,
            `   Extracting Entities: ${stats.extractingEntities}`,
            `   Creating Relationships: ${stats.creatingRelationships}`,
            `   Entity Discovery: ${stats.entityDiscovery}`,
            `   Processed: ${stats.processed}`,
            `   Error: ${stats.error}`,
            `   Paused: ${stats.paused}`
        ].join('\n');
        
        vscode.window.showInformationMessage(message, { modal: true });
    });
    context.subscriptions.push(queueStatusCommand);
    console.log('✅ Registered command: cappy.queueStatus');

    // Register diagnose graph command
    if (graphStore) {
        registerDiagnoseGraphCommand(context, graphStore);
        console.log('✅ Registered command: cappy.diagnoseGraph');
    }

    // Register reset database command
    registerResetDatabaseCommand(context);
    console.log('✅ Registered command: cappy.resetDatabase');

    // Register test retriever command
    const testRetrieverCommand = vscode.commands.registerCommand('cappy.testRetriever', async () => {
        try {
            const outputChannel = vscode.window.createOutputChannel('Cappy Retriever Test');
            outputChannel.show();
            outputChannel.appendLine('🔍 CAPPY RETRIEVER DIAGNOSTIC');
            outputChannel.appendLine('═'.repeat(60));
            
            // Check tool instance
            outputChannel.appendLine(`\n📦 Tool Instance: ${!!contextRetrievalToolInstance ? '✅ EXISTS' : '❌ NULL'}`);
            
            if (contextRetrievalToolInstance) {
                // Check internal state
                const tool = contextRetrievalToolInstance as any;
                outputChannel.appendLine(`📦 Retriever: ${!!tool.retriever ? '✅ EXISTS' : '❌ NULL'}`);
                outputChannel.appendLine(`📦 GraphService: ${!!tool.graphService ? '✅ EXISTS' : '❌ NULL'}`);
                
                if (tool.retriever) {
                    const retriever = tool.retriever as any;
                    outputChannel.appendLine(`📦 Retriever.graphStore: ${!!retriever.graphStore ? '✅ EXISTS' : '❌ NULL'}`);
                    outputChannel.appendLine(`📦 Retriever.graphData: ${!!retriever.graphData ? '✅ EXISTS' : '❌ NULL'}`);
                    outputChannel.appendLine(`📦 Retriever.workspaceRoot: ${retriever.workspaceRoot || 'NULL'}`);
                }
            }
            
            outputChannel.appendLine(`\n📦 Global graphStore: ${!!graphStore ? '✅ EXISTS' : '❌ NULL'}`);
            
            if (graphStore) {
                try {
                    const store = graphStore as any;
                    if (store.getChunkContents) {
                        outputChannel.appendLine(`📦 graphStore.getChunkContents: ✅ EXISTS`);
                        outputChannel.appendLine(`\n🔍 Testing vector query...`);
                        const chunks = await store.getChunkContents(5);
                        outputChannel.appendLine(`✅ Retrieved ${chunks?.length || 0} chunks`);
                        if (chunks && chunks.length > 0) {
                            outputChannel.appendLine(`📄 Sample: ${chunks[0].chunk_id}`);
                        }
                    } else {
                        outputChannel.appendLine(`❌ graphStore.getChunkContents: NOT FOUND`);
                    }
                } catch (error) {
                    outputChannel.appendLine(`❌ Error: ${error}`);
                }
            }
            
            outputChannel.appendLine('\n' + '═'.repeat(60));
            const query = await vscode.window.showInputBox({
                prompt: 'Enter search query',
                value: 'workspace scanner'
            });
            
            if (!query) {
                return;
            }
            
            outputChannel.appendLine(`\n🔍 Query: "${query}"`);
            outputChannel.appendLine(`📋 Use: @workspace use cappy_retrieve_context to search for "${query}"`);
            vscode.window.showInformationMessage(`✅ Check output for diagnostics`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed: ${error}`);
        }
    });
    context.subscriptions.push(testRetrieverCommand);
    console.log('✅ Registered command: cappy.testRetriever');

    // Create chat service with LangGraph engine (includes tools)
    const chatEngine = new LangGraphChatEngine();
    const chatService = createChatService(chatEngine);

    // TEMPORARILY DISABLED: WebSocket dev server bridge causing crashes
    // const devBridge = new DevServerBridge(7002, chatService);
    // context.subscriptions.push({ dispose: () => devBridge.dispose() });
    console.log('⏸️  Dev Server Bridge disabled (port conflict issues)');

    // Register Chat View Provider for sidebar
    const chatViewProvider = new ChatViewProvider(context.extensionUri, chatService);
    const chatViewDisposable = vscode.window.registerWebviewViewProvider(
        ChatViewProvider.viewType, 
        chatViewProvider
    );
    context.subscriptions.push(chatViewDisposable);
    console.log('✅ Registered Chat View Provider: cappy.chatView');
    
    // Register Documents View Provider for sidebar
    console.log('📄 [Extension] Creating DocumentsViewProvider...');
    documentsViewProviderInstance = new DocumentsViewProvider(context.extensionUri);
    console.log('📄 [Extension] DocumentsViewProvider created, registering...');
    const documentsViewDisposable = vscode.window.registerWebviewViewProvider(
        DocumentsViewProvider.viewType,
        documentsViewProviderInstance
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

        // Connect DocumentsViewProvider to the file database
        if (documentsViewProviderInstance && fileDatabase) {
            documentsViewProviderInstance.setFileDatabase(fileDatabase);
        }
        
        // Connect DocumentsViewProvider to graph store (will be set after graph initialization)
        // This will be called again after graphStore is initialized below

        // Initialize services for worker
    const { ParserService } = await import('./nivel2/infrastructure/services/parser-service.js');
        const { FileHashService } = await import('./nivel2/infrastructure/services/file-hash-service.js');
        const { EmbeddingService } = await import('./nivel2/infrastructure/services/embedding-service.js');
        const { IndexingService } = await import('./nivel2/infrastructure/services/indexing-service.js');
        const { ConfigService } = await import('./nivel2/infrastructure/services/config-service.js');
        
    const parserService = new ParserService();
        
        const hashService = new FileHashService();
        
        // Initialize indexing services
        const configService = new ConfigService(workspaceRoot);
        const embeddingService = new EmbeddingService();
        try {
            await embeddingService.initialize();
            console.log('✅ Embedding service initialized');
        } catch (error) {
            console.warn('⚠️ Embedding service failed to initialize. Vector search will be unavailable:', error);
            console.warn('⚠️ File processing will continue without embeddings');
        }
        
        // Initialize graph database
    const sqlitePath = configService.getGraphDataPath(workspaceRoot);
        const graphStoreInstance = new SQLiteAdapter(sqlitePath);
        await graphStoreInstance.initialize();
        console.log('✅ Graph store initialized');
        
        // Store globally for reanalyze command
        graphStore = graphStoreInstance;
        
        // Connect DocumentsViewProvider to graph store
        if (documentsViewProviderInstance && graphStoreInstance) {
            documentsViewProviderInstance.setGraphStore(graphStoreInstance);
            console.log('✅ DocumentsViewProvider connected to graph store');
        }
        
        // Initialize and start graph cleanup service (runs every hour)
        cleanupService = new GraphCleanupService(graphStoreInstance, {
            intervalMs: 60 * 60 * 1000, // 1 hour
            enabled: true
        });
        cleanupService.start();
        console.log('✅ Graph cleanup service started (hourly)');
        
        // Create vector store (needs to be before context tool initialization)
        const vectorStore = createVectorStore(graphStoreInstance, embeddingService);
        
        // Initialize context retrieval tool with graphStore
        if (contextRetrievalToolInstance && graphStoreInstance) {
            try {
                // Pass graphStore to HybridRetriever so it can search the database
                const { HybridRetriever } = await import('./nivel2/infrastructure/services/hybrid-retriever.js');
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
            const { VSCodeLLMProvider } = await import('./nivel2/infrastructure/services/entity-discovery/providers/VSCodeLLMProvider.js');
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
        await indexingService.initialize();
        console.log('✅ Indexing service ready');

        // Initialize worker WITH indexing service and graph store
        const worker = new FileProcessingWorker(
            parserService,
            hashService,
            workspaceRoot,
            indexingService,
            graphStore
        );

        // Initialize file change watcher
        fileWatcher = new FileChangeWatcher(
            fileDatabase,
            hashService,
            {
                workspaceRoot,
                autoAddNewFiles: true,
                reprocessModified: true,
                removeDeleted: true
            }
        );
        
        // TEMPORARILY DISABLED to prevent file system watcher crashes
        // await fileWatcher.start();
        console.log('⏸️  FileChangeWatcher disabled (native module stability)');

        // Initialize queue for background processing
        fileQueue = new FileProcessingQueue(fileDatabase, worker, {
            concurrency: 2,
            maxRetries: 3,
            autoStart: true // Auto-start processing queue
        });
        console.log('✅ FileProcessingQueue initialized and started');

        // Auto-refresh Graph panel when a file completes processing (with debounce)
        try {
            let refreshTimeout: NodeJS.Timeout | null = null;
            fileQueue.on('file:complete', (metadata, result) => {
                // Notify DocumentsViewProvider
                if (documentsViewProviderInstance) {
                    documentsViewProviderInstance.notifyFileUpdate({
                        type: 'completed',
                        fileId: metadata.id,
                        filePath: metadata.filePath,
                        progress: 100,
                        currentStep: 'Completed',
                        metrics: {
                            chunksCount: result.chunksCount,
                            nodesCount: result.nodesCount,
                            relationshipsCount: result.relationshipsCount,
                            duration: result.duration
                        }
                    });
                }
                
                // Debounce refresh to avoid multiple rapid calls
                if (refreshTimeout) {
                    clearTimeout(refreshTimeout);
                }
                refreshTimeout = setTimeout(() => {
                    graphPanel.refreshSubgraph(2).catch((err: unknown) => {
                        console.error('Failed to refresh graph after file processing:', err);
                    });
                    refreshTimeout = null;
                }, 2000); // Wait 2s after last file completes before refreshing
            });
            
            // Notify on processing start
            fileQueue.on('file:start', (metadata) => {
                if (documentsViewProviderInstance) {
                    documentsViewProviderInstance.notifyFileUpdate({
                        type: 'processing',
                        fileId: metadata.id,
                        filePath: metadata.filePath,
                        progress: 0,
                        currentStep: 'Starting...'
                    });
                }
            });
            
            // Notify on error
            fileQueue.on('file:failed', (metadata, error) => {
                if (documentsViewProviderInstance) {
                    documentsViewProviderInstance.notifyFileUpdate({
                        type: 'error',
                        fileId: metadata.id,
                        filePath: metadata.filePath,
                        error: error.message
                    });
                }
            });
        } catch (e) {
            console.warn('Could not attach queue event listeners:', e);
        }

        // No HTTP API - using postMessage communication instead
        console.log('✅ File processing system initialized (no HTTP API)');

        // Register cleanup on deactivation
        context.subscriptions.push({
            dispose: async () => {
                if (fileWatcher) {
                    fileWatcher.stop();
                    console.log('🛑 FileChangeWatcher stopped');
                }
                if (fileQueue) {
                    fileQueue.stop();
                    console.log('🛑 File processing queue stopped');
                }
                if (fileDatabase) {
                    fileDatabase.close();
                    console.log('🛑 File metadata database closed');
                }
            }
        });
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
    console.log('🦫 Cappy extension deactivating...');
    
    // Stop cleanup service
    if (cleanupService) {
        cleanupService.stop();
        console.log('✅ Graph cleanup service stopped');
    }
    
    // Stop file processing queue
    if (fileQueue) {
        fileQueue.stop();
        console.log('✅ File processing queue stopped');
    }
    
    // Stop file watcher
    if (fileWatcher) {
        fileWatcher.dispose();
        console.log('✅ File watcher stopped');
    }
    
    console.log('🦫 Cappy extension deactivated');
}

// TreeDataProvider removido - agora usamos WebviewView diretamente na sidebar
