/**
 * @fileoverview Bootstrap for Language Model Tools registration
 * @module bootstrap/LanguageModelToolsBootstrap
 */

import * as vscode from 'vscode';
import { GrepSearchTool } from '../../../../nivel2/infrastructure/tools/grep-search-tool';
import { ReadFileTool, FetchWebTool } from '../../../../nivel2/infrastructure/tools/read-file-tool';
import { CreateTaskTool } from '../../../../nivel2/infrastructure/tools/create-task-tool';
import { CheckTaskFileTool } from '../../../../nivel2/infrastructure/tools/check-task-file-tool';
import { TerminalCommandTool } from '../../../../nivel2/infrastructure/tools/terminal-command-tool';
import { RefineTaskTool } from '../../../../nivel2/infrastructure/tools/refine-task-tool';
import { TodoRepository } from '../../../../domains/todo/repositories/todo-repository';
import { CreateTodoTool } from '../../../../nivel2/infrastructure/tools/todo/create-todo-tool';
import { ListTodosTool } from '../../../../nivel2/infrastructure/tools/todo/list-todos-tool';
import { CompleteTodoTool } from '../../../../nivel2/infrastructure/tools/todo/complete-todo-tool';

/**
 * Registers all Language Model Tools for GitHub Copilot integration
 */
export class LanguageModelToolsBootstrap {
  private todoRepository: TodoRepository;

  constructor() {
    this.todoRepository = new TodoRepository();
  }

  /**
   * Registers Language Model tools used by conversational agent
   */
  register(context: vscode.ExtensionContext): void {
    console.log('🛠️  Registering Language Model Tools...');

    // Register grep search tool (text content search)
    const grepSearchTool = vscode.lm.registerTool('cappy_grep_search', new GrepSearchTool());
    context.subscriptions.push(grepSearchTool);
    console.log('  ✅ cappy_grep_search');

    // Register read file tool (read file contents)
    const readFileTool = vscode.lm.registerTool('cappy_read_file', new ReadFileTool());
    context.subscriptions.push(readFileTool);
    console.log('  ✅ cappy_read_file');

    // Register fetch web tool (fetch web content)
    const fetchWebTool = vscode.lm.registerTool('cappy_fetch_web', new FetchWebTool());
    context.subscriptions.push(fetchWebTool);
    console.log('  ✅ cappy_fetch_web');

    // Register create task tool (create task files)
    const createTaskTool = vscode.lm.registerTool('cappy_create_task_file', new CreateTaskTool());
    context.subscriptions.push(createTaskTool);
    console.log('  ✅ cappy_create_task_file');

    // Register check task file tool
    const checkTaskFileTool = vscode.lm.registerTool('cappy_check_task_file', new CheckTaskFileTool());
    context.subscriptions.push(checkTaskFileTool);
    console.log('  ✅ cappy_check_task_file');

    // Register refine task tool (improve task files with LLM)
    const refineTaskTool = vscode.lm.registerTool('cappy_refine_task', new RefineTaskTool());
    context.subscriptions.push(refineTaskTool);
    console.log('  ✅ cappy_refine_task');

    // Register terminal command tool
    const terminalCommandTool = vscode.lm.registerTool('cappy_run_terminal_command', new TerminalCommandTool());
    context.subscriptions.push(terminalCommandTool);
    console.log('  ✅ cappy_run_terminal_command');

    // Register todo tools
    const createTodoTool = vscode.lm.registerTool('cappy_create_todo', new CreateTodoTool(this.todoRepository));
    context.subscriptions.push(createTodoTool);
    console.log('  ✅ cappy_create_todo');

    const listTodosTool = vscode.lm.registerTool('cappy_list_todos', new ListTodosTool(this.todoRepository));
    context.subscriptions.push(listTodosTool);
    console.log('  ✅ cappy_list_todos');

    const completeTodoTool = vscode.lm.registerTool('cappy_complete_todo', new CompleteTodoTool(this.todoRepository));
    context.subscriptions.push(completeTodoTool);
    console.log('  ✅ cappy_complete_todo');

    // Schedule tool validation after LM runtime loads
    this.scheduleToolValidation();
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
   * Gets the todo repository instance
   */
  getTodoRepository(): TodoRepository {
    return this.todoRepository;
  }
}
