import * as fs from 'fs';
import * as path from 'path';
import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class ResetGraphUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'graph-reset';
  }

  async handle(_: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    try {
      const dataDir = ctx.getGraphPath();
      if (!dataDir) return;
      
      // Delete only the graph database file, not the entire data directory
      const graphDbPath = path.join(dataDir, 'graph-store.db');
      
      if (fs.existsSync(graphDbPath)) {
        fs.unlinkSync(graphDbPath);
        ctx.log(`🗑️ Removed graph database: ${graphDbPath}`);
        ctx.sendMessage({ type: 'db-status', exists: false, created: false, path: dataDir });
      } else {
        ctx.log(`⚠️ Graph database not found: ${graphDbPath}`);
        ctx.sendMessage({ type: 'db-status', exists: false, created: false, path: dataDir });
      }
      
      // Refresh the graph after reset
      await ctx.refreshSubgraph();
      
    } catch (error) {
      ctx.log(`❌ Failed to reset graph data: ${error}`);
      ctx.sendMessage({ type: 'error', error: `Reset failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
}
