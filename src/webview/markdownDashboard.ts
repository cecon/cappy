import * as vscode from 'vscode';
import * as path from 'path';
import { FileManager } from '../utils/fileManager';
import * as fs from 'fs';

/**
 * Generates and displays a Markdown-based dashboard.
 */
export class CapybaraDashboard {
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
            console.log('🔨 Capybara Dashboard: Starting show() method');
            
            // Check if workspace exists
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                console.log('🔨 Capybara Dashboard: No workspace folders found');
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

            console.log('🔨 Capybara Dashboard: Workspace found, checking FileManager');
            
            // Initialize FileManager if not already done
            if (!this.fileManager) {
                this.fileManager = new FileManager();
            }

            console.log('🔨 Capybara Dashboard: FileManager initialized, checking Capybara config');

            // Check if Capybara is initialized
            const config = await this.fileManager.readCapybaraConfig();
            if (!config) {
                console.log('🔨 Capybara Dashboard: No Capybara config found');
                vscode.window.showInformationMessage(
                    "Please initialize Capybara in this workspace first by running 'Capybara: Initialize Capybara'.",
                    'Initialize Capybara'
                ).then(choice => {
                    if (choice === 'Initialize Capybara') {
                        vscode.commands.executeCommand('capybara.init');
                    }
                });
                return;
            }

            console.log('🔨 Capybara Dashboard: Capybara config found, generating dashboard data');
            
            const dashboardData = await this.getDashboardData();
            console.log('🔨 Capybara Dashboard: Dashboard data generated, creating markdown content');
            
            const markdownContent = this.getMarkdownContent(dashboardData);
            console.log('🔨 Capybara Dashboard: Markdown content created, opening document');

            const document = await vscode.workspace.openTextDocument({
                content: markdownContent,
                language: 'markdown'
            });
            
            console.log('🔨 Capybara Dashboard: Document created, showing in editor');
            
            await vscode.window.showTextDocument(document, {
                viewColumn: vscode.ViewColumn.One,
                preview: true
            });
            
            console.log('🔨 Capybara Dashboard: Dashboard displayed successfully');
        } catch (error) {
            console.error('🔨 Capybara Dashboard: Error in show() method:', error);
            vscode.window.showErrorMessage(`Failed to generate Capybara Dashboard: ${error}`);
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
            const rulesPath = path.join(this.getWorkspaceRoot(), '.capy', 'prevention-rules.md');
            try {
                await fs.promises.access(rulesPath, fs.constants.F_OK);
                const content = await fs.promises.readFile(rulesPath, 'utf8');
                // Count ## headers as rules
                const rules = content.match(/^## /gm) || [];
                return rules.length;
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    return 0;
                }
                throw error;
            }
        } catch (error) {
            return 0;
        }
    }

    private async getDashboardData(): Promise<any> {
        if (!this.fileManager) {
            throw new Error("FileManager not initialized");
        }

        const workspaceRoot = this.getWorkspaceRoot();
        const config = await this.fileManager.readCapybaraConfig();
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

            // Check if task is completed
            let isCompleted = false;
            try {
                await fs.promises.access(completionPath, fs.constants.F_OK);
                const completionContent = await fs.promises.readFile(completionPath, 'utf8');
                isCompleted = completionContent.trim().length > 0;
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    console.error('Error reading completion file:', error);
                }
                isCompleted = false;
            }

            if (isCompleted) {
                completedTasks++;
            } else {
                activeTasks++;
            }

            // Extract estimated hours
            try {
                await fs.promises.access(descriptionPath, fs.constants.F_OK);
                const descContent = await fs.promises.readFile(descriptionPath, 'utf8');
                const hoursMatch = /estimated.*?(\d+(?:\.\d+)?)\s*h/i.exec(descContent);
                if (hoursMatch) {
                    const estimated = parseFloat(hoursMatch[1]);
                    totalEstimated += estimated;

                    if (isCompleted) {
                        // Try to extract actual hours from completion
                        try {
                            const compContent = await fs.promises.readFile(completionPath, 'utf8');
                            const actualHoursMatch = /actual.*?(\d+(?:\.\d+)?)\s*h/i.exec(compContent);
                            if (actualHoursMatch) {
                                totalActual += parseFloat(actualHoursMatch[1]);
                            } else {
                                totalActual += estimated; // Assume actual equals estimated if not specified
                            }
                        } catch (error: any) {
                            if (error.code !== 'ENOENT') {
                                console.error('Error reading completion content for hours:', error);
                            }
                            totalActual += estimated;
                        }
                    }
                }
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    console.error('Error reading description file:', error);
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

            try {
                await fs.promises.access(descriptionPath, fs.constants.F_OK);
                const descContent = await fs.promises.readFile(descriptionPath, 'utf8');
                const titleMatch = descContent.match(/^#\s*(.*)/m);
                const title = titleMatch ? titleMatch[1] : taskFolder;
                
                // Check if task is completed
                let isCompleted = false;
                try {
                    await fs.promises.access(completionPath, fs.constants.F_OK);
                    const completionContent = await fs.promises.readFile(completionPath, 'utf8');
                    isCompleted = completionContent.trim().length > 0;
                } catch (error: any) {
                    if (error.code !== 'ENOENT') {
                        console.error('Error checking completion:', error);
                    }
                    isCompleted = false;
                }
                
                const stats = await fs.promises.stat(descriptionPath);
                activities.push({
                    id: taskFolder,
                    title,
                    status: isCompleted ? 'Completed' : 'Active',
                    date: stats.mtime.toLocaleDateString()
                });
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    console.error('Error reading description file for activity:', error);
                }
            }
        }
        return activities;
    }

    private async getCopilotContextLastUpdated(): Promise<string> {
        try {
            const contextPath = path.join(this.getWorkspaceRoot(), '.capy', 'copilot-instructions.md');
            const stats = await fs.promises.stat(contextPath);
            return stats.mtime.toLocaleString();
        } catch (error) {
            return 'Never';
        }
    }

    private getMarkdownContent(data: any): string {
        const varianceIcon = parseFloat(data.taskMetrics.variance) > 0 ? '⚠️' : 
                           parseFloat(data.taskMetrics.variance) < 0 ? '✅' : '➖';

        return `# 🔨 Capybara Dashboard: ${data.project.name}

> **Quick Actions:** [Create New Task](command:capybara.createTask) | [Add Prevention Rule](command:capybara.addPreventionRule) | [Update Copilot Context](command:capybara.updateCopilotContext) | [Refresh Dashboard](command:capybara.openDashboard)

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
'*No prevention rules found. [Add your first rule](command:capybara.addPreventionRule)*'}

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
'*No recent activity found. [Create your first task](command:capybara.createTask)*'}

---

## 🎯 Available Commands

- **[🦫 Initialize Capybara](command:capybara.init)** - Set up Capybara in current workspace
- **[📝 Create Task](command:capybara.createTask)** - Create a new atomic task
- **[🚀 Start Activity](command:capybara.startActivity)** - Begin working on an activity
- **[✅ Complete Activity](command:capybara.completeActivity)** - Mark activity as complete
- **[🛡️ Add Prevention Rule](command:capybara.addPreventionRule)** - Document a new prevention rule
- **[📚 View History](command:capybara.viewHistory)** - Browse task history
- **[🔄 Update Context](command:capybara.updateCopilotContext)** - Refresh Copilot knowledge

---

*Dashboard generated on ${new Date().toLocaleString()} | [Refresh](command:capybara.openDashboard)*
`;
    }
}
