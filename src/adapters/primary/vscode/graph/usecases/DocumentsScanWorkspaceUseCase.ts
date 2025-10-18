import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class DocumentsScanWorkspaceUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'documents/scan-workspace';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    ctx.log('🔍 Documents: scan workspace');
    await ctx.triggerWorkspaceScan();
  }
}
