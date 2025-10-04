import * as vscode from 'vscode';
import { QueryOrchestrator } from '../query/orchestrator';

/**
 * Enhanced Status Bar for LightRAG with real-time updates
 */
export class LightRAGStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private orchestrator: QueryOrchestrator;
    private isIndexing = false;
    private lastIndexTime?: Date;
    private indexedFiles = 0;
    private totalChunks = 0;

    constructor(orchestrator: QueryOrchestrator) {
        this.orchestrator = orchestrator;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'cappy.lightrag.showStatusDetails';
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    public updateIndexingStatus(isIndexing: boolean, progress?: { current: number; total: number }): void {
        this.isIndexing = isIndexing;
        if (!isIndexing) {
            this.lastIndexTime = new Date();
            this.refreshStats();
        }
        this.updateStatusBar(progress);
    }

    public updateStats(indexedFiles: number, totalChunks: number): void {
        this.indexedFiles = indexedFiles;
        this.totalChunks = totalChunks;
        this.updateStatusBar();
    }

    private async refreshStats(): Promise<void> {
        try {
            const stats = await this.orchestrator.getSystemStats();
            this.indexedFiles = stats.database.chunks; // Using chunks as file indicator
            this.totalChunks = stats.database.chunks;
        } catch (error) {
            console.debug('Failed to refresh LightRAG stats:', error);
        }
    }

    private updateStatusBar(progress?: { current: number; total: number }): void {
        if (this.isIndexing) {
            if (progress) {
                const percentage = Math.round((progress.current / progress.total) * 100);
                this.statusBarItem.text = `$(sync~spin) LightRAG ${percentage}%`;
                this.statusBarItem.tooltip = `Indexing: ${progress.current}/${progress.total} files`;
            } else {
                this.statusBarItem.text = '$(sync~spin) LightRAG Indexing...';
                this.statusBarItem.tooltip = 'LightRAG is currently indexing your workspace';
            }
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        } else {
            const timeAgo = this.lastIndexTime ? this.getTimeAgo(this.lastIndexTime) : 'never';
            this.statusBarItem.text = `$(database) LightRAG (${this.indexedFiles})`;
            this.statusBarItem.tooltip = this.buildTooltip(timeAgo);
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.foreground');
        }
    }

    private buildTooltip(timeAgo: string): string {
        const lines = [
            'LightRAG Semantic Search',
            `📊 Status: Ready`,
            `📁 Chunks: ${this.totalChunks}`,
            `⏱️ Last indexed: ${timeAgo}`,
            '',
            'Click for detailed status'
        ];
        return lines.join('\n');
    }

    private getTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffMinutes < 1) return 'just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    }

    public showQuickStatus(): void {
        const message = this.isIndexing 
            ? 'LightRAG is currently indexing your workspace...'
            : `LightRAG Ready: ${this.indexedFiles} chunks indexed`;
        
        vscode.window.showInformationMessage(message, 'Show Details', 'Search Now')
            .then(selection => {
                switch (selection) {
                    case 'Show Details':
                        vscode.commands.executeCommand('cappy.lightrag.status');
                        break;
                    case 'Search Now':
                        vscode.commands.executeCommand('cappy.lightrag.search');
                        break;
                }
            });
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}