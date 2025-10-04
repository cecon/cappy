import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Enhanced Result Display with webview integration
 */
export interface SearchResultUI {
    chunk: {
        id: string;
        path: string;
        startLine: number;
        endLine: number;
        text: string;
    };
    score: number;
    explanation: {
        vectorScore: number;
        graphScore: number;
        freshnessScore: number;
        whyRelevant: string;
    };
}

export class LightRAGResultsPanel {
    public static readonly viewType = 'lightragResults';
    private static instance?: LightRAGResultsPanel;

    private _panel?: vscode.WebviewPanel;
    private _context: vscode.ExtensionContext;
    private _currentResults: SearchResultUI[] = [];

    private constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public static getInstance(context: vscode.ExtensionContext): LightRAGResultsPanel {
        if (!LightRAGResultsPanel.instance) {
            LightRAGResultsPanel.instance = new LightRAGResultsPanel(context);
        }
        return LightRAGResultsPanel.instance;
    }

    public async showResults(query: string, results: SearchResultUI[], searchTime: number): Promise<void> {
        this._currentResults = results;
        
        if (!this._panel) {
            this._panel = vscode.window.createWebviewPanel(
                LightRAGResultsPanel.viewType,
                'LightRAG Search Results',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    localResourceRoots: [this._context.extensionUri],
                    retainContextWhenHidden: true
                }
            );

            this._panel.onDidDispose(() => {
                this._panel = undefined;
            });

            this._panel.webview.onDidReceiveMessage(async (message) => {
                await this.handleWebviewMessage(message);
            });
        }

        this._panel.title = `LightRAG: "${query}"`;
        this._panel.webview.html = this.getWebviewContent(query, results, searchTime);
        this._panel.reveal(vscode.ViewColumn.Two);
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'openFile':
                await this.openFileAtLine(message.path, message.startLine, message.endLine);
                break;
            case 'searchSimilar':
                await vscode.commands.executeCommand('cappy.lightrag.search', message.text);
                break;
            case 'copyPath':
                await vscode.env.clipboard.writeText(message.path);
                vscode.window.showInformationMessage('Path copied to clipboard');
                break;
            case 'showInExplorer':
                await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(message.path));
                break;
        }
    }

    private async openFileAtLine(filePath: string, startLine: number, endLine: number): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);

            // Highlight the relevant lines
            const startPos = new vscode.Position(Math.max(0, startLine - 1), 0);
            const endPos = new vscode.Position(endLine - 1, 999);
            const range = new vscode.Range(startPos, endPos);

            editor.selection = new vscode.Selection(startPos, endPos);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

            // Add temporary decoration
            const decorationType = vscode.window.createTextEditorDecorationType({
                backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
                border: '1px solid',
                borderColor: new vscode.ThemeColor('editor.findMatchBorder')
            });

            editor.setDecorations(decorationType, [range]);

            // Remove decoration after 3 seconds
            setTimeout(() => {
                decorationType.dispose();
            }, 3000);

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    private getWebviewContent(query: string, results: SearchResultUI[], searchTime: number): string {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LightRAG Results</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 16px;
            line-height: 1.6;
        }
        
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 16px;
            margin-bottom: 20px;
        }
        
        .query {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 8px;
        }
        
        .stats {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        
        .result-item {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            margin-bottom: 16px;
            background-color: var(--vscode-editor-background);
            overflow: hidden;
            transition: all 0.2s ease;
        }
        
        .result-item:hover {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .result-header {
            padding: 12px 16px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .result-path {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: none;
        }
        
        .result-path:hover {
            text-decoration: underline;
        }
        
        .result-score {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .result-content {
            padding: 16px;
        }
        
        .result-text {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            white-space: pre-wrap;
            overflow-x: auto;
            margin-bottom: 12px;
            line-height: 1.4;
        }
        
        .result-explanation {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
        }
        
        .result-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .action-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s ease;
        }
        
        .action-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .action-button.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .action-button.primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .score-breakdown {
            display: flex;
            gap: 12px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 8px;
        }
        
        .score-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .score-label {
            font-weight: 600;
            margin-bottom: 2px;
        }
        
        .no-results {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        
        .no-results-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="query">🔍 "${query}"</div>
        <div class="stats">
            Found ${results.length} results in ${searchTime}ms
        </div>
    </div>
    
    ${results.length === 0 ? this.getNoResultsHTML() : this.getResultsHTML(results, workspaceRoot)}
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function openFile(path, startLine, endLine) {
            vscode.postMessage({
                type: 'openFile',
                path: path,
                startLine: startLine,
                endLine: endLine
            });
        }
        
        function searchSimilar(text) {
            vscode.postMessage({
                type: 'searchSimilar',
                text: text
            });
        }
        
        function copyPath(path) {
            vscode.postMessage({
                type: 'copyPath',
                path: path
            });
        }
        
        function showInExplorer(path) {
            vscode.postMessage({
                type: 'showInExplorer',
                path: path
            });
        }
    </script>
</body>
</html>`;
    }

    private getNoResultsHTML(): string {
        return `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <h3>No results found</h3>
                <p>Try refining your search query or check if your workspace is indexed.</p>
            </div>
        `;
    }

    private getResultsHTML(results: SearchResultUI[], workspaceRoot: string): string {
        return results.map((result, index) => {
            const relativePath = path.relative(workspaceRoot, result.chunk.path);
            const fileName = path.basename(result.chunk.path);
            const dirName = path.dirname(relativePath);
            
            return `
                <div class="result-item">
                    <div class="result-header">
                        <a class="result-path" href="#" onclick="openFile('${result.chunk.path}', ${result.chunk.startLine}, ${result.chunk.endLine})">
                            <strong>${fileName}</strong>${dirName !== '.' ? ` in ${dirName}` : ''}
                        </a>
                        <span class="result-score">${result.score.toFixed(3)}</span>
                    </div>
                    <div class="result-content">
                        <div class="result-text">${this.escapeHtml(result.chunk.text)}</div>
                        <div class="result-explanation">${result.explanation.whyRelevant}</div>
                        <div class="score-breakdown">
                            <div class="score-item">
                                <div class="score-label">Vector</div>
                                <div>${result.explanation.vectorScore.toFixed(3)}</div>
                            </div>
                            <div class="score-item">
                                <div class="score-label">Graph</div>
                                <div>${result.explanation.graphScore.toFixed(3)}</div>
                            </div>
                            <div class="score-item">
                                <div class="score-label">Fresh</div>
                                <div>${result.explanation.freshnessScore.toFixed(3)}</div>
                            </div>
                        </div>
                        <div class="result-actions">
                            <button class="action-button primary" onclick="openFile('${result.chunk.path}', ${result.chunk.startLine}, ${result.chunk.endLine})">
                                Open File
                            </button>
                            <button class="action-button" onclick="searchSimilar('${this.escapeHtml(result.chunk.text.substring(0, 50))}')">
                                Find Similar
                            </button>
                            <button class="action-button" onclick="copyPath('${result.chunk.path}')">
                                Copy Path
                            </button>
                            <button class="action-button" onclick="showInExplorer('${result.chunk.path}')">
                                Show in Explorer
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    public dispose(): void {
        this._panel?.dispose();
    }
}