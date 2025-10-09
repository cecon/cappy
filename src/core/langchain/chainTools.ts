import * as vscode from 'vscode';
import { ChainTool, ChainContext } from './types';

/**
 * Built-in tools that can be registered in chains
 * These tools follow the Python LangChain pattern of being methods within the chain
 */

export class CappyChainTools {
    
    /**
     * File creation tool - creates files with content
     */
    static createFile: ChainTool = {
        name: 'create_file',
        description: 'Create a new file with specified content',
        parameters: {
            filePath: 'string - path to the file to create',
            content: 'string - content to write to the file'
        },
        async execute(args: { filePath: string; content: string }, context: ChainContext): Promise<string> {
            try {
                const { filePath, content } = args;
                
                if (!filePath || !content) {
                    throw new Error('Both filePath and content are required');
                }

                // Use VS Code workspace API to create file
                const uri = vscode.Uri.file(filePath);
                const buffer = Buffer.from(content, 'utf8');
                
                await vscode.workspace.fs.writeFile(uri, buffer);
                
                const result = `File created successfully: ${filePath}`;
                console.log(`CappyChain Tool: ${result}`);
                return result;
            } catch (error: any) {
                throw new Error(`Failed to create file: ${error.message}`);
            }
        }
    };

    /**
     * Read file tool - reads file content
     */
    static readFile: ChainTool = {
        name: 'read_file',
        description: 'Read content from a file',
        parameters: {
            filePath: 'string - path to the file to read'
        },
        async execute(args: { filePath: string }, context: ChainContext): Promise<string> {
            try {
                const { filePath } = args;
                
                if (!filePath) {
                    throw new Error('filePath is required');
                }

                const uri = vscode.Uri.file(filePath);
                const data = await vscode.workspace.fs.readFile(uri);
                const content = Buffer.from(data).toString('utf8');
                
                console.log(`CappyChain Tool: Read file ${filePath} (${content.length} chars)`);
                return content;
            } catch (error: any) {
                throw new Error(`Failed to read file: ${error.message}`);
            }
        }
    };

    /**
     * Execute VS Code command tool
     */
    static executeCommand: ChainTool = {
        name: 'execute_command',
        description: 'Execute a VS Code command',
        parameters: {
            command: 'string - VS Code command to execute',
            args: 'array - optional arguments for the command'
        },
        async execute(args: { command: string; args?: any[] }, context: ChainContext): Promise<any> {
            try {
                const { command, args: commandArgs = [] } = args;
                
                if (!command) {
                    throw new Error('command is required');
                }

                const result = await vscode.commands.executeCommand(command, ...commandArgs);
                
                console.log(`CappyChain Tool: Executed command ${command}`);
                return result || `Command ${command} executed successfully`;
            } catch (error: any) {
                throw new Error(`Failed to execute command: ${error.message}`);
            }
        }
    };

    /**
     * Create Cappy task tool
     */
    static createTask: ChainTool = {
        name: 'create_task',
        description: 'Create a new Cappy task with intelligent context',
        parameters: {
            title: 'string - optional task title',
            description: 'string - optional task description'
        },
        async execute(args: { title?: string; description?: string }, context: ChainContext): Promise<string> {
            try {
                // Use Cappy's createTaskFile command
                const result = await vscode.commands.executeCommand('cappy.createTaskFile');
                
                console.log('CappyChain Tool: Created Cappy task with intelligent context');
                return typeof result === 'string' ? result : 'Cappy task created successfully';
            } catch (error: any) {
                throw new Error(`Failed to create Cappy task: ${error.message}`);
            }
        }
    };

    /**
     * Work on current task tool
     */
    static workOnTask: ChainTool = {
        name: 'work_on_task',
        description: 'Work on the current Cappy task with context and prevention rules',
        parameters: {},
        async execute(args: Record<string, any>, context: ChainContext): Promise<string> {
            try {
                const result = await vscode.commands.executeCommand('cappy.workOnCurrentTask');
                
                console.log('CappyChain Tool: Worked on current Cappy task');
                return typeof result === 'string' ? result : 'Task work completed successfully';
            } catch (error: any) {
                throw new Error(`Failed to work on task: ${error.message}`);
            }
        }
    };

    /**
     * Show notification tool
     */
    static showNotification: ChainTool = {
        name: 'show_notification',
        description: 'Show a notification message to the user',
        parameters: {
            message: 'string - message to display',
            type: 'string - notification type: info, warning, or error'
        },
        async execute(args: { message: string; type?: 'info' | 'warning' | 'error' }, context: ChainContext): Promise<string> {
            try {
                const { message, type = 'info' } = args;
                
                if (!message) {
                    throw new Error('message is required');
                }

                switch (type) {
                    case 'error':
                        vscode.window.showErrorMessage(message);
                        break;
                    case 'warning':
                        vscode.window.showWarningMessage(message);
                        break;
                    default:
                        vscode.window.showInformationMessage(message);
                }
                
                console.log(`CappyChain Tool: Showed ${type} notification: ${message}`);
                return `Notification shown: ${message}`;
            } catch (error: any) {
                throw new Error(`Failed to show notification: ${error.message}`);
            }
        }
    };

    /**
     * Set context variable tool
     */
    static setVariable: ChainTool = {
        name: 'set_variable',
        description: 'Set a variable in the chain context',
        parameters: {
            name: 'string - variable name',
            value: 'any - variable value'
        },
        async execute(args: { name: string; value: any }, context: ChainContext): Promise<string> {
            try {
                const { name, value } = args;
                
                if (!name) {
                    throw new Error('variable name is required');
                }

                context.variables[name] = value;
                
                console.log(`CappyChain Tool: Set variable ${name} = ${value}`);
                return `Variable ${name} set to: ${value}`;
            } catch (error: any) {
                throw new Error(`Failed to set variable: ${error.message}`);
            }
        }
    };

    /**
     * Log message tool
     */
    static logMessage: ChainTool = {
        name: 'log_message',
        description: 'Log a message to the console',
        parameters: {
            message: 'string - message to log',
            level: 'string - log level: info, warn, or error'
        },
        async execute(args: { message: string; level?: 'info' | 'warn' | 'error' }, context: ChainContext): Promise<string> {
            try {
                const { message, level = 'info' } = args;
                
                if (!message) {
                    throw new Error('message is required');
                }

                switch (level) {
                    case 'error':
                        console.error(`CappyChain Log: ${message}`);
                        break;
                    case 'warn':
                        console.warn(`CappyChain Log: ${message}`);
                        break;
                    default:
                        console.log(`CappyChain Log: ${message}`);
                }
                
                return `Logged ${level}: ${message}`;
            } catch (error: any) {
                throw new Error(`Failed to log message: ${error.message}`);
            }
        }
    };

    /**
     * Get all available tools for registration
     */
    static getAllTools(): Map<string, ChainTool> {
        const tools = new Map<string, ChainTool>();
        
        tools.set('create_file', this.createFile);
        tools.set('read_file', this.readFile);
        tools.set('execute_command', this.executeCommand);
        tools.set('create_task', this.createTask);
        tools.set('work_on_task', this.workOnTask);
        tools.set('show_notification', this.showNotification);
        tools.set('set_variable', this.setVariable);
        tools.set('log_message', this.logMessage);
        
        return tools;
    }

    /**
     * Register all tools in a chain context
     */
    static registerAllTools(context: ChainContext): void {
        const tools = this.getAllTools();
        for (const [name, tool] of tools) {
            context.tools.set(name, tool);
        }
    }
}