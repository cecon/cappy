import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class ReadyUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'ready';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    ctx.log('✅ Webview ready');
  }
}
