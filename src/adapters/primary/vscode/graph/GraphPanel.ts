import * as vscode from 'vscode';
import * as fs from 'fs';
import { IndexingService } from '../../../../services/indexing-service';
import type { UseCase, UseCaseContext, WebviewMessage } from './usecases/UseCase';
import { ReadyUseCase } from './usecases/ReadyUseCase';
import { LoadSubgraphUseCase } from './usecases/LoadSubgraphUseCase';
import { GetDbStatusUseCase } from './usecases/GetDbStatusUseCase';
import { SearchUseCase } from './usecases/SearchUseCase';
import { RefreshUseCase } from './usecases/RefreshUseCase';
import { ResetGraphUseCase } from './usecases/ResetGraphUseCase';
import { OpenFileUseCase } from './usecases/OpenFileUseCase';
import { DocumentsUploadRequestedUseCase } from './usecases/DocumentsUploadRequestedUseCase';
import { DocumentsUploadSelectedUseCase } from './usecases/DocumentsUploadSelectedUseCase';
import { DocumentsScanWorkspaceUseCase } from './usecases/DocumentsScanWorkspaceUseCase';
import { DocumentsConfigureSourcesUseCase } from './usecases/DocumentsConfigureSourcesUseCase';
import { DocumentsConfirmRemoveUseCase } from './usecases/DocumentsConfirmRemoveUseCase';
import { DocumentsConfirmClearUseCase } from './usecases/DocumentsConfirmClearUseCase';
import { WebviewContentBuilder } from './WebviewContentBuilder';
import { IndexingInitializer } from './IndexingInitializer';
import { WorkspaceIndexer } from './WorkspaceIndexer';

/**
 * WebView Panel for Graph Visualization
 * Integrates with IndexingService to display the knowledge graph
 */
