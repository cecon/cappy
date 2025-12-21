import * as vscode from 'vscode';
import { TodoRepository } from '../../../../domains/todo/repositories/todo-repository';

interface CompleteTodoInput {
  id: string;
}

/**
 * Tool for marking todos as complete
 */
export class CompleteTodoTool implements vscode.LanguageModelTool<CompleteTodoInput> {
  private repository: TodoRepository;

  constructor(repository: TodoRepository) {
    this.repository = repository;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CompleteTodoInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      const { id } = options.input;

      if (!id) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('❌ Todo ID is required')
        ]);
      }

      const updated = this.repository.update({ id, completed: true });

      if (!updated) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`❌ Todo not found: ${id}`)
        ]);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `✅ Todo completed!\n\n` +
          `📝 **${updated.title}**\n` +
          `Completed at: ${new Date(updated.completedAt!).toLocaleString()}`
        )
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Error completing todo: ${errorMessage}`)
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CompleteTodoInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { id } = options.input;
    return {
      invocationMessage: `Completing todo: ${id}`,
      confirmationMessages: {
        title: 'Complete Todo',
        message: new vscode.MarkdownString(`Mark todo as complete:\n\n\`${id}\``)
      }
    };
  }
}
