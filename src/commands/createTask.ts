import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from '../utils/fileManager';
import { Task, TaskStatus } from '../models/task';

export class TaskCreator {
    private fileManager: FileManager;

    constructor() {
        this.fileManager = new FileManager();
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

            // Get task name
            const taskName = await vscode.window.showInputBox({
                prompt: 'Enter task name',
                placeHolder: 'e.g., Implement user authentication',
                validateInput: (value) => {
                    if (!value || value.trim().length < 3) {
                        return 'Task name must be at least 3 characters long';
                    }
                    if (value.length > 50) {
                        return 'Task name must be less than 50 characters';
                    }
                    return null;
                }
            });

            if (!taskName) {
                return false;
            }

            // Get task description
            const description = await vscode.window.showInputBox({
                prompt: 'Enter detailed description of what needs to be done',
                placeHolder: 'Describe the task goals, requirements, and expected outcomes...',
                validateInput: (value) => {
                    if (!value || value.trim().length < 10) {
                        return 'Description must be at least 10 characters long';
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
                prompt: `Estimated hours for this task (suggested: ${suggestedHours}h)`,
                placeHolder: suggestedHours.toString(),
                value: suggestedHours.toString(),
                validateInput: (value) => {
                    const hours = parseFloat(value);
                    if (isNaN(hours) || hours <= 0) {
                        return 'Please enter a valid number greater than 0';
                    }
                    if (hours > 8) {
                        return 'Tasks should be ≤8 hours. Consider breaking into smaller tasks.';
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
                    `⚠️ This task (${estimatedHours}h) may not be atomic.\n\nAtomic tasks (≤3h) are recommended for better tracking and completion.\n\nProceed anyway?`,
                    'Yes, Create Task',
                    'Let me revise'
                );

                if (proceed !== 'Yes, Create Task') {
                    return false;
                }
            }

            // Get priority
            const priorities = [
                { label: '🔴 High Priority', value: 'high' },
                { label: '🟡 Medium Priority', value: 'medium' },
                { label: '🟢 Low Priority', value: 'low' }
            ];

            const selectedPriority = await vscode.window.showQuickPick(
                priorities.map(p => p.label),
                {
                    placeHolder: 'Select task priority',
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
                atomicitySuggestions: atomicityAnalysis.suggestions
            };

            return await this.createTask(taskData);

        } catch (error) {
            console.error('Error in TaskCreator:', error);
            vscode.window.showErrorMessage('An error occurred while creating the task.');
            return false;
        }
    }

    private async createTask(taskData: any): Promise<boolean> {
        try {
            // Generate task ID
            const taskId = await this.generateTaskId(taskData.name);
            
            // Create task folder
            const taskPath = await this.fileManager.createTaskFolder(taskId);

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
                    confidence: 0.8,
                    suggestions: taskData.atomicitySuggestions || []
                }
            };

            // Generate task files from templates
            await this.generateTaskFiles(taskPath, task, taskData);

            // Show success message and open description
            const choice = await vscode.window.showInformationMessage(
                `✅ Task "${task.name}" created successfully!`,
                'Open Description',
                'Open Folder'
            );

            if (choice === 'Open Description') {
                const descriptionPath = vscode.Uri.file(path.join(taskPath, 'description.md'));
                await vscode.window.showTextDocument(descriptionPath);
            } else if (choice === 'Open Folder') {
                await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(taskPath));
            }

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create task: ${error}`);
            return false;
        }
    }

    private async generateTaskId(taskName: string): Promise<string> {
        const taskFolders = await this.fileManager.getTaskFolders();
        
        // Find next task number
        let maxNumber = 0;
        for (const folder of taskFolders) {
            const match = folder.match(/^TASK_(\d+)_/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumber) {
                    maxNumber = num;
                }
            }
        }

        const nextNumber = maxNumber + 1;
        const sanitizedName = taskName
            .toUpperCase()
            .replace(/[^A-Z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 30);

        return `TASK_${nextNumber.toString().padStart(2, '0')}_${sanitizedName}`;
    }

    private async generateTaskFiles(taskPath: string, task: Task, taskData: any): Promise<void> {
        const templates = {
            description: this.getDescriptionTemplate(),
            done: this.getDoneTemplate(),
            difficulties: this.getDifficultiesTemplate()
        };

        const replacements: Record<string, string> = {};
        replacements['TASK_ID'] = task.id;
        replacements['TASK_NAME'] = task.name;
        replacements['TASK_DESCRIPTION'] = task.description;
        replacements['ESTIMATED_HOURS'] = task.estimatedHours.toString();
        replacements['PRIORITY'] = taskData.priority;
        replacements['CREATED_DATE'] = new Date().toLocaleDateString();
        replacements['ATOMICITY_STATUS'] = task.atomicity?.isAtomic ? '✅ Atomic' : '⚠️ Non-atomic';
        replacements['SUGGESTIONS'] = task.atomicity?.suggestions?.join('\n- ') || 'None';

        // Create description file
        const descriptionContent = this.replaceTemplateVars(templates.description, replacements);
        await fs.promises.writeFile(path.join(taskPath, 'description.md'), descriptionContent, 'utf8');

        // Create done criteria file
        const doneContent = this.replaceTemplateVars(templates.done, replacements);
        await fs.promises.writeFile(path.join(taskPath, 'done.md'), doneContent, 'utf8');

        // Create difficulties file
        const difficultiesContent = this.replaceTemplateVars(templates.difficulties, replacements);
        await fs.promises.writeFile(path.join(taskPath, 'difficulties.md'), difficultiesContent, 'utf8');
    }

    private replaceTemplateVars(template: string, replacements: Record<string, string>): string {
        let result = template;
        for (const [key, value] of Object.entries(replacements)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return result;
    }

    private analyzeAtomicity(description: string): { estimatedHours: number; isAtomic: boolean; confidence: number; suggestions: string[] } {
        const wordCount = description.split(/\s+/).length;
        const complexity = this.calculateComplexity(description);
        
        let estimatedHours = 1;
        
        // Basic estimation based on description length and complexity
        if (wordCount > 50) {
            estimatedHours += 1;
        }
        if (wordCount > 100) {
            estimatedHours += 1;
        }
        if (complexity > 3) {
            estimatedHours += complexity - 3;
        }

        const isAtomic = estimatedHours <= 3;
        const suggestions: string[] = [];

        if (!isAtomic) {
            suggestions.push('Consider breaking this task into smaller subtasks');
            suggestions.push('Focus on one specific aspect at a time');
            suggestions.push('Define clear, measurable deliverables');
        }

        return {
            estimatedHours,
            isAtomic,
            confidence: 0.7,
            suggestions
        };
    }

    private calculateComplexity(description: string): number {
        const complexityKeywords = [
            'integrate', 'implement', 'refactor', 'migrate', 'design',
            'architecture', 'database', 'api', 'security', 'performance',
            'test', 'deploy', 'configure', 'setup'
        ];

        let complexity = 1;
        const lowerDesc = description.toLowerCase();

        for (const keyword of complexityKeywords) {
            if (lowerDesc.includes(keyword)) {
                complexity += 0.5;
            }
        }

        return Math.min(complexity, 5); // Cap at 5
    }

    private getDescriptionTemplate(): string {
        return `# {{TASK_ID}} - {{TASK_NAME}}

## 📋 Overview
{{TASK_DESCRIPTION}}

## 🎯 Objectives
- [ ] Define the primary objective
- [ ] List specific deliverables
- [ ] Identify success criteria

## 📝 Requirements
### Functional Requirements
- Define what the solution must do

### Non-Functional Requirements
- Define performance, security, usability requirements

## 🔧 Technical Approach
### Implementation Strategy
- Outline the approach
- List key technologies/tools
- Define architecture decisions

### Key Components
- Component 1: Description
- Component 2: Description

## 📊 Estimated Effort
- **Hours:** {{ESTIMATED_HOURS}}
- **Priority:** {{PRIORITY}}
- **Atomicity:** {{ATOMICITY_STATUS}}

## 🎭 Definition of Done
See [done.md](./done.md) for completion criteria.

## 🔗 Related Tasks
- Previous: 
- Next: 
- Dependencies: 

## 📎 Artifacts
- [ ] Code files
- [ ] Documentation
- [ ] Tests
- [ ] Configuration

---
*Created: {{CREATED_DATE}}*
`;
    }

    private getDoneTemplate(): string {
        return `# ✅ Definition of Done - {{TASK_ID}}

## 📋 Completion Criteria

### Code Quality
- [ ] Code is implemented and functional
- [ ] Code follows project conventions
- [ ] Code is properly commented
- [ ] No compiler errors or warnings

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests (if applicable)
- [ ] Manual testing completed
- [ ] Edge cases considered

### Documentation
- [ ] Code documentation updated
- [ ] README updated (if needed)
- [ ] API documentation (if applicable)

### Review & Integration
- [ ] Code reviewed
- [ ] Merged to main branch
- [ ] Deployment considerations addressed

### Validation
- [ ] Requirements met
- [ ] Stakeholder approval (if needed)
- [ ] Performance criteria met

## 🎯 Success Metrics
- Functionality works as expected
- No breaking changes introduced
- {{ESTIMATED_HOURS}} hour estimate respected

## 📝 Notes
Add any specific completion notes here.

---
*Task: {{TASK_NAME}}*
*Created: {{CREATED_DATE}}*
`;
    }

    private getDifficultiesTemplate(): string {
        return `# 🚧 Difficulties Faced - {{TASK_ID}}

## 📝 Problem Log

### Template for Recording Issues

#### Problem #1
**Date:** 
**Description:** 
**Context:** 
**Solution:** 
**Time Impact:** 
**Prevention Rule:** 

---

## 💡 Lessons Learned

### What Went Well
- 

### What Could Be Improved
- 

### Knowledge Gained
- 

## 🛡️ Prevention Rules Generated
Document any new prevention rules that should be added to avoid similar issues:

1. **Rule Title:** 
   - **Context:** 
   - **Problem:** 
   - **Solution:** 

---
*Task: {{TASK_NAME}}*
*Estimated: {{ESTIMATED_HOURS}} hours*
*Created: {{CREATED_DATE}}*
`;
    }

    // Smart task creation with AI assistance
    public async showSmartCreation(): Promise<boolean> {
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

            // Get natural language description
            const userDescription = await vscode.window.showInputBox({
                prompt: 'Descreva o que você quer implementar (ex: "Adicionar autenticação OAuth")',
                placeHolder: 'Digite sua descrição em linguagem natural...',
                validateInput: (text) => {
                    if (!text || text.trim().length < 10) {
                        return 'Por favor, forneça uma descrição mais detalhada (pelo menos 10 caracteres)';
                    }
                    return null;
                }
            });

            if (!userDescription) {
                return false;
            }

            // Analyze and generate task details
            const taskDetails = await this.analyzeTaskDescription(userDescription);

            // Show preview and confirmation
            const confirmation = await this.showTaskPreview(taskDetails);
            
            if (confirmation === 'Create') {
                return await this.createTask(taskDetails);
            } else if (confirmation === 'Edit') {
                // Allow manual editing of generated details
                return await this.editGeneratedTask(taskDetails);
            }

            return false;
        } catch (error) {
            console.error('Error in smart task creation:', error);
            vscode.window.showErrorMessage('Ocorreu um erro durante a criação inteligente da tarefa.');
            return false;
        }
    }

    private async analyzeTaskDescription(description: string): Promise<any> {
        const lowerDesc = description.toLowerCase();
        
        // Extract task name (first sentence or main action)
        let name = description.split('.')[0].trim();
        if (name.length > 50) {
            name = name.substring(0, 47) + '...';
        }

        // Estimate complexity/hours based on keywords
        let hours = 2; // default
        if (lowerDesc.includes('implement') || lowerDesc.includes('create') || lowerDesc.includes('build')) {
            hours = 3;
        }
        if (lowerDesc.includes('authentication') || lowerDesc.includes('oauth') || lowerDesc.includes('security')) {
            hours = 4;
        }
        if (lowerDesc.includes('database') || lowerDesc.includes('migration')) {
            hours = 3;
        }
        if (lowerDesc.includes('ui') || lowerDesc.includes('interface') || lowerDesc.includes('frontend')) {
            hours = 3;
        }
        if (lowerDesc.includes('api') || lowerDesc.includes('endpoint')) {
            hours = 2;
        }
        if (lowerDesc.includes('test') || lowerDesc.includes('testing')) {
            hours = 2;
        }

        // Determine priority based on keywords
        let priority = 'medium';
        if (lowerDesc.includes('urgent') || lowerDesc.includes('critical') || lowerDesc.includes('bug')) {
            priority = 'high';
        }
        if (lowerDesc.includes('nice to have') || lowerDesc.includes('enhancement')) {
            priority = 'low';
        }

        // Generate enhanced description
        const enhancedDescription = this.generateEnhancedDescription(description);

        // Generate suggestions based on analysis
        const suggestions = this.generateAtomicitySuggestions(description, hours);

        return {
            name,
            description: enhancedDescription,
            estimatedHours: hours,
            priority,
            atomicitySuggestions: suggestions
        };
    }

    private generateEnhancedDescription(originalDesc: string): string {
        let description = `## Visão Geral da Tarefa\n${originalDesc}\n\n`;
        
        description += `## Abordagem de Implementação\n`;
        description += `- Planejar estratégia de implementação\n`;
        description += `- Considerar implicações de segurança\n`;
        description += `- Garantir qualidade do código e documentação\n\n`;

        description += `## Critérios de Conclusão\n`;
        description += `- [ ] Implementação completa\n`;
        description += `- [ ] Testes passando\n`;
        description += `- [ ] Código revisado\n`;
        description += `- [ ] Documentação atualizada\n`;
        
        return description;
    }

    private generateAtomicitySuggestions(description: string, estimatedHours: number): string[] {
        const suggestions = [];
        const lowerDesc = description.toLowerCase();

        if (estimatedHours > 3) {
            suggestions.push('Considere quebrar esta tarefa em subtarefas menores');
            suggestions.push('Foque em um aspecto específico por vez');
            suggestions.push('Defina entregas claras e mensuráveis');
        }

        // Specific suggestions based on content
        if (lowerDesc.includes('authentication') || lowerDesc.includes('oauth')) {
            suggestions.push('Pesquise melhores práticas de segurança');
            suggestions.push('Configure provedor OAuth');
            suggestions.push('Implemente fluxo de login/logout');
        }

        if (lowerDesc.includes('database')) {
            suggestions.push('Planeje migrações de banco de dados');
            suggestions.push('Considere validação de dados');
        }

        if (lowerDesc.includes('api')) {
            suggestions.push('Projete endpoints da API');
            suggestions.push('Adicione validação de entrada');
            suggestions.push('Escreva documentação da API');
        }

        return suggestions;
    }

    private async showTaskPreview(taskDetails: any): Promise<string> {
        const items = [
            {
                label: '✅ Criar Tarefa',
                description: 'Criar a tarefa com os detalhes gerados',
                detail: 'A tarefa será criada automaticamente',
                value: 'Create'
            },
            {
                label: '✏️ Editar Antes de Criar',
                description: 'Revisar e modificar os detalhes gerados',
                detail: 'Abrir formulário com dados pré-preenchidos',
                value: 'Edit'
            },
            {
                label: '❌ Cancelar',
                description: 'Cancelar criação da tarefa',
                detail: 'Nenhuma tarefa será criada',
                value: 'Cancel'
            }
        ];

        const preview = `
📝 **Preview da Tarefa Gerada:**

**Nome:** ${taskDetails.name}
**Prioridade:** ${taskDetails.priority}
**Horas Estimadas:** ${taskDetails.estimatedHours}

**Prévia da Descrição:**
${taskDetails.description.substring(0, 200)}...

**Sugestões:** ${taskDetails.atomicitySuggestions.length} geradas
        `;

        vscode.window.showInformationMessage(preview);

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'O que você gostaria de fazer com esta tarefa gerada?'
        });

        return selection?.value || 'Cancel';
    }

