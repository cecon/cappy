import * as vscode from 'vscode';
import * as path from 'path';
import { FileManager } from '../utils/fileManager';

export class ForgeDashboard {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private fileManager: FileManager;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.fileManager = new FileManager();
    }

    public show(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'forgeDashboard',
            'FORGE Dashboard',
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
                case 'loadDashboard':
                    await this.loadDashboardData();
                    break;
                case 'createTask':
                    await vscode.commands.executeCommand('forge.createTask');
                    break;
                case 'addPreventionRule':
                    await vscode.commands.executeCommand('forge.addPreventionRule');
                    break;
                case 'updateCopilotContext':
                    await vscode.commands.executeCommand('forge.updateCopilotContext');
                    break;
                case 'exportRules':
                    await vscode.commands.executeCommand('forge.exportRules');
                    break;
            }
        });

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // Load initial data
        this.loadDashboardData();
    }

    private async loadDashboardData(): Promise<void> {
        try {
            const data = await this.collectDashboardData();
            
            if (this.panel) {
                this.panel.webview.postMessage({
                    command: 'updateDashboard',
                    data: data
                });
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    private async collectDashboardData(): Promise<any> {
        if (!vscode.workspace.workspaceFolders) {
            return { error: 'No workspace folder found' };
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        
        // Get project info
        const config = await this.fileManager.readForgeConfig();
        const languages = await this.fileManager.getProjectLanguages();
        const frameworks = await this.fileManager.getProjectFrameworks();

        // Get task metrics
        const taskMetrics = await this.getTaskMetrics();
        
        // Get prevention rules stats
        const preventionRulesStats = await this.getPreventionRulesStats();

        // Get recent activity
        const recentActivity = await this.getRecentActivity();

        return {
            project: {
                name: config?.project.name || path.basename(workspaceRoot),
                languages,
                frameworks,
                description: config?.project.description || 'No description available'
            },
            taskMetrics,
            preventionRulesStats,
            recentActivity,
            copilotContext: {
                lastUpdated: await this.getCopilotContextLastUpdated(),
                rulesCount: preventionRulesStats.totalRules
            }
        };
    }

    private async getTaskMetrics(): Promise<any> {
        const taskFolders = await this.fileManager.getTaskFolders();
        let activeTasks = 0;
        let completedTasks = 0;
        let totalEstimated = 0;
        let totalActual = 0;
        const tasks = [];

        const fs = require('fs');
        const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;

        for (const taskFolder of taskFolders) {
            const taskPath = path.join(workspaceRoot, 'tasks', taskFolder);
            const completionPath = path.join(taskPath, 'completion.md');
            const descriptionPath = path.join(taskPath, 'description.md');

            const isCompleted = fs.existsSync(completionPath) && 
                               fs.readFileSync(completionPath, 'utf8').trim().length > 0;

            if (isCompleted) {
                completedTasks++;
            } else {
                activeTasks++;
            }

            // Extract estimated hours
            if (fs.existsSync(descriptionPath)) {
                const descContent = fs.readFileSync(descriptionPath, 'utf8');
                const hoursMatch = RegExp(/estimated.*?(\d+(?:\.\d+)?)\s*h/i).exec(descContent);
                if (hoursMatch) {
                    const estimated = parseFloat(hoursMatch[1]);
                    totalEstimated += estimated;

                    if (isCompleted) {
                        // Try to extract actual hours from completion
                        const compContent = fs.readFileSync(completionPath, 'utf8');
                        const actualMatch = RegExp(/actual.*?(\d+(?:\.\d+)?)\s*h/i).exec(compContent);
                        if (actualMatch) {
                            totalActual += parseFloat(actualMatch[1]);
                        } else {
                            totalActual += estimated; // Fallback
                        }
                    }
                }
            }

            tasks.push({
                name: taskFolder.replace(/^TASK_\d+_/, '').replace(/_/g, ' '),
                isCompleted,
                folder: taskFolder
            });
        }

        const variance = totalActual - totalEstimated;
        const atomicitySuccess = completedTasks > 0 ? 
            Math.round((completedTasks / (activeTasks + completedTasks)) * 100) : 0;

        return {
            totalTasks: activeTasks + completedTasks,
            activeTasks,
            completedTasks,
            totalEstimated: Math.round(totalEstimated * 10) / 10,
            totalActual: Math.round(totalActual * 10) / 10,
            variance: Math.round(variance * 10) / 10,
            atomicitySuccess,
            tasks: tasks.slice(-10) // Last 10 tasks
        };
    }

    private async getPreventionRulesStats(): Promise<any> {
        const rules = await this.loadPreventionRules();
        const rulesByCategory: Record<string, number> = {};
        let totalTimeSaved = 0;

        rules.forEach(rule => {
            const category = rule.category.toString();
            rulesByCategory[category] = (rulesByCategory[category] || 0) + 1;
            totalTimeSaved += rule.timeSaved || 1;
        });

        return {
            totalRules: rules.length,
            rulesByCategory,
            totalTimeSaved: Math.round(totalTimeSaved * 10) / 10,
            averageEffectiveness: rules.length > 0 ? 
                Math.round((rules.reduce((sum, r) => sum + (r.effectiveness || 0.8), 0) / rules.length) * 100) : 0,
            mostEffectiveRules: rules
                .sort((a, b) => (b.effectiveness || 0) - (a.effectiveness || 0))
                .slice(0, 5)
        };
    }

    private async loadPreventionRules(): Promise<any[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const rulesPath = path.join(workspaceRoot, '.forge', 'prevention-rules.json');
        const fs = require('fs');

        if (!fs.existsSync(rulesPath)) {
            return [];
        }

        try {
            const content = fs.readFileSync(rulesPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return [];
        }
    }

    private async getRecentActivity(): Promise<any[]> {
        const activities = [];
        const taskFolders = await this.fileManager.getTaskFolders();
        const fs = require('fs');
        const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;

        // Sort by modification date
        const sortedFolders = taskFolders
            .map(folder => {
                const taskPath = path.join(workspaceRoot, 'tasks', folder);
                const stats = fs.statSync(taskPath);
                return { folder, mtime: stats.mtime };
            })
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
            .slice(0, 10);

        for (const { folder, mtime } of sortedFolders) {
            const taskPath = path.join(workspaceRoot, 'tasks', folder);
            const completionPath = path.join(taskPath, 'completion.md');
            
            const isCompleted = fs.existsSync(completionPath) && 
                               fs.readFileSync(completionPath, 'utf8').trim().length > 0;

            activities.push({
                type: isCompleted ? 'completed' : 'created',
                taskName: folder.replace(/^TASK_\d+_/, '').replace(/_/g, ' '),
                date: mtime.toISOString().split('T')[0],
                folder
            });
        }

        return activities;
    }

    private async getCopilotContextLastUpdated(): Promise<string> {
        try {
            const instructionsPath = await this.fileManager.getCopilotInstructionsPath();
            const fs = require('fs');
            
            if (fs.existsSync(instructionsPath)) {
                const stats = fs.statSync(instructionsPath);
                return stats.mtime.toISOString().split('T')[0];
            }
        } catch (error) {
            // Ignore error
        }
        return 'Never';
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FORGE Dashboard</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
        }
        .actions {
            display: flex;
            gap: 10px;
        }
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 20px;
        }
        .card h3 {
            margin: 0 0 15px 0;
            color: var(--vscode-foreground);
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .metric-value {
            font-weight: bold;
        }
        .positive { color: var(--vscode-terminal-ansiGreen); }
        .negative { color: var(--vscode-terminal-ansiRed); }
        .neutral { color: var(--vscode-foreground); }
        .progress-bar {
            background-color: var(--vscode-progressBar-background);
            height: 6px;
            border-radius: 3px;
            margin: 10px 0;
        }
        .progress-fill {
            background-color: var(--vscode-progressBar-background);
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        .category-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .category-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .activity-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .activity-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .activity-type {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
        }
        .completed { background-color: var(--vscode-terminal-ansiGreen); color: black; }
        .created { background-color: var(--vscode-terminal-ansiBlue); color: white; }
        .loading {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        .project-info {
            grid-column: 1 / -1;
            text-align: center;
            padding: 15px;
        }
        .project-info h2 {
            margin: 0 0 10px 0;
        }
        .project-details {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🔨 FORGE Dashboard</div>
        <div class="actions">
            <button onclick="createTask()">New Task</button>
            <button onclick="addPreventionRule()" class="secondary">Add Rule</button>
            <button onclick="updateCopilotContext()" class="secondary">Update Context</button>
            <button onclick="exportRules()" class="secondary">Export</button>
        </div>
    </div>

    <div id="content" class="loading">
        <p>Loading dashboard data...</p>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function createTask() {
            vscode.postMessage({ command: 'createTask' });
        }
        
        function addPreventionRule() {
            vscode.postMessage({ command: 'addPreventionRule' });
        }
        
        function updateCopilotContext() {
            vscode.postMessage({ command: 'updateCopilotContext' });
        }
        
        function exportRules() {
            vscode.postMessage({ command: 'exportRules' });
        }
        
        function formatCategoryName(category) {
            return category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ');
        }
        
        function renderDashboard(data) {
            const content = document.getElementById('content');
            
            if (data.error) {
                content.innerHTML = \`<div class="card"><h3>Error</h3><p>\${data.error}</p></div>\`;
                return;
            }
            
            const varianceClass = data.taskMetrics.variance > 0 ? 'negative' : 
                                  data.taskMetrics.variance < 0 ? 'positive' : 'neutral';
            
            content.innerHTML = \`
                <div class="grid">
                    <div class="card project-info">
                        <h2>\${data.project.name}</h2>
                        <div class="project-details">
                            <strong>Languages:</strong> \${data.project.languages.join(', ') || 'None detected'}<br>
                            <strong>Frameworks:</strong> \${data.project.frameworks.join(', ') || 'None detected'}<br>
                            <strong>Description:</strong> \${data.project.description}
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>📊 Task Metrics</h3>
                        <div class="metric">
                            <span>Total Tasks:</span>
                            <span class="metric-value">\${data.taskMetrics.totalTasks}</span>
                        </div>
                        <div class="metric">
                            <span>Active:</span>
                            <span class="metric-value">\${data.taskMetrics.activeTasks}</span>
                        </div>
                        <div class="metric">
                            <span>Completed:</span>
                            <span class="metric-value">\${data.taskMetrics.completedTasks}</span>
                        </div>
                        <div class="metric">
                            <span>Time Variance:</span>
                            <span class="metric-value \${varianceClass}">\${data.taskMetrics.variance}h</span>
                        </div>
                        <div class="metric">
                            <span>Atomicity Success:</span>
                            <span class="metric-value">\${data.taskMetrics.atomicitySuccess}%</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>🛡️ Prevention Rules</h3>
                        <div class="metric">
                            <span>Total Rules:</span>
                            <span class="metric-value">\${data.preventionRulesStats.totalRules}</span>
                        </div>
                        <div class="metric">
                            <span>Time Saved:</span>
                            <span class="metric-value positive">\${data.preventionRulesStats.totalTimeSaved}h</span>
                        </div>
                        <div class="metric">
                            <span>Avg Effectiveness:</span>
                            <span class="metric-value">\${data.preventionRulesStats.averageEffectiveness}%</span>
                        </div>
                        
                        <h4>By Category:</h4>
                        <ul class="category-list">
                            \${Object.entries(data.preventionRulesStats.rulesByCategory)
                                .map(([cat, count]) => \`
                                    <li class="category-item">
                                        <span>\${formatCategoryName(cat)}</span>
                                        <span>\${count}</span>
                                    </li>
                                \`).join('')}
                        </ul>
                    </div>
                    
                    <div class="card">
                        <h3>🤖 Copilot Integration</h3>
                        <div class="metric">
                            <span>Last Updated:</span>
                            <span class="metric-value">\${data.copilotContext.lastUpdated}</span>
                        </div>
                        <div class="metric">
                            <span>Rules in Context:</span>
                            <span class="metric-value">\${data.copilotContext.rulesCount}</span>
                        </div>
                        <button onclick="updateCopilotContext()" style="margin-top: 10px; width: 100%;">
                            Update Copilot Context
                        </button>
                    </div>
                    
                    <div class="card">
                        <h3>📈 Recent Activity</h3>
                        <ul class="activity-list">
                            \${data.recentActivity.slice(0, 8).map(activity => \`
                                <li class="activity-item">
                                    <div>
                                        <span class="activity-type \${activity.type}">\${activity.type}</span>
                                        <span>\${activity.taskName}</span>
                                    </div>
                                    <span>\${activity.date}</span>
                                </li>
                            \`).join('')}
                        </ul>
                    </div>
                </div>
            \`;
        }
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.command === 'updateDashboard') {
                renderDashboard(message.data);
            }
        });
        
        // Request initial data
        vscode.postMessage({ command: 'loadDashboard' });
    </script>
</body>
</html>`;
    }
}
