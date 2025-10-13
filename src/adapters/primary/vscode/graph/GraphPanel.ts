import * as vscode from 'vscode';
import * as fs from 'fs';
import { IndexingService } from '../../../../services/indexing-service';
import { ConfigService } from '../../../../services/config-service';
import { EmbeddingService } from '../../../../services/embedding-service';
import { LanceDBAdapter } from '../../../secondary/vector/lancedb-adapter';
import { KuzuAdapter } from '../../../secondary/graph/kuzu-adapter';

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
                    vscode.Uri.joinPath(this.context.extensionUri, 'out')
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

            // Create adapters with paths from config
            const lanceDBPath = configService.getLanceDBPath(workspaceRoot);
            const kuzuPath = configService.getKuzuPath(workspaceRoot);

            const vectorStore = new LanceDBAdapter(lanceDBPath, embeddingService);
            const graphStore = new KuzuAdapter(kuzuPath);

            // Initialize adapters
            await vectorStore.initialize();
            await graphStore.initialize();

            // Create indexing service
            this.indexingService = new IndexingService(
                vectorStore,
                graphStore,
                embeddingService
            );

            this.log('✅ Indexing services initialized');
            this.sendMessage({ type: 'status', status: 'ready' });

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
    private async handleMessage(message: { type: string; query?: string; filePath?: string; line?: number }) {
        switch (message.type) {
            case 'ready':
                this.log('✅ Webview ready');
                break;

            case 'search':
                if (message.query) {
                    await this.handleSearch(message.query);
                }
                break;

            case 'refresh':
                await this.indexWorkspace();
                break;

            case 'open-file':
                if (message.filePath) {
                    await this.openFile(message.filePath, message.line);
                }
                break;

            default:
                this.log(`⚠️ Unknown message type: ${message.type}`);
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
     * Gets webview HTML content
     */
    private getWebviewContent(): string {
        const nonce = this.getNonce();
        const cspSource = this.panel!.webview.cspSource;

        // Try to load the built React app
        const graphHtmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'graph.html');
        
        // Load the built HTML file if it exists
        try {
            let htmlContent = fs.readFileSync(graphHtmlPath.fsPath, 'utf8');
            
            // Get webview URIs for all assets
            const graphJsUri = this.panel!.webview.asWebviewUri(
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'graph.js')
            );
            const indexJsUri = this.panel!.webview.asWebviewUri(
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'index.js')
            );
            const styleUri = this.panel!.webview.asWebviewUri(
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'style.css')
            );

            // Replace relative paths with webview URIs
            htmlContent = htmlContent
                .replace('./graph.js', graphJsUri.toString())
                .replace('./index.js', indexJsUri.toString())
                .replace('./style.css', styleUri.toString());

            // Remove modulepreload link (causes CSP issues)
            htmlContent = htmlContent.replace(
                /<link rel="modulepreload"[^>]*>/g,
                ''
            );

            // Add CSP meta tag if not present
            if (!htmlContent.includes('Content-Security-Policy')) {
                htmlContent = htmlContent.replace(
                    '<meta name="viewport"',
                    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}; img-src ${cspSource} data: https:; font-src ${cspSource}; connect-src ${cspSource};">
    <meta name="viewport"`
                );
            }

            // Add nonce to script tags
            htmlContent = htmlContent.replace(
                /<script type="module"/g,
                `<script type="module" nonce="${nonce}"`
            );

            return htmlContent;
        } catch (error) {
            this.log(`⚠️ Could not load built React app, using fallback HTML: ${error}`);
        }

        // Fallback HTML if React app not built
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                style-src ${cspSource} 'unsafe-inline';
                script-src 'nonce-${nonce}' ${cspSource};
                img-src ${cspSource} data: https:;
                font-src ${cspSource};
                connect-src ${cspSource};
            ">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cappy Knowledge Graph</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body, html {
                    height: 100vh;
                    font-family: var(--vscode-font-family);
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    overflow: hidden;
                }

                #root {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: 16px;
                    gap: 16px;
                    overflow: hidden;
                }

                .header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: var(--vscode-sideBar-background);
                    border-radius: 6px;
                    gap: 12px;
                }

                .title {
                    font-size: 18px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .search-bar {
                    flex: 1;
                    max-width: 500px;
                    display: flex;
                    gap: 8px;
                }

                .search-input {
                    flex: 1;
                    padding: 6px 12px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                }

                .search-input:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                }

                .btn {
                    padding: 6px 12px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                }

                .btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                .btn-secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .btn-secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }

                .content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    overflow: hidden;
                }

                .status-bar {
                    padding: 8px 16px;
                    background: var(--vscode-statusBar-background);
                    color: var(--vscode-statusBar-foreground);
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border-top: 1px solid var(--vscode-panel-border);
                }

                .status-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid var(--vscode-progressBar-background);
                    border-top: 2px solid var(--vscode-progressBar-foreground);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .loading-screen {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                }

                .loading-spinner {
                    width: 48px;
                    height: 48px;
                    border: 4px solid var(--vscode-progressBar-background);
                    border-top: 4px solid var(--vscode-progressBar-foreground);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                .graph-container {
                    flex: 1;
                    position: relative;
                    background: var(--vscode-editor-background);
                }

                .placeholder {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    color: var(--vscode-descriptionForeground);
                }

                .placeholder h3 {
                    font-size: 16px;
                    font-weight: 600;
                }

                .placeholder p {
                    font-size: 13px;
                    text-align: center;
                    max-width: 400px;
                }

                .error {
                    padding: 12px 16px;
                    background: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    border-radius: 4px;
                    color: var(--vscode-errorForeground);
                    font-size: 13px;
                }
            </style>
        </head>
        <body>
            <div id="root">
                <div class="container">
                    <div class="header">
                        <div class="title">
                            <span>🦫</span>
                            <span>Cappy Knowledge Graph</span>
                        </div>
                        <div class="search-bar">
                            <input 
                                id="search-input" 
                                class="search-input" 
                                type="text" 
                                placeholder="Search code, docs, entities..."
                            />
                            <button id="search-btn" class="btn">Search</button>
                        </div>
                        <button id="refresh-btn" class="btn btn-secondary">↻ Refresh</button>
                    </div>

                    <div class="content">
                        <div id="loading" class="loading-screen">
                            <div class="loading-spinner"></div>
                            <h3>Initializing Knowledge Graph...</h3>
                            <p>Loading embeddings and indexing workspace files...</p>
                        </div>

                        <div id="graph" class="graph-container" style="display: none;">
                            <div class="placeholder">
                                <span style="font-size: 48px;">📊</span>
                                <h3>Graph Visualization</h3>
                                <p>
                                    React + Reagraph visualization will be integrated here.
                                    For now, use the search bar to query the indexed knowledge.
                                </p>
                            </div>
                        </div>

                        <div id="error" style="display: none;"></div>
                    </div>

                    <div class="status-bar">
                        <div class="status-item">
                            <span id="status-icon">⏳</span>
                            <span id="status-text">Initializing...</span>
                        </div>
                        <div class="status-item" id="stats" style="display: none;">
                            <span id="stats-text"></span>
                        </div>
                    </div>
                </div>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();

                // State
                let state = {
                    status: 'initializing',
                    stats: null,
                    error: null
                };

                // DOM elements
                const loading = document.getElementById('loading');
                const graph = document.getElementById('graph');
                const errorEl = document.getElementById('error');
                const statusIcon = document.getElementById('status-icon');
                const statusText = document.getElementById('status-text');
                const statsDiv = document.getElementById('stats');
                const statsText = document.getElementById('stats-text');
                const searchInput = document.getElementById('search-input');
                const searchBtn = document.getElementById('search-btn');
                const refreshBtn = document.getElementById('refresh-btn');

                // Event listeners
                searchBtn.addEventListener('click', handleSearch);
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') handleSearch();
                });
                refreshBtn.addEventListener('click', () => {
                    vscode.postMessage({ type: 'refresh' });
                });

                // Handle messages from extension
                window.addEventListener('message', (event) => {
                    const message = event.data;
                    console.log('Received message:', message);

                    switch (message.type) {
                        case 'status':
                            handleStatus(message.status);
                            break;
                        case 'graph-data':
                            handleGraphData(message.data);
                            break;
                        case 'search-results':
                            handleSearchResults(message.results);
                            break;
                        case 'error':
                            handleError(message.error);
                            break;
                        case 'indexing-progress':
                            handleIndexingProgress(message.current, message.total);
                            break;
                    }
                });

                function handleStatus(status) {
                    state.status = status;

                    const icons = {
                        initializing: '⏳',
                        indexing: '📂',
                        searching: '🔍',
                        ready: '✅'
                    };

                    const messages = {
                        initializing: 'Initializing...',
                        indexing: 'Indexing workspace...',
                        searching: 'Searching...',
                        ready: 'Ready'
                    };

                    statusIcon.textContent = icons[status] || '⏳';
                    statusText.textContent = messages[status] || status;

                    if (status === 'ready') {
                        loading.style.display = 'none';
                        graph.style.display = 'flex';
                    }
                }

                function handleGraphData(data) {
                    state.stats = data.stats;
                    
                    if (data.stats) {
                        statsDiv.style.display = 'flex';
                        statsText.textContent = 
                            \`📁 \${data.stats.totalFiles} files • 📦 \${data.stats.totalChunks} chunks\`;
                    }

                    console.log('Graph data loaded:', data);
                }

                function handleSearchResults(results) {
                    console.log('Search results:', results);
                    
                    // For now, just log results
                    // TODO: Display in graph visualization
                    if (results.length === 0) {
                        alert('No results found');
                    } else {
                        alert(\`Found \${results.length} results (check console for details)\`);
                    }

                    handleStatus('ready');
                }

                function handleError(error) {
                    state.error = error;
                    errorEl.textContent = error;
                    errorEl.style.display = 'block';
                    loading.style.display = 'none';
                    
                    statusIcon.textContent = '❌';
                    statusText.textContent = 'Error';
                }

                function handleIndexingProgress(current, total) {
                    statusText.textContent = \`Indexing... \${current}/\${total} files\`;
                }

                function handleSearch() {
                    const query = searchInput.value.trim();
                    if (query) {
                        vscode.postMessage({ type: 'search', query });
                    }
                }

                // Initialize
                vscode.postMessage({ type: 'ready' });
                console.log('Graph webview initialized');
            </script>
        </body>
        </html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
