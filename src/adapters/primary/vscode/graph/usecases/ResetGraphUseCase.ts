import * as fs from 'fs';
import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class ResetGraphUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'graph-reset' || message.type === 'kuzu-reset'; // backwards compatible
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    try {
      const p = ctx.getGraphPath();
      if (!p) return;
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
        ctx.log(`🗑️ Removed graph data folder: ${p}`);
      }
      await ctx.ensureGraphDataDir(p);
      ctx.sendMessage({ type: 'db-status', exists: true, created: ctx.getGraphDbCreated(), path: p });
    } catch (error) {
      ctx.log(`❌ Failed to reset graph data: ${error}`);
      ctx.sendMessage({ type: 'error', error: `Reset failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
}
