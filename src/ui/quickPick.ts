import * as vscode from 'vscode';

/**
 * Enhanced Quick Pick for LightRAG search with fuzzy matching and previews
 */
export class LightRAGQuickPick {
    private quickPick: vscode.QuickPick<LightRAGQuickPickItem>;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.quickPick = vscode.window.createQuickPick<LightRAGQuickPickItem>();
        this.setupQuickPick();
    }

    private setupQuickPick(): void {
        this.quickPick.placeholder = 'Search your codebase semantically...';
        this.quickPick.ignoreFocusOut = true;
        this.quickPick.matchOnDescription = true;
        this.quickPick.matchOnDetail = true;
        
        // Enable multi-select for advanced actions
        this.quickPick.canSelectMany = false;

        this.disposables.push(
            this.quickPick.onDidChangeValue(this.onSearchQueryChanged.bind(this)),
            this.quickPick.onDidAccept(this.onItemSelected.bind(this)),
            this.quickPick.onDidHide(() => this.dispose())
        );
    }

    public async show(): Promise<LightRAGQuickPickItem | undefined> {
        return new Promise((resolve) => {
            this.quickPick.onDidAccept(() => {
                const selection = this.quickPick.selectedItems[0];
                this.quickPick.hide();
                resolve(selection);
            });

            this.quickPick.onDidHide(() => {
                resolve(undefined);
            });

            this.quickPick.show();
        });
    }

    public updateItems(items: LightRAGQuickPickItem[]): void {
        this.quickPick.items = items;
        this.quickPick.busy = false;
    }

    public setBusy(busy: boolean): void {
        this.quickPick.busy = busy;
    }

    public setPlaceholder(placeholder: string): void {
        this.quickPick.placeholder = placeholder;
    }

    private async onSearchQueryChanged(query: string): Promise<void> {
        if (query.length < 2) {
            this.updateItems(this.getDefaultItems());
            return;
        }

        this.setBusy(true);
        
        // Trigger search after a short delay to avoid too frequent searches
        setTimeout(async () => {
            if (this.quickPick.value === query) {
                await this.performSearch(query);
            }
        }, 300);
    }

    private async performSearch(query: string): Promise<void> {
        try {
            // Execute LightRAG search command
            await vscode.commands.executeCommand('cappy.lightrag.search', query);
        } catch (error) {
            vscode.window.showErrorMessage(`Search failed: ${error}`);
        } finally {
            this.setBusy(false);
        }
    }

    private onItemSelected(): void {
        const selection = this.quickPick.selectedItems[0];
        if (selection && selection.command) {
            vscode.commands.executeCommand(selection.command.command, ...selection.command.arguments || []);
        }
    }

    private getDefaultItems(): LightRAGQuickPickItem[] {
        return [
            {
                label: '$(search) Search your codebase',
                description: 'Enter terms to search semantically',
                command: { command: 'cappy.lightrag.search' }
            },
            {
                label: '$(database) Index workspace',
                description: 'Build or rebuild the semantic index',
                command: { command: 'cappy.lightrag.indexWorkspace' }
            },
            {
                label: '$(info) Show LightRAG status',
                description: 'View current system status and statistics',
                command: { command: 'cappy.lightrag.status' }
            },
            {
                label: '$(gear) LightRAG settings',
                description: 'Configure LightRAG preferences',
                command: { command: 'workbench.action.openSettings', arguments: ['cappy.lightrag'] }
            }
        ];
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.quickPick.dispose();
    }
}

export interface LightRAGQuickPickItem extends vscode.QuickPickItem {
    command?: {
        command: string;
        arguments?: any[];
    };
    filePath?: string;
    startLine?: number;
    endLine?: number;
    score?: number;
}
