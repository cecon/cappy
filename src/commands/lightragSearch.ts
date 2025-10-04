import * as vscode from 'vscode';
import * as path from 'path';
import { QueryOrchestrator, MiniLightRAGConfig, SearchContext } from '../query/orchestrator';
import { OutputWriter } from '../utils/outputWriter';

/**
 * LightRAG Search Command
 * Integrates Mini-LightRAG search functionality with VS Code UI
 */
export class LightRAGSearchCommand {
    private orchestrator: QueryOrchestrator | null = null;
    private outputWriter: OutputWriter;
    private statusBarItem: vscode.StatusBarItem;
    private isInitialized = false;

    constructor(private context: vscode.ExtensionContext) {
        this.outputWriter = new OutputWriter();
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.statusBarItem.command = 'cappy.lightrag.status';
        this.context.subscriptions.push(this.statusBarItem);
    }

    /**
     * Initialize LightRAG system
     */
    async initialize(): Promise<void> {
        try {
            this.updateStatusBar('Initializing LightRAG...', true);
            
            const config = await this.loadConfiguration();
            this.orchestrator = new QueryOrchestrator(this.context, config);
            
            await this.orchestrator.initialize();
            this.isInitialized = true;
            
            this.updateStatusBar('LightRAG Ready', false);
            this.outputWriter.writeLine('✅ LightRAG system initialized successfully');
            
            // Setup auto-indexing
            this.setupFileWatchers();
            
        } catch (error) {
            this.updateStatusBar('LightRAG Error', false);
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.outputWriter.writeLine(`❌ Failed to initialize LightRAG: ${errorMsg}`);
            throw error;
        }
    }

    /**
     * Execute semantic search with VS Code integration
     */
    async executeSearch(query?: string): Promise<void> {
        if (!this.isInitialized || !this.orchestrator) {
            vscode.window.showWarningMessage('LightRAG is not initialized. Please run "Initialize LightRAG" first.');
            return;
        }

        try {
            // Get search query
            const searchQuery = query || await this.promptForQuery();
            if (!searchQuery) {
                return;
            }

            this.updateStatusBar('Searching...', true);
            this.outputWriter.writeLine(`🔍 Searching for: "${searchQuery}"`);

            // Build search context
            const searchContext = await this.buildSearchContext();
            
            // Execute search
            const startTime = Date.now();
            const results = await this.orchestrator.search(searchQuery, searchContext);
            const searchTime = Date.now() - startTime;

            // Display results
            await this.displaySearchResults(results, searchQuery, searchTime);
            
            this.updateStatusBar('LightRAG Ready', false);

        } catch (error) {
            this.updateStatusBar('Search Error', false);
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.outputWriter.writeLine(`❌ Search failed: ${errorMsg}`);
            vscode.window.showErrorMessage(`Search failed: ${errorMsg}`);
        }
    }

