import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class SearchUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'search';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    const query = message.query;
    const indexingService = ctx.getIndexingService() as { hybridSearch: (q: string, limit: number) => Promise<{ directMatches: unknown[]; relatedChunks: unknown[] }> } | undefined;
    if (!indexingService || !query) return;
    try {
      ctx.log(`🔍 Searching for: "${query}"`);
      ctx.sendMessage({ type: 'status', status: 'searching' });
      const results = await indexingService.hybridSearch(query, 20);
      const totalResults = results.directMatches.length + results.relatedChunks.length;
      ctx.log(`✅ Found ${totalResults} results (${results.directMatches.length} direct, ${results.relatedChunks.length} related)`);
      ctx.sendMessage({ type: 'search-results', query, results: { direct: results.directMatches, related: results.relatedChunks } });
    } catch (error) {
      ctx.log(`❌ Search failed: ${error}`);
      ctx.sendMessage({ type: 'error', error: `Search failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
}
