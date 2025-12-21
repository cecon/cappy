import * as vscode from 'vscode';
import { TodoRepository } from '../../../../domains/todo/repositories/todo-repository';

/**
 * Tool for listing all todos
 */
export class ListTodosTool implements vscode.LanguageModelTool<object> {
  private repository: TodoRepository;

  constructor(repository: TodoRepository) {
    this.repository = repository;
  }

  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<object>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      const todoList = this.repository.getAll();

      if (todoList.total === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('📋 No todos yet. Create your first one!')
        ]);
      }

      let message = `📋 **Todo List** (${todoList.total} total)\n\n`;
      message += `✅ Completed: ${todoList.completed}\n`;
      message += `⏳ Pending: ${todoList.pending}\n\n`;
      message += `---\n\n`;

      todoList.todos.forEach((todo, index) => {
        const status = todo.completed ? '✅' : '⬜';
        message += `${index + 1}. ${status} **${todo.title}**\n`;
        if (todo.description) {
          message += `   ${todo.description}\n`;
        }
        message += `   ID: \`${todo.id}\`\n`;
        message += `   Created: ${new Date(todo.createdAt).toLocaleString()}\n`;
        if (todo.completedAt) {
          message += `   Completed: ${new Date(todo.completedAt).toLocaleString()}\n`;
        }
        message += `\n`;
      });

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(message)
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Error listing todos: ${errorMessage}`)
      ]);
    }
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<object>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: 'Listing todos...'
    };
  }
}
