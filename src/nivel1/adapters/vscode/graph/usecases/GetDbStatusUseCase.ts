import * as fs from 'node:fs';
import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class GetDbStatusUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'get-db-status';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
  const path = ctx.getGraphPath();
    if (!path) return;
    const exists = fs.existsSync(path);
    ctx.sendMessage({ type: 'db-status', exists, created: ctx.getGraphDbCreated(), path });
  }
}
