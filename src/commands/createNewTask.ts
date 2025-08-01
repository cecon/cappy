import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TaskWorkflowManager } from '../utils/taskWorkflowManager';
import { Task, TaskStatus } from '../models/task';

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
            if (currentTask && currentTask.status === TaskStatus.active) {
                const choice = await vscode.window.showWarningMessage(
                    `⚠️ Task "${currentTask.name}" is currently active.\n\nWhat would you like to do?`,
                    'Pause Current & Create New',
                    'Continue with Current',
                    'Cancel'
                );

                if (choice === 'Continue with Current') {
                    // Open current task description
                    const descriptionPath = path.join(currentTask.path, 'DESCRIPTION.md');
                    if (fs.existsSync(descriptionPath)) {
                        await vscode.window.showTextDocument(vscode.Uri.file(descriptionPath));
                    }
                    return false;
                } else if (choice === 'Pause Current & Create New') {
                    await this.workflowManager.pauseCurrentTask();
                } else {
                    return false;
                }
            }

            // Get task name
            const taskName = await vscode.window.showInputBox({
                prompt: 'Nome da nova task',
                placeHolder: 'ex: Implementar autenticação JWT',
                validateInput: (value) => {
                    if (!value || value.trim().length < 3) {
                        return 'Nome da task deve ter pelo menos 3 caracteres';
                    }
                    if (value.length > 50) {
                        return 'Nome da task deve ter menos de 50 caracteres';
                    }
                    return null;
                }
            });

            if (!taskName) {
                return false;
            }

            // Get task description
            const description = await vscode.window.showInputBox({
                prompt: 'Descrição detalhada do que precisa ser feito',
                placeHolder: 'Descreva os objetivos, requisitos e resultados esperados...',
                validateInput: (value) => {
                    if (!value || value.trim().length < 10) {
                        return 'Descrição deve ter pelo menos 10 caracteres';
                    }
                    return null;
                }
            });

            if (!description) {
                return false;
            }

            // Analyze atomicity
            const atomicityAnalysis = this.analyzeAtomicity(description);
            
            // Get estimated hours with suggestion
            const suggestedHours = atomicityAnalysis.estimatedHours;
            const hoursInput = await vscode.window.showInputBox({
                prompt: `Horas estimadas para esta task (sugerido: ${suggestedHours}h)`,
                placeHolder: suggestedHours.toString(),
                value: suggestedHours.toString(),
                validateInput: (value) => {
                    const hours = parseFloat(value);
                    if (isNaN(hours) || hours <= 0) {
                        return 'Digite um número válido maior que 0';
                    }
                    if (hours > 8) {
                        return 'Tasks devem ser ≤8 horas. Considere quebrar em tasks menores.';
                    }
                    return null;
                }
            });

            if (!hoursInput) {
                return false;
            }

            const estimatedHours = parseFloat(hoursInput);

            // Warn if task is not atomic
            if (estimatedHours > 3) {
                const proceed = await vscode.window.showWarningMessage(
                    `⚠️ Esta task (${estimatedHours}h) pode não ser atômica.\n\nTasks atômicas (≤3h) são recomendadas para melhor rastreamento.\n\nProsseguir mesmo assim?`,
                    'Sim, Criar Task',
                    'Deixe-me revisar'
                );

                if (proceed !== 'Sim, Criar Task') {
                    return false;
                }
            }

            // Get priority
            const priorities = [
                { label: '🔴 Alta Prioridade', value: 'high' },
                { label: '🟡 Média Prioridade', value: 'medium' },
                { label: '🟢 Baixa Prioridade', value: 'low' }
            ];

            const selectedPriority = await vscode.window.showQuickPick(
                priorities.map(p => p.label),
                {
                    placeHolder: 'Selecione a prioridade da task',
                    canPickMany: false
                }
            );

            if (!selectedPriority) {
                return false;
            }

            const priority = priorities.find(p => p.label === selectedPriority)?.value || 'medium';

            // Create the task
            const taskData = {
                name: taskName.trim(),
                description: description.trim(),
                estimatedHours,
                priority,
                atomicityAnalysis
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
            // Get next task number
            const taskNumber = await this.workflowManager.getNextTaskNumber();
            const taskId = `task_${taskNumber.toString().padStart(4, '0')}`;
            
            // Create task folder in .capy/
            const taskPath = path.join(
                vscode.workspace.workspaceFolders![0].uri.fsPath,
                '.capy',
                taskId
            );

            if (!fs.existsSync(taskPath)) {
                fs.mkdirSync(taskPath, { recursive: true });
            }

            // Create artifacts folder
            const artifactsPath = path.join(taskPath, 'artifacts');
            if (!fs.existsSync(artifactsPath)) {
                fs.mkdirSync(artifactsPath);
            }

            // Create task object
            const task: Task = {
                id: taskId,
                name: taskData.name,
                description: taskData.description,
                status: TaskStatus.active,
                estimatedHours: taskData.estimatedHours,
                createdAt: new Date(),
                path: taskPath,
                artifacts: [],
                difficulties: [],
                preventionRules: [],
                atomicity: {
                    isAtomic: taskData.estimatedHours <= 3,
                    estimatedHours: taskData.estimatedHours,
                    confidence: taskData.atomicityAnalysis.confidence,
                    suggestions: taskData.atomicityAnalysis.suggestions || []
                }
            };

            // Inherit prevention rules from last completed task
            await this.inheritPreventionRules(task);

            // Generate task files
            await this.generateTaskFiles(taskPath, task, taskData);

            // Save task metadata
            const metadataPath = path.join(taskPath, 'task-metadata.json');
            const metadata = { ...task, path: undefined }; // Don't save path in metadata
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

            // Set as current active task
            await this.workflowManager.setCurrentTask(taskId);

            // Increment task counter
            await this.workflowManager.incrementTaskNumber();

            // Show success message and open description
            const choice = await vscode.window.showInformationMessage(
                `✅ Task "${task.name}" criada com sucesso e ativada!`,
                'Abrir Descrição',
                'Abrir Pasta'
            );

            if (choice === 'Abrir Descrição') {
                const descriptionPath = vscode.Uri.file(path.join(taskPath, 'DESCRIPTION.md'));
                await vscode.window.showTextDocument(descriptionPath);
            } else if (choice === 'Abrir Pasta') {
                await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(taskPath));
            }

            vscode.window.showInformationMessage(
                `🎯 Task ${taskId} está agora ativa. Use o Copilot para começar o desenvolvimento!`
            );

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Falha ao criar task: ${error}`);
            return false;
        }
    }

    private async inheritPreventionRules(task: Task): Promise<void> {
        try {
            // Get last completed task from history
            const completedTasks = await this.workflowManager.listCompletedTasks();
            if (completedTasks.length === 0) {
                return;
            }

            // Sort by completion date and get the most recent
            const lastTask = completedTasks
                .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0];

            // Read difficulties from last task
            const difficultiesPath = path.join(lastTask.path, 'DIFFICULTIES_FACED.md');
            if (fs.existsSync(difficultiesPath)) {
                const difficultiesContent = fs.readFileSync(difficultiesPath, 'utf8');
                
                // Extract prevention rules (simplified - you might want to implement better parsing)
                const ruleMatches = difficultiesContent.match(/DON'T.*$/gm);
                if (ruleMatches) {
                    task.preventionRules = ruleMatches.slice(0, 15); // Limit to 15 rules
                }
            }
        } catch (error) {
            console.error('Error inheriting prevention rules:', error);
        }
    }

    private async generateTaskFiles(taskPath: string, task: Task, taskData: any): Promise<void> {
        // Generate DESCRIPTION.md
        const descriptionContent = this.generateDescriptionContent(task, taskData);
        fs.writeFileSync(path.join(taskPath, 'DESCRIPTION.md'), descriptionContent);

        // Generate DONE.md template
        const doneContent = this.generateDoneTemplate(task);
        fs.writeFileSync(path.join(taskPath, 'DONE.md'), doneContent);

        // Generate DIFFICULTIES_FACED.md template
        const difficultiesContent = this.generateDifficultiesTemplate(task);
        fs.writeFileSync(path.join(taskPath, 'DIFFICULTIES_FACED.md'), difficultiesContent);
    }

    private generateDescriptionContent(task: Task, taskData: any): string {
        const inheritedRules = task.preventionRules.length > 0 
            ? `\n## 🚨 Prevention Rules (Inherited)\n\n${task.preventionRules.map(rule => `- ${rule}`).join('\n')}\n`
            : '';

        return `# ${task.name}

**Task ID:** ${task.id}  
**Status:** ${task.status}  
**Created:** ${task.createdAt.toLocaleDateString()}  
**Estimated:** ${task.estimatedHours}h  
**Priority:** ${taskData.priority}

## 📋 Description

${task.description}

## 🎯 Success Criteria

- [ ] [Define specific completion criteria here]
- [ ] [Add measurable outcomes]
- [ ] [Include testing requirements]

## 🔧 Technical Scope

- **Technologies:** [List relevant technologies]
- **Dependencies:** [List dependencies]
- **Architecture:** [Describe approach]

## ⚛️ Atomicity Analysis

- **Is Atomic:** ${task.atomicity.isAtomic ? 'Yes' : 'No'}
- **Confidence:** ${task.atomicity.confidence}/10
- **Estimated Hours:** ${task.atomicity.estimatedHours}h

${task.atomicity.suggestions?.length ? `### Suggestions:\n${task.atomicity.suggestions.map(s => `- ${s}`).join('\n')}` : ''}

