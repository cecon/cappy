import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class DocumentsUploadRequestedUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'documents/upload-requested';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    ctx.log('📤 Documents: upload dialog requested');
  }
}
