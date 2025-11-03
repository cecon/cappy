import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class DocumentsReprocessUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'document/reprocess';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    try {
      const { fileId, filePath } = (message.payload || {}) as { fileId: string; filePath: string };
      
      ctx.log(`🔄 [DocumentsReprocessUseCase] ========================================`);
      ctx.log(`🔄 [DocumentsReprocessUseCase] REPROCESS REQUEST RECEIVED`);
      ctx.log(`🔄 [DocumentsReprocessUseCase] fileId: ${fileId}`);
      ctx.log(`🔄 [DocumentsReprocessUseCase] filePath: ${filePath}`);
      ctx.log(`🔄 [DocumentsReprocessUseCase] ========================================`);

      if (!filePath) {
        ctx.log(`❌ [DocumentsReprocessUseCase] Missing filePath in payload`);
        return;
      }

      // Execute the reprocess command
      ctx.log(`🔄 [DocumentsReprocessUseCase] Calling cappy.reprocessDocument command...`);
      await ctx.vscode.commands.executeCommand('cappy.reprocessDocument', {
        fileId,
        filePath
      });
      
      ctx.log(`✅ [DocumentsReprocessUseCase] Reprocess command completed`);
      
      // Optionally send a confirmation message back
      ctx.sendMessage({
        type: 'document/reprocessed',
        payload: { fileId, filePath }
      });
      
    } catch (error) {
      ctx.log(`❌ [DocumentsReprocessUseCase] Error: ${error}`);
      ctx.sendMessage({
        type: 'error',
        payload: {
          message: `Failed to reprocess document: ${error instanceof Error ? error.message : String(error)}`
        }
      });
    }
  }
}
