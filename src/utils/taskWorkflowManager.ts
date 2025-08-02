import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Task, TaskStatus } from '../models/task';
import { CapybaraConfig } from '../models/capybaraConfig';
import { FileManager } from './fileManager';
import { TaskXmlManager } from './taskXmlManager';

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

            config.tasks.currentTask = taskId;
            await this.fileManager.writeCapybaraConfig(config);
            return true;
        } catch (error) {
            console.error('Error setting current task:', error);
            return false;
        }
    }

    /**
     * Clear the current active task
     */
    public async clearCurrentTask(): Promise<boolean> {
        try {
            const config = await this.fileManager.readCapybaraConfig();
            if (!config) {
                return false;
            }

            config.tasks.currentTask = undefined;
            await this.fileManager.writeCapybaraConfig(config);
            return true;
        } catch (error) {
            console.error('Error clearing current task:', error);
            return false;
        }
    }

    /**
     * Load task from path using XML
     */
    private async loadTaskFromPath(taskPath: string): Promise<Task | null> {
        try {
            // First try to load from XML
            const xmlPath = path.join(taskPath, 'task.xml');
            if (fs.existsSync(xmlPath)) {
                return TaskXmlManager.loadTaskXml(taskPath);
            }

            // Fallback to legacy JSON format for compatibility
            const metadataPath = path.join(taskPath, 'task-metadata.json');
            if (fs.existsSync(metadataPath)) {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                // Convert legacy format to new format
                const legacyTask: Task = {
                    ...metadata,
                    path: taskPath,
                    // Map legacy properties to new format
                    title: metadata.name || metadata.title,
                    version: '1.0',
                    progress: {
                        completed: 0,
                        total: 1
                    },
                    context: {
                        mainTechnology: 'Unknown',
                        dependencies: []
                    },
                    steps: [],
                    validation: {
                        checklist: []
                    }
                };
                return legacyTask;
            }

            return null;
        } catch (error) {
            console.error('Error loading task from path:', error);
            return null;
        }
    }

    /**
     * List all active tasks (not completed or paused)
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

            const tasks: Task[] = [];
            const entries = fs.readdirSync(capyPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('history')) {
                    const taskPath = path.join(capyPath, entry.name);
                    const task = await this.loadTaskFromPath(taskPath);
                    if (task && task.status !== TaskStatus.concluida) {
                        tasks.push(task);
                    }
                }
            }

            return tasks;
        } catch (error) {
            console.error('Error listing active tasks:', error);
            return [];
        }
    }

    /**
     * List all completed tasks from history
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

            const tasks: Task[] = [];
            const entries = fs.readdirSync(historyPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const taskPath = path.join(historyPath, entry.name);
                    const task = await this.loadTaskFromPath(taskPath);
                    if (task) {
                        tasks.push(task);
                    }
                }
            }

            return tasks.sort((a, b) => 
                (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
            );
        } catch (error) {
            console.error('Error listing completed tasks:', error);
            return [];
        }
    }

    /**
     * Pause the current task
     */
    public async pauseCurrentTask(): Promise<boolean> {
        try {
            const currentTask = await this.getCurrentTask();
            if (!currentTask) {
                return false;
            }

            currentTask.status = TaskStatus.pausada;
            currentTask.pausedAt = new Date();
            TaskXmlManager.saveTaskXml(currentTask, currentTask.path);

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
            const currentTask = await this.getCurrentTask();
            if (currentTask) {
                const choice = await vscode.window.showWarningMessage(
                    `Task "${currentTask.title}" está ativa. Pausar para retomar "${taskId}"?`,
                    'Sim, Pausar',
                    'Cancelar'
                );

                if (choice !== 'Sim, Pausar') {
                    return false;
                }

                await this.pauseCurrentTask();
            }

            const taskPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                taskId
            );

            const task = await this.loadTaskFromPath(taskPath);
            if (!task) {
                return false;
            }

            task.status = TaskStatus.emAndamento;
            task.pausedAt = undefined;
            TaskXmlManager.saveTaskXml(task, task.path);

            return await this.setCurrentTask(taskId);
        } catch (error) {
            console.error('Error resuming task:', error);
            return false;
        }
    }

    /**
     * Complete the current task and move it to history
     */
    public async completeCurrentTask(): Promise<boolean> {
        try {
            const currentTask = await this.getCurrentTask();
            if (!currentTask) {
                vscode.window.showErrorMessage('Nenhuma task ativa para completar.');
                return false;
            }

            // Create STEP folder in history
            const stepNumber = await this.getNextStepNumber();
            const stepId = `STEP_${stepNumber.toString().padStart(4, '0')}`;
            const taskName = currentTask.title.replace(/[^a-zA-Z0-9_-]/g, '_');
            const historyFolderName = `${stepId}_${taskName}`;
            
            const historyPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                'history',
                historyFolderName
            );

            // Update task metadata
            currentTask.status = TaskStatus.concluida;
            currentTask.completedAt = new Date();
            currentTask.stepId = stepId;

            // Create history folder
            if (!fs.existsSync(historyPath)) {
                fs.mkdirSync(historyPath, { recursive: true });
            }

            // Move task folder to history
            const originalPath = currentTask.path;
            currentTask.path = historyPath;

            // Copy files to history
            this.copyFolderSync(originalPath, historyPath);

            // Save updated task XML in history
            TaskXmlManager.saveTaskXml(currentTask, historyPath);

            // Remove original task folder
            fs.rmSync(originalPath, { recursive: true, force: true });

            // Clear current task
            await this.clearCurrentTask();

            vscode.window.showInformationMessage(
                `✅ Task "${currentTask.title}" completada e movida para histórico como ${stepId}!`
            );

            return true;
        } catch (error) {
            console.error('Error completing task:', error);
            vscode.window.showErrorMessage(`Erro ao completar task: ${error}`);
            return false;
        }
    }

    /**
     * Get next step number for completed tasks
     */
    private async getNextStepNumber(): Promise<number> {
        try {
            const historyPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                'history'
            );

            if (!fs.existsSync(historyPath)) {
                return 1;
            }

            const entries = fs.readdirSync(historyPath);
            const stepNumbers = entries
                .map(name => {
                    const match = name.match(/^STEP_(\d{4})/);
                    return match ? parseInt(match[1]) : 0;
                })
                .filter(num => num > 0);

            return stepNumbers.length > 0 ? Math.max(...stepNumbers) + 1 : 1;
        } catch (error) {
            console.error('Error getting next step number:', error);
            return 1;
        }
    }

    /**
     * Copy folder recursively
     */
    private copyFolderSync(src: string, dest: string): void {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                this.copyFolderSync(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * Update step completion status
     */
    public async updateStepCompletion(stepId: string, completed: boolean): Promise<boolean> {
        try {
            const currentTask = await this.getCurrentTask();
            if (!currentTask) {
                return false;
            }

            TaskXmlManager.updateStepCompletion(currentTask.path, stepId, completed);
            return true;
        } catch (error) {
            console.error('Error updating step completion:', error);
            return false;
        }
    }
}
