import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ChatProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'cappy.chatView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'generateTodoList':
                        this.handleGenerateTodoList(message.prompt);
                        break;
                    case 'createTask':
                        this.handleCreateTask(message.todoData);
                        break;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }

    private async handleGenerateTodoList(prompt: string) {
        try {
            // Simulate AI processing for now
            const todoItems = this.generateTodoFromPrompt(prompt);
            
            // Send response back to webview
            this._view?.webview.postMessage({
                type: 'todoGenerated',
                data: todoItems
            });
        } catch (error) {
            this._view?.webview.postMessage({
                type: 'error',
                message: `Error generating todo list: ${error}`
            });
        }
    }

    private generateTodoFromPrompt(prompt: string): any[] {
        const keywords = prompt.toLowerCase();
        const todoItems = [];
        let idCounter = 1;

        // Analyze the prompt for different types of tasks
        const taskTypes = this.analyzeTaskTypes(keywords);
        
        // Generate context-aware todos based on task analysis
        if (taskTypes.includes('api') || taskTypes.includes('backend')) {
            todoItems.push({
                id: idCounter++,
                title: 'Design API structure',
                description: 'Define endpoints, request/response schemas, and authentication requirements',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Setup backend framework',
                description: 'Initialize project structure with chosen framework (Express, FastAPI, etc.)',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Implement core endpoints',
                description: 'Create main API endpoints with proper error handling',
                completed: false
            });
        }

        if (taskTypes.includes('frontend') || taskTypes.includes('ui') || taskTypes.includes('react') || taskTypes.includes('vue')) {
            todoItems.push({
                id: idCounter++,
                title: 'Setup frontend project',
                description: 'Initialize project with chosen framework and build tools',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Create component structure',
                description: 'Design and implement reusable UI components',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Implement routing and navigation',
                description: 'Setup application routing and navigation flow',
                completed: false
            });
        }

        if (taskTypes.includes('database') || taskTypes.includes('db') || taskTypes.includes('sql')) {
            todoItems.push({
                id: idCounter++,
                title: 'Design database schema',
                description: 'Define tables, relationships, and constraints',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Setup database connection',
                description: 'Configure database connection and ORM/query builder',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Create migration scripts',
                description: 'Write database migration and seed scripts',
                completed: false
            });
        }

        if (taskTypes.includes('test') || taskTypes.includes('testing')) {
            todoItems.push({
                id: idCounter++,
                title: 'Setup testing framework',
                description: 'Configure testing environment and tools',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Write unit tests',
                description: 'Create unit tests for core functionality',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Add integration tests',
                description: 'Implement end-to-end and integration tests',
                completed: false
            });
        }

        if (taskTypes.includes('deployment') || taskTypes.includes('deploy')) {
            todoItems.push({
                id: idCounter++,
                title: 'Setup CI/CD pipeline',
                description: 'Configure automated build and deployment process',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Configure production environment',
                description: 'Setup production server and environment variables',
                completed: false
            });
        }

        if (taskTypes.includes('documentation') || taskTypes.includes('docs')) {
            todoItems.push({
                id: idCounter++,
                title: 'Write API documentation',
                description: 'Create comprehensive API documentation with examples',
                completed: false
            });
            todoItems.push({
                id: idCounter++,
                title: 'Add code comments',
                description: 'Document code with clear comments and JSDoc',
                completed: false
            });
        }

        // Always add these universal steps if specific ones weren't generated
        if (todoItems.length === 0) {
            const projectPhases = this.generateGenericPhases(prompt);
            todoItems.push(...projectPhases);
        }

        // Add final review step
        todoItems.push({
            id: idCounter++,
            title: 'Review and test',
            description: 'Final review, testing, and quality assurance',
            completed: false
        });

        return todoItems.slice(0, 8); // Limit to 8 items max
    }

    private analyzeTaskTypes(keywords: string): string[] {
        const types = [];
        
        // API/Backend keywords
        if (/\b(api|backend|server|endpoint|rest|graphql|microservice)\b/.test(keywords)) {
            types.push('api', 'backend');
        }
        
        // Frontend keywords
        if (/\b(frontend|ui|interface|react|vue|angular|component|web app)\b/.test(keywords)) {
            types.push('frontend', 'ui');
        }
        
        // Database keywords
        if (/\b(database|db|sql|postgres|mysql|mongodb|schema|table)\b/.test(keywords)) {
            types.push('database', 'db');
        }
        
        // Testing keywords
        if (/\b(test|testing|unit test|integration|e2e|jest|cypress)\b/.test(keywords)) {
            types.push('test', 'testing');
        }
        
        // Deployment keywords
        if (/\b(deploy|deployment|ci\/cd|docker|kubernetes|aws|azure|heroku)\b/.test(keywords)) {
            types.push('deployment', 'deploy');
        }
        
        // Documentation keywords
        if (/\b(documentation|docs|readme|guide|manual)\b/.test(keywords)) {
            types.push('documentation', 'docs');
        }

        return types;
    }

    private generateGenericPhases(prompt: string): any[] {
        return [
            {
                id: 1,
                title: 'Analyze and plan',
                description: `Break down the requirements for: "${prompt}"`,
                completed: false
            },
            {
                id: 2,
                title: 'Setup project structure',
                description: 'Initialize project with necessary files and configurations',
                completed: false
            },
            {
                id: 3,
                title: 'Implement core functionality',
                description: 'Build the main features and functionality',
                completed: false
            },
            {
                id: 4,
                title: 'Add error handling',
                description: 'Implement proper error handling and validation',
                completed: false
            },
            {
                id: 5,
                title: 'Optimize and refactor',
                description: 'Improve code quality and performance',
                completed: false
            }
        ];
    }

    private async handleCreateTask(todoData: any) {
        try {
            // Convert todo items to Cappy task format
            const taskSteps = todoData.items.map((item: any, index: number) => ({
                stepNumber: index + 1,
                title: item.title,
                description: item.description,
                completed: item.completed
            }));

            // Create task XML with the todo steps
            const taskXml = await this.generateTaskXML(taskSteps);
            
            // Save task file using existing Cappy logic
            const createTaskCommand = vscode.commands.getCommands().then(commands => {
                if (commands.includes('cappy.createTaskFile')) {
                    return vscode.commands.executeCommand('cappy.createTaskFile', {
                        title: taskSteps[0]?.title || 'Generated Task',
                        category: 'development',
                        steps: taskSteps
                    });
                }
            });

            vscode.window.showInformationMessage(`🦫 Cappy Task created with ${todoData.items.length} steps`);
            
            this._view?.webview.postMessage({
                type: 'taskCreated',
                success: true
            });
        } catch (error) {
            console.error('Error creating task:', error);
            this._view?.webview.postMessage({
                type: 'error',
                message: `Error creating task: ${error}`
            });
        }
    }

    private async generateTaskXML(steps: any[]): Promise<string> {
        // This would integrate with the existing task XML generation logic
        // For now, we'll use the existing createTaskFile command
        return '';
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get path to resource on disk
        const stylePath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.css');
        const scriptPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.js');
        
        // Convert to webview URIs
        const styleUri = webview.asWebviewUri(stylePath);
        const scriptUri = webview.asWebviewUri(scriptPath);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>Cappy Task Chat</title>
</head>
<body>
    <div class="chat-container">
        <div class="header">
            <h2>🦫 Task Assistant</h2>
            <p>Describe your task and I'll create a todo list for you</p>
        </div>
        
        <div class="chat-area" id="chatArea">
            <div class="welcome-message">
                <div class="message assistant">
                    <div class="message-content">
                        Welcome! I'm your task assistant. Describe what you want to accomplish and I'll help you break it down into actionable steps.
                    </div>
                </div>
            </div>
        </div>
        
        <div class="input-area">
            <div class="input-container">
                <textarea 
                    id="promptInput" 
                    placeholder="Describe your task... (e.g., 'Create a REST API for user management')"
                    rows="3"></textarea>
                <button id="generateBtn" class="primary-btn">
                    <span class="btn-icon">🎯</span>
                    Generate Todo List
                </button>
            </div>
        </div>
        
        <div class="todo-section" id="todoSection" style="display: none;">
            <div class="section-header">
                <h3>Generated Todo List</h3>
                <button id="editBtn" class="secondary-btn">✏️ Edit</button>
            </div>
            <div id="todoList" class="todo-list"></div>
            <div class="action-buttons">
                <button id="createTaskBtn" class="primary-btn">
                    <span class="btn-icon">✅</span>
                    Create Cappy Task
                </button>
                <button id="regenerateBtn" class="secondary-btn">
                    <span class="btn-icon">🔄</span>
                    Regenerate
                </button>
            </div>
        </div>
    </div>
    
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    public show() {
        if (this._view) {
            this._view.show?.(true);
        }
    }
}