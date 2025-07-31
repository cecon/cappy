import * as vscode from 'vscode';
import { PreventionRule, PreventionRuleCategory } from '../models/preventionRule';

export class PreventionRuleAdder {
    private panel: vscode.WebviewPanel | undefined;

    public async show(): Promise<boolean> {
        return new Promise((resolve) => {
            this.panel = vscode.window.createWebviewPanel(
                'forgePreventionRuleAdder',
                'Add Prevention Rule',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: []
                }
            );

            this.panel.webview.html = this.getWebviewContent();

            this.panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'addRule': {
                        const success = await this.addPreventionRule(message.ruleData);
                        resolve(success);
                        this.panel?.dispose();
                        break;
                    }
                    case 'cancel': {
                        resolve(false);
                        this.panel?.dispose();
                        break;
                    }
                }
            });

            this.panel.onDidDispose(() => {
                resolve(false);
            });
        });
    }

    private async addPreventionRule(ruleData: any): Promise<boolean> {
        try {
            if (!vscode.workspace.workspaceFolders) {
                const openFolder = await vscode.window.showInformationMessage(
                    '📁 FORGE precisa de uma pasta de projeto para adicionar regras de prevenção.\n\nAbra uma pasta primeiro.',
                    'Abrir Pasta', 'Cancelar'
                );
                
                if (openFolder === 'Abrir Pasta') {
                    try {
                        await vscode.commands.executeCommand('vscode.openFolder');
                    } catch (error) {
                        // Silently handle error - user can open folder manually
                        vscode.window.showInformationMessage('Por favor, abra uma pasta manualmente via File > Open Folder');
                    }
                }
                return false;
            }

            const rule: PreventionRule = {
                id: `manual_${Date.now()}`,
                problem: ruleData.problem,
                solution: ruleData.solution,
                category: ruleData.category as PreventionRuleCategory,
                language: ruleData.languages || [],
                framework: ruleData.frameworks || [],
                timeSaved: parseFloat(ruleData.timeSaved) || 1,
                confidence: parseInt(ruleData.confidence) || 3,
                sourceTask: 'Manual Entry',
                createdAt: new Date(),
                appliedCount: 0,
                effectiveness: 0.8,
                tags: this.extractTags(ruleData.problem, ruleData.solution)
            };

            // Save to prevention rules file
            await this.savePreventionRule(rule);

            vscode.window.showInformationMessage(
                `Prevention rule added successfully!`,
                'View Rules',
                'Update Copilot Context'
            ).then(choice => {
                if (choice === 'View Rules') {
                    // Focus on prevention rules view
                    vscode.commands.executeCommand('forgePreventionRules.focus');
                } else if (choice === 'Update Copilot Context') {
                    vscode.commands.executeCommand('forge.updateCopilotContext');
                }
            });

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add prevention rule: ${error}`);
            return false;
        }
    }

    private async savePreventionRule(rule: PreventionRule): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const rulesPath = require('path').join(workspaceRoot, '.forge', 'prevention-rules.json');
        const fs = require('fs-extra');

        // Ensure .forge directory exists
        await fs.ensureDir(require('path').join(workspaceRoot, '.forge'));

        let existingRules: PreventionRule[] = [];
        
        // Load existing rules
        if (fs.existsSync(rulesPath)) {
            try {
                const content = fs.readFileSync(rulesPath, 'utf8');
                existingRules = JSON.parse(content);
            } catch (error) {
                console.warn('Error reading existing prevention rules, creating new file');
                existingRules = [];
            }
        }

        // Add new rule
        existingRules.push(rule);

        // Save back to file
        fs.writeFileSync(rulesPath, JSON.stringify(existingRules, null, 2), 'utf8');
    }

    private extractTags(problem: string, solution: string): string[] {
        const text = `${problem} ${solution}`.toLowerCase();
        const tags: string[] = [];
        
        // Extract common technical terms
        const techTerms = [
            'javascript', 'typescript', 'python', 'java', 'csharp', 'rust', 'go',
            'react', 'vue', 'angular', 'svelte', 'express', 'django', 'flask', 'fastapi',
            'database', 'sql', 'nosql', 'redis', 'mongodb', 'postgresql', 'mysql',
            'api', 'rest', 'graphql', 'websocket', 'http', 'https',
            'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'serverless',
            'git', 'github', 'gitlab', 'ci', 'cd', 'pipeline'
        ];
        
        techTerms.forEach(term => {
            if (text.includes(term)) {
                tags.push(term);
            }
        });
        
        return [...new Set(tags)]; // Remove duplicates
    }

    private getWebviewContent(): string {
        const categories = Object.values(PreventionRuleCategory).map(cat => {
            const displayName = cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ');
            return `<option value="${cat}">${displayName}</option>`;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Prevention Rule</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .info-box {
            background-color: var(--vscode-editorWidget-background);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border: 1px solid var(--vscode-widget-border);
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input, textarea, select {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        textarea {
            height: 60px;
            resize: vertical;
        }
        .inline-group {
            display: flex;
            gap: 15px;
        }
        .inline-group .form-group {
            flex: 1;
        }
        .small-input {
            width: 80px;
        }
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .example {
            font-style: italic;
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-top: 5px;
        }
        .confidence-labels {
            display: flex;
            justify-content: space-between;
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <h1>🛡️ Add Prevention Rule</h1>
    
    <div class="info-box">
        <p><strong>Prevention Rules</strong> help GitHub Copilot avoid common mistakes by documenting problems and their solutions.</p>
        <p><strong>Format:</strong> ❌ DON'T [problem] → [solution]</p>
    </div>
    
    <form id="ruleForm">
        <div class="form-group">
            <label for="problem">Problem (What NOT to do) *</label>
            <textarea id="problem" placeholder="e.g., use datetime.utcnow() without timezone" required></textarea>
            <div class="example">Example: "use SELECT * in production queries"</div>
        </div>
        
        <div class="form-group">
            <label for="solution">Solution (What TO do instead) *</label>
            <textarea id="solution" placeholder="e.g., use datetime.now(timezone.utc) for timezone-aware timestamps" required></textarea>
            <div class="example">Example: "specify exact columns needed: SELECT id, name, email"</div>
        </div>
        
        <div class="form-group">
            <label for="category">Category *</label>
            <select id="category" required>
                <option value="">Select a category...</option>
                ${categories}
            </select>
        </div>
        
        <div class="inline-group">
            <div class="form-group">
                <label for="languages">Languages (comma-separated)</label>
                <input type="text" id="languages" placeholder="e.g., python, javascript, typescript">
                <div class="example">Leave empty if applicable to all languages</div>
            </div>
            
            <div class="form-group">
                <label for="frameworks">Frameworks (comma-separated)</label>
                <input type="text" id="frameworks" placeholder="e.g., react, django, express">
                <div class="example">Leave empty if applicable to all frameworks</div>
            </div>
        </div>
        
        <div class="inline-group">
            <div class="form-group">
                <label for="timeSaved">Time Saved (hours)</label>
                <input type="number" id="timeSaved" class="small-input" min="0.1" step="0.1" value="1">
                <div class="example">Estimated time this rule saves</div>
            </div>
            
            <div class="form-group">
                <label for="confidence">Confidence Level</label>
                <input type="range" id="confidence" min="1" max="5" value="4" step="1">
                <div class="confidence-labels">
                    <span>1 (Low)</span>
                    <span id="confidenceValue">4</span>
                    <span>5 (High)</span>
                </div>
                <div class="example">How confident are you this prevents issues?</div>
            </div>
        </div>
        
        <div class="button-group">
            <button type="submit">Add Prevention Rule</button>
            <button type="button" id="cancelBtn" class="secondary">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Update confidence display
        document.getElementById('confidence').addEventListener('input', (e) => {
            document.getElementById('confidenceValue').textContent = e.target.value;
        });
        
        document.getElementById('ruleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const languages = document.getElementById('languages').value
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);
                
            const frameworks = document.getElementById('frameworks').value
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);
            
            const ruleData = {
                problem: document.getElementById('problem').value,
                solution: document.getElementById('solution').value,
                category: document.getElementById('category').value,
                languages: languages,
                frameworks: frameworks,
                timeSaved: document.getElementById('timeSaved').value,
                confidence: document.getElementById('confidence').value
            };
            
            if (!ruleData.problem || !ruleData.solution || !ruleData.category) {
                alert('Please fill in all required fields');
                return;
            }
            
            vscode.postMessage({
                command: 'addRule',
                ruleData: ruleData
            });
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
    </script>
</body>
</html>`;
    }
}
