import * as vscode from 'vscode';
import * as path from 'path';
import { GraphPanel } from './nivel1/adapters/vscode/graph/GraphPanel';
import { ChatViewProvider } from './nivel1/adapters/vscode/chat/ChatViewProvider';
import { DocumentsViewProvider } from './nivel1/adapters/vscode/documents/DocumentsViewProvider';
import { CreateFileTool } from './nivel2/infrastructure/tools/create-file-tool';
import { FetchWebTool } from './nivel2/infrastructure/tools/fetch-web-tool';
import { ContextRetrievalTool } from './domains/chat/tools/native/context-retrieval';
import { LangGraphChatEngine } from './nivel2/infrastructure/agents/langgraph-chat-engine';
import { createChatService } from './domains/chat/services/chat-service';
import { registerScanWorkspaceCommand } from './nivel1/adapters/vscode/commands/scan-workspace';
import { registerProcessSingleFileCommand } from './commands/process-single-file';
import { registerDebugRetrievalCommand } from './commands/debug-retrieval';
import { registerDebugCommand, registerDebugDatabaseCommand, registerDebugAddTestDataCommand } from './commands/debug';
import { reanalyzeRelationships } from './commands/reanalyze-relationships';
import { registerResetDatabaseCommand } from './commands/reset-database';
import { FileMetadataDatabase } from './nivel2/infrastructure/services/file-metadata-database';
import { FileProcessingQueue } from './nivel2/infrastructure/services/file-processing-queue';
import { FileProcessingWorker } from './nivel2/infrastructure/services/file-processing-worker';
import { FileProcessingAPI } from './nivel2/infrastructure/services/file-processing-api';
import { UnifiedQueueProcessor } from './nivel2/infrastructure/services/unified-queue-processor';
import { FileChangeWatcher } from './nivel2/infrastructure/services/file-change-watcher';
import { createVectorStore } from './nivel2/infrastructure/vector/sqlite-vector-adapter';
import type { GraphStorePort } from './domains/graph/ports/indexing-port';
import { SQLiteAdapter } from './nivel2/infrastructure/database/index.js';
import { DevServerBridge } from './nivel1/adapters/vscode/dev-server-bridge';

