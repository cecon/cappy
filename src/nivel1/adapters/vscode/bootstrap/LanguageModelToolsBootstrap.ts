/**
 * @fileoverview Bootstrap for Language Model Tools registration
 * @module bootstrap/LanguageModelToolsBootstrap
 */

import * as vscode from 'vscode';
import { ContextRetrievalTool } from '../../../../nivel2/infrastructure/tools/context/context-retrieval-tool';
import { GrepSearchTool } from '../../../../nivel2/infrastructure/tools/grep-search-tool';
import { ReadFileTool } from '../../../../nivel2/infrastructure/tools/read-file-tool';
import { CreateTaskTool } from '../../../../nivel2/infrastructure/tools/create-task-tool';

/**
 * Registers all Language Model Tools for GitHub Copilot integration
 */
export class LanguageModelToolsBootstrap {
  private contextRetrievalToolInstance: ContextRetrievalTool | null = null;

  /**
   * Registers Language Model tools used by conversational agent
   * Only registers tools that are actively used in the thinking loop
   */
  register(context: vscode.ExtensionContext): ContextRetrievalTool {
    console.log('🛠️  Registering Language Model Tools...');

    // Register context retrieval tool (will be initialized later with graph data)
    this.contextRetrievalToolInstance = new ContextRetrievalTool();
    const contextRetrievalTool = vscode.lm.registerTool(
      'cappy_retrieve_context',
      this.contextRetrievalToolInstance
    );
    context.subscriptions.push(contextRetrievalTool);
    console.log('  ✅ cappy_retrieve_context');

    // Register grep search tool (text content search)
    const grepSearchTool = vscode.lm.registerTool('cappy_grep_search', new GrepSearchTool());
    context.subscriptions.push(grepSearchTool);
    console.log('  ✅ cappy_grep_search');

    // Register read file tool (read file contents)
    const readFileTool = vscode.lm.registerTool('cappy_read_file', new ReadFileTool());
    context.subscriptions.push(readFileTool);
    console.log('  ✅ cappy_read_file');

    // Register create task tool (create task files)
    const createTaskTool = vscode.lm.registerTool('cappy_create_task_file', new CreateTaskTool());
    context.subscriptions.push(createTaskTool);
    console.log('  ✅ cappy_create_task_file');

    // Schedule tool validation after LM runtime loads
    this.scheduleToolValidation();

    return this.contextRetrievalToolInstance;
  }

  /**
   * Validates registered tools after a delay
   */
  private scheduleToolValidation(): void {
    setTimeout(() => {
      const allTools = vscode.lm.tools;
      const cappyTools = allTools.filter(t => t.name.startsWith('cappy_'));
      
      console.log('🛠️  All Cappy tools registered:', cappyTools.map(t => t.name).join(', '));
      console.log('🛠️  Total Language Model tools available:', allTools.length);
      
      if (cappyTools.length > 0) {
        console.log(`✅ Cappy tools registered: ${cappyTools.map(t => t.name).join(', ')}`);
      } else {
        console.warn('⚠️  Cappy: No tools were registered!');
      }
    }, 5000);
  }

  /**
   * Gets the context retrieval tool instance
   */
  getContextRetrievalTool(): ContextRetrievalTool | null {
    return this.contextRetrievalToolInstance;
  }
}
