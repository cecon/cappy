import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class DocumentsConfirmRemoveUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'document/confirm-remove';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    const payload = message.payload as { fileId?: string; filePath?: string } | undefined;
    
    if (!payload?.fileId || !payload?.filePath) {
      ctx.log('❌ Invalid remove request: missing fileId or filePath');
      return;
    }

    const { fileId, filePath } = payload;
    
    // Show confirmation dialog using VS Code API
    const confirmed = await ctx.vscode.window.showWarningMessage(
      `Are you sure you want to remove this file?\n\nThis will:\n- Delete the file from the queue\n- Remove all chunks and nodes from the graph\n- Delete all relationships\n\nFile: ${filePath}`,
      { modal: true },
      'Remove'
    );

    if (confirmed === 'Remove') {
      ctx.log(`🗑️ Remove operation requested for: ${fileId}`);
      // Legacy HTTP removal service has been removed.
      await ctx.vscode.window.showInformationMessage(
        'File removal through external service is no longer supported. Please use built-in maintenance commands (e.g., "Cappy: Clean Invalid Files" or reset database) while native removal is being implemented.'
      );
    }
  }
}
