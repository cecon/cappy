import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';
import type { FileMetadata } from '../../../../../nivel2/infrastructure/services/file-metadata-database';

type DocumentStatus = 'completed' | 'preprocessed' | 'processing' | 'pending' | 'failed';

interface DocumentItem {
  id: string;
  fileName: string;
  filePath: string;
  summary: string;
  status: DocumentStatus;
  length: number;
  chunks: number;
  created: string;
  updated: string;
  trackId?: string;
  processingStartTime?: string;
  processingEndTime?: string;
  currentStep?: string;
  progress?: number;
}

export class DocumentsRefreshUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'document/refresh';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    try {
      const payload = (message.payload || {}) as {
        page?: number;
        limit?: number;
        status?: string;
        sortBy?: 'id' | 'created_at' | 'updated_at';
        sortOrder?: 'asc' | 'desc';
      };

      const page = payload.page ?? 1;
      const limit = payload.limit ?? 10;
      const sortBy = payload.sortBy ?? 'updated_at';
      const sortOrder = payload.sortOrder ?? 'desc';
      const status = payload.status as
        | 'completed'
        | 'preprocessed'
        | 'processing'
        | 'pending'
        | 'failed'
        | undefined;

      ctx.log(`[DocumentsRefreshUseCase] Fetching documents page=${page} limit=${limit} status=${status ?? 'any'} sortBy=${sortBy} ${sortOrder}`);

      const result = await ctx.vscode.commands.executeCommand<{
        files: FileMetadata[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>('cappy.getFilesPaginated', { page, limit, status, sortBy, sortOrder });

      const documents: DocumentItem[] = (result.files || []).map((file: FileMetadata) => this.mapFileToDocument(file));

      ctx.sendMessage({
        type: 'document/list',
        payload: {
          documents,
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (e) {
      ctx.log(`[DocumentsRefreshUseCase] ERROR: ${e instanceof Error ? e.message : String(e)}`);
      ctx.sendMessage({ type: 'document/list', payload: { documents: [], total: 0, page: 1, limit: 10, totalPages: 0 } });
    }
  }

  private mapFileToDocument(file: FileMetadata): DocumentItem {
    let status: DocumentStatus = 'pending';
    if (file.status === 'completed' || file.status === 'processed') {
      status = 'completed';
    } else if (file.status === 'processing') {
      status = 'processing';
    } else if (file.status === 'failed' || file.status === 'error') {
      status = 'failed';
    }

    return {
      id: file.id,
      fileName: file.fileName,
      filePath: file.filePath,
      summary: file.errorMessage || '',
      status,
      length: file.fileSize || 0,
      chunks: file.chunksCount || 0,
      created: file.processingStartedAt || new Date().toISOString(),
      updated: file.processingCompletedAt || new Date().toISOString(),
      trackId: file.id,
      processingStartTime: file.processingStartedAt,
      processingEndTime: file.processingCompletedAt,
      currentStep: file.currentStep,
      progress: file.progress,
    };
  }
}
