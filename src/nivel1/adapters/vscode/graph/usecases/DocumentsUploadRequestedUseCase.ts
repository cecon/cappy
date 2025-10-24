import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';
import * as vscode from 'vscode';

export class DocumentsUploadRequestedUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    // Accept both legacy (documents/*) and sidebar (document/*) events
    return message.type === 'documents/upload-requested' || message.type === 'document/upload';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    ctx.log('📤 Documents: upload dialog requested');

    try {
      // Ask user to pick files
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        openLabel: 'Upload Files',
        filters: {
          'Code Files': ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'php'],
          'Markup & Docs': ['md', 'txt', 'html', 'blade.php', 'pdf'],
          'All Files': ['*']
        }
      });

      if (!fileUris || fileUris.length === 0) {
        ctx.log('ℹ️ Upload cancelled by user');
        ctx.sendMessage({ type: 'documents/upload-cancelled', message: 'No files selected' });
        return;
      }

      ctx.log(`📂 Processing ${fileUris.length} selected file(s)...`);

      // Process each selected file via internal command
      for (const fileUri of fileUris) {
        const filePath = fileUri.fsPath;
        ctx.log(`  📄 Queuing: ${filePath}`);
        await vscode.commands.executeCommand('cappy.processSingleFileInternal', {
          filePath,
          onProgress: (step: string, percent: number) => {
            ctx.log(`    ⏳ ${step} (${percent}%)`);
          }
        });
      }

      ctx.log(`✅ All ${fileUris.length} file(s) queued for processing`);
      ctx.sendMessage({ type: 'documents/upload-complete', count: fileUris.length });

      // Refresh graph (and any dependent views) after upload
      await ctx.refreshSubgraph(2);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.log(`❌ Upload failed: ${errorMessage}`);
      ctx.sendMessage({ type: 'documents/upload-error', error: errorMessage });
    }
  }
}
