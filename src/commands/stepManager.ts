import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TaskWorkflowManager } from '../utils/taskWorkflowManager';
import { TaskXmlManager } from '../utils/taskXmlManager';

export class StepManager {
    private workflowManager: TaskWorkflowManager;

    constructor() {
        this.workflowManager = new TaskWorkflowManager();
    }

    public async markStepCompleted(): Promise<void> {
        try {
            const currentTask = await this.workflowManager.getCurrentTask();
            if (!currentTask) {
                vscode.window.showWarningMessage('❌ Nenhuma task ativa encontrada.');
                return;
            }

            // Get incomplete steps
            const incompleteSteps = currentTask.steps.filter(step => !step.completed);
            if (incompleteSteps.length === 0) {
                vscode.window.showInformationMessage('✅ Todos os steps já foram concluídos!');
                return;
            }

            // Show step selection
            const stepOptions = incompleteSteps.map(step => ({
                label: `${step.id}: ${step.title}`,
                description: step.description,
                step: step
            }));

            const selectedOption = await vscode.window.showQuickPick(stepOptions, {
                placeHolder: 'Selecione o step para marcar como concluído'
            });

            if (!selectedOption) {
                return;
            }

            const step = selectedOption.step;

            // Check if step has dependencies
            if (step.dependsOn) {
                const dependency = currentTask.steps.find(s => s.id === step.dependsOn);
                if (dependency && !dependency.completed) {
                    vscode.window.showWarningMessage(
                        `❌ Este step depende de "${dependency.title}" que ainda não foi concluído.`
                    );
                    return;
                }
            }

            // Show step criteria for validation
            if (step.criteria.length > 0) {
                const criteriaMessage = step.criteria
                    .map((criterio, index) => `${index + 1}. ${criterio}`)
                    .join('\n');
                
                const confirm = await vscode.window.showInformationMessage(
                    `Confirmar conclusão do step "${step.title}"?\n\nCritérios:\n${criteriaMessage}`,
                    'Sim, Concluir',
                    'Cancelar'
                );

                if (confirm !== 'Sim, Concluir') {
                    return;
                }
            }

            // Mark step as completed
            await this.workflowManager.updateStepCompletion(step.id, true);

            // Show success message
            const updatedTask = await this.workflowManager.getCurrentTask();
            const completedCount = updatedTask?.steps.filter(s => s.completed).length || 0;
            const totalCount = updatedTask?.steps.length || 0;

            vscode.window.showInformationMessage(
                `✅ Step "${step.title}" marcado como concluído! (${completedCount}/${totalCount})`
            );

            // Check if all required steps are completed
            const requiredSteps = currentTask.steps.filter(s => s.required);
            const completedRequiredSteps = requiredSteps.filter(s => s.completed || s.id === step.id);
            
            if (completedRequiredSteps.length === requiredSteps.length) {
                const completeTask = await vscode.window.showInformationMessage(
                    '🎉 Todos os steps obrigatórios foram concluídos!\n\nDeseja completar a task?',
                    'Sim, Completar Task',
                    'Continuar Trabalhando'
                );

                if (completeTask === 'Sim, Completar Task') {
                    await this.workflowManager.completeCurrentTask();
                }
            }

        } catch (error) {
            console.error('Error marking step completed:', error);
            vscode.window.showErrorMessage(`Erro ao atualizar step: ${error}`);
        }
    }

