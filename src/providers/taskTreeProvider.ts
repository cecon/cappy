import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Task, TaskStatus } from '../models/task';
import { FileManager } from '../utils/fileManager';

export class ForgeTaskProvider implements vscode.TreeDataProvider<TaskItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | null | void> = new vscode.EventEmitter<TaskItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private fileManager: FileManager;

    constructor() {
        this.fileManager = new FileManager();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TaskItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TaskItem): Promise<TaskItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const tasksPath = path.join(workspaceRoot, 'tasks');

        // Check if tasks folder exists
        if (!fs.existsSync(tasksPath)) {
            return [];
        }

        if (element) {
            return this.getTaskDetails(element);
        } else {
            return this.getTasks(tasksPath);
        }
    }

    private async getTasks(tasksPath: string): Promise<TaskItem[]> {
        const tasks: TaskItem[] = [];
        
        try {
            const taskFolders = fs.readdirSync(tasksPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .sort();

            for (const taskFolder of taskFolders) {
                const taskPath = path.join(tasksPath, taskFolder);
                const task = await this.loadTask(taskPath, taskFolder);
                
                if (task) {
                    const taskItem = new TaskItem(
                        task.name,
                        task.status === TaskStatus.ACTIVE ? 'activeTask' : 'task',
                        task,
                        taskPath,
                        vscode.TreeItemCollapsibleState.Collapsed
                    );
                    
                    // Set appropriate icon based on status
                    taskItem.iconPath = this.getTaskIcon(task.status);
                    
                    // Add tooltip with task info
                    taskItem.tooltip = this.getTaskTooltip(task);
                    
                    tasks.push(taskItem);
                }
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }

        return tasks;
    }

    private async getTaskDetails(taskItem: TaskItem): Promise<TaskItem[]> {
        const details: TaskItem[] = [];
        const task = taskItem.task;

        if (!task) return details;

        // Add status
        details.push(new TaskItem(
            `Status: ${task.status}`,
            'taskDetail',
            undefined,
            undefined,
            vscode.TreeItemCollapsibleState.None
        ));

        // Add estimated hours
        details.push(new TaskItem(
            `Estimated: ${task.estimatedHours}h`,
            'taskDetail',
            undefined,
            undefined,
            vscode.TreeItemCollapsibleState.None
        ));

        // Add actual hours if completed
        if (task.actualHours !== undefined) {
            details.push(new TaskItem(
                `Actual: ${task.actualHours}h`,
                'taskDetail',
                undefined,
                undefined,
                vscode.TreeItemCollapsibleState.None
            ));
        }

        // Add atomicity info
        const atomicityIcon = task.atomicity.isAtomic ? '✅' : '❌';
        details.push(new TaskItem(
            `${atomicityIcon} Atomic: ${task.atomicity.isAtomic ? 'Yes' : 'No'}`,
            'taskDetail',
            undefined,
            undefined,
            vscode.TreeItemCollapsibleState.None
        ));

        // Add files
        if (task.artifacts.length > 0) {
            const artifactsItem = new TaskItem(
                `Artifacts (${task.artifacts.length})`,
                'taskGroup',
                undefined,
                undefined,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            details.push(artifactsItem);
        }

        return details;
    }

    private async loadTask(taskPath: string, taskFolder: string): Promise<Task | null> {
        try {
            const descriptionPath = path.join(taskPath, 'description.md');
            const completionPath = path.join(taskPath, 'completion.md');
            const difficultiesPath = path.join(taskPath, 'difficulties.md');

            if (!fs.existsSync(descriptionPath)) {
                return null;
            }

            // Parse task name from folder name
            const taskId = taskFolder;
            const namePart = taskFolder.replace(/^TASK_\d+_/, '').replace(/_/g, ' ');
            const taskName = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();

            // Determine status based on completion.md existence and content
            let status = TaskStatus.ACTIVE;
            let completedAt: Date | undefined;
            let actualHours: number | undefined;

            if (fs.existsSync(completionPath)) {
                const completionContent = fs.readFileSync(completionPath, 'utf8');
                if (completionContent.trim().length > 0) {
                    status = TaskStatus.COMPLETED;
                    const stats = fs.statSync(completionPath);
                    completedAt = stats.mtime;
                    
                    // Try to extract actual hours from completion.md
                    const hoursMatch = completionContent.match(/actual.*?(\d+(?:\.\d+)?)\s*h/i);
                    if (hoursMatch) {
                        actualHours = parseFloat(hoursMatch[1]);
                    }
                }
            }

            // Get creation date from folder stats
            const folderStats = fs.statSync(taskPath);
            const createdAt = folderStats.birthtime;

            // Read description for estimated hours and atomicity info
            const descriptionContent = fs.readFileSync(descriptionPath, 'utf8');
            let estimatedHours = 3; // default
            let atomicity = { isAtomic: true, estimatedHours: 3, confidence: 0.8 };

            const hoursMatch = descriptionContent.match(/estimated.*?(\d+(?:\.\d+)?)\s*h/i);
            if (hoursMatch) {
                estimatedHours = parseFloat(hoursMatch[1]);
                atomicity.estimatedHours = estimatedHours;
                atomicity.isAtomic = estimatedHours <= 3;
            }

            // Get artifacts from artifacts folder
            const artifactsPath = path.join(taskPath, 'artifacts');
            let artifacts: string[] = [];
            if (fs.existsSync(artifactsPath)) {
                artifacts = fs.readdirSync(artifactsPath);
            }

            // Get difficulties
            let difficulties: string[] = [];
            if (fs.existsSync(difficultiesPath)) {
                const difficultiesContent = fs.readFileSync(difficultiesPath, 'utf8');
                difficulties = difficultiesContent.split('\n').filter(line => line.trim().length > 0);
            }

            const task: Task = {
                id: taskId,
                name: taskName,
                description: descriptionContent,
                status,
                estimatedHours,
                actualHours,
                createdAt,
                completedAt,
                path: taskPath,
                artifacts,
                difficulties,
                preventionRules: [], // Will be populated from difficulties analysis
                atomicity
            };

            return task;
        } catch (error) {
            console.error(`Error loading task from ${taskPath}:`, error);
            return null;
        }
    }

    private getTaskIcon(status: TaskStatus): vscode.ThemeIcon {
        switch (status) {
            case TaskStatus.ACTIVE:
                return new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('charts.blue'));
            case TaskStatus.COMPLETED:
                return new vscode.ThemeIcon('check-circle', new vscode.ThemeColor('charts.green'));
            case TaskStatus.PAUSED:
                return new vscode.ThemeIcon('pause-circle', new vscode.ThemeColor('charts.orange'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    private getTaskTooltip(task: Task): string {
        const status = task.status.charAt(0).toUpperCase() + task.status.slice(1);
        const atomicity = task.atomicity.isAtomic ? 'Atomic' : 'Non-Atomic';
        const completion = task.completedAt ? `\nCompleted: ${task.completedAt.toLocaleDateString()}` : '';
        
        return `${task.name}\nStatus: ${status}\nEstimated: ${task.estimatedHours}h\nAtomicity: ${atomicity}${completion}`;
    }
}

export class TaskItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly contextValue: string,
        public readonly task?: Task,
        public readonly taskPath?: string,
        public readonly collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        
        if (task) {
            this.description = `${task.estimatedHours}h`;
            if (task.status === TaskStatus.COMPLETED && task.actualHours) {
                this.description += ` (${task.actualHours}h actual)`;
            }
        }

        // Make tasks clickable to open description.md
        if (contextValue === 'task' || contextValue === 'activeTask') {
            this.command = {
                command: 'forge.openTask',
                title: 'Open Task',
                arguments: [this]
            };
        }
    }
}
