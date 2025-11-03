import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';

export class DocumentsViewDetailsUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'document/view-details';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    try {
      const { fileId } = (message.payload || {}) as { fileId: string };
      
      ctx.log(`[DocumentsViewDetailsUseCase] Fetching details for fileId: ${fileId}`);

      // Use commands to access file and graph data
      const fileData = await ctx.vscode.commands.executeCommand<{
        file: {
          id: string;
          filePath: string;
          fileName: string;
        } | null;
        chunks: Array<{
          id: string;
          content: string;
          embedding?: number[];
        }>;
        graphNode: {
          id: string;
          type: string;
          properties: Record<string, unknown>;
        } | null;
        relationships: Array<{
          from: string;
          to: string;
          type: string;
        }>;
      }>('cappy.getDocumentDetails', { fileId });

      if (!fileData?.file) {
        ctx.log(`[DocumentsViewDetailsUseCase] File not found: ${fileId}`);
        ctx.sendMessage({
          type: 'document/details',
          payload: {
            embeddings: [],
            graphNode: null,
            relationships: []
          }
        });
        return;
      }

      ctx.log(`[DocumentsViewDetailsUseCase] File found: ${fileData.file.filePath}`);
      ctx.log(`[DocumentsViewDetailsUseCase] Found ${fileData.chunks.length} chunks, ${fileData.relationships.length} relationships`);

      const payload = {
        embeddings: fileData.chunks.map(c => ({
          chunkId: c.id,
          content: c.content,
          embedding: c.embedding || []
        })),
        graphNode: fileData.graphNode,
        relationships: fileData.relationships
      };

      ctx.log(`[DocumentsViewDetailsUseCase] Sending details to webview`);
      ctx.sendMessage({
        type: 'document/details',
        payload
      });
      
      ctx.log(`[DocumentsViewDetailsUseCase] Details sent successfully`);
    } catch (error) {
      ctx.log(`[DocumentsViewDetailsUseCase] Error: ${error}`);
      ctx.sendMessage({
        type: 'document/details',
        payload: {
          embeddings: [],
          graphNode: null,
          relationships: []
        }
      });
    }
  }
}
