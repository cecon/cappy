import * as vscode from 'vscode';
import { TaskCreator } from './createTask';

export class SmartTaskCreator {
    private taskCreator: TaskCreator;

    constructor() {
        this.taskCreator = new TaskCreator();
    }

    public async show(): Promise<boolean> {
        // Get user input - natural language description
        const userDescription = await vscode.window.showInputBox({
            prompt: 'Describe what you want to implement (e.g., "Add user authentication with OAuth")',
            placeHolder: 'Enter your task description in natural language...',
            validateInput: (text) => {
                if (!text || text.trim().length < 10) {
                    return 'Please provide a more detailed description (at least 10 characters)';
                }
                return null;
            }
        });

        if (!userDescription) {
            return false;
        }

        // Analyze the description and generate task details
        const taskDetails = await this.analyzeTaskDescription(userDescription);

        // Show confirmation dialog with generated details
        const confirmation = await this.showTaskPreview(taskDetails);
        
        if (confirmation === 'Create') {
            return await this.createTaskWithDetails(taskDetails);
        } else if (confirmation === 'Edit') {
            // Open the regular task creator with pre-filled data
            return await this.taskCreator.showWithPrefill(taskDetails);
        }

        return false;
    }

    private async analyzeTaskDescription(description: string): Promise<any> {
        // Simple AI-like analysis (can be enhanced with actual AI APIs)
        const analysis = this.parseDescription(description);
        
        return {
            name: analysis.name,
            description: analysis.description,
            estimatedHours: analysis.hours,
            priority: analysis.priority,
            category: analysis.category,
            subtasks: analysis.subtasks
        };
    }

    private parseDescription(description: string): any {
        const lowerDesc = description.toLowerCase();
        
        // Extract task name (first few words or main action)
        let name = description.split('.')[0].trim();
        if (name.length > 50) {
            name = name.substring(0, 47) + '...';
        }

        // Estimate complexity/hours based on keywords
        let hours = 2; // default
        if (lowerDesc.includes('implement') || lowerDesc.includes('create') || lowerDesc.includes('build')) {
            hours = 4;
        }
        if (lowerDesc.includes('authentication') || lowerDesc.includes('oauth') || lowerDesc.includes('security')) {
            hours = 6;
        }
        if (lowerDesc.includes('database') || lowerDesc.includes('migration')) {
            hours = 3;
        }
        if (lowerDesc.includes('ui') || lowerDesc.includes('interface') || lowerDesc.includes('frontend')) {
            hours = 4;
        }
        if (lowerDesc.includes('api') || lowerDesc.includes('endpoint')) {
            hours = 3;
        }
        if (lowerDesc.includes('test') || lowerDesc.includes('testing')) {
            hours = 2;
        }

        // Determine priority based on keywords
        let priority = 'Medium';
        if (lowerDesc.includes('urgent') || lowerDesc.includes('critical') || lowerDesc.includes('bug')) {
            priority = 'High';
        }
        if (lowerDesc.includes('nice to have') || lowerDesc.includes('enhancement')) {
            priority = 'Low';
        }

        // Categorize based on content
        let category = 'Development';
        if (lowerDesc.includes('test') || lowerDesc.includes('testing')) {
            category = 'Testing';
        }
        if (lowerDesc.includes('bug') || lowerDesc.includes('fix')) {
            category = 'Bug Fix';
        }
        if (lowerDesc.includes('ui') || lowerDesc.includes('design')) {
            category = 'UI/UX';
        }
        if (lowerDesc.includes('doc') || lowerDesc.includes('documentation')) {
            category = 'Documentation';
        }
        if (lowerDesc.includes('deploy') || lowerDesc.includes('config')) {
            category = 'DevOps';
        }

        // Generate detailed description with subtasks
        const detailedDescription = this.generateDetailedDescription(description, category);

        return {
            name,
            description: detailedDescription,
            hours,
            priority,
            category,
            subtasks: this.generateSubtasks(description, category)
        };
    }

    private generateDetailedDescription(originalDesc: string, category: string): string {
        let description = `## Task Overview\n${originalDesc}\n\n`;
        
        description += `## Implementation Approach\n`;
        
        switch (category) {
            case 'Testing':
                description += `- Write comprehensive test cases\n- Ensure good code coverage\n- Test edge cases and error scenarios\n`;
                break;
            case 'UI/UX':
                description += `- Design user-friendly interface\n- Ensure responsive design\n- Follow accessibility guidelines\n`;
                break;
            case 'Bug Fix':
                description += `- Reproduce the issue\n- Identify root cause\n- Implement fix with tests\n`;
                break;
            default:
                description += `- Plan implementation strategy\n- Consider security implications\n- Ensure code quality and documentation\n`;
        }

        description += `\n## Definition of Done\n- [ ] Implementation complete\n- [ ] Tests passing\n- [ ] Code reviewed\n- [ ] Documentation updated\n`;
        
        return description;
    }

    private generateSubtasks(description: string, category: string): string[] {
        const subtasks = [];
        const lowerDesc = description.toLowerCase();

        // Common subtasks based on category
        if (category === 'Development') {
            subtasks.push('Plan implementation approach');
            subtasks.push('Set up development environment');
            subtasks.push('Implement core functionality');
            subtasks.push('Add error handling');
            subtasks.push('Write unit tests');
        }

        // Specific subtasks based on keywords
        if (lowerDesc.includes('authentication') || lowerDesc.includes('oauth')) {
            subtasks.push('Configure OAuth provider');
            subtasks.push('Implement login/logout flow');
            subtasks.push('Add session management');
            subtasks.push('Secure API endpoints');
        }

        if (lowerDesc.includes('database')) {
            subtasks.push('Design database schema');
            subtasks.push('Create migration scripts');
            subtasks.push('Implement data access layer');
            subtasks.push('Add data validation');
        }

        if (lowerDesc.includes('api')) {
            subtasks.push('Design API endpoints');
            subtasks.push('Implement request/response models');
            subtasks.push('Add input validation');
            subtasks.push('Write API documentation');
        }

        return subtasks.slice(0, 5); // Limit to 5 subtasks
    }

    private async showTaskPreview(taskDetails: any): Promise<string> {
        const items = [
            {
                label: '✅ Create Task',
                description: 'Create the task with generated details',
                detail: 'Task will be created automatically',
                value: 'Create'
            },
            {
                label: '✏️ Edit Before Creating',
                description: 'Review and modify the generated details',
                detail: 'Open form with pre-filled data',
                value: 'Edit'
            },
            {
                label: '❌ Cancel',
                description: 'Cancel task creation',
                detail: 'No task will be created',
                value: 'Cancel'
            }
        ];

        const preview = `
📝 **Generated Task Preview:**

**Name:** ${taskDetails.name}
**Category:** ${taskDetails.category}
**Priority:** ${taskDetails.priority}
**Estimated Hours:** ${taskDetails.estimatedHours}

**Description Preview:**
${taskDetails.description.substring(0, 200)}...

**Subtasks:** ${taskDetails.subtasks.length} generated
        `;

        vscode.window.showInformationMessage(preview);

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'What would you like to do with this generated task?'
        });

        return selection?.value || 'Cancel';
    }

    private async createTaskWithDetails(taskDetails: any): Promise<boolean> {
        try {
            // Use the existing task creation logic but with generated data
            const success = await this.taskCreator.createTaskWithData(taskDetails);
            
            if (success) {
                vscode.window.showInformationMessage(
                    `✅ Smart task "${taskDetails.name}" created successfully!`
                );
            }
            
            return success;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create smart task: ${error}`);
            return false;
        }
    }
}
