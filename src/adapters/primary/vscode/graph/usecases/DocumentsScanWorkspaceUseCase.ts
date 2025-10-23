import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class DocumentsScanWorkspaceUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    // Accept both legacy (documents/*) and sidebar (document/*) events
    return message.type === 'documents/scan-workspace' || message.type === 'document/scan';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    ctx.log('🔍 Documents: scan workspace');
    await ctx.triggerWorkspaceScan();
  }
}