// Global instances for file processing system
let fileDatabase: FileMetadataDatabase | null = null;
let fileQueue: FileProcessingQueue | null = null;
let fileAPI: FileProcessingAPI | null = null;
let queueProcessor: UnifiedQueueProcessor | null = null;
let fileWatcher: FileChangeWatcher | null = null;
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

    // NOTE: Starting the full file processing system initializes several
    // components that can load native modules (SQLite/Kùzu/sharp). To avoid
    // native-module crashes during activation, we defer initialization and
    // expose a command that starts it manually when the user is ready.
    //
    // To start processing, run the command: "Cappy: Start File Processing"
    // (command id: cappy.startProcessing)
    const startProcessingCommand = vscode.commands.registerCommand('cappy.startProcessing', async () => {
        try {
            await initializeFileProcessingSystem(context, graphPanel);
            vscode.window.showInformationMessage('✅ Cappy: File processing system started');
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('Failed to initialize file processing system:', error);
            vscode.window.showErrorMessage(`Failed to start file processing API: ${errMsg}`);
        }
    });
    context.subscriptions.push(startProcessingCommand);
    console.log('⏸️ File processing initialization deferred. Use command: cappy.startProcessing');
    
    // Register the graph visualization command
    const openGraphCommand = vscode.commands.registerCommand('cappy.openGraph', async () => {
        await graphPanel.show();
    });
    
    context.subscriptions.push(openGraphCommand);

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

    // Register queue control commands
    const pauseQueueCommand = vscode.commands.registerCommand('cappy.pauseQueue', () => {
        if (!queueProcessor) {
            vscode.window.showWarningMessage('Queue processor not initialized');
            return;
        }
        queueProcessor.pause();
        vscode.window.showInformationMessage('⏸️ Processing queue paused');
    });
    context.subscriptions.push(pauseQueueCommand);
    console.log('✅ Registered command: cappy.pauseQueue');

    const resumeQueueCommand = vscode.commands.registerCommand('cappy.resumeQueue', () => {
        if (!queueProcessor) {
            vscode.window.showWarningMessage('Queue processor not initialized');
            return;
        }
        queueProcessor.resume();
        vscode.window.showInformationMessage('▶️ Processing queue resumed');
    });
    context.subscriptions.push(resumeQueueCommand);
    console.log('✅ Registered command: cappy.resumeQueue');

    const queueStatusCommand = vscode.commands.registerCommand('cappy.queueStatus', async () => {
        if (!fileDatabase || !queueProcessor) {
            vscode.window.showWarningMessage('Queue system not initialized');
            return;
        }
        
        const stats = fileDatabase.getStats();
        const state = queueProcessor.getState();
        
        const message = [
            `📊 Queue Status:`,
            `   Running: ${state.isRunning ? '✅' : '❌'}`,
            `   Paused: ${state.isPaused ? '⏸️' : '▶️'}`,
            `   Active: ${state.activeProcesses}`,
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

    // Start WebSocket dev server bridge (porta 7001)
    const devBridge = new DevServerBridge(7001, chatService);
    context.subscriptions.push({ dispose: () => devBridge.dispose() });
    console.log('🔌 Dev Server Bridge started on port 7001');

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
        const { ParserService } = await import('./nivel2/infrastructure/services/parser-service.js');
        const { FileHashService } = await import('./nivel2/infrastructure/services/file-hash-service.js');
        const { EmbeddingService } = await import('./nivel2/infrastructure/services/embedding-service.js');
        const { IndexingService } = await import('./nivel2/infrastructure/services/indexing-service.js');
        const { ConfigService } = await import('./nivel2/infrastructure/services/config-service.js');
        
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

        // Initialize NEW unified queue processor
        queueProcessor = new UnifiedQueueProcessor(
            fileDatabase,
            worker,
            {
                concurrency: 2,
                pollInterval: 1000,
                batchSize: 10,
                maxRetries: 3,
                retryDelay: 5000
            }
        );

        // Start queue processor (runs in background)
        // TEMPORARILY DISABLED to prevent native module crashes
        // queueProcessor.start();
        console.log('⏸️  UnifiedQueueProcessor disabled (native module stability)');

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

        // Initialize queue (LEGACY - kept for compatibility)
        fileQueue = new FileProcessingQueue(fileDatabase, worker, {
            concurrency: 2,
            maxRetries: 3,
            autoStart: false // Disabled, using UnifiedQueueProcessor instead
        });
        console.log('⚠️  Legacy FileProcessingQueue created (disabled)');

        // Auto-refresh Graph panel when a file completes processing
        try {
            queueProcessor.on('file:complete', async () => {
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
            },
            async (filePath: string) => {
                try {
                    console.log('[Extension] 🔄 API requested file reprocess:', filePath);

                    // Normalize and build absolute path
                    const absPath = path.join(workspaceRoot, filePath);

                    // Best-effort: remove existing nodes for this file so we re-create cleanly
                    try {
                        await graphStoreInstance.deleteFile(filePath);
                        console.log('[Extension] 🗑️ Deleted existing graph data for:', filePath);
                    } catch (e) {
                        console.warn('[Extension] ⚠️ Could not delete existing graph data (may not exist):', e);
                    }

                    // Ensure there is a DB record and set to pending so the queue processes just this file
                    if (!fileDatabase) {
                        throw new Error('File metadata database not initialized');
                    }
                    const db = fileDatabase;
                    let record = db.getFileByPath(filePath);
                    if (record) {
                        // Reset existing record to pending
                        db.updateFile(record.id, {
                            status: 'pending',
                            progress: 0,
                            currentStep: 'Queued for reprocessing',
                            errorMessage: undefined,
                            chunksCount: undefined,
                            nodesCount: undefined,
                            relationshipsCount: undefined,
                            processingStartedAt: undefined,
                            processingCompletedAt: undefined
                        });
                        console.log('[Extension] 🔁 Reset existing DB record to pending:', record.id);
                    } else {
                        // Create new record
                        const stats = await vscode.workspace.fs.stat(vscode.Uri.file(absPath));
                        const contentHash = await hashService.hashFile(absPath);
                        const id = `file:${hashService.hashString(filePath)}`;
                        db.insertFile({
                            id,
                            filePath,
                            fileName: path.basename(filePath),
                            fileSize: Number(stats.size),
                            fileHash: contentHash,
                            fileContent: undefined,
                            status: 'pending',
                            progress: 0,
                            currentStep: 'Queued for reprocessing',
                            errorMessage: undefined,
                            retryCount: 0,
                            maxRetries: 3,
                            processingStartedAt: undefined,
                            processingCompletedAt: undefined,
                            chunksCount: undefined,
                            nodesCount: undefined,
                            relationshipsCount: undefined
                        });
                        record = db.getFile(id)!;
                        console.log('[Extension] 📝 Enqueued new DB record for reprocess:', id);
                    }

                    // The UnifiedQueueProcessor will pick this up automatically on next poll
                    // Optionally trigger an immediate tick
                    // (no public API to tick; rely on 1s pollInterval)

                    console.log('[Extension] ✅ Single-file reprocess scheduled:', filePath);
                } catch (e) {
                    console.error('[Extension] ❌ Failed to reprocess file:', e);
                    throw e;
                }
            }
        );
        await fileAPI.start();
        console.log('✅ File processing API started on http://localhost:3456');

        // Register cleanup on deactivation
        context.subscriptions.push({
            dispose: async () => {
                if (queueProcessor) {
                    queueProcessor.stop();
                    console.log('🛑 UnifiedQueueProcessor stopped');
                }
                if (fileWatcher) {
                    fileWatcher.stop();
                    console.log('🛑 FileChangeWatcher stopped');
                }
                if (fileAPI) {
                    await fileAPI.stop();
                    console.log('🛑 File processing API stopped');
                }
                if (fileQueue) {
                    await fileQueue.stop();
                    console.log('🛑 Legacy file processing queue stopped');
                }
                if (fileDatabase) {
                    fileDatabase.close();
                    console.log('🛑 File metadata database closed');
                }
            }
        });

        vscode.window.showInformationMessage('✅ File processing system ready with queue processor');
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