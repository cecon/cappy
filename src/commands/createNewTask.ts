import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TaskWorkflowManager } from '../utils/taskWorkflowManager';
import { Task, TaskStatus, TaskStep } from '../models/task';
import { TaskXmlManager } from '../utils/taskXmlManager';

export class NewTaskCreator {    
    private workflowManager: TaskWorkflowManager;

    constructor() {
        this.workflowManager = new TaskWorkflowManager();
    }

    public async show(): Promise<boolean> {
        try {
            // Check if workspace exists
            if (!vscode.workspace.workspaceFolders) {
                const openFolder = await vscode.window.showInformationMessage(
                    '📁 Capybara precisa de uma pasta de projeto para criar tarefas.\n\nAbra uma pasta primeiro.',
                    'Abrir Pasta', 'Cancelar'
                );
                
                if (openFolder === 'Abrir Pasta') {
                    try {
                        await vscode.commands.executeCommand('vscode.openFolder');
                    } catch (error) {
                        vscode.window.showInformationMessage('Por favor, abra uma pasta manualmente via File > Open Folder');
                    }
                }
                return false;
            }

            // Check if there's already an active task
            const currentTask = await this.workflowManager.getCurrentTask();
            if (currentTask && currentTask.status === TaskStatus.emAndamento) {
                const choice = await vscode.window.showWarningMessage(
                    `⚠️ Task "${currentTask.title}" está ativa.\n\nO que deseja fazer?`,
                    'Pausar Atual & Criar Nova',
                    'Continuar com Atual',
                    'Cancelar'
                );

                if (choice === 'Continuar com Atual') {
                    // Open current task XML
                    const taskXmlPath = path.join(currentTask.path, 'task.xml');
                    if (fs.existsSync(taskXmlPath)) {
                        await vscode.window.showTextDocument(vscode.Uri.file(taskXmlPath));
                    }
                    return false;
                } else if (choice === 'Pausar Atual & Criar Nova') {
                    // Pause current task
                    currentTask.status = TaskStatus.pausada;
                    currentTask.pausedAt = new Date();
                    TaskXmlManager.saveTaskXml(currentTask, currentTask.path);
                } else {
                    return false;
                }
            }

            // Collect task information
            const taskId = await vscode.window.showInputBox({
                prompt: 'ID da Task (ex: cadastro-cliente-react)',
                placeHolder: 'use-kebab-case',
                validateInput: (value) => {
                    if (!value || value.length < 3) {
                        return 'ID deve ter pelo menos 3 caracteres';
                    }
                    if (!/^[a-z0-9-]+$/.test(value)) {
                        return 'Use apenas letras minúsculas, números e hífens';
                    }
                    return null;
                }
            });

            if (!taskId) {
                return false;
            }

            const title = await vscode.window.showInputBox({
                prompt: 'Título da Task',
                placeHolder: 'Criar página de cadastro de clientes'
            });

            if (!title) {
                return false;
            }

            const description = await vscode.window.showInputBox({
                prompt: 'Descrição da Task',
                placeHolder: 'Desenvolver componente React para cadastro de novos clientes'
            });

            if (!description) {
                return false;
            }

            const mainTechnology = await vscode.window.showQuickPick([
                'React', 'Vue', 'Angular', 'Node.js', 'Python', 'TypeScript', 'JavaScript', 'Java', 'C#', 'Outro'
            ], {
                placeHolder: 'Tecnologia principal'
            });

            if (!mainTechnology) {
                return false;
            }

            let techVersion: string | undefined;
            if (mainTechnology !== 'Outro') {
                techVersion = await vscode.window.showInputBox({
                    prompt: `Versão do ${mainTechnology} (opcional)`,
                    placeHolder: '18+, 3.x, etc.'
                });
            }

            // Create the task with sample steps
            const taskData = {
                id: taskId,
                title: title.trim(),
                description: description.trim(),
                mainTechnology,
                techVersion
            };

            return await this.createTask(taskData);

        } catch (error) {
            console.error('Error in NewTaskCreator:', error);
            vscode.window.showErrorMessage('Ocorreu um erro ao criar a task.');
            return false;
        }
    }

