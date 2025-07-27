import * as vscode from 'vscode';
import * as path from 'path';
import { FileManager } from '../utils/fileManager';
import { Task, TaskStatus } from '../models/task';

export class TaskCompleter {
    private fileManager: FileManager;
    private panel: vscode.WebviewPanel | undefined;

    constructor() {
        this.fileManager = new FileManager();
    }

    public async show(taskItem?: any): Promise<boolean> {
        let selectedTask: Task | null = null;

        // If no task provided, let user select one
        if (!taskItem) {
            selectedTask = await this.selectActiveTask();
            if (!selectedTask) {
                return false;
            }
        } else {
            selectedTask = taskItem.task;
        }

        if (!selectedTask) {
            vscode.window.showErrorMessage('No task selected');
            return false;
        }

        return new Promise((resolve) => {
            this.panel = vscode.window.createWebviewPanel(
                'forgeTaskCompleter',
                `Complete Task: ${selectedTask!.name}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: []
                }
            );

            this.panel.webview.html = this.getWebviewContent(selectedTask!);

            this.panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'completeTask': {
                        const success = await this.completeTask(selectedTask!, message.completionData);
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

    private async selectActiveTask(): Promise<Task | null> {
        const taskFolders = await this.fileManager.getTaskFolders();
        const activeTasks: Task[] = [];

        // Load active tasks
        for (const taskFolder of taskFolders) {
            const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
            const taskPath = path.join(workspaceRoot, 'tasks', taskFolder);
            const completionPath = path.join(taskPath, 'completion.md');

            const fs = require('fs');
            
            // Check if task is active (no completion.md or empty)
            if (!fs.existsSync(completionPath) || fs.readFileSync(completionPath, 'utf8').trim().length === 0) {
                // Load task details
                const task = await this.loadTaskFromFolder(taskPath, taskFolder);
                if (task) {
                    activeTasks.push(task);
                }
            }
        }

        if (activeTasks.length === 0) {
            vscode.window.showInformationMessage('No active tasks found');
            return null;
        }

        if (activeTasks.length === 1) {
            return activeTasks[0];
        }

        // Let user pick from multiple active tasks
        const taskItems = activeTasks.map(task => ({
            label: task.name,
            description: `${task.estimatedHours}h estimated`,
            task: task
        }));

        const selected = await vscode.window.showQuickPick(taskItems, {
            placeHolder: 'Select a task to complete'
        });

        return selected ? selected.task : null;
    }

    private async loadTaskFromFolder(taskPath: string, taskFolder: string): Promise<Task | null> {
        try {
            const fs = require('fs');
            const descriptionPath = path.join(taskPath, 'description.md');

            if (!fs.existsSync(descriptionPath)) {
                return null;
            }

            const taskId = taskFolder;
            const namePart = taskFolder.replace(/^TASK_\d+_/, '').replace(/_/g, ' ');
            const taskName = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();

            const descriptionContent = fs.readFileSync(descriptionPath, 'utf8');
            let estimatedHours = 3;

            const hoursMatch = RegExp(/estimated.*?(\d+(?:\.\d+)?)\s*h/i).exec(descriptionContent);
            if (hoursMatch) {
                estimatedHours = parseFloat(hoursMatch[1]);
            }

            const task: Task = {
                id: taskId,
                name: taskName,
                description: descriptionContent,
                status: TaskStatus.ACTIVE,
                estimatedHours,
                createdAt: new Date(),
                path: taskPath,
                artifacts: [],
                difficulties: [],
                preventionRules: [],
                atomicity: {
                    isAtomic: estimatedHours <= 3,
                    estimatedHours,
                    confidence: 0.8
                }
            };

            return task;
        } catch (error) {
            console.error(`Error loading task from ${taskPath}:`, error);
            return null;
        }
    }

    private async completeTask(task: Task, completionData: any): Promise<boolean> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
            const templatesPath = path.join(workspaceRoot, '.forge', 'templates');
            const fs = require('fs');

            // Generate completion.md content
            let completionTemplate = '';
            const completionTemplatePath = path.join(templatesPath, 'completion.md');
            if (fs.existsSync(completionTemplatePath)) {
                completionTemplate = fs.readFileSync(completionTemplatePath, 'utf8');
            } else {
                completionTemplate = this.getDefaultCompletionTemplate();
            }

            const actualHours = parseFloat(completionData.actualHours) || task.estimatedHours;
            const variance = actualHours - task.estimatedHours;
            const variancePercentage = Math.round((variance / task.estimatedHours) * 100);

            const completionContent = this.replaceTemplateVariables(completionTemplate, {
                TASK_NAME: task.name,
                ESTIMATED_HOURS: task.estimatedHours.toString(),
                ACTUAL_HOURS: actualHours.toString(),
                VARIANCE: variance > 0 ? `+${variance}h` : `${variance}h`,
                VARIANCE_PERCENTAGE: variance > 0 ? `+${variancePercentage}%` : `${variancePercentage}%`,
                COMPLETED_DATE: new Date().toISOString().split('T')[0],
                ACCOMPLISHMENTS: completionData.accomplishments || 'Task completed successfully',
                TECHNOLOGIES: completionData.technologies || 'Standard project technologies',
                ARTIFACTS: completionData.artifacts || 'Code files created',
                LESSONS: completionData.lessons || 'Experience gained from task implementation',
                GENERATED_RULES: completionData.preventionRules || 'No new prevention rules generated'
            });

            // Write completion.md
            await this.fileManager.writeTaskFile(task.path, 'completion.md', completionContent);

            // Update task metrics in a simple metrics file
            await this.updateTaskMetrics(task, actualHours);

            vscode.window.showInformationMessage(
                `Task "${task.name}" marked as complete!`,
                'View Completion',
                'Add Prevention Rules'
            ).then(choice => {
                if (choice === 'View Completion') {
                    const completionPath = vscode.Uri.file(path.join(task.path, 'completion.md'));
                    vscode.window.showTextDocument(completionPath);
                } else if (choice === 'Add Prevention Rules') {
                    const difficultiesPath = vscode.Uri.file(path.join(task.path, 'difficulties.md'));
                    vscode.window.showTextDocument(difficultiesPath);
                }
            });

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to complete task: ${error}`);
            return false;
        }
    }

    private async updateTaskMetrics(task: Task, actualHours: number): Promise<void> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
            const metricsPath = path.join(workspaceRoot, '.forge', 'metrics.json');
            const fs = require('fs-extra');

        let metrics: {
            totalTasks: number;
            completedTasks: number;
            totalEstimatedHours: number;
            totalActualHours: number;
            tasks: Array<{
                id: string;
                name: string;
                estimatedHours: number;
                actualHours: number;
                variance: number;
                completedAt: string;
            }>;
        } = {
            totalTasks: 0,
            completedTasks: 0,
            totalEstimatedHours: 0,
            totalActualHours: 0,
            tasks: []
        };            if (fs.existsSync(metricsPath)) {
                try {
                    metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
                } catch (error) {
                    console.warn('Error reading metrics file, creating new one');
                }
            }

            metrics.completedTasks++;
            metrics.totalEstimatedHours += task.estimatedHours;
            metrics.totalActualHours += actualHours;

            metrics.tasks.push({
                id: task.id,
                name: task.name,
                estimatedHours: task.estimatedHours,
                actualHours: actualHours,
                variance: actualHours - task.estimatedHours,
                completedAt: new Date().toISOString()
            });

            fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
        } catch (error) {
            console.error('Error updating task metrics:', error);
        }
    }

    private replaceTemplateVariables(template: string, variables: Record<string, string>): string {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value);
        }
        return result;
    }

    private getDefaultCompletionTemplate(): string {
        return `# Task Completion: {{TASK_NAME}}

## ✅ What Was Accomplished
{{ACCOMPLISHMENTS}}

## 📊 Time Analysis
- **Estimated:** {{ESTIMATED_HOURS}} hours
- **Actual:** {{ACTUAL_HOURS}} hours
- **Variance:** {{VARIANCE}} ({{VARIANCE_PERCENTAGE}}%)

## 🔧 Technologies Used
{{TECHNOLOGIES}}

## 📁 Artifacts Created
{{ARTIFACTS}}

## 🎓 Lessons Learned
{{LESSONS}}

## 📈 Prevention Rules Generated
{{GENERATED_RULES}}

---
*Completed: {{COMPLETED_DATE}}*
*Total Time: {{ACTUAL_HOURS}} hours*
`;
    }

    private getWebviewContent(task: Task): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete FORGE Task</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .task-info {
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
        .time-input {
            width: 100px;
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
        .time-analysis {
            display: flex;
            gap: 20px;
            align-items: center;
        }
        .variance {
            font-weight: bold;
        }
        .positive { color: var(--vscode-terminal-ansiRed); }
        .negative { color: var(--vscode-terminal-ansiGreen); }
    </style>
</head>
<body>
    <h1>✅ Complete FORGE Task</h1>
    
    <div class="task-info">
        <h3>${task.name}</h3>
        <p><strong>Estimated:</strong> ${task.estimatedHours} hours</p>
        <p><strong>Status:</strong> ${task.atomicity.isAtomic ? '✅ Atomic' : '❌ Non-Atomic'}</p>
    </div>
    
    <form id="completionForm">
        <div class="form-group">
            <label for="actualHours">Actual Hours Spent *</label>
            <div class="time-analysis">
                <input type="number" id="actualHours" class="time-input" min="0.1" step="0.1" value="${task.estimatedHours}" required>
                <span id="variance" class="variance"></span>
            </div>
        </div>
        
        <div class="form-group">
            <label for="accomplishments">What Was Accomplished *</label>
            <textarea id="accomplishments" placeholder="Describe what you implemented, features added, problems solved..." required></textarea>
        </div>
        
        <div class="form-group">
            <label for="technologies">Technologies Used</label>
            <textarea id="technologies" placeholder="List the main technologies, libraries, frameworks used..."></textarea>
        </div>
        
        <div class="form-group">
            <label for="artifacts">Artifacts Created</label>
            <textarea id="artifacts" placeholder="List the files created, modified, or important code changes..."></textarea>
        </div>
        
        <div class="form-group">
            <label for="lessons">Lessons Learned</label>
            <textarea id="lessons" placeholder="What did you learn? What would you do differently next time?"></textarea>
        </div>
        
        <div class="form-group">
            <label for="preventionRules">Prevention Rules Generated</label>
            <textarea id="preventionRules" placeholder="Any new prevention rules? (Format: ❌ DON'T [problem] → [solution])"></textarea>
        </div>
        
        <div class="button-group">
            <button type="submit">Complete Task</button>
            <button type="button" id="cancelBtn" class="secondary">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        
        function updateVariance() {
            const estimated = ${task.estimatedHours};
            const actual = parseFloat(document.getElementById('actualHours').value) || estimated;
            const variance = actual - estimated;
            const percentage = Math.round((variance / estimated) * 100);
            
            const varianceSpan = document.getElementById('variance');
            if (variance === 0) {
                varianceSpan.textContent = 'Perfect estimate!';
                varianceSpan.className = 'variance';
            } else if (variance > 0) {
                varianceSpan.textContent = \`+\${variance}h (\${percentage > 0 ? '+' : ''}\${percentage}%)\`;
                varianceSpan.className = 'variance positive';
            } else {
                varianceSpan.textContent = \`\${variance}h (\${percentage}%)\`;
                varianceSpan.className = 'variance negative';
            }
        }
        
        document.getElementById('actualHours').addEventListener('input', updateVariance);
        updateVariance(); // Initial calculation
        
        document.getElementById('completionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const completionData = {
                actualHours: document.getElementById('actualHours').value,
                accomplishments: document.getElementById('accomplishments').value,
                technologies: document.getElementById('technologies').value,
                artifacts: document.getElementById('artifacts').value,
                lessons: document.getElementById('lessons').value,
                preventionRules: document.getElementById('preventionRules').value
            };
            
            if (!completionData.accomplishments) {
                alert('Please describe what was accomplished');
                return;
            }
            
            vscode.postMessage({
                command: 'completeTask',
                completionData: completionData
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
