import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from '../utils/fileManager';
import { Task, TaskStatus } from '../models/task';

export class TaskCompleter {
    private fileManager: FileManager;

    constructor() {
        this.fileManager = new FileManager();
    }

    public async show(taskItem?: any): Promise<boolean> {
        try {
            let selectedTask: Task | null = null;

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

            return await this.collectCompletionData(selectedTask);

        } catch (error) {
            console.error('Error in TaskCompleter:', error);
            vscode.window.showErrorMessage('An error occurred while completing the task.');
            return false;
        }
    }

    private async collectCompletionData(task: Task): Promise<boolean> {
        const proceed = await vscode.window.showInformationMessage(
            `📋 Complete Task: "${task.name}"\n\nEstimated: ${task.estimatedHours}h\nCreated: ${task.createdAt.toLocaleDateString()}\n\nProceed with completion?`,
            'Yes, Complete Task',
            'Cancel'
        );

        if (proceed !== 'Yes, Complete Task') {
            return false;
        }

        const actualHoursInput = await vscode.window.showInputBox({
            prompt: `How many hours did you actually spend on this task? (estimated: ${task.estimatedHours}h)`,
            placeHolder: task.estimatedHours.toString(),
            value: task.estimatedHours.toString(),
            validateInput: (value) => {
                const hours = parseFloat(value);
                if (isNaN(hours) || hours < 0) {
                    return 'Please enter a valid number >= 0';
                }
                if (hours > 24) {
                    return 'Did you really spend more than 24 hours? Please check the value.';
                }
                return null;
            }
        });

        if (!actualHoursInput) {
            return false;
        }

        const actualHours = parseFloat(actualHoursInput);

        const summary = await vscode.window.showInputBox({
            prompt: 'Briefly describe what was accomplished',
            placeHolder: 'e.g., Successfully implemented user authentication with JWT tokens',
            validateInput: (value) => {
                if (!value || value.trim().length < 10) {
                    return 'Summary must be at least 10 characters long';
                }
                return null;
            }
        });

        if (!summary) {
            return false;
        }

        const completionData = {
            actualHours,
            summary,
            completedAt: new Date()
        };

        return await this.completeTask(task, completionData);
    }

    private async selectActiveTask(): Promise<Task | null> {
        try {
            const taskFolders = await this.fileManager.getTaskFolders();
            const activeTasks: Task[] = [];

            for (const folder of taskFolders) {
                try {
                    const taskPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'tasks', folder);
                    const configPath = path.join(taskPath, 'config.json');
                    
                    try {
                        await fs.promises.access(configPath, fs.constants.F_OK);
                        const configContent = await fs.promises.readFile(configPath, 'utf8');
                        const config = JSON.parse(configContent);
                        if (config.status === TaskStatus.active) {
                            activeTasks.push(config);
                        }
                    } catch (error: any) {
                        if (error.code !== 'ENOENT') {
                            console.error('Error reading task config:', error);
                        }
                    }
                } catch (error) {
                    continue;
                }
            }

            if (activeTasks.length === 0) {
                vscode.window.showInformationMessage('No active tasks found.');
                return null;
            }

            const taskItems = activeTasks.map(task => ({
                label: `📋 ${task.name}`,
                description: `${task.estimatedHours}h • Created ${task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'Unknown'}`,
                detail: task.description,
                task: task
            }));

            const selected = await vscode.window.showQuickPick(taskItems, {
                placeHolder: 'Select a task to complete',
                matchOnDescription: true,
                matchOnDetail: true
            });

            return selected ? selected.task : null;

        } catch (error) {
            console.error('Error selecting task:', error);
            vscode.window.showErrorMessage('Failed to load active tasks.');
            return null;
        }
    }

    private async completeTask(task: Task, completionData: any): Promise<boolean> {
        try {
            task.status = TaskStatus.completed;
            task.actualHours = completionData.actualHours;
            task.completedAt = completionData.completedAt;

            const taskConfigPath = path.join(task.path, 'config.json');
            await fs.promises.writeFile(taskConfigPath, JSON.stringify(task, null, 2), 'utf8');

            await this.generateCompletionReport(task, completionData);

            const choice = await vscode.window.showInformationMessage(
                `✅ Task "${task.name}" completed successfully!\n\nTime: ${completionData.actualHours}h (estimated: ${task.estimatedHours}h)`,
                'View Report',
                'Open Task Folder'
            );

            if (choice === 'View Report') {
                const reportPath = vscode.Uri.file(path.join(task.path, 'completion-report.md'));
                await vscode.window.showTextDocument(reportPath);
            } else if (choice === 'Open Task Folder') {
                await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(task.path));
            }

            return true;

        } catch (error) {
            console.error('Error completing task:', error);
            vscode.window.showErrorMessage(`Failed to complete task: ${error}`);
            return false;
        }
    }

    private async generateCompletionReport(task: Task, completionData: any): Promise<void> {
        const report = `# ✅ Task Completion Report

## Task Information
- **Name:** ${task.name}
- **ID:** ${task.id}
- **Status:** COMPLETED ✅
- **Completed:** ${completionData.completedAt.toLocaleDateString()} ${completionData.completedAt.toLocaleTimeString()}

## Time Analysis
- **Estimated Hours:** ${task.estimatedHours}h
- **Actual Hours:** ${completionData.actualHours}h
- **Variance:** ${(completionData.actualHours - task.estimatedHours).toFixed(1)}h (${((completionData.actualHours / task.estimatedHours - 1) * 100).toFixed(1)}%)

## Completion Summary
${completionData.summary}

---
*Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*
`;

        const reportPath = path.join(task.path, 'completion-report.md');
        await fs.promises.writeFile(reportPath, report, 'utf8');
    }
}