    /**
     * Index current workspace
     */
    async indexWorkspace(): Promise<void> {
        if (!this.isInitialized || !this.orchestrator) {
            vscode.window.showWarningMessage('LightRAG is not initialized.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('No workspace folder is open.');
            return;
        }

        try {
            this.updateStatusBar('Indexing workspace...', true);
            
            const workspacePath = workspaceFolders[0].uri.fsPath;
            this.outputWriter.writeLine(`📁 Starting workspace indexing: ${workspacePath}`);

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'LightRAG Indexing',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Analyzing workspace...' });
                
                await this.orchestrator!.indexWorkspace(workspacePath);
                
                progress.report({ message: 'Indexing complete!' });
            });

            const stats = await this.orchestrator.getSystemStats();
            this.outputWriter.writeLine(`✅ Indexing completed:`);
            this.outputWriter.writeLine(`   - Database chunks: ${stats.database.chunks}`);
            this.outputWriter.writeLine(`   - Graph nodes: ${stats.database.nodes}`);
            this.outputWriter.writeLine(`   - Graph edges: ${stats.database.edges}`);
            this.outputWriter.writeLine(`   - Indexing status: ${stats.indexing.isIndexing ? 'Active' : 'Idle'}`);

            this.updateStatusBar('LightRAG Ready', false);
            vscode.window.showInformationMessage(
                `Workspace indexed: ${stats.database.chunks} chunks, ${stats.database.nodes} nodes`
            );

        } catch (error) {
            this.updateStatusBar('Indexing Error', false);
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.outputWriter.writeLine(`❌ Indexing failed: ${errorMsg}`);
            vscode.window.showErrorMessage(`Indexing failed: ${errorMsg}`);
        }
    }

    /**
     * Show system status
     */
    async showStatus(): Promise<void> {
        if (!this.isInitialized || !this.orchestrator) {
            vscode.window.showInformationMessage('LightRAG is not initialized.');
            return;
        }

        try {
            const stats = await this.orchestrator.getSystemStats();
            const indexingStatus = this.orchestrator.getIndexingStatus();

            const statusItems = [
                `**LightRAG System Status**`,
                '',
                `🟢 **Status**: ${stats.isInitialized ? 'Initialized' : 'Not Ready'}`,
                `� **Database Chunks**: ${stats.database.chunks}`,
                `🔗 **Graph Nodes**: ${stats.database.nodes}`,
                `🌐 **Graph Edges**: ${stats.database.edges}`,
                `⚡ **Cache Size**: ${stats.cache.size}`,
                `📊 **Cache Hit Rate**: ${(stats.cache.hitRate * 100).toFixed(1)}%`,
                '',
                `🔄 **Indexing Status**: ${indexingStatus.isIndexing ? 'Active' : 'Idle'}`,
                `📝 **Processed Files**: ${indexingStatus.processedFiles}`
            ];

            const statusText = statusItems.join('\n');
            this.outputWriter.writeLine(statusText);

            // Show in information message with actions
            const action = await vscode.window.showInformationMessage(
                `LightRAG: ${stats.database.chunks} chunks, ${stats.database.nodes} nodes`,
                'View Details',
                'Reindex',
                'Search'
            );

            switch (action) {
                case 'View Details':
                    this.outputWriter.show();
                    break;
                case 'Reindex':
                    await this.indexWorkspace();
                    break;
                case 'Search':
                    await this.executeSearch();
                    break;
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to get status: ${errorMsg}`);
        }
    }

    /**
     * Search in current file context
     */
    async searchInContext(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor.');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (selectedText.trim()) {
            await this.executeSearch(selectedText.trim());
        } else {
            // Use surrounding context as query hint
            const line = editor.document.lineAt(selection.active.line);
            const contextQuery = line.text.trim();
            
            if (contextQuery) {
                const query = await vscode.window.showInputBox({
                    prompt: 'Search query',
                    value: contextQuery,
                    placeHolder: 'Enter search terms...'
                });
                
                if (query) {
                    await this.executeSearch(query);
                }
            } else {
                await this.executeSearch();
            }
        }
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        if (this.orchestrator) {
            this.orchestrator.shutdown();
        }
        this.statusBarItem.dispose();
    }

    // Private helper methods

    private async loadConfiguration(): Promise<Partial<MiniLightRAGConfig>> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const rootPath = workspaceFolders?.[0]?.uri.fsPath || '';

        const config = vscode.workspace.getConfiguration('cappy.lightrag');
        
        return {
            database: {
                path: path.join(rootPath, '.cappy', 'lightrag-db'),
                vectorDimension: config.get('vectorDimension', 384),
                indexType: config.get('indexType', 'HNSW')
            },
            indexing: {
                batchSize: config.get('indexing.batchSize', 100),
                maxConcurrency: config.get('indexing.maxConcurrency', 4),
                chunkSize: {
                    min: config.get('indexing.chunkSize.min', 200),
                    max: config.get('indexing.chunkSize.max', 1000)
                },
                skipPatterns: config.get('indexing.skipPatterns', [
                    '**/node_modules/**',
                    '**/.git/**',
                    '**/dist/**',
                    '**/out/**',
                    '**/*.min.js'
                ]),
                includePatterns: config.get('indexing.includePatterns', [
                    '**/*.ts',
                    '**/*.js',
                    '**/*.md',
                    '**/*.txt',
                    '**/*.json'
                ]),
                autoIndexOnSave: config.get('indexing.autoIndexOnSave', true),
                autoIndexInterval: config.get('indexing.autoIndexInterval', 300000) // 5 minutes
            },
            search: {
                defaultMaxResults: config.get('search.maxResults', 20),
                defaultExpandHops: config.get('search.expandHops', 2),
                vectorWeight: config.get('search.vectorWeight', 0.6),
                graphWeight: config.get('search.graphWeight', 0.3),
                freshnessWeight: config.get('search.freshnessWeight', 0.1),
                cacheTimeMinutes: config.get('search.cacheTimeMinutes', 10)
            }
        };
    }

    private async promptForQuery(): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt: 'Enter search query',
            placeHolder: 'Search your codebase semantically...',
            ignoreFocusOut: true
        });
    }

    private async buildSearchContext(): Promise<SearchContext> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders?.[0]?.uri.fsPath || '';
        
        const context: SearchContext = {
            workspacePath
        };

        // Add cursor context if available
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const position = editor.selection.active;
            const line = editor.document.lineAt(position.line);
            
            context.activeDocument = editor.document;
            context.selection = editor.selection;
            context.cursorContext = {
                line: position.line + 1,
                character: position.character,
                surroundingText: line.text
            };
        }

        // Note: Additional context like openFiles would be processed separately

        return context;
    }

    private async displaySearchResults(results: any, query: string, searchTime: number): Promise<void> {
        const { results: searchResults, stats } = results;

        if (searchResults.length === 0) {
            this.outputWriter.writeLine(`No results found for "${query}"`);
            vscode.window.showInformationMessage('No results found.');
            return;
        }

        // Log detailed results
        this.outputWriter.writeLine(`\n🎯 Search Results for "${query}" (${searchTime}ms):`);
        this.outputWriter.writeLine(`Found ${searchResults.length} results\n`);

        // Create quick pick items
        const quickPickItems: vscode.QuickPickItem[] = searchResults.map((result: any, index: number) => {
            const { chunk, score } = result;
            const relativePath = path.relative(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                chunk.path
            );

            return {
                label: `$(file) ${relativePath}`,
                description: `Lines ${chunk.startLine}-${chunk.endLine}`,
                detail: `Score: ${score.toFixed(3)} - ${chunk.text.substring(0, 100)}...`,
                picked: index === 0
            };
        });

        // Show quick pick
        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: `${searchResults.length} results found - Select to open`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            const index = quickPickItems.indexOf(selected);
            const result = searchResults[index];
            await this.openSearchResult(result);
        }

        // Log detailed explanations
        searchResults.forEach((result: any, index: number) => {
            this.outputWriter.writeLine(`${index + 1}. ${path.basename(result.chunk.path)}:${result.chunk.startLine}-${result.chunk.endLine}`);
            this.outputWriter.writeLine(`   Score: ${result.score.toFixed(3)} (vector: ${result.explanation.vectorScore.toFixed(3)}, graph: ${result.explanation.graphScore.toFixed(3)})`);
            this.outputWriter.writeLine(`   ${result.explanation.whyRelevant}`);
            this.outputWriter.writeLine('');
        });

        this.outputWriter.writeLine(`📊 Search Statistics:`);
        this.outputWriter.writeLine(`   - Total found: ${stats.totalFound}`);
        this.outputWriter.writeLine(`   - Vector matches: ${stats.vectorMatches}`);
        this.outputWriter.writeLine(`   - Graph expansions: ${stats.graphExpansions}`);
        this.outputWriter.writeLine(`   - Processing time: ${stats.processingTime}ms`);
    }

    private async openSearchResult(result: any): Promise<void> {
        try {
            const { chunk } = result;
            const uri = vscode.Uri.file(chunk.path);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);

            // Highlight the found chunk
            const startPos = new vscode.Position(chunk.startLine - 1, 0);
            const endPos = new vscode.Position(chunk.endLine - 1, 999);
            const range = new vscode.Range(startPos, endPos);

            editor.selection = new vscode.Selection(startPos, endPos);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

            this.outputWriter.writeLine(`📂 Opened: ${path.basename(chunk.path)}:${chunk.startLine}`);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to open file: ${errorMsg}`);
        }
    }

    private setupFileWatchers(): void {
        if (!this.orchestrator) {
            return;
        }

        // Watch for file saves - simplified without auto-indexing methods
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (document.uri.scheme === 'file') {
                // Auto-indexing would be triggered here in full implementation
                this.outputWriter.writeLine(`📝 File saved: ${path.basename(document.uri.fsPath)}`);
            }
        }, null, this.context.subscriptions);

        // Watch for file changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        watcher.onDidCreate(async (uri) => {
            if (uri.scheme === 'file') {
                this.outputWriter.writeLine(`➕ File created: ${path.basename(uri.fsPath)}`);
            }
        });

        watcher.onDidDelete(async (uri) => {
            if (uri.scheme === 'file') {
                this.outputWriter.writeLine(`🗑️ File deleted: ${path.basename(uri.fsPath)}`);
            }
        });

        this.context.subscriptions.push(watcher);
    }

    private updateStatusBar(text: string, isWorking: boolean): void {
        this.statusBarItem.text = isWorking ? `$(sync~spin) ${text}` : `$(database) ${text}`;
        this.statusBarItem.show();
    }
}