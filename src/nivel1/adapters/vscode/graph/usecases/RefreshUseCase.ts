import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class RefreshUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'refresh';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    await ctx.indexWorkspace();
  }
}
