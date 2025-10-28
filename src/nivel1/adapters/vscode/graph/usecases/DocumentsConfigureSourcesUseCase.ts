import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class DocumentsConfigureSourcesUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'documents/configure-sources';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    ctx.log('⚙️ Documents: open settings for sources');
    await ctx.vscode.commands.executeCommand('workbench.action.openSettings', '@ext:eduardocecon.cappy');
  }
}
