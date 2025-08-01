import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
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
                    '📁 FORGE precisa de uma pasta de projeto para criar tarefas.\n\nAbra uma pasta primeiro.',
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
                status: TaskStatus.ACTIVE,
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
        await fs.writeFile(path.join(taskPath, 'description.md'), descriptionContent, 'utf8');

        // Create done criteria file
        const doneContent = this.replaceTemplateVars(templates.done, replacements);
        await fs.writeFile(path.join(taskPath, 'done.md'), doneContent, 'utf8');

        // Create difficulties file
        const difficultiesContent = this.replaceTemplateVars(templates.difficulties, replacements);
        await fs.writeFile(path.join(taskPath, 'difficulties.md'), difficultiesContent, 'utf8');
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
            // Get basic task idea
            const taskIdea = await vscode.window.showInputBox({
                prompt: 'Describe what you want to accomplish (AI will help structure it)',
                placeHolder: 'e.g., "I need to add user authentication to my web app"',
                validateInput: (value) => {
                    if (!value || value.trim().length < 10) {
                        return 'Please provide at least 10 characters describing your task';
                    }
                    return null;
                }
            });

            if (!taskIdea) {
                return false;
            }

            // Show that AI is analyzing
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'AI is analyzing your task...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });

                // Simulate AI analysis (in real implementation, this would call an AI service)
                const analysis = this.analyzeTaskWithAI(taskIdea);
                
                progress.report({ increment: 50 });
                
                // Present the analysis to user
                const structuredTask = await this.presentAIAnalysis(analysis);
                
                progress.report({ increment: 100 });
                
                if (structuredTask) {
                    return await this.createTask(structuredTask);
                }
                
                return false;
            });

            return true;
        } catch (error) {
            console.error('Error in smart task creation:', error);
            vscode.window.showErrorMessage('An error occurred during smart task creation.');
            return false;
        }
    }

    private analyzeTaskWithAI(taskIdea: string): any {
        // This is a simplified AI simulation
        // In real implementation, this would call OpenAI/Claude/etc.
        
        const wordCount = taskIdea.split(/\s+/).length;
        const hasComplexTerms = /authentication|database|api|integration|security|deployment/i.test(taskIdea);
        
        let estimatedHours = 2;
        if (wordCount > 20) {
            estimatedHours += 1;
        }
        if (hasComplexTerms) {
            estimatedHours += 2;
        }
        
        return {
            originalIdea: taskIdea,
            suggestedName: this.extractTaskName(taskIdea),
            suggestedDescription: this.enhanceDescription(taskIdea),
            estimatedHours,
            priority: hasComplexTerms ? 'high' : 'medium',
            suggestions: this.generateSuggestions(taskIdea),
            breakdown: estimatedHours > 3 ? this.suggestBreakdown(taskIdea) : null
        };
    }

    private extractTaskName(taskIdea: string): string {
        // Simple extraction - would be more sophisticated with real AI
        const words = taskIdea.split(/\s+/).slice(0, 6);
        return words.join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    }

    private enhanceDescription(taskIdea: string): string {
        return `${taskIdea}\n\n**Auto-generated enhancement:**\n- Ensure proper error handling\n- Consider security implications\n- Plan for testing\n- Document the implementation`;
    }

    private generateSuggestions(taskIdea: string): string[] {
        const suggestions = [
            'Break down into smaller, testable components',
            'Consider edge cases and error scenarios',
            'Plan for proper documentation'
        ];

        if (/auth/i.test(taskIdea)) {
            suggestions.push('Research security best practices');
            suggestions.push('Consider multi-factor authentication');
        }

        if (/database|data/i.test(taskIdea)) {
            suggestions.push('Plan database migrations');
            suggestions.push('Consider data validation');
        }

        return suggestions;
    }

    private suggestBreakdown(taskIdea: string): string[] {
        return [
            'Research and planning phase',
            'Core implementation',
            'Testing and validation',
            'Documentation and cleanup'
        ];
    }

    private async presentAIAnalysis(analysis: any): Promise<any> {
        const items = [
            {
                label: '✅ Accept AI Suggestion',
                description: `"${analysis.suggestedName}" (${analysis.estimatedHours}h)`,
                action: 'accept'
            },
            {
                label: '✏️ Modify Suggestion',
                description: 'Edit the AI-generated task details',
                action: 'modify'
            }
        ];

        if (analysis.breakdown) {
            items.push({
                label: '🔧 Break Down Task',
                description: 'Split into smaller atomic tasks',
                action: 'breakdown'
            });
        }

        const choice = await vscode.window.showQuickPick(items, {
            placeHolder: 'AI Analysis Complete - Choose how to proceed'
        });

        if (!choice) {
            return null;
        }

        switch (choice.action) {
            case 'accept':
                return {
                    name: analysis.suggestedName,
                    description: analysis.suggestedDescription,
                    estimatedHours: analysis.estimatedHours,
                    priority: analysis.priority,
                    atomicitySuggestions: analysis.suggestions
                };

            case 'modify':
                return await this.modifyAISuggestion(analysis);

            case 'breakdown':
                vscode.window.showInformationMessage(
                    'Task breakdown suggested:\n' + analysis.breakdown.join('\n- '),
                    'Create First Task'
                );
                return await this.modifyAISuggestion(analysis);

            default:
                return null;
        }
    }

    private async modifyAISuggestion(analysis: any): Promise<any> {
        // Allow user to modify the AI suggestion
        const name = await vscode.window.showInputBox({
            prompt: 'Task name',
            value: analysis.suggestedName,
            validateInput: (value) => value?.trim().length < 3 ? 'Name too short' : null
        });

        if (!name) {
            return null;
        }

        const description = await vscode.window.showInputBox({
            prompt: 'Task description',
            value: analysis.suggestedDescription,
            validateInput: (value) => value?.trim().length < 10 ? 'Description too short' : null
        });

        if (!description) {
            return null;
        }

        const hours = await vscode.window.showInputBox({
            prompt: 'Estimated hours',
            value: analysis.estimatedHours.toString(),
            validateInput: (value) => {
                const h = parseFloat(value);
                return isNaN(h) || h <= 0 ? 'Invalid hours' : null;
            }
        });

        if (!hours) {
            return null;
        }

        return {
            name,
            description,
            estimatedHours: parseFloat(hours),
            priority: analysis.priority,
            atomicitySuggestions: analysis.suggestions
        };
    }
}
