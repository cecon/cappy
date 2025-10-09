import * as vscode from 'vscode';
import { ChainExecutor } from '../core/langchain/chainExecutor';

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

    // Register cappy.createTaskFile tool
    const createTaskToolDisposable = lm.registerTool(
      'cappy_create_task',
      {
        name: 'cappy_create_task',
        displayName: 'Cappy: Create Task File',
        modelDescription: 'Create a new task XML file with specified category and title directly',
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
            // Create the task file directly
            const result = await vscode.commands.executeCommand('cappy.createTaskFile', options.input);
            
            // Return success message
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Task file created successfully with category "${options.input.category}" and title "${options.input.title}". The task is now ready to work on.`)
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

    // === CappyRAG Tools ===

    // Register cappyrag.addDocument tool
    const cappyragAddDocumentDisposable = lm.registerTool(
      'cappyrag_add_document',
      {
        name: 'cappyrag_add_document',
        displayName: 'CappyRAG: Add Document',
        modelDescription: 'Add a document to the CappyRAG knowledge base for entity extraction and relationship mapping. Supports .txt, .md, .pdf, .doc, .docx files. Document will be processed to extract entities, relationships and semantic information.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Absolute path to the document file'
            },
            title: {
              type: 'string',
              description: 'Optional title for the document (defaults to filename)'
            },
            author: {
              type: 'string',
              description: 'Optional author name'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for categorization'
            },
            language: {
              type: 'string',
              description: 'Optional language code (e.g., "en", "pt", "es")'
            }
          },
          required: ['filePath']
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<{
            filePath: string;
            title?: string;
            author?: string;
            tags?: string[];
            language?: string;
          }>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            const result = await vscode.commands.executeCommand(
              'cappyrag.addDocument',
              options.input.filePath,
              options.input.title,
              options.input.author,
              options.input.tags,
              options.input.language
            ) as string;
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(result)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error adding document: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappy.query tool
    const cappyragQueryDisposable = lm.registerTool(
      'cappy_query',
      {
        name: 'cappy_query',
        displayName: 'Cappy: Query Knowledge Base',
        modelDescription: 'Query the CappyRAG knowledge base using hybrid search (vector + keyword) to retrieve relevant entities, relationships and document chunks. Returns contextualized information with similarity scores.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language query to search the knowledge base'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)'
            }
          },
          required: ['query']
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<{
            query: string;
            limit?: number;
          }>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            const result = await vscode.commands.executeCommand(
              'cappy.query',
              options.input.query,
              options.input.limit || 10
            ) as string;
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(result)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error querying knowledge base: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappyrag.getStats tool
    const cappyragStatsDisposable = lm.registerTool(
      'cappyrag_get_stats',
      {
        name: 'cappyrag_get_stats',
        displayName: 'CappyRAG: Get Statistics',
        modelDescription: 'Get statistics about the CappyRAG knowledge base including total documents, entities, relationships, and chunks indexed',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<void>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            const result = await vscode.commands.executeCommand('cappyrag.getStats') as string;
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(result)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error getting stats: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappyrag.getSupportedFormats tool
    const cappyragFormatsDisposable = lm.registerTool(
      'cappyrag_get_supported_formats',
      {
        name: 'cappyrag_get_supported_formats',
        displayName: 'CappyRAG: Get Supported Formats',
        modelDescription: 'Get list of supported document formats for CappyRAG including file extensions, descriptions, and processing capabilities',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<void>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            const result = await vscode.commands.executeCommand('cappyrag.getSupportedFormats') as string;
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(result)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error getting supported formats: ${error}`)
            ]);
          }
        }
      }
    );

    // Register cappyrag.estimateProcessingTime tool
    const cappyragEstimateDisposable = lm.registerTool(
      'cappyrag_estimate_processing_time',
      {
        name: 'cappyrag_estimate_processing_time',
        displayName: 'CappyRAG: Estimate Processing Time',
        modelDescription: 'Estimate processing time for a document based on file size and complexity. Returns breakdown of processing steps and estimated duration.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Absolute path to the document file'
            }
          },
          required: ['filePath']
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<{ filePath: string }>,
          token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> => {
          try {
            const result = await vscode.commands.executeCommand(
              'cappyrag.estimateProcessingTime',
              options.input.filePath
            ) as string;
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(result)
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error estimating processing time: ${error}`)
            ]);
          }
        }
      }
    );

    // Add all tools to context subscriptions
    context.subscriptions.push(
      initToolDisposable,
      knowstackToolDisposable,
      createTaskToolDisposable,
      workOnTaskToolDisposable,
      completeTaskToolDisposable,
      reindexToolDisposable,
      cappyragAddDocumentDisposable,
      cappyragQueryDisposable,
      cappyragStatsDisposable,
      cappyragFormatsDisposable,
      cappyragEstimateDisposable
    );

    console.log('🦫 Cappy: Language Model tools registered successfully');

  } catch (error) {
    console.error('Cappy: Failed to register Language Model tools:', error);
  }
}
