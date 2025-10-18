import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class DocumentsUploadSelectedUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'documents/upload-selected';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    const payload = (message.payload ?? {}) as { files?: Array<{ name: string; type: string; size: number }> };
    ctx.log(`📥 Documents: ${payload.files?.length ?? 0} file(s) selected`);
    // TODO: Wire ingestion pipeline to handle provided files metadata
  }
}
