import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class OpenFileUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'open-file';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    if (!message.filePath) return;
    await ctx.openFile(message.filePath, message.line);
  }
}
