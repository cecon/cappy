import * as vscode from 'vscode';

/**
 * Register Cappy tools for Language Model (Copilot)
 */
export function registerLanguageModelTools(context: vscode.ExtensionContext) {
  // Check if lm API is available
  const lm = vscode.lm as any;
  if (!lm?.registerTool) {
    console.log('Cappy: Language Model API not available in this VS Code version');
    return;
  }

  try {
    // Register cappy.init tool
    const initToolDisposable = lm.registerTool(
      'cappy_init',
      {
        name: 'cappy_init',
        displayName: 'Cappy: Initialize',
        modelDescription: 'Initialize Cappy structure in the workspace (.cappy folder, config files, copilot-instructions.md)',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<void>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            await vscode.commands.executeCommand('cappy.init');
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart('Cappy initialized successfully. Structure created in .cappy folder.')
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error initializing Cappy: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappy.knowstack tool
    const knowstackToolDisposable = lm.registerTool(
      'cappy_knowstack',
      {
        name: 'cappy_knowstack',
        displayName: 'Cappy: KnowStack',
        modelDescription: 'Analyze project stack and generate knowledge base (stack.md) with technologies, architecture, and development workflows',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<void>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            await vscode.commands.executeCommand('cappy.knowstack');
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`KnowStack analysis completed. Generated stack.md file.`)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error running KnowStack: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappy.new tool
    const newTaskToolDisposable = lm.registerTool(
      'cappy_new_task',
      {
        name: 'cappy_new_task',
        displayName: 'Cappy: New Task',
        modelDescription: 'Generate step-by-step script to create a new Cappy task with context and execution steps',
        inputSchema: {
          type: 'object',
          properties: {
            taskDescription: {
              type: 'string',
              description: 'Brief description of the task to create'
            }
          }
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<{ taskDescription?: string }>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            await vscode.commands.executeCommand('cappy.new', options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Task creation script generated successfully.`)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error creating new task: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappy.createTaskFile tool
    const createTaskToolDisposable = lm.registerTool(
      'cappy_create_task',
      {
        name: 'cappy_create_task',
        displayName: 'Cappy: Create Task File',
        modelDescription: 'Create a new task XML file with specified category and title',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Task category (feature, bugfix, refactor, etc)'
            },
            title: {
              type: 'string',
              description: 'Task title'
            }
          },
          required: ['category', 'title']
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<{ category: string; title: string }>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            await vscode.commands.executeCommand('cappy.createTaskFile', options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Task file created successfully.`)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error creating task file: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappy.workOnCurrentTask tool
    const workOnTaskToolDisposable = lm.registerTool(
      'cappy_work_on_task',
      {
        name: 'cappy_work_on_task',
        displayName: 'Cappy: Work on Current Task',
        modelDescription: 'Execute the current active task following its script, context and prevention rules',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<void>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            const result = await vscode.commands.executeCommand('cappy.workOnCurrentTask');
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Working on current task: ${result}`)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error working on task: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappy.completeTask tool
    const completeTaskToolDisposable = lm.registerTool(
      'cappy_complete_task',
      {
        name: 'cappy_complete_task',
        displayName: 'Cappy: Complete Task',
        modelDescription: 'Mark current task as completed, capture learnings and move to history',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<void>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            await vscode.commands.executeCommand('cappy.completeTask');
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Task completed successfully and moved to history.`)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error completing task: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappy.reindex tool
    const reindexToolDisposable = lm.registerTool(
      'cappy_reindex',
      {
        name: 'cappy_reindex',
        displayName: 'Cappy: Reindex',
        modelDescription: 'Rebuild semantic indexes for docs, tasks and prevention rules using Mini-LightRAG',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<void>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            await vscode.commands.executeCommand('cappy.reindex');
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Semantic indexes rebuilt successfully.`)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error reindexing: ${error}`)
            ]);
          }
        }
      }
    );

    // Add all tools to context subscriptions
    context.subscriptions.push(
      initToolDisposable,
      knowstackToolDisposable,
      newTaskToolDisposable,
      createTaskToolDisposable,
      workOnTaskToolDisposable,
      completeTaskToolDisposable,
      reindexToolDisposable
    );

    console.log('🦫 Cappy: Language Model tools registered successfully');

  } catch (error) {
    console.error('Cappy: Failed to register Language Model tools:', error);
  }
}
