import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Task, TaskStatus } from '../models/task';
import { CapybaraConfig } from '../models/capybaraConfig';
import { FileManager } from './fileManager';

export class TaskWorkflowManager {
    private fileManager: FileManager;

    constructor() {
        this.fileManager = new FileManager();
    }

    /**
     * Get the current active task
     */
    public async getCurrentTask(): Promise<Task | null> {
        try {
            const config = await this.fileManager.readCapybaraConfig();
            if (!config?.tasks.currentTask) {
                return null;
            }

            const taskPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                config.tasks.currentTask
            );

            if (!fs.existsSync(taskPath)) {
                // Current task reference is stale, clear it
                await this.clearCurrentTask();
                return null;
            }

            return await this.loadTaskFromPath(taskPath);
        } catch (error) {
            console.error('Error getting current task:', error);
            return null;
        }
    }

    /**
     * Set a task as the current active task
     */
    public async setCurrentTask(taskId: string): Promise<boolean> {
        try {
            const config = await this.fileManager.readCapybaraConfig();
            if (!config) {
                return false;
            }
            
            // Update current task in config
            config.tasks.currentTask = taskId;
            await this.fileManager.writeCapybaraConfig(config);

            // Update copilot instructions
            await this.updateCopilotInstructions(taskId);

            return true;
        } catch (error) {
            console.error('Error setting current task:', error);
            return false;
        }
    }

    /**
     * Clear current task (when pausing or completing)
     */
    public async clearCurrentTask(): Promise<boolean> {
        try {
            const config = await this.fileManager.readCapybaraConfig();
            if (!config) {
                return false;
            }
            
            delete config.tasks.currentTask;
            await this.fileManager.writeCapybaraConfig(config);

            // Update copilot instructions
            await this.updateCopilotInstructions(null);

            return true;
        } catch (error) {
            console.error('Error clearing current task:', error);
            return false;
        }
    }

    /**
     * Get next available task number
     */
    public async getNextTaskNumber(): Promise<number> {
        try {
            const config = await this.fileManager.readCapybaraConfig();
            return config?.tasks.nextTaskNumber || 1;
        } catch (error) {
            console.error('Error getting next task number:', error);
            return 1;
        }
    }

    /**
     * Increment task counter
     */
    public async incrementTaskNumber(): Promise<void> {
        try {
            const config = await this.fileManager.readCapybaraConfig();
            if (!config) {
                return;
            }
            
            config.tasks.nextTaskNumber = (config.tasks.nextTaskNumber || 1) + 1;
            await this.fileManager.writeCapybaraConfig(config);
        } catch (error) {
            console.error('Error incrementing task number:', error);
        }
    }

    /**
     * List all tasks (active and paused)
     */
    public async listActiveTasks(): Promise<Task[]> {
        try {
            const capyPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy'
            );

            if (!fs.existsSync(capyPath)) {
                return [];
            }

            const entries = fs.readdirSync(capyPath, { withFileTypes: true });
            const tasks: Task[] = [];

            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('task_')) {
                    const taskPath = path.join(capyPath, entry.name);
                    const task = await this.loadTaskFromPath(taskPath);
                    if (task && task.status !== TaskStatus.completed) {
                        tasks.push(task);
                    }
                }
            }

            return tasks.sort((a, b) => a.id.localeCompare(b.id));
        } catch (error) {
            console.error('Error listing active tasks:', error);
            return [];
        }
    }

    /**
     * List completed tasks from history
     */
    public async listCompletedTasks(): Promise<Task[]> {
        try {
            const historyPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                'history'
            );

            if (!fs.existsSync(historyPath)) {
                return [];
            }

            const entries = fs.readdirSync(historyPath, { withFileTypes: true });
            const tasks: Task[] = [];

            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('STEP_')) {
                    const taskPath = path.join(historyPath, entry.name);
                    const task = await this.loadTaskFromPath(taskPath);
                    if (task) {
                        tasks.push(task);
                    }
                }
            }

            return tasks.sort((a, b) => a.id.localeCompare(b.id));
        } catch (error) {
            console.error('Error listing completed tasks:', error);
            return [];
        }
    }

    /**
     * Pause current task
     */
    public async pauseCurrentTask(): Promise<boolean> {
        try {
            const currentTask = await this.getCurrentTask();
            if (!currentTask) {
                return false;
            }

            // Update task status
            currentTask.status = TaskStatus.paused;
            currentTask.pausedAt = new Date();
            await this.saveTask(currentTask);

            // Clear current task reference
            await this.clearCurrentTask();

            return true;
        } catch (error) {
            console.error('Error pausing current task:', error);
            return false;
        }
    }

    /**
     * Resume a paused task
     */
    public async resumeTask(taskId: string): Promise<boolean> {
        try {
            // Check if there's already an active task
            const currentTask = await this.getCurrentTask();
            if (currentTask) {
                const confirm = await vscode.window.showWarningMessage(
                    `Task "${currentTask.name}" is currently active. Pause it to resume "${taskId}"?`,
                    'Yes, Pause Current',
                    'Cancel'
                );

                if (confirm !== 'Yes, Pause Current') {
                    return false;
                }

                await this.pauseCurrentTask();
            }

            // Load and resume the target task
            const taskPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                taskId
            );

            const task = await this.loadTaskFromPath(taskPath);
            if (!task) {
                return false;
            }

            task.status = TaskStatus.active;
            task.pausedAt = undefined;
            await this.saveTask(task);

            // Set as current task
            await this.setCurrentTask(taskId);

            return true;
        } catch (error) {
            console.error('Error resuming task:', error);
            return false;
        }
    }

    /**
     * Complete current task and move to history
     */
    public async completeCurrentTask(): Promise<boolean> {
        try {
            const currentTask = await this.getCurrentTask();
            if (!currentTask) {
                vscode.window.showWarningMessage('No active task to complete.');
                return false;
            }

            // Generate STEP number for history
            const stepNumber = await this.getNextHistoryStepNumber();
            const stepId = `STEP_${stepNumber.toString().padStart(4, '0')}`;

            // Create history folder if it doesn't exist
            const historyPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                'history'
            );

            if (!fs.existsSync(historyPath)) {
                fs.mkdirSync(historyPath, { recursive: true });
            }

            // Move task to history with STEP naming
            const taskName = currentTask.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const newPath = path.join(historyPath, `${stepId}_${taskName}`);
            
            // Copy current task folder to history
            await this.copyDirectory(currentTask.path, newPath);

            // Update task metadata
            currentTask.status = TaskStatus.completed;
            currentTask.completedAt = new Date();
            currentTask.stepId = stepId;
            currentTask.path = newPath;

            // Save updated task in history location
            await this.saveTask(currentTask);

            // Remove original task folder
            fs.rmSync(currentTask.path, { recursive: true, force: true });

            // Clear current task reference
            await this.clearCurrentTask();

            vscode.window.showInformationMessage(
                `✅ Task completed and moved to history as ${stepId}`
            );

            return true;
        } catch (error) {
            console.error('Error completing task:', error);
            vscode.window.showErrorMessage('Failed to complete task.');
            return false;
        }
    }

    /**
     * Get next STEP number for history
     */
    private async getNextHistoryStepNumber(): Promise<number> {
        try {
            const historyPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                'history'
            );

            if (!fs.existsSync(historyPath)) {
                return 1;
            }

            const entries = fs.readdirSync(historyPath, { withFileTypes: true });
            let maxStep = 0;

            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('STEP_')) {
                    const match = entry.name.match(/^STEP_(\d+)/);
                    if (match) {
                        const stepNum = parseInt(match[1], 10);
                        maxStep = Math.max(maxStep, stepNum);
                    }
                }
            }

            return maxStep + 1;
        } catch (error) {
            console.error('Error getting next STEP number:', error);
            return 1;
        }
    }

    /**
     * Update copilot instructions with current task
     */
    private async updateCopilotInstructions(taskId: string | null): Promise<void> {
        try {
            const instructionsPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                'copilot-instructions.md'
            );

            if (!fs.existsSync(instructionsPath)) {
                return;
            }

            let content = fs.readFileSync(instructionsPath, 'utf8');

            // Update or add current-task line
            const currentTaskRegex = /^current-task:\s*.*/m;
            const newLine = taskId ? `current-task: ${taskId}` : '';

            if (currentTaskRegex.test(content)) {
                if (newLine) {
                    content = content.replace(currentTaskRegex, newLine);
                } else {
                    content = content.replace(currentTaskRegex, '');
                }
            } else if (newLine) {
                // Add at the beginning of the file
                content = `${newLine}\n\n${content}`;
            }

            fs.writeFileSync(instructionsPath, content);
        } catch (error) {
            console.error('Error updating copilot instructions:', error);
        }
    }

    /**
     * Load task from directory path
     */
    private async loadTaskFromPath(taskPath: string): Promise<Task | null> {
        try {
            const metadataPath = path.join(taskPath, 'task-metadata.json');
            if (!fs.existsSync(metadataPath)) {
                return null;
            }

            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            return {
                ...metadata,
                path: taskPath,
                createdAt: new Date(metadata.createdAt),
                completedAt: metadata.completedAt ? new Date(metadata.completedAt) : undefined,
                pausedAt: metadata.pausedAt ? new Date(metadata.pausedAt) : undefined
            };
        } catch (error) {
            console.error('Error loading task from path:', error);
            return null;
        }
    }

    /**
     * Save task metadata
     */
    private async saveTask(task: Task): Promise<void> {
        try {
            const metadataPath = path.join(task.path, 'task-metadata.json');
            const metadata = {
                ...task,
                path: undefined // Don't save path in metadata
            };
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.error('Error saving task metadata:', error);
            throw error;
        }
    }

    /**
     * Copy directory recursively
     */
    private async copyDirectory(source: string, destination: string): Promise<void> {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }

        const entries = fs.readdirSync(source, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);

            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
