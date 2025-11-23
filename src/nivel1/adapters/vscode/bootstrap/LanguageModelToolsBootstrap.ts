/**
 * @fileoverview Bootstrap for Language Model Tools registration
 * @module bootstrap/LanguageModelToolsBootstrap
 */

import * as vscode from 'vscode';
import { CreateFileTool } from '../../../../nivel2/infrastructure/tools/create-file-tool';
import { FetchWebTool } from '../../../../nivel2/infrastructure/tools/fetch-web-tool';
import { ContextRetrievalTool } from '../../../../nivel2/infrastructure/tools/context/context-retrieval-tool';
import { WorkspaceSearchTool } from '../../../../nivel2/infrastructure/tools/workspace-search-tool';
import { GrepSearchTool } from '../../../../nivel2/infrastructure/tools/grep-search-tool';
import { SymbolSearchTool } from '../../../../nivel2/infrastructure/tools/symbol-search-tool';
import { ReadFileTool } from '../../../../nivel2/infrastructure/tools/read-file-tool';

/**
 * Registers all Language Model Tools for GitHub Copilot integration
 */
export class LanguageModelToolsBootstrap {
  private contextRetrievalToolInstance: ContextRetrievalTool | null = null;

  /**
   * Registers all LM tools
   */
  register(context: vscode.ExtensionContext): ContextRetrievalTool {
    console.log('🛠️  Registering Language Model Tools...');

    // Register file creation tool
    const createFileTool = vscode.lm.registerTool('cappy_create_file', new CreateFileTool());
    context.subscriptions.push(createFileTool);
    console.log('  ✅ cappy_create_file');

    // Register web fetching tool
    const fetchWebTool = vscode.lm.registerTool('cappy_fetch_web', new FetchWebTool());
    context.subscriptions.push(fetchWebTool);
    console.log('  ✅ cappy_fetch_web');

    // Register context retrieval tool (will be initialized later with graph data)
    this.contextRetrievalToolInstance = new ContextRetrievalTool();
    const contextRetrievalTool = vscode.lm.registerTool(
      'cappy_retrieve_context',
      this.contextRetrievalToolInstance
    );
    context.subscriptions.push(contextRetrievalTool);
    console.log('  ✅ cappy_retrieve_context');

    // Register workspace search tool (file search by pattern)
    const workspaceSearchTool = vscode.lm.registerTool('cappy_workspace_search', new WorkspaceSearchTool());
    context.subscriptions.push(workspaceSearchTool);
    console.log('  ✅ cappy_workspace_search');

    // Register grep search tool (text content search)
    const grepSearchTool = vscode.lm.registerTool('cappy_grep_search', new GrepSearchTool());
    context.subscriptions.push(grepSearchTool);
    console.log('  ✅ cappy_grep_search');

    // Register symbol search tool (classes, functions, etc.)
    const symbolSearchTool = vscode.lm.registerTool('cappy_symbol_search', new SymbolSearchTool());
    context.subscriptions.push(symbolSearchTool);
    console.log('  ✅ cappy_symbol_search');

    // Register read file tool (read file contents)
    const readFileTool = vscode.lm.registerTool('cappy_read_file', new ReadFileTool());
    context.subscriptions.push(readFileTool);
    console.log('  ✅ cappy_read_file');

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