export class GraphPanel {
    private panel: vscode.WebviewPanel | undefined;
    private indexingService: IndexingService | undefined;
    private isInitializing = false;
    private readonly context: vscode.ExtensionContext;
    private readonly outputChannel: vscode.OutputChannel;
    private graphDbCreated = false;
    private graphDataPath: string | null = null;
    private graphWatcher: vscode.FileSystemWatcher | undefined;
    private refreshTimer: NodeJS.Timeout | null = null;
    private useCases: UseCase[] = [];
    private webviewBuilder: WebviewContentBuilder;
    private indexingInitializer = new IndexingInitializer();
    private workspaceIndexer = new WorkspaceIndexer();

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.registerUseCases();
        this.webviewBuilder = new WebviewContentBuilder(this.context);
    }

    /**
     * Opens or focuses the graph panel
     */
    public async show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        // Create webview panel
        this.panel = vscode.window.createWebviewPanel(
            'cappyGraph',
            '🦫 Cappy Knowledge Graph',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'out'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'resources')
                ]
            }
        );

        // Set HTML content
        this.panel.webview.html = this.webviewBuilder.build(this.panel);

        // Handle disposal
        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.cleanup();
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.dispatchMessage(message as WebviewMessage);
            },
            undefined,
            this.context.subscriptions
        );

        // Initialize indexing service
        await this.initializeIndexing();
    }

    private registerUseCases() {
        this.useCases = [
            new ReadyUseCase(),
            new LoadSubgraphUseCase(),
            new GetDbStatusUseCase(),
            new SearchUseCase(),
            new RefreshUseCase(),
            new ResetGraphUseCase(),
            new OpenFileUseCase(),
            new DocumentsUploadRequestedUseCase(),
            new DocumentsUploadSelectedUseCase(),
            new DocumentsScanWorkspaceUseCase(),
            new DocumentsConfigureSourcesUseCase(),
            new DocumentsConfirmRemoveUseCase(),
            new DocumentsConfirmClearUseCase(),
        ];
    }

    private getUseCaseContext(): UseCaseContext {
        return {
            vscode,
            panel: this.panel,
            log: (msg: string) => this.log(msg),
            sendMessage: (m: Record<string, unknown>) => this.sendMessage(m),
            getIndexingService: () => this.indexingService,
            getGraphPath: () => this.graphDataPath,
            getGraphDbCreated: () => this.graphDbCreated,
            ensureGraphDataDir: (dbPath: string) => this.ensureGraphDataDir(dbPath),
            refreshSubgraph: (depth?: number) => this.refreshSubgraph(depth),
            openFile: (file: string, line?: number) => this.openFile(file, line),
            indexWorkspace: () => this.indexWorkspace(),
            triggerWorkspaceScan: () => this.triggerWorkspaceScan(),
        };
    }

    private async dispatchMessage(message: WebviewMessage) {
        const ctx = this.getUseCaseContext();
        const handler = this.useCases.find(u => u.canHandle(message));
        if (handler) {
            await handler.handle(message, ctx);
            return;
        }
        this.log(`⚠️ Unknown message type: ${message.type}`);
    }

    /**
     * Refreshes the displayed subgraph (used after indexing events)
     */
    public async refreshSubgraph(depth: number = 2) {
        try {
            if (!this.indexingService || !this.panel) return;
            type GraphStoreLike = { getSubgraph?: (seeds: string[] | undefined, depth: number) => Promise<{ nodes: unknown[]; edges: unknown[] }> };
            const svc = this.indexingService as unknown as { graphStore?: GraphStoreLike };
            const graphStore = svc.graphStore;
            if (graphStore && typeof graphStore.getSubgraph === 'function') {
                // Attempt to reload from disk if adapter exposes it (sql.js snapshot)
                if (typeof (graphStore as unknown as { reloadFromDisk?: () => Promise<void> }).reloadFromDisk === 'function') {
                    await (graphStore as unknown as { reloadFromDisk: () => Promise<void> }).reloadFromDisk();
                }
                const sub = await graphStore.getSubgraph(undefined, Math.min(10, Math.max(0, depth)));
                this.sendMessage({ type: 'subgraph', nodes: sub.nodes, edges: sub.edges });
            }
        } catch (e) {
            this.log(`❌ Refresh subgraph failed: ${e}`);
        }
    }

    /**
     * Initializes the indexing service
     */
    private async initializeIndexing() {
        if (this.isInitializing || this.indexingService) {
            return;
        }

        this.isInitializing = true;
        this.sendMessage({ type: 'status', status: 'initializing' });

        try {
            const result = await this.indexingInitializer.initialize(this.context, {
                log: (m) => this.log(m),
                sendMessage: (msg) => this.sendMessage(msg),
                setupGraphWatcher: (ws) => this.setupGraphWatcher(ws),
            });

            this.indexingService = result.indexingService;
            this.graphDataPath = result.graphDataPath;
            this.graphDbCreated = result.graphDbCreated;

        } catch (error) {
            this.log(`❌ Failed to initialize: ${error}`);
            this.sendMessage({ 
                type: 'error', 
                error: `Initialization failed: ${error instanceof Error ? error.message : String(error)}`
            });
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Sets up a FileSystemWatcher on the SQLite graph directory to auto-refresh the graph
     */
    private setupGraphWatcher(workspaceFolder: vscode.WorkspaceFolder) {
    // Clean previous watcher
    this.graphWatcher?.dispose();
    this.graphWatcher = undefined;

    // Watch the graph data folder (SQLite database)
    const pattern = new vscode.RelativePattern(workspaceFolder, '.cappy/data/**/*.db');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);
    this.graphWatcher = watcher;        const scheduleRefresh = () => {
            if (this.refreshTimer) {
                clearTimeout(this.refreshTimer);
            }
            this.refreshTimer = setTimeout(() => {
                this.refreshSubgraph(2).catch((err: unknown) => this.log(`Refresh after FS change failed: ${err}`));
            }, 500);
        };

        watcher.onDidCreate(() => scheduleRefresh(), this, this.context.subscriptions);
        watcher.onDidChange(() => scheduleRefresh(), this, this.context.subscriptions);
        watcher.onDidDelete(() => scheduleRefresh(), this, this.context.subscriptions);

        this.context.subscriptions.push(watcher);
        this.log('👀 Watching .cappy/data for graph database changes');
    }

    /**
     * Indexes all files in workspace  
     */
    private async indexWorkspace() {
        if (!this.indexingService) {
            return;
        }
        await this.workspaceIndexer.index({
            log: (m) => this.log(m),
            sendMessage: (msg) => this.sendMessage(msg),
        });
    }

    /**
     * Triggers a workspace scan using IndexingService (fullRescan if available).
     * Sends status updates and forwards scan stats back to the webview.
     */
    private async triggerWorkspaceScan() {
        try {
                // Prefer the dedicated scan command which runs the full WorkspaceScanner pipeline
                this.sendMessage({ type: 'status', status: 'indexing' });
                this.log('🔍 Triggering workspace scan via command: cappy.scanWorkspace');
                await vscode.commands.executeCommand('cappy.scanWorkspace');
                this.log('✅ Workspace scan completed (command)');
                this.sendMessage({ type: 'status', status: 'ready' });
                // Refresh subgraph after scan completes
                await this.refreshSubgraph(2);
        } catch (e) {
            this.log(`❌ Workspace scan failed: ${e}`);
            this.sendMessage({ type: 'error', error: String(e) });
        }
    }

    /**
     * Opens a file at a specific line
     */
    private async openFile(filePath: string, line?: number) {
        try {
            const uri = vscode.Uri.file(filePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc);

            if (line !== undefined && line > 0) {
                const position = new vscode.Position(line - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        } catch (error) {
            this.log(`❌ Failed to open file: ${error}`);
            vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
        }
    }

    /**
     * Sends message to webview
     */
    private sendMessage(message: Record<string, unknown>) {
        this.panel?.webview.postMessage(message);
    }

    /**
     * Logs message to output channel
     */
    private log(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    /**
     * Cleanup resources
     */
    private cleanup() {
        // IndexingService cleanup will be handled when extension deactivates
        this.log('🧹 Graph panel closed');
    }

    /**
     * Ensures the graph data directory exists; creates an empty structure if missing
     */
    private async ensureGraphDataDir(dbPath: string) {
        try {
            if (!fs.existsSync(dbPath)) {
                fs.mkdirSync(dbPath, { recursive: true });
                this.graphDbCreated = true;
                this.log(`🆕 Created graph data folder: ${dbPath}`);
                // Optional marker file for visibility
                const marker = `${dbPath}/README.txt`;
                if (!fs.existsSync(marker)) {
                    fs.writeFileSync(marker, 'Cappy Graph data — created automatically.');
                }
            } else {
                this.graphDbCreated = false;
                this.log(`📁 Graph data folder exists: ${dbPath}`);
            }
        } catch (error) {
            this.log(`❌ Failed to prepare graph data folder: ${error}`);
        }
    }
}

