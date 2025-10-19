import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class LoadSubgraphUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'load-subgraph';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    try {
      const depth = message.depth ?? 2;
      ctx.log(`[LoadSubgraphUseCase] Loading subgraph with depth ${depth}`);
      
      const indexingService = ctx.getIndexingService() as unknown as { graphStore?: { getSubgraph?: (seeds: string[] | undefined, depth: number) => Promise<{ nodes: unknown[]; edges: unknown[] }> } } | undefined;
      
      if (!indexingService) {
        ctx.log('[LoadSubgraphUseCase] ERROR: No indexing service available');
        return;
      }
      
      const graphStore = indexingService.graphStore;
      
      if (!graphStore) {
        ctx.log('[LoadSubgraphUseCase] ERROR: No graph store available');
        return;
      }
      
      if (typeof graphStore.getSubgraph !== 'function') {
        ctx.log('[LoadSubgraphUseCase] ERROR: getSubgraph is not a function');
        return;
      }
      
      ctx.log('[LoadSubgraphUseCase] Reloading from disk...');
      if (typeof (graphStore as unknown as { reloadFromDisk?: () => Promise<void> }).reloadFromDisk === 'function') {
        await (graphStore as unknown as { reloadFromDisk: () => Promise<void> }).reloadFromDisk();
        ctx.log('[LoadSubgraphUseCase] Reloaded from disk');
      }
      
      ctx.log('[LoadSubgraphUseCase] Getting subgraph...');
      const sub = await graphStore.getSubgraph(undefined, Math.min(10, Math.max(0, depth)));
      ctx.log(`[LoadSubgraphUseCase] Got subgraph: ${sub.nodes.length} nodes, ${sub.edges.length} edges`);
      
      const msg = { type: 'subgraph', nodes: sub.nodes, edges: sub.edges };
      ctx.log(`[LoadSubgraphUseCase] Sending message: ${JSON.stringify(msg).substring(0, 200)}`);
      ctx.sendMessage(msg);
    } catch (e) {
      ctx.log(`[LoadSubgraphUseCase] ERROR: ${e instanceof Error ? e.message : String(e)}`);
      ctx.sendMessage({ type: 'error', error: `Load subgraph failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
}