${inheritedRules}

## 📝 Implementation Notes

[Add implementation details as you work on this task]

---
*Generated by Capybara - ${new Date().toLocaleString()}*
`;
    }

    private generateDoneTemplate(task: Task): string {
        return `# ✅ ${task.name} - COMPLETED

**Task ID:** ${task.id}  
**Completion Date:** [To be filled when completed]  
**Actual Hours:** [To be filled when completed]

## 🎯 Completed Criteria

- [ ] [Mark completed criteria here]
- [ ] [Add verification steps]
- [ ] [Include test results]

## 📊 Results

### What was accomplished:
- [List major accomplishments]
- [Include code changes]
- [Note any architectural decisions]

### Files created/modified:
- [List files]

### Tests added:
- [List test files/cases]

## 📈 Lessons Learned

### What went well:
- [Positive outcomes]

### What could be improved:
- [Areas for improvement]

## 🔄 Next Steps

- [Any follow-up tasks needed]
- [Related tasks to consider]

---
*Completed on: [Date]*
`;
    }

    private generateDifficultiesTemplate(task: Task): string {
        const inheritedSection = task.preventionRules.length > 0 
            ? `## 📋 Accumulated DON'Ts from Previous Tasks

${task.preventionRules.map(rule => `- ${rule}`).join('\n')}