    public async markStepIncomplete(): Promise<void> {
        try {
            const currentTask = await this.workflowManager.getCurrentTask();
            if (!currentTask) {
                vscode.window.showWarningMessage('❌ Nenhuma task ativa encontrada.');
                return;
            }

            // Get completed steps
            const completedSteps = currentTask.steps.filter(step => step.completed);
            if (completedSteps.length === 0) {
                vscode.window.showInformationMessage('❌ Nenhum step foi concluído ainda.');
                return;
            }

            // Show step selection
            const stepOptions = completedSteps.map(step => ({
                label: `${step.id}: ${step.title}`,
                description: step.description,
                step: step
            }));

            const selectedOption = await vscode.window.showQuickPick(stepOptions, {
                placeHolder: 'Selecione o step para marcar como não concluído'
            });

            if (!selectedOption) {
                return;
            }

            const step = selectedOption.step;

            // Check if other steps depend on this one
            const dependentSteps = currentTask.steps.filter(s => s.dependsOn === step.id && s.completed);
            if (dependentSteps.length > 0) {
                const dependentNames = dependentSteps.map(s => s.title).join(', ');
                vscode.window.showWarningMessage(
                    `❌ Não é possível marcar como incompleto. Os seguintes steps dependem deste: ${dependentNames}`
                );
                return;
            }

            // Confirm action
            const confirm = await vscode.window.showWarningMessage(
                `Marcar step "${step.title}" como não concluído?`,
                'Sim, Marcar como Incompleto',
                'Cancelar'
            );

            if (confirm !== 'Sim, Marcar como Incompleto') {
                return;
            }

            // Mark step as incomplete
            await this.workflowManager.updateStepCompletion(step.id, false);

            vscode.window.showInformationMessage(
                `✅ Step "${step.title}" marcado como não concluído.`
            );

        } catch (error) {
            console.error('Error marking step incomplete:', error);
            vscode.window.showErrorMessage(`Erro ao atualizar step: ${error}`);
        }
    }

    public async showStepProgress(): Promise<void> {
        try {
            const currentTask = await this.workflowManager.getCurrentTask();
            if (!currentTask) {
                vscode.window.showWarningMessage('❌ Nenhuma task ativa encontrada.');
                return;
            }

            // Create progress report
            const totalSteps = currentTask.steps.length;
            const completedSteps = currentTask.steps.filter(s => s.completed).length;
            const requiredSteps = currentTask.steps.filter(s => s.required).length;
            const completedRequiredSteps = currentTask.steps.filter(s => s.required && s.completed).length;

            let progressReport = `# 📊 Progresso da Task: ${currentTask.title}\n\n`;
            progressReport += `**Progresso Geral:** ${completedSteps}/${totalSteps} steps\n`;
            progressReport += `**Steps Obrigatórios:** ${completedRequiredSteps}/${requiredSteps} steps\n`;
            progressReport += `**Status:** ${currentTask.status}\n\n`;

            progressReport += `## 📋 Detalhes dos Steps\n\n`;

            for (const step of currentTask.steps) {
                const status = step.completed ? '✅' : '⏳';
                const required = step.required ? '🔴' : '🔵';
                const dependency = step.dependsOn ? ` (depende de ${step.dependsOn})` : '';

                progressReport += `${status} ${required} **${step.id}**: ${step.title}${dependency}\n`;
                progressReport += `   ${step.description}\n`;
                
                if (step.criteria.length > 0) {
                    progressReport += `   **Critérios:**\n`;
                    for (const criterio of step.criteria) {
                        progressReport += `   - ${criterio}\n`;
                    }
                }
                
                if (step.deliverables && step.deliverables.length > 0) {
                    progressReport += `   **Entregas:** ${step.deliverables.join(', ')}\n`;
                }
                
                progressReport += `\n`;
            }

            progressReport += `\n---\n`;
            progressReport += `**Legenda:**\n`;
            progressReport += `✅ = Concluído | ⏳ = Pendente\n`;
            progressReport += `🔴 = Obrigatório | 🔵 = Opcional\n`;

            // Show in new document
            const doc = await vscode.workspace.openTextDocument({
                content: progressReport,
                language: 'markdown'
            });

            await vscode.window.showTextDocument(doc);

        } catch (error) {
            console.error('Error showing step progress:', error);
            vscode.window.showErrorMessage(`Erro ao mostrar progresso: ${error}`);
        }
    }
}
