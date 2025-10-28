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
      ctx.log(`🗑️ Removing document: ${fileId}`);
      
      try {
        // Call backend to remove file
        const res = await fetch('http://localhost:3456/files/remove', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId, filePath })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Failed to remove file');
        }

        const result = await res.json() as { nodesDeleted?: number; chunksDeleted?: number; relationshipsDeleted?: number };
        
        ctx.log(`✅ File removed successfully: ${fileId}`);
        
        // Notify webview to update UI
        ctx.sendMessage({
          type: 'document/removed',
          fileId,
          result
        });

        // Show success message
        await ctx.vscode.window.showInformationMessage(
          `✅ File removed successfully!\n\nRemoved:\n- File metadata\n- ${result.nodesDeleted || 0} graph nodes\n- ${result.chunksDeleted || 0} chunks\n- ${result.relationshipsDeleted || 0} relationships`
        );

        // Refresh graph
        await ctx.refreshSubgraph();

      } catch (e) {
        ctx.log(`❌ Remove error: ${e}`);
        await ctx.vscode.window.showErrorMessage(`Failed to remove file: ${String(e)}`);
      }
    }
  }
}
