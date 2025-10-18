import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class LoadSubgraphUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'load-subgraph';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    try {
      const depth = message.depth ?? 2;
      const indexingService = ctx.getIndexingService() as unknown as { graphStore?: { getSubgraph?: (seeds: string[] | undefined, depth: number) => Promise<{ nodes: unknown[]; edges: unknown[] }> } } | undefined;
      if (!indexingService) return;
      const graphStore = indexingService.graphStore;
      if (graphStore && typeof graphStore.getSubgraph === 'function') {
        const maybeReload = (graphStore as unknown as { reloadFromDisk?: () => Promise<void> }).reloadFromDisk;
        if (typeof maybeReload === 'function') {
          await maybeReload();
        }
        const sub = await graphStore.getSubgraph(undefined, Math.min(10, Math.max(0, depth)));
        ctx.sendMessage({ type: 'subgraph', nodes: sub.nodes, edges: sub.edges });
      }
    } catch (e) {
      ctx.sendMessage({ type: 'error', error: `Load subgraph failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
}
