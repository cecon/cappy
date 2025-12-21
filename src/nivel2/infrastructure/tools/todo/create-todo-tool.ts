import * as vscode from 'vscode';
import { TodoRepository } from '../../../../domains/todo/repositories/todo-repository';

interface CreateTodoInput {
  title: string;
  description?: string;
}

/**
 * Tool for creating todos
 */
export class CreateTodoTool implements vscode.LanguageModelTool<CreateTodoInput> {
  private repository: TodoRepository;

  constructor(repository: TodoRepository) {
    this.repository = repository;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CreateTodoInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      const { title, description } = options.input;

      if (!title || title.trim() === '') {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('❌ Title is required')
        ]);
      }

      const todo = this.repository.create({ title, description });

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `✅ Todo created!\n\n` +
          `📝 **${todo.title}**\n` +
          `ID: ${todo.id}\n` +
          (todo.description ? `Description: ${todo.description}\n` : '') +
          `Created: ${new Date(todo.createdAt).toLocaleString()}`
        )
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Error creating todo: ${errorMessage}`)
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CreateTodoInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { title } = options.input;
    return {
      invocationMessage: `Creating todo: ${title}`,
      confirmationMessages: {
        title: 'Create Todo',
        message: new vscode.MarkdownString(`Create todo:\n\n**${title}**`)
      }
    };
  }
}
