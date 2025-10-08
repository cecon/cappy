import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface AgentContext {
    type: 'file' | 'task' | 'project' | 'search' | 'prevention';
    name: string;
    data: any;
}

interface AgentTool {
    name: string;
    displayName: string;
    icon: string;
    description: string;
}

interface LLMModel {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'local' | 'azure';
    available: boolean;
}

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
                    case 'agentQuery':
                        this.handleAgentQuery(message.prompt, message.model, message.context, message.tools);
                        break;
                    case 'requestContext':
                        this.handleRequestContext();
                        break;
                    case 'requestTools':
                        this.handleRequestTools();
                        break;
                    case 'requestInitialData':
                        this.handleRequestInitialData();
                        break;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }

    private async handleAgentQuery(prompt: string, model: string, context: AgentContext[], tools: AgentTool[]) {
        try {
            // Simulate AI agent processing with Cappy tools
            console.log(`Agent Query: ${prompt}`);
            console.log(`Model: ${model}`);
            console.log(`Context: ${JSON.stringify(context)}`);
            console.log(`Tools: ${JSON.stringify(tools)}`);

            // Process the query with context and tools
            const response = await this.processAgentQuery(prompt, model, context, tools);
            
            // Send response back to webview
            this._view?.webview.postMessage({
                type: 'agentResponse',
                data: response
            });
        } catch (error) {
            console.error('Error processing agent query:', error);
            this._view?.webview.postMessage({
                type: 'error',
                message: `Error processing query: ${error}`
            });
        }
    }

    private async processAgentQuery(prompt: string, model: string, context: AgentContext[], tools: AgentTool[]) {
        // This is where we would integrate with actual LLM APIs
        // For now, we'll simulate intelligent responses based on prompt analysis
        
        const promptLower = prompt.toLowerCase();
        let response = {
            content: '',
            toolResults: [] as any[],
            newContext: [] as AgentContext[]
        };

        // Analyze prompt for tool usage
        if (promptLower.includes('create task') || promptLower.includes('@createtask')) {
            response.content = '🦫 I\'ll help you create a new Cappy task. Let me analyze your requirements and generate a structured task.';
            response.toolResults.push(await this.executeCreateTaskTool(prompt));
        } else if (promptLower.includes('search') || promptLower.includes('@searchcode')) {
            response.content = '🔍 Searching your codebase for relevant information...';
            response.toolResults.push(await this.executeSearchTool(prompt));
        } else if (promptLower.includes('analyze') || promptLower.includes('@analyzeproject')) {
            response.content = '📊 Analyzing your project structure and providing insights...';
            response.toolResults.push(await this.executeAnalyzeProjectTool());
        } else if (promptLower.includes('prevention') || promptLower.includes('@preventionrules')) {
            response.content = '🛡️ Checking prevention rules and best practices...';
            response.toolResults.push(await this.executePreventionRulesTool());
        } else {
            // General AI response simulation
            response.content = this.generateContextualResponse(prompt, context, model);
        }

        return response;
    }

    private generateContextualResponse(prompt: string, context: AgentContext[], model: string): string {
        // Simulate intelligent response based on context
        const hasProjectContext = context.some(c => c.type === 'project');
        const hasFileContext = context.some(c => c.type === 'file');
        const hasTaskContext = context.some(c => c.type === 'task');

        let response = `🦫 Based on your project context`;
        
        if (hasProjectContext) {
            response += ' and current workspace';
        }
        if (hasFileContext) {
            response += ' and the files you\'re working on';
        }
        if (hasTaskContext) {
            response += ' and active tasks';
        }
        
        response += `, here's what I can help with:\n\n`;
        
        // Provide contextual suggestions
        if (prompt.toLowerCase().includes('help')) {
            response += `I'm your Cappy AI agent with access to all your project tools. I can:
• 📝 Create and manage tasks with intelligent breakdowns
• 🔍 Search your codebase and documentation  
• 📊 Analyze project structure and dependencies
• 🛡️ Apply prevention rules and best practices
• 💡 Suggest improvements and optimizations
• ⚡ Execute Cappy commands on your behalf

Just describe what you want to accomplish, and I'll use the right tools to help you get there!`;
        } else {
            response += `I understand you want to: "${prompt}"\n\nLet me help you with that. I have access to your project context and can use Cappy tools to provide the best assistance. Would you like me to:

• Break this down into actionable tasks?
• Search for related code or documentation?
• Analyze the current project structure?
• Apply relevant prevention rules?

Just let me know how you'd like to proceed!`;
        }

        return response;
    }

    private async executeCreateTaskTool(prompt: string) {
        // Integrate with existing createTaskFile command
        try {
            const result = await vscode.commands.executeCommand('cappy.createTaskFile', {
                title: this.extractTaskTitle(prompt),
                description: prompt,
                agent: true
            });
            
            return {
                toolName: 'Create Task',
                data: {
                    success: true,
                    message: 'Task created successfully',
                    result: result
                }
            };
        } catch (error) {
            return {
                toolName: 'Create Task',
                data: {
                    success: false,
                    error: error?.toString()
                }
            };
        }
    }

    private async executeSearchTool(prompt: string) {
        // Integrate with CappyRAG search
        try {
            const searchTerm = this.extractSearchTerm(prompt);
            const result = await vscode.commands.executeCommand('cappy.query', {
                query: searchTerm,
                limit: 5
            });
            
            return {
                toolName: 'Search Code',
                data: {
                    searchTerm: searchTerm,
                    results: result
                }
            };
        } catch (error) {
            return {
                toolName: 'Search Code',
                data: {
                    error: error?.toString()
                }
            };
        }
    }

    private async executeAnalyzeProjectTool() {
        // Integrate with knowStack command
        try {
            const result = await vscode.commands.executeCommand('cappy.knowstack');
            
            return {
                toolName: 'Analyze Project',
                data: {
                    stackAnalysis: result
                }
            };
        } catch (error) {
            return {
                toolName: 'Analyze Project',
                data: {
                    error: error?.toString()
                }
            };
        }
    }

    private async executePreventionRulesTool() {
        // Get prevention rules from the project
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                throw new Error('No workspace found');
            }

            const preventionRulesPath = path.join(workspaceRoot, '.cappy', 'prevention-rules.md');
            let rules = 'No prevention rules found';
            
            if (fs.existsSync(preventionRulesPath)) {
                rules = fs.readFileSync(preventionRulesPath, 'utf8');
            }
            
            return {
                toolName: 'Prevention Rules',
                data: {
                    rules: rules,
                    path: preventionRulesPath
                }
            };
        } catch (error) {
            return {
                toolName: 'Prevention Rules',
                data: {
                    error: error?.toString()
                }
            };
        }
    }

    private extractTaskTitle(prompt: string): string {
        // Simple extraction logic - could be improved with NLP
        const lines = prompt.split('\n');
        const firstLine = lines[0].trim();
        
        if (firstLine.length > 50) {
            return firstLine.substring(0, 47) + '...';
        }
        
        return firstLine || 'Agent Generated Task';
    }

    private extractSearchTerm(prompt: string): string {
        // Extract search terms from prompt
        const searchPatterns = [
            /search for (.+)/i,
            /find (.+)/i,
            /look for (.+)/i,
            /@searchcode (.+)/i
        ];
        
        for (const pattern of searchPatterns) {
            const match = prompt.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        // Default to using the whole prompt
        return prompt;
    }

    private async handleRequestContext() {
        // Get available context from the current workspace
        const context: AgentContext[] = [];
        
        try {
            // Add current file context
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                context.push({
                    type: 'file',
                    name: path.basename(activeEditor.document.fileName),
                    data: {
                        path: activeEditor.document.fileName,
                        language: activeEditor.document.languageId
                    }
                });
            }
            
            // Add project context
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
            if (workspaceRoot) {
                context.push({
                    type: 'project',
                    name: path.basename(workspaceRoot.uri.fsPath),
                    data: {
                        path: workspaceRoot.uri.fsPath
                    }
                });
            }
            
            // Add active task context
            try {
                const activeTask = await vscode.commands.executeCommand('cappy.getActiveTask');
                if (activeTask) {
                    context.push({
                        type: 'task',
                        name: 'Active Task',
                        data: activeTask
                    });
                }
            } catch (error) {
                // No active task
            }
            
            this._view?.webview.postMessage({
                type: 'contextUpdate',
                context: context
            });
        } catch (error) {
            console.error('Error getting context:', error);
        }
    }

    private async handleRequestTools() {
        // Get available Cappy tools
        const tools: AgentTool[] = [
            {
                name: 'createTask',
                displayName: 'Create Task',
                icon: '📝',
                description: 'Create a new Cappy task'
            },
            {
                name: 'searchCode',
                displayName: 'Search Code',
                icon: '🔍',
                description: 'Search codebase with CappyRAG'
            },
            {
                name: 'analyzeProject',
                displayName: 'Analyze Project',
                icon: '📊',
                description: 'Run KnowStack analysis'
            },
            {
                name: 'cappyQuery',
                displayName: 'Cappy Query',
                icon: '🧠',
                description: 'Query Cappy knowledge base'
            },
            {
                name: 'preventionRules',
                displayName: 'Prevention Rules',
                icon: '🛡️',
                description: 'Check prevention rules'
            },
            {
                name: 'workOnTask',
                displayName: 'Work on Task',
                icon: '⚡',
                description: 'Execute current task step'
            }
        ];
        
        this._view?.webview.postMessage({
            type: 'toolsUpdate',
            tools: tools
        });
    }

    private async handleRequestInitialData() {
        // Send initial models list
        const models: LLMModel[] = [
            { id: 'gpt-4', name: 'GPT-4', provider: 'openai', available: true },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', available: true },
            { id: 'claude-3', name: 'Claude 3', provider: 'anthropic', available: true },
            { id: 'local-llama', name: 'Local Llama', provider: 'local', available: false },
            { id: 'local-codellama', name: 'Local CodeLlama', provider: 'local', available: false }
        ];
        
        this._view?.webview.postMessage({
            type: 'modelsList',
            models: models
        });
        
        // Also send initial context and tools
        this.handleRequestContext();
        this.handleRequestTools();
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
        // Get path to HTML template
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.html');
        
        // Get path to resource on disk
        const stylePath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.css');
        const scriptPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'chat.js');
        
        // Convert to webview URIs
        const styleUri = webview.asWebviewUri(stylePath);
        const scriptUri = webview.asWebviewUri(scriptPath);

        try {
            // Read HTML template
            const fs = require('fs');
            let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
            
            // Replace placeholders with actual URIs
            htmlContent = htmlContent
                .replace('{STYLE_URI}', styleUri.toString())
                .replace('{SCRIPT_URI}', scriptUri.toString());
            
            return htmlContent;
        } catch (error) {
            console.error('Error reading HTML template:', error);
            // Fallback to inline HTML if file reading fails
            return this._getFallbackHtml(styleUri, scriptUri);
        }
    }

    private _getFallbackHtml(styleUri: vscode.Uri, scriptUri: vscode.Uri): string {

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