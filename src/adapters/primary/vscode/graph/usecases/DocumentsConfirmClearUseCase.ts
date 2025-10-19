import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class DocumentsConfirmClearUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'document/confirm-clear';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    // Show confirmation dialog using VS Code API
    const confirmed = await ctx.vscode.window.showWarningMessage(
      'Are you sure you want to clear all documents?',
      { modal: true },
      'Clear All'
    );

    if (confirmed === 'Clear All') {
      ctx.log('🗑️ Clearing all documents');
      
      // Notify webview to proceed with clear operation
      ctx.sendMessage({
        type: 'document/clear-confirmed'
      });
    }
  }
}