    private async editGeneratedTask(taskDetails: any): Promise<boolean> {
        // Allow user to edit the generated task details manually
        const name = await vscode.window.showInputBox({
            prompt: 'Nome da tarefa',
            value: taskDetails.name,
            validateInput: (value) => {
                if (!value || value.trim().length < 3) {
                    return 'Nome da tarefa deve ter pelo menos 3 caracteres';
                }
                if (value.length > 50) {
                    return 'Nome da tarefa deve ter menos de 50 caracteres';
                }
                return null;
            }
        });

        if (!name) {
            return false;
        }

        const description = await vscode.window.showInputBox({
            prompt: 'Descrição detalhada do que precisa ser feito',
            value: taskDetails.description,
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

        const hoursInput = await vscode.window.showInputBox({
            prompt: 'Horas estimadas para esta tarefa',
            value: taskDetails.estimatedHours.toString(),
            validateInput: (value) => {
                const hours = parseFloat(value);
                if (isNaN(hours) || hours <= 0) {
                    return 'Por favor, insira um número válido maior que 0';
                }
                if (hours > 8) {
                    return 'Tarefas devem ser ≤8 horas. Considere quebrar em tarefas menores.';
                }
                return null;
            }
        });

        if (!hoursInput) {
            return false;
        }

        const estimatedHours = parseFloat(hoursInput);

        // Get priority
        const priorities = [
            { label: '🔴 Alta Prioridade', value: 'high' },
            { label: '🟡 Média Prioridade', value: 'medium' },
            { label: '🟢 Baixa Prioridade', value: 'low' }
        ];

        const selectedPriority = await vscode.window.showQuickPick(
            priorities.map(p => p.label),
            {
                placeHolder: 'Selecione a prioridade da tarefa',
                canPickMany: false
            }
        );

        if (!selectedPriority) {
            return false;
        }

        const priority = priorities.find(p => p.label === selectedPriority)?.value || 'medium';

        // Create the modified task
        const modifiedTaskData = {
            name: name.trim(),
            description: description.trim(),
            estimatedHours,
            priority,
            atomicitySuggestions: taskDetails.atomicitySuggestions
        };

        return await this.createTask(modifiedTaskData);
    }


}
