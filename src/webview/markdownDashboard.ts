import * as vscode from 'vscode';
import * as path from 'path';
import { FileManager } from '../utils/fileManager';
import * as fs from 'fs-extra';

/**
 * Generates and displays a Markdown-based dashboard.
 */
export class ForgeDashboard {
    private fileManager: FileManager | undefined;

    constructor(private context: vscode.ExtensionContext) {
        try {
            this.fileManager = new FileManager();
        } catch (error) {
            // FileManager will throw if no workspace, we'll handle this in show()
            this.fileManager = undefined;
        }
    }

    public async show(): Promise<void> {
        try {
            console.log('🔨 FORGE Dashboard: Starting show() method');
            
            // Check if workspace exists
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                console.log('🔨 FORGE Dashboard: No workspace folders found');
                vscode.window.showInformationMessage(
                    "Please open a workspace folder first.",
                    'Open Folder'
                ).then(choice => {
                    if (choice === 'Open Folder') {
                        vscode.commands.executeCommand('vscode.openFolder');
                    }
                });
                return;
            }

            console.log('🔨 FORGE Dashboard: Workspace found, checking FileManager');
            
            // Initialize FileManager if not already done
            if (!this.fileManager) {
                this.fileManager = new FileManager();
            }

            console.log('🔨 FORGE Dashboard: FileManager initialized, checking FORGE config');

            // Check if FORGE is initialized
            const config = await this.fileManager.readForgeConfig();
            if (!config) {
                console.log('🔨 FORGE Dashboard: No FORGE config found');
                vscode.window.showInformationMessage(
                    "Please initialize FORGE in this workspace first by running 'FORGE: Initialize FORGE Framework'.",
                    'Initialize FORGE'
                ).then(choice => {
                    if (choice === 'Initialize FORGE') {
                        vscode.commands.executeCommand('forge.init');
                    }
                });
                return;
            }

            console.log('🔨 FORGE Dashboard: FORGE config found, generating dashboard data');
            
            const dashboardData = await this.getDashboardData();
            console.log('🔨 FORGE Dashboard: Dashboard data generated, creating markdown content');
            
            const markdownContent = this.getMarkdownContent(dashboardData);
            console.log('🔨 FORGE Dashboard: Markdown content created, opening document');

            const document = await vscode.workspace.openTextDocument({
                content: markdownContent,
                language: 'markdown'
            });
            
            console.log('🔨 FORGE Dashboard: Document created, showing in editor');
            
            await vscode.window.showTextDocument(document, {
                viewColumn: vscode.ViewColumn.One,
                preview: true
            });
            
            console.log('🔨 FORGE Dashboard: Dashboard displayed successfully');
        } catch (error) {
            console.error('🔨 FORGE Dashboard: Error in show() method:', error);
            vscode.window.showErrorMessage(`Failed to generate FORGE Dashboard: ${error}`);
        }
    }

    private getWorkspaceRoot(): string {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error("No workspace root found.");
        }
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    private async getPreventionRulesCount(): Promise<number> {
        try {
            const rulesPath = path.join(this.getWorkspaceRoot(), '.forge', 'prevention-rules.md');
            if (await fs.pathExists(rulesPath)) {
                const content = await fs.readFile(rulesPath, 'utf8');
                // Count ## headers as rules
                const rules = content.match(/^## /gm) || [];
                return rules.length;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    private async getDashboardData(): Promise<any> {
        if (!this.fileManager) {
            throw new Error("FileManager not initialized");
        }

        const workspaceRoot = this.getWorkspaceRoot();
        const config = await this.fileManager.readForgeConfig();
        const preventionRulesCount = await this.getPreventionRulesCount();
        const taskMetrics = await this.getTaskMetrics();
        const recentActivity = await this.getRecentActivity();
        const languages = await this.fileManager.getProjectLanguages();
        const frameworks = await this.fileManager.getProjectFrameworks();

        return {
            project: {
                name: config?.project.name || path.basename(workspaceRoot),
                languages,
                frameworks,
                description: config?.project.description || 'No description available'
            },
            taskMetrics,
            preventionRulesStats: {
                totalRules: preventionRulesCount
            },
            recentActivity,
            copilotContext: {
                lastUpdated: await this.getCopilotContextLastUpdated(),
                rulesCount: preventionRulesCount
            }
        };
    }

    private async getTaskMetrics(): Promise<any> {
        if (!this.fileManager) {
            throw new Error("FileManager not initialized");
        }

        const taskFolders = await this.fileManager.getTaskFolders();
        let activeTasks = 0;
        let completedTasks = 0;
        let totalEstimated = 0;
        let totalActual = 0;

        for (const taskFolder of taskFolders) {
            const taskPath = path.join(this.getWorkspaceRoot(), 'tasks', taskFolder);
            const completionPath = path.join(taskPath, 'completion.md');
            const descriptionPath = path.join(taskPath, 'description.md');

            const isCompleted = await fs.pathExists(completionPath) && 
                               (await fs.readFile(completionPath, 'utf8')).trim().length > 0;

            if (isCompleted) {
                completedTasks++;
            } else {
                activeTasks++;
            }

            // Extract estimated hours
            if (await fs.pathExists(descriptionPath)) {
                const descContent = await fs.readFile(descriptionPath, 'utf8');
                const hoursMatch = /estimated.*?(\d+(?:\.\d+)?)\s*h/i.exec(descContent);
                if (hoursMatch) {
                    const estimated = parseFloat(hoursMatch[1]);
                    totalEstimated += estimated;

                    if (isCompleted) {
                        // Try to extract actual hours from completion
                        const compContent = await fs.readFile(completionPath, 'utf8');
                        const actualHoursMatch = /actual.*?(\d+(?:\.\d+)?)\s*h/i.exec(compContent);
                        if (actualHoursMatch) {
                            totalActual += parseFloat(actualHoursMatch[1]);
                        } else {
                            totalActual += estimated; // Assume actual equals estimated if not specified
                        }
                    }
                }
            }
        }

        const variance = totalActual - totalEstimated;
        const atomicitySuccess = totalEstimated > 0 ? Math.round((1 - Math.abs(variance) / totalEstimated) * 100) : 100;

        return {
            totalTasks: taskFolders.length,
            activeTasks,
            completedTasks,
            variance: variance.toFixed(1),
            atomicitySuccess: Math.max(0, atomicitySuccess)
        };
    }

    private async getRecentActivity(): Promise<any[]> {
        if (!this.fileManager) {
            return [];
        }

        const taskFolders = await this.fileManager.getTaskFolders();
        const activities = [];

        for (const taskFolder of taskFolders.slice(-5).reverse()) {
            const taskPath = path.join(this.getWorkspaceRoot(), 'tasks', taskFolder);
            const descriptionPath = path.join(taskPath, 'description.md');
            const completionPath = path.join(taskPath, 'completion.md');

            if (await fs.pathExists(descriptionPath)) {
                const descContent = await fs.readFile(descriptionPath, 'utf8');
                const titleMatch = descContent.match(/^#\s*(.*)/m);
                const title = titleMatch ? titleMatch[1] : taskFolder;
                const isCompleted = await fs.pathExists(completionPath) && 
                                   (await fs.readFile(completionPath, 'utf8')).trim().length > 0;
                
                const stats = await fs.stat(descriptionPath);
                activities.push({
                    id: taskFolder,
                    title,
                    status: isCompleted ? 'Completed' : 'Active',
                    date: stats.mtime.toLocaleDateString()
                });
            }
        }
        return activities;
    }

    private async getCopilotContextLastUpdated(): Promise<string> {
        try {
            const contextPath = path.join(this.getWorkspaceRoot(), '.forge', 'copilot-instructions.md');
            const stats = await fs.stat(contextPath);
            return stats.mtime.toLocaleString();
        } catch (error) {
            return 'Never';
        }
    }

    private getMarkdownContent(data: any): string {
        const varianceIcon = parseFloat(data.taskMetrics.variance) > 0 ? '⚠️' : 
                           parseFloat(data.taskMetrics.variance) < 0 ? '✅' : '➖';

        return `# 🔨 FORGE Dashboard: ${data.project.name}

> **Quick Actions:** [Create New Task](command:forge.createTask) | [Add Prevention Rule](command:forge.addPreventionRule) | [Update Copilot Context](command:forge.updateCopilotContext) | [Refresh Dashboard](command:forge.openDashboard)

---

## 📋 Project Overview

- **Description:** ${data.project.description}
- **Languages:** ${data.project.languages.join(', ') || 'None detected'}
- **Frameworks:** ${data.project.frameworks.join(', ') || 'None detected'}

## 📊 Task Metrics

| Metric | Value |
|--------|-------|
| **Total Tasks** | ${data.taskMetrics.totalTasks} |
| **Active Tasks** | ${data.taskMetrics.activeTasks} |
| **Completed Tasks** | ${data.taskMetrics.completedTasks} |
| **Time Variance** | ${varianceIcon} ${data.taskMetrics.variance}h |
| **Atomicity Success** | ${data.taskMetrics.atomicitySuccess}% |

## 🛡️ Prevention Rules

**Total Rules:** ${data.preventionRulesStats.totalRules}

${data.preventionRulesStats.totalRules > 0 ? 
'*Prevention rules are active and protecting your workflow.*' : 
'*No prevention rules found. [Add your first rule](command:forge.addPreventionRule)*'}

## 🚀 Copilot Context

- **Last Updated:** ${data.copilotContext.lastUpdated}
- **Active Rules:** ${data.copilotContext.rulesCount}

## 🕒 Recent Activity

${data.recentActivity.length > 0 ? 
`| Task | Status | Date |
|------|--------|------|
${data.recentActivity.map((activity: any) => 
  `| ${activity.title} | ${activity.status === 'Completed' ? '✅' : '⏳'} ${activity.status} | ${activity.date} |`
).join('\n')}` :
'*No recent activity found. [Create your first task](command:forge.createTask)*'}

---

## 🎯 Available Commands

- **[🔨 Initialize FORGE](command:forge.init)** - Set up FORGE in current workspace
- **[📝 Create Task](command:forge.createTask)** - Create a new atomic task
- **[🚀 Start Activity](command:forge.startActivity)** - Begin working on an activity
- **[✅ Complete Activity](command:forge.completeActivity)** - Mark activity as complete
- **[🛡️ Add Prevention Rule](command:forge.addPreventionRule)** - Document a new prevention rule
- **[📚 View History](command:forge.viewHistory)** - Browse task history
- **[🔄 Update Context](command:forge.updateCopilotContext)** - Refresh Copilot knowledge

---

*Dashboard generated on ${new Date().toLocaleString()} | [Refresh](command:forge.openDashboard)*
`;
    }
}
