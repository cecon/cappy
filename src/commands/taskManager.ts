import * as vscode from 'vscode';
import { TaskWorkflowManager } from '../utils/taskWorkflowManager';
import { TaskStatus } from '../models/task';

export class TaskManager {
    private workflowManager: TaskWorkflowManager;

    constructor() {
        this.workflowManager = new TaskWorkflowManager();
    }

    /**
     * Show current task status
     */
    public async showCurrentTask(): Promise<void> {
        try {
            const currentTask = await this.workflowManager.getCurrentTask();
            
            if (!currentTask) {
                vscode.window.showInformationMessage(
                    '📭 Nenhuma task ativa no momento.\n\nCrie uma nova task para começar!'
                );
                return;
            }

            const statusIcon = currentTask.status === TaskStatus.active ? '🎯' : '⏸️';
            const timeInfo = currentTask.actualHours 
                ? `${currentTask.actualHours}h trabalhadas de ${currentTask.estimatedHours}h estimadas`
                : `${currentTask.estimatedHours}h estimadas`;

            const choice = await vscode.window.showInformationMessage(
                `${statusIcon} **Task Ativa:** ${currentTask.name}\n\n` +
                `**ID:** ${currentTask.id}\n` +
                `**Status:** ${currentTask.status}\n` +
                `**Tempo:** ${timeInfo}\n` +
                `**Criada:** ${currentTask.createdAt.toLocaleDateString()}`,
                'Abrir Descrição',
                'Pausar Task',
                'Completar Task',
                'Ver Pasta'
            );

            switch (choice) {
                case 'Abrir Descrição':
                    await this.openTaskDescription(currentTask.id);
                    break;
                case 'Pausar Task':
                    await this.pauseCurrentTask();
                    break;
                case 'Completar Task':
                    await this.completeCurrentTask();
                    break;
                case 'Ver Pasta':
                    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(currentTask.path));
                    break;
            }
        } catch (error) {
            console.error('Error showing current task:', error);
            vscode.window.showErrorMessage('Erro ao carregar task atual.');
        }
    }

    /**
     * List and manage all tasks
     */
    public async showAllTasks(): Promise<void> {
        try {
            const activeTasks = await this.workflowManager.listActiveTasks();
            const currentTask = await this.workflowManager.getCurrentTask();

            if (activeTasks.length === 0) {
                vscode.window.showInformationMessage(
                    '📭 Nenhuma task encontrada.\n\nCrie uma nova task para começar!'
                );
                return;
            }

            const taskItems = activeTasks.map(task => {
                const isActive = currentTask?.id === task.id;
                const icon = isActive ? '🎯' : task.status === TaskStatus.paused ? '⏸️' : '📋';
                const statusText = isActive ? ' (ATIVA)' : task.status === TaskStatus.paused ? ' (PAUSADA)' : '';
                
                return {
                    label: `${icon} ${task.name}${statusText}`,
                    description: `${task.id} • ${task.estimatedHours}h • ${task.createdAt.toLocaleDateString()}`,
                    detail: task.description.substring(0, 100) + (task.description.length > 100 ? '...' : ''),
                    task
                };
            });

            const selected = await vscode.window.showQuickPick(taskItems, {
                placeHolder: 'Selecione uma task para gerenciar',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selected) {
                return;
            }

            await this.showTaskActions(selected.task);
        } catch (error) {
            console.error('Error showing all tasks:', error);
            vscode.window.showErrorMessage('Erro ao carregar lista de tasks.');
        }
    }

    /**
     * Show task-specific actions
     */
    private async showTaskActions(task: any): Promise<void> {
        const currentTask = await this.workflowManager.getCurrentTask();
        const isActive = currentTask?.id === task.id;
        const isPaused = task.status === TaskStatus.paused;

        const actions = [];
        
        actions.push('📖 Abrir Descrição');
        actions.push('📁 Ver Pasta');
        
        if (isActive) {
            actions.push('⏸️ Pausar Task');
            actions.push('✅ Completar Task');
        } else if (isPaused) {
            actions.push('▶️ Retomar Task');
        }

        const choice = await vscode.window.showQuickPick(actions, {
            placeHolder: `Ações para: ${task.name}`
        });

        if (!choice) {
            return;
        }

        switch (choice) {
            case '📖 Abrir Descrição':
                await this.openTaskDescription(task.id);
                break;
            case '📁 Ver Pasta':
                await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(task.path));
                break;
            case '⏸️ Pausar Task':
                await this.pauseCurrentTask();
                break;
            case '✅ Completar Task':
                await this.completeCurrentTask();
                break;
            case '▶️ Retomar Task':
                await this.resumeTask(task.id);
                break;
        }
    }

    /**
     * Pause current task
     */
    public async pauseCurrentTask(): Promise<boolean> {
        try {
            const currentTask = await this.workflowManager.getCurrentTask();
            if (!currentTask) {
                vscode.window.showWarningMessage('Nenhuma task ativa para pausar.');
                return false;
            }

            const confirm = await vscode.window.showWarningMessage(
                `⏸️ Pausar task "${currentTask.name}"?\n\nVocê poderá retomá-la depois ou criar uma nova task.`,
                'Sim, Pausar',
                'Cancelar'
            );

            if (confirm !== 'Sim, Pausar') {
                return false;
            }

            const success = await this.workflowManager.pauseCurrentTask();
            
            if (success) {
                vscode.window.showInformationMessage(
                    `⏸️ Task "${currentTask.name}" pausada com sucesso.`
                );
            }

            return success;
        } catch (error) {
            console.error('Error pausing task:', error);
            vscode.window.showErrorMessage('Erro ao pausar task.');
            return false;
        }
    }

    /**
     * Resume a paused task
     */
    public async resumeTask(taskId: string): Promise<boolean> {
        try {
            const success = await this.workflowManager.resumeTask(taskId);
            
            if (success) {
                vscode.window.showInformationMessage(
                    `▶️ Task ${taskId} retomada com sucesso!`
                );
            }

            return success;
        } catch (error) {
            console.error('Error resuming task:', error);
            vscode.window.showErrorMessage('Erro ao retomar task.');
            return false;
        }
    }

    /**
     * Complete current task
     */
    public async completeCurrentTask(): Promise<boolean> {
        try {
            const currentTask = await this.workflowManager.getCurrentTask();
            if (!currentTask) {
                vscode.window.showWarningMessage('Nenhuma task ativa para completar.');
                return false;
            }

            const confirm = await vscode.window.showWarningMessage(
                `✅ Marcar task "${currentTask.name}" como completada?\n\nEla será movida para o histórico.`,
                'Sim, Completar',
                'Cancelar'
            );

            if (confirm !== 'Sim, Completar') {
                return false;
            }

            const success = await this.workflowManager.completeCurrentTask();
            return success;
        } catch (error) {
            console.error('Error completing task:', error);
            vscode.window.showErrorMessage('Erro ao completar task.');
            return false;
        }
    }

    /**
     * Show task history
     */
    public async showHistory(): Promise<void> {
        try {
            const completedTasks = await this.workflowManager.listCompletedTasks();

            if (completedTasks.length === 0) {
                vscode.window.showInformationMessage(
                    '📚 Histórico vazio.\n\nComplete algumas tasks para vê-las aqui!'
                );
                return;
            }

            const historyItems = completedTasks.map(task => ({
                label: `✅ ${task.name}`,
                description: `${task.stepId} • Completada em ${task.completedAt?.toLocaleDateString()}`,
                detail: task.description.substring(0, 100) + (task.description.length > 100 ? '...' : ''),
                task
            }));

            const selected = await vscode.window.showQuickPick(historyItems, {
                placeHolder: 'Histórico de tasks completadas',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selected) {
                return;
            }

            const choice = await vscode.window.showQuickPick([
                '📖 Ver Descrição',
                '📁 Abrir Pasta',
                '🔄 Reabrir Task'
            ], {
                placeHolder: `Ações para: ${selected.task.name}`
            });

            switch (choice) {
                case '📖 Ver Descrição':
                    await this.openTaskDescription(selected.task.stepId || selected.task.id);
                    break;
                case '📁 Abrir Pasta':
                    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(selected.task.path));
                    break;
                case '🔄 Reabrir Task':
                    await this.reopenCompletedTask(selected.task);
                    break;
            }
        } catch (error) {
            console.error('Error showing history:', error);
            vscode.window.showErrorMessage('Erro ao carregar histórico.');
        }
    }

    /**
     * Reopen a completed task
     */
    private async reopenCompletedTask(task: any): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `🔄 Reabrir task "${task.name}"?\n\nEla será movida de volta para tasks ativas.`,
            'Sim, Reabrir',
            'Cancelar'
        );

        if (confirm === 'Sim, Reabrir') {
            // TODO: Implement reopening logic
            vscode.window.showInformationMessage(
                '🚧 Funcionalidade de reabrir task em desenvolvimento.'
            );
        }
    }

    /**
     * Open task description file
     */
    private async openTaskDescription(taskId: string): Promise<void> {
        try {
            const tasks = await this.workflowManager.listActiveTasks();
            const task = tasks.find(t => t.id === taskId);
            
            if (task) {
                const descriptionPath = vscode.Uri.file(task.path + '/DESCRIPTION.md');
                await vscode.window.showTextDocument(descriptionPath);
            } else {
                // Try history
                const historyTasks = await this.workflowManager.listCompletedTasks();
                const historyTask = historyTasks.find(t => t.stepId === taskId || t.id === taskId);
                
                if (historyTask) {
                    const descriptionPath = vscode.Uri.file(historyTask.path + '/DESCRIPTION.md');
                    await vscode.window.showTextDocument(descriptionPath);
                }
            }
        } catch (error) {
            console.error('Error opening task description:', error);
            vscode.window.showErrorMessage('Erro ao abrir descrição da task.');
        }
    }
}
