import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IndexingService } from '../../../../services/indexing-service';
import { ConfigService } from '../../../../services/config-service';
import { EmbeddingService } from '../../../../services/embedding-service';
import { SQLiteAdapter } from '../../../secondary/graph/sqlite-adapter';
import type { VectorStorePort } from '../../../../domains/graph/ports/indexing-port';

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
    private kuzuPath: string | null = null;

    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ) {
        this.context = context;
        this.outputChannel = outputChannel;
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
        this.panel.webview.html = this.getWebviewContent();

        // Handle disposal
        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.cleanup();
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleMessage(message);
            },
            undefined,
            this.context.subscriptions
        );

        // Initialize indexing service
        await this.initializeIndexing();
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
            this.log('🔧 Initializing indexing services...');

            // Get workspace root
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            const workspaceRoot = workspaceFolder.uri.fsPath;

            // Load configuration
            const configService = new ConfigService(workspaceRoot);

            // Create embedding service
            const embeddingService = new EmbeddingService();
            await embeddingService.initialize();

            // Ensure base data dir and Kuzu database exist (create empty if missing)
            const baseDataDir = path.join(workspaceRoot, '.cappy', 'data');
            if (!fs.existsSync(baseDataDir)) {
                fs.mkdirSync(baseDataDir, { recursive: true });
                this.log(`🆕 Created base data folder: ${baseDataDir}`);
            } else {
                this.log(`📁 Base data folder exists: ${baseDataDir}`);
            }
            const sqlitePath = configService.getKuzuPath(workspaceRoot);
            this.kuzuPath = sqlitePath;
            await this.ensureKuzuDatabase(sqlitePath);
            this.sendMessage({ type: 'db-status', exists: true, created: this.graphDbCreated, path: sqlitePath });

            // Vector store removed - using SQLite only
            const graphStore = new SQLiteAdapter(sqlitePath);

            // Initialize adapter
            await graphStore.initialize();
            // Create a workspace node labeled by the workspace name (Kuzu-only API)
            try {
                this.log(`🔧 Creating workspace node: ${workspaceFolder.name}`);
                await (graphStore as SQLiteAdapter).ensureWorkspaceNode(workspaceFolder.name);
                this.log(`✅ Workspace node ensured: ${workspaceFolder.name}`);
            } catch (e) {
                this.log(`❌ Could not ensure workspace node: ${e}`);
                console.error('Workspace node error:', e);
            }

            // Create indexing service
            this.indexingService = new IndexingService(
                null as unknown as VectorStorePort, // TODO: Remove VectorStore dependency
                graphStore,
                embeddingService
            );

            this.log('✅ Indexing services initialized');
            this.sendMessage({ type: 'status', status: 'ready' });

            // Load initial graph to show workspace node
            try {
                this.log('🔍 Loading initial graph...');
                const sub = await graphStore.getSubgraph(undefined, 2);
                this.log(`📊 Initial graph loaded: ${sub.nodes.length} nodes, ${sub.edges.length} edges`);
                if (sub.nodes.length > 0) {
                    this.log(`   First node: ${sub.nodes[0].id} (${sub.nodes[0].label})`);
                }
                this.sendMessage({ type: 'subgraph', nodes: sub.nodes, edges: sub.edges });
            } catch (e) {
                this.log(`❌ Could not load initial graph: ${e}`);
                console.error('Load graph error:', e);
            }

            // Index workspace
            await this.indexWorkspace();

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
     * Indexes all files in workspace  
     */
    private async indexWorkspace() {
        if (!this.indexingService) {
            return;
        }

        this.sendMessage({ type: 'status', status: 'indexing' });
        this.log('📂 Scanning workspace for files...');

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this.log('⚠️ No workspace folder found');
            return;
        }

        try {
            // TODO: Implement file indexing with ParserService integration
            // For now, just show ready status
            this.log(`✅ Indexing system ready`);
            this.log(`� Next: Use search to test hybrid search`);
            
            this.sendMessage({ 
                type: 'graph-data', 
                data: {
                    message: 'Indexing system ready - use search to test queries',
                    ready: true
                }
            });

        } catch (error) {
            this.log(`❌ Indexing failed: ${error}`);
            this.sendMessage({ 
                type: 'error', 
                error: `Indexing failed: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handles messages from webview
     */
    private async handleMessage(message: { type: string; query?: string; filePath?: string; line?: number; depth?: number; payload?: unknown }) {
        switch (message.type) {
            case 'ready':
                this.log('✅ Webview ready');
                break;
            case 'load-subgraph':
                try {
                    const depth = message.depth ?? 2;
                    if (!this.indexingService) { break; }
                    type GraphStoreLike = { getSubgraph?: (seeds: string[] | undefined, depth: number) => Promise<{ nodes: unknown[]; edges: unknown[] }> };
                    const svc = this.indexingService as unknown as { graphStore?: GraphStoreLike };
                    const graphStore = svc.graphStore;
                    if (graphStore && typeof graphStore.getSubgraph === 'function') {
                        const sub = await graphStore.getSubgraph(undefined, Math.min(10, Math.max(0, depth)));
                        this.sendMessage({ type: 'subgraph', nodes: sub.nodes, edges: sub.edges });
                    }
                } catch (e) {
                    this.sendMessage({ type: 'error', error: `Load subgraph failed: ${e instanceof Error ? e.message : String(e)}` });
                }
                break;
            case 'get-db-status':
                if (this.kuzuPath) {
                    const exists = fs.existsSync(this.kuzuPath);
                    const status = { type: 'db-status', exists, created: this.graphDbCreated, path: this.kuzuPath };
                    this.sendMessage(status);
                }
                break;

            case 'search':
                if (message.query) {
                    await this.handleSearch(message.query);
                }
                break;

            case 'refresh':
                await this.indexWorkspace();
                break;
            case 'kuzu-reset':
                await this.resetKuzu();
                break;

            case 'open-file':
                if (message.filePath) {
                    await this.openFile(message.filePath, message.line);
                }
                break;

            // Documents page actions
            case 'documents/upload-requested':
                this.log('📤 Documents: upload dialog requested');
                break;
            case 'documents/upload-selected': {
                const payload = (message.payload ?? {}) as { files?: Array<{ name: string; type: string; size: number }> };
                this.log(`📥 Documents: ${payload.files?.length ?? 0} file(s) selected`);
                // TODO: Wire ingestion pipeline to handle provided files metadata
                break;
            }
            case 'documents/scan-workspace':
                this.log('🔍 Documents: scan workspace');
                await this.triggerWorkspaceScan();
                break;
            case 'documents/configure-sources':
                this.log('⚙️ Documents: open settings for sources');
                await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:eduardocecon.cappy');
                break;

            default:
                this.log(`⚠️ Unknown message type: ${message.type}`);
        }
    }

    private async triggerWorkspaceScan() {
        try {
            if (!this.indexingService) {
                await this.initializeIndexing();
            }
            if (!this.indexingService) {
                this.log('❌ IndexingService not available');
                return;
            }
            this.sendMessage({ type: 'status', status: 'indexing' });
            // If IndexingService exposes a fullRescan method, use it; otherwise fallback to indexWorkspace
            const svc = this.indexingService as unknown as { fullRescan?: () => Promise<unknown> };
            const stats = typeof svc.fullRescan === 'function'
                ? await svc.fullRescan()
                : await this.indexWorkspace();
            this.sendMessage({ type: 'status', status: 'ready' });
            if (stats) {
                this.sendMessage({ type: 'graph-data', data: { stats } });
            }
        } catch (e) {
            this.log(`❌ Workspace scan failed: ${e}`);
            this.sendMessage({ type: 'error', error: String(e) });
        }
    }

    /**
     * Handles search queries
     */
    private async handleSearch(query: string) {
        if (!this.indexingService || !query) {
            return;
        }

        try {
            this.log(`🔍 Searching for: "${query}"`);
            this.sendMessage({ type: 'status', status: 'searching' });

            const results = await this.indexingService.hybridSearch(query, 20);
            
            const totalResults = results.directMatches.length + results.relatedChunks.length;
            this.log(`✅ Found ${totalResults} results (${results.directMatches.length} direct, ${results.relatedChunks.length} related)`);
            
            this.sendMessage({ 
                type: 'search-results', 
                query,
                results: {
                    direct: results.directMatches,
                    related: results.relatedChunks
                }
            });

        } catch (error) {
            this.log(`❌ Search failed: ${error}`);
            this.sendMessage({ 
                type: 'error', 
                error: `Search failed: ${error instanceof Error ? error.message : String(error)}`
            });
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
     * Ensures the Kuzu database folder exists; creates an empty structure if missing
     */
    private async ensureKuzuDatabase(dbPath: string) {
        try {
            if (!fs.existsSync(dbPath)) {
                fs.mkdirSync(dbPath, { recursive: true });
                this.graphDbCreated = true;
                this.log(`🆕 Created Kuzu DB folder: ${dbPath}`);
                // Optional marker file for visibility
                const marker = `${dbPath}/README.txt`;
                if (!fs.existsSync(marker)) {
                    fs.writeFileSync(marker, 'Cappy Kuzu DB — created automatically.');
                }
            } else {
                this.graphDbCreated = false;
                this.log(`📁 Kuzu DB folder exists: ${dbPath}`);
            }
        } catch (error) {
            this.log(`❌ Failed to prepare Kuzu DB folder: ${error}`);
        }
    }

    /**
     * Gets webview HTML content
     */
    private getWebviewContent(): string {
    const nonce = this.getNonce();
        const cspSource = this.panel!.webview.cspSource;

        // Try to load the built React app
        const graphHtmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'graph.html');
        
        // Load the built HTML file (mandatory)
        let htmlContent = fs.readFileSync(graphHtmlPath.fsPath, 'utf8');

        // Get webview URIs for all assets
        const graphJsUri = this.panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'graph.js')
        );
        const indexJsUri = this.panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'index.js')
        );
        // CSS built for the graph webview
        const graphCssUri = this.panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'graph.css')
        );

        // Prepare favicon
        const faviconUri = this.panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'icons', 'cappy-activity.svg')
        );

        // Replace relative paths with webview URIs
        htmlContent = htmlContent
            .replace('./graph.js', graphJsUri.toString())
            .replace('./index.js', indexJsUri.toString())
            .replace('./graph.css', graphCssUri.toString());

        // Inject favicon
        if (!htmlContent.includes('rel="icon"')) {
            htmlContent = htmlContent.replace(
                '</head>',
                `  <link rel="icon" type="image/svg+xml" href="${faviconUri}">\n</head>`
            );
        }

        // Force-enable scrolling inside the webview (override global hidden rules)
        if (!htmlContent.includes('cappy-scroll-override')) {
            htmlContent = htmlContent.replace(
                '</head>',
                `<style id="cappy-scroll-override">html,body{overflow:auto !important;}#root{overflow:auto !important;}</style>\n</head>`
            );
        }

        // Remove modulepreload link (causes CSP issues)
        htmlContent = htmlContent.replace(
            /<link rel="modulepreload"[^>]*>/g,
            ''
        );

        // Add CSP meta tag if not present
        if (!htmlContent.includes('Content-Security-Policy')) {
            htmlContent = htmlContent.replace(
                '<meta name="viewport"',
                `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}; img-src ${cspSource} data: https:; font-src ${cspSource}; connect-src ${cspSource} http://localhost:3456;">
    <meta name="viewport"`
            );
        }

        // Add nonce to script tags
        htmlContent = htmlContent.replace(
            /<script type="module"/g,
            `<script type="module" nonce="${nonce}"`
        );

        return htmlContent;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Resets the Kuzu database by recreating its folder and notifying the webview
     */
    private async resetKuzu() {
        try {
            if (!this.kuzuPath) return;
            // Remove and recreate
            if (fs.existsSync(this.kuzuPath)) {
                fs.rmSync(this.kuzuPath, { recursive: true, force: true });
                this.log(`🗑️ Removed Kuzu DB folder: ${this.kuzuPath}`);
            }
            await this.ensureKuzuDatabase(this.kuzuPath);
            this.sendMessage({ type: 'db-status', exists: true, created: this.graphDbCreated, path: this.kuzuPath });
        } catch (error) {
            this.log(`❌ Failed to reset Kuzu DB: ${error}`);
            this.sendMessage({ type: 'error', error: `Reset failed: ${error instanceof Error ? error.message : String(error)}` });
        }
    }
}
