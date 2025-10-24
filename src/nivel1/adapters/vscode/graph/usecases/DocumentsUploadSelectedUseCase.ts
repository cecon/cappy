import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';
import * as vscode from 'vscode';

interface FileMetadata {
  name: string;
  type: string;
  size: number;
}

export class DocumentsUploadSelectedUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'documents/upload-selected';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    const payload = (message.payload ?? {}) as { files?: FileMetadata[] };
    const files = payload.files ?? [];
    
    ctx.log(`📥 Documents: ${files.length} file(s) selected for upload`);
    
    if (files.length === 0) {
      ctx.log('⚠️ No files provided in payload');
      return;
    }

    try {
      // Request user to select files from disk
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        openLabel: 'Upload Files',
        filters: {
          'Code Files': ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'go', 'rs'],
          'Documentation': ['md', 'txt', 'pdf'],
          'All Files': ['*']
        }
      });

      if (!fileUris || fileUris.length === 0) {
        ctx.log('ℹ️ Upload cancelled by user');
        ctx.sendMessage({ 
          type: 'documents/upload-cancelled',
          message: 'No files selected' 
        });
        return;
      }

      ctx.log(`📂 Processing ${fileUris.length} selected file(s)...`);
      
      // Trigger file processing for each selected file
      for (const fileUri of fileUris) {
        const filePath = fileUri.fsPath;
        ctx.log(`  📄 Queuing: ${filePath}`);
        
        // Execute the internal processing command
        await vscode.commands.executeCommand('cappy.processSingleFileInternal', {
          filePath,
          onProgress: (step: string, percent: number) => {
            ctx.log(`    ⏳ ${step} (${percent}%)`);
          }
        });
      }

      ctx.log(`✅ All ${fileUris.length} file(s) queued for processing`);
      
      // Notify webview of successful upload
      ctx.sendMessage({ 
        type: 'documents/upload-complete',
        count: fileUris.length
      });

      // Refresh the graph to show new documents
      await ctx.refreshSubgraph(2);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.log(`❌ Upload failed: ${errorMessage}`);
      ctx.sendMessage({ 
        type: 'documents/upload-error',
        error: errorMessage 
      });
    }
  }
}
