import * as vscode from 'vscode';

/**
 * Progress indicator for long-running LightRAG operations
 */
export class LightRAGProgressManager {
    private static instance?: LightRAGProgressManager;

    private constructor() {}

    public static getInstance(): LightRAGProgressManager {
        if (!LightRAGProgressManager.instance) {
            LightRAGProgressManager.instance = new LightRAGProgressManager();
        }
        return LightRAGProgressManager.instance;
    }

    /**
     * Show progress for workspace indexing
     */
    public async withIndexingProgress<T>(
        operation: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
    ): Promise<T> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'LightRAG Indexing',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Preparing workspace analysis...' });
            return await operation(progress);
        });
    }

    /**
     * Show progress for search operations
     */
    public async withSearchProgress<T>(
        query: string,
        operation: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
    ): Promise<T> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `Searching: "${query}"`,
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Analyzing query...' });
            return await operation(progress);
        });
    }

    /**
     * Show background progress in status bar
     */
    public async withStatusBarProgress<T>(
        title: string,
        operation: () => Promise<T>
    ): Promise<T> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title
        }, async () => {
            return await operation();
        });
    }

    /**
     * Show detailed progress with steps
     */
    public async withDetailedProgress<T>(
        title: string,
        steps: string[],
        operation: (
            progress: vscode.Progress<{ message?: string; increment?: number }>,
            updateStep: (stepIndex: number, message?: string) => void
        ) => Promise<T>
    ): Promise<T> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false
        }, async (progress) => {
            const incrementPerStep = 100 / steps.length;
            let currentStep = 0;

            const updateStep = (stepIndex: number, message?: string) => {
                const stepMessage = message || steps[stepIndex];
                progress.report({
                    message: `${stepMessage} (${stepIndex + 1}/${steps.length})`,
                    increment: incrementPerStep
                });
            };

            return await operation(progress, updateStep);
        });
    }
}

/**
 * Toast notifications for LightRAG operations
 */
export class LightRAGNotifications {
    private static readonly notificationTimeout = 5000; // 5 seconds

    /**
     * Show success notification
     */
    public static success(message: string, actions?: string[]): Thenable<string | undefined> {
        return vscode.window.showInformationMessage(`✅ ${message}`, ...actions || []);
    }

    /**
     * Show warning notification
     */
    public static warning(message: string, actions?: string[]): Thenable<string | undefined> {
        return vscode.window.showWarningMessage(`⚠️ ${message}`, ...actions || []);
    }

    /**
     * Show error notification
     */
    public static error(message: string, actions?: string[]): Thenable<string | undefined> {
        return vscode.window.showErrorMessage(`❌ ${message}`, ...actions || []);
    }

    /**
     * Show indexing completion notification
     */
    public static indexingComplete(fileCount: number, chunkCount: number): void {
        const message = `Workspace indexed: ${fileCount} files, ${chunkCount} chunks`;
        this.success(message, ['Search Now', 'View Details'])
            .then(action => {
                switch (action) {
                    case 'Search Now':
                        vscode.commands.executeCommand('cappy.lightrag.search');
                        break;
                    case 'View Details':
                        vscode.commands.executeCommand('cappy.lightrag.status');
                        break;
                }
            });
    }

    /**
     * Show search results notification
     */
    public static searchComplete(query: string, resultCount: number, searchTime: number): void {
        if (resultCount === 0) {
            this.warning(`No results found for "${query}"`, ['Try Different Terms']);
        } else {
            const message = `Found ${resultCount} results for "${query}" (${searchTime}ms)`;
            this.success(message, ['View Results'])
                .then(action => {
                    if (action === 'View Results') {
                        // Results panel should already be open
                    }
                });
        }
    }

    /**
     * Show initialization notification
     */
    public static initializationComplete(): void {
        this.success('LightRAG initialized successfully', ['Index Workspace', 'Search'])
            .then(action => {
                switch (action) {
                    case 'Index Workspace':
                        vscode.commands.executeCommand('cappy.lightrag.indexWorkspace');
                        break;
                    case 'Search':
                        vscode.commands.executeCommand('cappy.lightrag.search');
                        break;
                }
            });
    }

    /**
     * Show auto-indexing notification (brief)
     */
    public static autoIndexing(fileName: string): void {
        // Show brief status bar message instead of popup
        vscode.window.setStatusBarMessage(`$(sync~spin) Auto-indexing ${fileName}...`, 2000);
    }

    /**
     * Show temporary status message
     */
    public static statusMessage(message: string, timeout: number = LightRAGNotifications.notificationTimeout): void {
        vscode.window.setStatusBarMessage(message, timeout);
    }
}

/**
 * Hover provider for enhanced tooltips
 */
export class LightRAGHoverProvider implements vscode.HoverProvider {
    private orchestrator: any; // QueryOrchestrator type would be imported

    constructor(orchestrator: any) {
        this.orchestrator = orchestrator;
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        try {
            // Get word at position
            const wordRange = document.getWordRangeAtPosition(position);
            if (!wordRange) {
                return undefined;
            }

            const word = document.getText(wordRange);
            if (word.length < 3) {
                return undefined;
            }

            // Create hover content
            const contents = new vscode.MarkdownString();
            contents.isTrusted = true;
            contents.appendMarkdown(`**LightRAG Semantic Search**\n\n`);
            contents.appendMarkdown(`Search for: \`${word}\`\n\n`);
            contents.appendMarkdown(`[🔍 Search Similar](command:cappy.lightrag.search?${encodeURIComponent(JSON.stringify([word]))} "Search for similar terms")`);
            contents.appendMarkdown(` | `);
            contents.appendMarkdown(`[📊 Search Context](command:cappy.lightrag.searchSelection "Search current selection")`);

            return new vscode.Hover(contents, wordRange);

        } catch (error) {
            console.debug('LightRAG hover provider error:', error);
            return undefined;
        }
    }
}