    private async createTask(taskData: any): Promise<boolean> {
        try {
            // Create task folder in .capy/
            const taskPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                taskData.id
            );

            if (!fs.existsSync(taskPath)) {
                fs.mkdirSync(taskPath, { recursive: true });
            }

            // Create sample steps for the task
            const sampleSteps: TaskStep[] = [
                {
                    id: 'step001',
                    order: 1,
                    title: 'Configurar estrutura básica',
                    description: 'Criar estrutura inicial do projeto e configurações necessárias',
                    completed: false,
                    required: true,
                    criteria: [
                        'Estrutura de pastas criada',
                        'Configurações básicas definidas',
                        'Dependências instaladas'
                    ],
                    deliverables: ['Estrutura inicial do projeto']
                },
                {
                    id: 'step002',
                    order: 2,
                    title: 'Implementar funcionalidade principal',
                    description: 'Desenvolver a funcionalidade core conforme especificação',
                    completed: false,
                    required: true,
                    dependsOn: 'step001',
                    criteria: [
                        'Funcionalidade implementada',
                        'Testes básicos funcionando',
                        'Validações aplicadas'
                    ]
                },
                {
                    id: 'step003',
                    order: 3,
                    title: 'Testes e documentação',
                    description: 'Criar testes adequados e documentar o uso',
                    completed: false,
                    required: false,
                    dependsOn: 'step002',
                    criteria: [
                        'Testes unitários criados',
                        'Documentação atualizada',
                        'Exemplos de uso fornecidos'
                    ],
                    deliverables: ['Arquivos de teste', 'Documentação']
                }
            ];

            // Create task object
            const task: Task = {
                id: taskData.id,
                version: '1.0',
                title: taskData.title,
                description: taskData.description,
                status: TaskStatus.emAndamento,
                progress: {
                    completed: 0,
                    total: sampleSteps.length
                },
                createdAt: new Date(),
                path: taskPath,
                context: {
                    mainTechnology: taskData.mainTechnology,
                    version: taskData.techVersion,
                    dependencies: [
                        // Add some common dependencies based on technology
                        ...this.getDefaultDependencies(taskData.mainTechnology)
                    ]
                },
                steps: sampleSteps,
                validation: {
                    checklist: [
                        'Todos os steps obrigatórios concluídos',
                        'Critérios de cada step atendidos',
                        'Entregas geradas conforme especificado',
                        'Testes executados com sucesso'
                    ]
                }
            };

            // Save task as XML
            TaskXmlManager.saveTaskXml(task, taskPath);

            // Set as current active task
            await this.workflowManager.setCurrentTask(taskData.id);

            // Show success message and open XML
            const choice = await vscode.window.showInformationMessage(
                `✅ Task "${task.title}" criada com sucesso e ativada!`,
                'Abrir XML',
                'Abrir Pasta'
            );

            if (choice === 'Abrir XML') {
                const xmlPath = vscode.Uri.file(path.join(taskPath, 'task.xml'));
                await vscode.window.showTextDocument(xmlPath);
            } else if (choice === 'Abrir Pasta') {
                await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(taskPath));
            }

            vscode.window.showInformationMessage(
                `🎯 Task ${taskData.id} está agora ativa. Use o XML para acompanhar o progresso!`
            );

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Falha ao criar task: ${error}`);
            return false;
        }
    }

    private getDefaultDependencies(technology: string): { name: string; type: 'lib' | 'framework' | 'tool' }[] {
        const deps = [];
        
        switch (technology.toLowerCase()) {
            case 'react':
                deps.push(
                    { name: 'react-hook-form', type: 'lib' as const },
                    { name: 'yup', type: 'lib' as const }
                );
                break;
            case 'vue':
                deps.push(
                    { name: 'vuex', type: 'lib' as const },
                    { name: 'vue-router', type: 'lib' as const }
                );
                break;
            case 'node.js':
                deps.push(
                    { name: 'express', type: 'framework' as const },
                    { name: 'typescript', type: 'tool' as const }
                );
                break;
        }
        
        return deps;
    }
}
