import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';
import type { HybridRetriever, HybridRetrieverOptions } from '../../../../../nivel2/infrastructure/services/hybrid-retriever';

interface RetrievalSearchMessage extends WebviewMessage {
  type: 'retrieval/search';
  payload: {
    query: string;
    options?: HybridRetrieverOptions;
  };
}

export class RetrievalSearchUseCase implements UseCase {
  private readonly hybridRetriever: HybridRetriever;

  constructor(hybridRetriever: HybridRetriever) {
    this.hybridRetriever = hybridRetriever;
  }

  canHandle(message: WebviewMessage): boolean {
    return message.type === 'retrieval/search';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    const retrievalMessage = message as RetrievalSearchMessage;
    console.log('[RetrievalSearchUseCase] Handling search:', retrievalMessage.payload);

    try {
      const { query, options = {} } = retrievalMessage.payload || {};

      if (!query?.trim()) {
        throw new Error('Query cannot be empty');
      }

      const startTime = Date.now();

      // Execute hybrid retrieval
      const result = await this.hybridRetriever.retrieve(query, options);
      
      const executionTime = Date.now() - startTime;

      console.log('[RetrievalSearchUseCase] Search completed:', {
        totalFound: result.metadata.totalFound,
        returned: result.metadata.returned,
        executionTime,
        strategy: options.strategy || 'hybrid'
      });

      // Add execution time to metadata
      const enrichedResult = {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime
        }
      };

      // Send result back to webview
      ctx.sendMessage({
        type: 'retrieval/result',
        payload: enrichedResult
      });
    } catch (error) {
      console.error('[RetrievalSearchUseCase] Search failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error during retrieval';

      ctx.sendMessage({
        type: 'retrieval/error',
        error: errorMessage
      });
    }
  }
}
