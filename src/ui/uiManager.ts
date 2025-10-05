import * as vscode from 'vscode';
import { LightRAGStatusBar } from './statusBar';
import { LightRAGResultsPanel, SearchResultUI } from './resultsPanel';
import { LightRAGQuickPick } from './quickPick';
import { LightRAGProgressManager, LightRAGNotifications, LightRAGHoverProvider } from './progressManager';
import { QueryOrchestrator } from '../query/orchestrator';

/**
 * UI Manager that coordinates all LightRAG user interface components
 */
export class LightRAGUIManager {
    private statusBar: LightRAGStatusBar;
    private resultsPanel: LightRAGResultsPanel;
    private progressManager: LightRAGProgressManager;
    private hoverProvider?: vscode.Disposable;
    private context: vscode.ExtensionContext;
    private orchestrator: QueryOrchestrator;

    constructor(context: vscode.ExtensionContext, orchestrator: QueryOrchestrator) {
        this.context = context;
        this.orchestrator = orchestrator;
        
        // Initialize UI components
        this.statusBar = new LightRAGStatusBar(orchestrator);
        this.resultsPanel = LightRAGResultsPanel.getInstance(context);
        this.progressManager = LightRAGProgressManager.getInstance();
        
        this.setupHoverProvider();
        this.registerUICommands();
    }

    /**
     * Setup hover provider for enhanced tooltips
     */
    private setupHoverProvider(): void {
        const provider = new LightRAGHoverProvider(this.orchestrator);
        this.hoverProvider = vscode.languages.registerHoverProvider(
            ['typescript', 'javascript', 'python', 'markdown', 'json'],
            provider
        );
        this.context.subscriptions.push(this.hoverProvider);
    }

    /**
     * Register UI-specific commands
     */
    private registerUICommands(): void {
        const commands = [
            vscode.commands.registerCommand('cappy.lightrag.showStatusDetails', async () => {
                this.statusBar.showQuickStatus();
            }),

            vscode.commands.registerCommand('cappy.lightrag.openQuickPick', async () => {
                const quickPick = new LightRAGQuickPick();
                await quickPick.show();
                quickPick.dispose();
            }),

            vscode.commands.registerCommand('cappy.lightrag.showResults', async (query: string, results: SearchResultUI[], searchTime: number) => {
                await this.resultsPanel.showResults(query, results, searchTime);
            })
        ];

        this.context.subscriptions.push(...commands);
    }

    /**
     * Show indexing progress
     */
    public async showIndexingProgress<T>(
        operation: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
    ): Promise<T> {
        this.statusBar.updateIndexingStatus(true);
        
        try {
            const result = await this.progressManager.withIndexingProgress(async (progress) => {
                const steps = [
                    'Analyzing workspace structure...',
                    'Processing files...',
                    'Building semantic index...',
                    'Creating graph relationships...',
                    'Finalizing index...'
                ];

                return await this.progressManager.withDetailedProgress(
                    'LightRAG Workspace Indexing',
                    steps,
                    async (detailedProgress, updateStep) => {
                        return await operation(detailedProgress);
                    }
                );
            });

            this.statusBar.updateIndexingStatus(false);
            return result;

        } catch (error) {
            this.statusBar.updateIndexingStatus(false);
            throw error;
        }
    }

    /**
     * Show search progress and results
     */
    public async showSearchProgress<T>(
        query: string,
        operation: () => Promise<{ results: SearchResultUI[]; searchTime: number }>
    ): Promise<void> {
        try {
            const result = await this.progressManager.withSearchProgress(query, async (progress) => {
                progress.report({ message: 'Executing semantic search...' });
                const searchResult = await operation();
                progress.report({ message: 'Processing results...' });
                return searchResult;
            });

            // Show results in panel
            await this.resultsPanel.showResults(query, result.results, result.searchTime);

            // Show notification
            LightRAGNotifications.searchComplete(query, result.results.length, result.searchTime);

        } catch (error) {
            LightRAGNotifications.error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Show initialization progress
     */
    public async showInitializationProgress<T>(
        operation: () => Promise<T>
    ): Promise<T> {
        return await this.progressManager.withStatusBarProgress(
            'Initializing LightRAG...',
            async () => {
                const result = await operation();
                LightRAGNotifications.initializationComplete();
                return result;
            }
        );
    }

    /**
     * Update status bar with current stats
     */
    public updateStatus(indexedFiles: number, totalChunks: number): void {
        this.statusBar.updateStats(indexedFiles, totalChunks);
    }

    /**
     * Show auto-indexing notification
     */
    public showAutoIndexing(fileName: string): void {
        LightRAGNotifications.autoIndexing(fileName);
    }

    /**
     * Show success notification
     */
    public showSuccess(message: string, actions?: string[]): Thenable<string | undefined> {
        return LightRAGNotifications.success(message, actions);
    }

    /**
     * Show error notification
     */
    public showError(message: string, actions?: string[]): Thenable<string | undefined> {
        return LightRAGNotifications.error(message, actions);
    }

    /**
     * Show warning notification
     */
    public showWarning(message: string, actions?: string[]): Thenable<string | undefined> {
        return LightRAGNotifications.warning(message, actions);
    }

    /**
     * Show temporary status message
     */
    public showStatusMessage(message: string, timeout?: number): void {
        LightRAGNotifications.statusMessage(message, timeout);
    }

    /**
     * Show indexing completion notification
     */
    public showIndexingComplete(fileCount: number, chunkCount: number): void {
        LightRAGNotifications.indexingComplete(fileCount, chunkCount);
    }

    /**
     * Create and show quick pick for search
     */
    public async showSearchQuickPick(): Promise<void> {
        const quickPick = new LightRAGQuickPick();
        try {
            const selection = await quickPick.show();
            if (selection && selection.command) {
                await vscode.commands.executeCommand(
                    selection.command.command,
                    ...(selection.command.arguments || [])
                );
            }
        } finally {
            quickPick.dispose();
        }
    }

    /**
     * Dispose all UI components
     */
    public dispose(): void {
        this.statusBar.dispose();
        this.resultsPanel.dispose();
        if (this.hoverProvider) {
            this.hoverProvider.dispose();
        }
    }
}

// Export all UI components for individual use
export {
    LightRAGStatusBar,
    LightRAGResultsPanel,
    LightRAGQuickPick,
    LightRAGProgressManager,
    LightRAGNotifications,
    LightRAGHoverProvider,
    SearchResultUI
};