---

`
            : '';

        return `# 🚨 ${task.name} - Difficulties & Prevention Rules

**Task ID:** ${task.id}

${inheritedSection}## 🐛 Problems Encountered

### [Problem Category 1]
**Problem:** [Describe the issue]  
**Context:** [When/where it occurred]  
**Solution:** [How it was resolved]  
**Prevention Rule:** DON'T [specific rule to prevent this]

### [Problem Category 2]
**Problem:** [Describe the issue]  
**Context:** [When/where it occurred]  
**Solution:** [How it was resolved]  
**Prevention Rule:** DON'T [specific rule to prevent this]

---

## 🔄 Accumulated DON'Ts for Next Task

[This section will be automatically updated when task is completed]

---
*Updated: ${new Date().toLocaleString()}*
`;
    }

    private analyzeAtomicity(description: string): any {
        // Simple heuristic-based analysis
        const words = description.toLowerCase().split(' ');
        const complexityKeywords = [
            'implement', 'create', 'build', 'develop', 'design',
            'integrate', 'configure', 'setup', 'deploy'
        ];
        
        const complexityScore = words.filter(word => 
            complexityKeywords.some(keyword => word.includes(keyword))
        ).length;

        const estimatedHours = Math.min(Math.max(complexityScore * 0.5 + 1, 1), 8);
        const confidence = complexityScore <= 4 ? 8 : 6;

        return {
            estimatedHours: Math.round(estimatedHours * 2) / 2, // Round to nearest 0.5
            confidence,
            suggestions: estimatedHours > 3 ? [
                'Consider breaking into smaller sub-tasks',
                'Focus on single responsibility principle',
                'Ensure task can be completed in one sitting'
            ] : []
        };
    }
}
