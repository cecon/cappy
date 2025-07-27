import * as vscode from 'vscode';
import * as path from 'path';
import { FileManager } from '../utils/fileManager';
import { Task, TaskStatus } from '../models/task';

export class TaskCreator {
    private fileManager: FileManager;
    private panel: vscode.WebviewPanel | undefined;

    constructor() {
        this.fileManager = new FileManager();
    }

    public async show(): Promise<boolean> {
        return new Promise((resolve) => {
            this.panel = vscode.window.createWebviewPanel(
                'forgeTaskCreator',
                'Create FORGE Task',
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
                    case 'createTask':
                        const success = await this.createTask(message.taskData);
                        resolve(success);
                        this.panel?.dispose();
                        break;
                    case 'analyzeAtomicity':
                        const analysis = await this.analyzeAtomicity(message.description);
                        this.panel?.webview.postMessage({
                            command: 'atomicityResult',
                            result: analysis
                        });
                        break;
                    case 'cancel':
                        resolve(false);
                        this.panel?.dispose();
                        break;
                }
            });

            this.panel.onDidDispose(() => {
                resolve(false);
            });
        });
    }

    private async createTask(taskData: any): Promise<boolean> {
        try {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder found');
                return false;
            }

            // Generate task ID
            const taskId = await this.generateTaskId(taskData.name);
            
            // Create task folder
            const taskPath = await this.fileManager.createTaskFolder(taskId);

            // Create task object
            const task: Task = {
                id: taskId,
                name: taskData.name,
                description: taskData.description,
                status: TaskStatus.ACTIVE,
                estimatedHours: taskData.estimatedHours,
                createdAt: new Date(),
                path: taskPath,
                artifacts: [],
                difficulties: [],
                preventionRules: [],
                atomicity: {
                    isAtomic: taskData.estimatedHours <= 3,
                    estimatedHours: taskData.estimatedHours,
                    confidence: 0.8,
                    suggestions: taskData.atomicitySuggestions || []
                }
            };

            // Generate task files from templates
            await this.generateTaskFiles(taskPath, task, taskData);

            // Show success message and open description
            vscode.window.showInformationMessage(
                `Task "${task.name}" created successfully!`,
                'Open Description',
                'Open Folder'
            ).then(choice => {
                if (choice === 'Open Description') {
                    const descriptionPath = vscode.Uri.file(path.join(taskPath, 'description.md'));
                    vscode.window.showTextDocument(descriptionPath);
                } else if (choice === 'Open Folder') {
                    vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(taskPath));
                }
            });

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create task: ${error}`);
            return false;
        }
    }

    private async generateTaskId(taskName: string): Promise<string> {
        const taskFolders = await this.fileManager.getTaskFolders();
        
        // Find next task number
        let maxNumber = 0;
        for (const folder of taskFolders) {
            const match = folder.match(/^TASK_(\d+)_/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumber) {
                    maxNumber = num;
                }
            }
        }

        const nextNumber = maxNumber + 1;
        const sanitizedName = taskName
            .toUpperCase()
            .replace(/[^A-Z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 30);

        return `TASK_${nextNumber.toString().padStart(2, '0')}_${sanitizedName}`;
    }

    private async generateTaskFiles(taskPath: string, task: Task, taskData: any): Promise<void> {
        // Load templates
        const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const templatesPath = path.join(workspaceRoot, '.forge', 'templates');
        
        const fs = require('fs');
        
        // Generate description.md
        let descriptionTemplate = '';
        const descriptionTemplatePath = path.join(templatesPath, 'description.md');
        if (fs.existsSync(descriptionTemplatePath)) {
            descriptionTemplate = fs.readFileSync(descriptionTemplatePath, 'utf8');
        } else {
            descriptionTemplate = this.getDefaultDescriptionTemplate();
        }

        const relevantRules = await this.getRelevantPreventionRules(taskData.description);
        const rulesText = relevantRules.length > 0 
            ? relevantRules.map(rule => `- ❌ DON'T ${rule.problem} → ${rule.solution}`).join('\n')
            : '- No relevant prevention rules found yet';

        const descriptionContent = this.replaceTemplateVariables(descriptionTemplate, {
            TASK_NAME: task.name,
            TASK_DESCRIPTION: taskData.description,
            ESTIMATED_HOURS: task.estimatedHours.toString(),
            ATOMICITY_STATUS: task.atomicity.isAtomic ? '✅ Atomic (≤3h)' : '❌ Not Atomic (>3h)',
            PREVENTION_RULES: rulesText,
            CREATED_DATE: new Date().toISOString().split('T')[0]
        });

        await this.fileManager.writeTaskFile(taskPath, 'description.md', descriptionContent);

        // Create empty completion.md
        await this.fileManager.writeTaskFile(taskPath, 'completion.md', '');

        // Generate difficulties.md template
        let difficultiesTemplate = '';
        const difficultiesTemplatePath = path.join(templatesPath, 'difficulties.md');
        if (fs.existsSync(difficultiesTemplatePath)) {
            difficultiesTemplate = fs.readFileSync(difficultiesTemplatePath, 'utf8');
        } else {
            difficultiesTemplate = this.getDefaultDifficultiesTemplate();
        }

        const difficultiesContent = this.replaceTemplateVariables(difficultiesTemplate, {
            TASK_NAME: task.name
        });

        await this.fileManager.writeTaskFile(taskPath, 'difficulties.md', difficultiesContent);
    }

    private async getRelevantPreventionRules(description: string): Promise<any[]> {
        // Simple keyword matching for now
        // In a more advanced version, this could use semantic similarity
        const keywords = description.toLowerCase().split(/\s+/);
        
        // This would typically load from prevention rules provider
        // For now, return empty array
        return [];
    }

    private replaceTemplateVariables(template: string, variables: Record<string, string>): string {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value);
        }
        return result;
    }

    private async analyzeAtomicity(description: string): Promise<any> {
        // Simple heuristic for atomicity analysis
        const wordCount = description.split(/\s+/).length;
        const complexity = this.estimateComplexity(description);
        
        let estimatedHours = 1;
        
        // Heuristic based on description length and complexity
        if (wordCount > 50) estimatedHours += 1;
        if (wordCount > 100) estimatedHours += 1;
        if (complexity > 3) estimatedHours += complexity - 3;

        const isAtomic = estimatedHours <= 3;
        const suggestions = [];

        if (!isAtomic) {
            suggestions.push('Consider breaking this task into smaller parts');
            suggestions.push('Each part should be implementable in ≤3 hours');
            suggestions.push('Focus on one specific feature or component');
        }

        return {
            estimatedHours,
            isAtomic,
            confidence: 0.7,
            suggestions
        };
    }

    private estimateComplexity(description: string): number {
        const complexityKeywords = [
            'database', 'migration', 'authentication', 'authorization', 'security',
            'performance', 'optimization', 'algorithm', 'integration', 'api',
            'microservice', 'distributed', 'concurrent', 'parallel', 'async'
        ];

        let complexity = 1;
        const lowerDesc = description.toLowerCase();
        
        for (const keyword of complexityKeywords) {
            if (lowerDesc.includes(keyword)) {
                complexity += 0.5;
            }
        }

        return Math.min(complexity, 5);
    }

    private getDefaultDescriptionTemplate(): string {
        return `# Task: {{TASK_NAME}}

## 🎯 Objective
{{TASK_DESCRIPTION}}

## 📋 Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## 🚫 Prevention Rules to Apply
{{PREVENTION_RULES}}

## ⏱️ Time Estimation
**Estimated:** {{ESTIMATED_HOURS}} hours
**Atomicity:** {{ATOMICITY_STATUS}}

## ✅ Definition of Done
- [ ] Code implemented and tested
- [ ] Documentation updated
- [ ] No linting errors

---
*Created: {{CREATED_DATE}}*
`;
    }

    private getDefaultDifficultiesTemplate(): string {
        return `# Difficulties & Prevention Rules: {{TASK_NAME}}

## 🚨 Problems Encountered

*Add problems here as they occur during development*

### Example Problem
**Issue:** Description of what went wrong
**Impact:** Time lost, what broke
**Root Cause:** Why this happened

**Prevention Rule:**
❌ DON'T [what not to do] → [what to do instead]

---

*Note: Add prevention rules in the format "❌ DON'T [problem] → [solution]" for automatic Copilot integration*
`;
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create FORGE Task</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input, textarea {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        textarea {
            height: 80px;
            resize: vertical;
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
        .atomicity-result {
            margin-top: 10px;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid var(--vscode-input-border);
        }
        .atomic {
            background-color: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-terminal-ansiBlack);
        }
        .non-atomic {
            background-color: var(--vscode-terminal-ansiRed);
            color: var(--vscode-terminal-ansiWhite);
        }
        ul {
            margin: 5px 0;
            padding-left: 20px;
        }
    </style>
</head>
<body>
    <h1>🔨 Create New FORGE Task</h1>
    
    <form id="taskForm">
        <div class="form-group">
            <label for="taskName">Task Name *</label>
            <input type="text" id="taskName" placeholder="e.g., Add user authentication" required>
        </div>
        
        <div class="form-group">
            <label for="taskDescription">Description *</label>
            <textarea id="taskDescription" placeholder="Describe what needs to be implemented..." required></textarea>
        </div>
        
        <div class="form-group">
            <label for="estimatedHours">Estimated Hours</label>
            <input type="number" id="estimatedHours" min="0.5" max="10" step="0.5" value="2">
        </div>
        
        <button type="button" id="analyzeBtn" class="secondary">🔍 Analyze Atomicity</button>
        
        <div id="atomicityResult" style="display: none;"></div>
        
        <div class="button-group">
            <button type="submit">Create Task</button>
            <button type="button" id="cancelBtn" class="secondary">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const taskData = {
                name: document.getElementById('taskName').value,
                description: document.getElementById('taskDescription').value,
                estimatedHours: parseFloat(document.getElementById('estimatedHours').value)
            };
            
            if (!taskData.name || !taskData.description) {
                alert('Please fill in all required fields');
                return;
            }
            
            vscode.postMessage({
                command: 'createTask',
                taskData: taskData
            });
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
        
        document.getElementById('analyzeBtn').addEventListener('click', () => {
            const description = document.getElementById('taskDescription').value;
            if (!description) {
                alert('Please enter a task description first');
                return;
            }
            
            vscode.postMessage({
                command: 'analyzeAtomicity',
                description: description
            });
        });
        
        window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.command === 'atomicityResult') {
                const result = message.result;
                const resultDiv = document.getElementById('atomicityResult');
                
                resultDiv.style.display = 'block';
                resultDiv.className = 'atomicity-result ' + (result.isAtomic ? 'atomic' : 'non-atomic');
                
                let html = \`<strong>\${result.isAtomic ? '✅ Atomic' : '❌ Not Atomic'}</strong><br>\`;
                html += \`Estimated: \${result.estimatedHours} hours<br>\`;
                html += \`Confidence: \${Math.round(result.confidence * 100)}%\`;
                
                if (result.suggestions && result.suggestions.length > 0) {
                    html += '<br><strong>Suggestions:</strong><ul>';
                    result.suggestions.forEach(suggestion => {
                        html += \`<li>\${suggestion}</li>\`;
                    });
                    html += '</ul>';
                }
                
                resultDiv.innerHTML = html;
                
                // Update estimated hours
                document.getElementById('estimatedHours').value = result.estimatedHours;
            }
        });
    </script>
</body>
</html>`;
    }

    // New methods for Smart Task Creation
    public async showWithPrefill(taskDetails: any): Promise<boolean> {
        return new Promise((resolve) => {
            this.panel = vscode.window.createWebviewPanel(
                'forgeTaskCreator',
                'Create FORGE Task',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: []
                }
            );

            this.panel.webview.html = this.getWebviewContentWithPrefill(taskDetails);

            this.panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'createTask':
                        const success = await this.createTask(message.taskData);
                        resolve(success);
                        this.panel?.dispose();
                        break;
                    case 'analyzeAtomicity':
                        const analysis = await this.analyzeAtomicity(message.description);
                        this.panel?.webview.postMessage({
                            command: 'atomicityResult',
                            result: analysis
                        });
                        break;
                    case 'cancel':
                        resolve(false);
                        this.panel?.dispose();
                        break;
                }
            });

            this.panel.onDidDispose(() => {
                resolve(false);
            });
        });
    }

    public async createTaskWithData(taskDetails: any): Promise<boolean> {
        const taskData = {
            name: taskDetails.name,
            description: taskDetails.description,
            estimatedHours: taskDetails.estimatedHours,
            priority: taskDetails.priority,
            category: taskDetails.category,
            atomicitySuggestions: taskDetails.subtasks || []
        };

        return await this.createTask(taskData);
    }

    private getWebviewContentWithPrefill(taskDetails: any): string {
        const content = this.getWebviewContent();
        
        // Replace the empty values with prefilled data
        return content
            .replace('id="taskName" placeholder="e.g. Add user authentication"', 
                    `id="taskName" placeholder="e.g. Add user authentication" value="${taskDetails.name}"`)
            .replace('id="description" placeholder="Describe what needs to be implemented...">', 
                    `id="description" placeholder="Describe what needs to be implemented...">${taskDetails.description}`)
            .replace('id="estimatedHours" value="2"', 
                    `id="estimatedHours" value="${taskDetails.estimatedHours}"`)
            .replace('<option value="Medium" selected>Medium</option>', 
                    `<option value="${taskDetails.priority}" selected>${taskDetails.priority}</option>`);
    }
}
