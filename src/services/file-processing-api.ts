import * as http from 'http';
import type { FileProcessingQueue } from './file-processing-queue';
import type { FileMetadataDatabase, FileMetadata } from './file-metadata-database';
import type { GraphStorePort } from '../domains/graph/ports/indexing-port';

export interface FileUploadRequest {
  filePath: string;
  fileName: string;
  content: string; // base64 encoded
}

export interface FileStatusResponse {
  fileId: string; // Changed from number to string to match FileMetadata
  fileName?: string;
  filePath?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  summary: string;
  error?: string;
  chunksCount?: number;
  nodesCount?: number;
  relationshipsCount?: number;
  fileSize?: number;
}

export class FileProcessingAPI {
  private server: http.Server | null = null;
  private queue: FileProcessingQueue;
  private database: FileMetadataDatabase;
  private graphStore: GraphStorePort | null;
  private port: number;
  private onScanWorkspace?: () => Promise<void>;

  constructor(
    queue: FileProcessingQueue,
    database: FileMetadataDatabase,
    _workspaceRoot: string, // kept for compatibility but no longer used
    port: number = 3456,
    graphStore: GraphStorePort | null = null,
    onScanWorkspace?: () => Promise<void>
  ) {
    this.queue = queue;
    this.database = database;
    this.port = port;
    this.graphStore = graphStore;
    this.onScanWorkspace = onScanWorkspace;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // CORS headers for browser access
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        this.handleRequest(req, res);
      });

      this.server.listen(this.port, () => {
        console.log(`[FileProcessingAPI] Server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        console.error('[FileProcessingAPI] Server error:', error);
        reject(error);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[FileProcessingAPI] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '', `http://localhost:${this.port}`);
      
      if (req.method === 'POST' && url.pathname === '/files/enqueue') {
        await this.handleEnqueue(req, res);
      } else if (req.method === 'POST' && url.pathname === '/files/reprocess') {
        await this.handleReprocess(req, res);
      } else if (req.method === 'POST' && url.pathname === '/scan/workspace') {
        await this.handleScanWorkspace(req, res);
      } else if (req.method === 'DELETE' && url.pathname === '/files/remove') {
        await this.handleRemove(req, res);
      } else if (req.method === 'GET' && url.pathname === '/files/status') {
        await this.handleGetStatus(req, res);
      } else if (req.method === 'GET' && url.pathname === '/files/all') {
        await this.handleGetAllFiles(req, res);
      } else if (req.method === 'GET' && url.pathname === '/files/indexed') {
        await this.handleGetIndexedFiles(req, res);
      } else if (req.method === 'POST' && url.pathname === '/files/clear') {
        await this.handleClearAll(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('[FileProcessingAPI] Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }));
    }
  }

  private async handleScanWorkspace(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      if (!this.onScanWorkspace) {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Scan workspace not supported' }));
        return;
      }
      console.log('[FileProcessingAPI] 🔍 Triggering workspace scan via API');
      await this.onScanWorkspace();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Workspace scan triggered' }));
    } catch (error) {
      console.error('[FileProcessingAPI] ❌ Scan workspace error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to trigger workspace scan' }));
    }
  }

  private async handleReprocess(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { fileId } = JSON.parse(body || '{}');
        if (!fileId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing fileId' }));
          return;
        }

        const metadata = this.database.getFile(String(fileId));
        if (!metadata) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }

        // Reset fields and set back to pending so the queue will pick it up
        this.database.updateFile(String(fileId), {
          status: 'pending',
          progress: 0,
          currentStep: null as unknown as string | undefined,
          errorMessage: null as unknown as string | undefined,
          chunksCount: null as unknown as number | undefined,
          nodesCount: null as unknown as number | undefined,
          relationshipsCount: null as unknown as number | undefined,
          processingStartedAt: null as unknown as string | undefined,
          processingCompletedAt: null as unknown as string | undefined
        });

        console.log(`[FileProcessingAPI] 🔄 Reprocess requested for ${fileId}. Status set to pending.`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Reprocess scheduled', fileId }));
      } catch (error) {
        console.error('[FileProcessingAPI] ❌ Reprocess error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to reprocess file' }));
      }
    });
  }

  private async handleRemove(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { fileId, filePath } = JSON.parse(body || '{}');
        if (!fileId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing fileId' }));
          return;
        }

        console.log(`[FileProcessingAPI] 🗑️  Remove requested for ${fileId} (${filePath})`);

        // Get metadata before deletion
        const metadata = this.database.getFile(String(fileId));
        if (!metadata) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }

        const actualFilePath = filePath || metadata.filePath;
        let nodesDeleted = 0;
        let chunksDeleted = 0;
        let relationshipsDeleted = 0;

        // 1. Delete from graph store if available
        if (this.graphStore && actualFilePath) {
          try {
            console.log(`[FileProcessingAPI] 🗑️  Deleting graph data for ${actualFilePath}`);
            
            // Get chunks count before deletion
            const chunks = await this.graphStore.getFileChunks(actualFilePath);
            chunksDeleted = chunks.length;
            
            // Delete file nodes (this should delete chunks and relationships too)
            await this.graphStore.deleteFileNodes(actualFilePath);
            
            // Estimate relationships (at least 1 CONTAINS per chunk)
            relationshipsDeleted = chunksDeleted;
            nodesDeleted = 1 + chunksDeleted; // 1 file node + chunks
            
            console.log(`[FileProcessingAPI] ✅ Graph data deleted: ${nodesDeleted} nodes, ${relationshipsDeleted} relationships`);
          } catch (error) {
            console.error('[FileProcessingAPI] ⚠️  Graph deletion error:', error);
            // Continue even if graph deletion fails
          }
        }

        // 2. Delete from database
        this.database.deleteFile(String(fileId));
        console.log(`[FileProcessingAPI] ✅ File metadata deleted from database`);

        // 3. Queue cleanup happens automatically when file is deleted from database

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          message: 'File removed successfully', 
          fileId,
          nodesDeleted,
          chunksDeleted,
          relationshipsDeleted
        }));

      } catch (error) {
        console.error('[FileProcessingAPI] ❌ Remove error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to remove file' }));
      }
    });
  }

  private async handleEnqueue(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        console.log('[FileProcessingAPI] Parsing upload request...');
        const uploadRequest: FileUploadRequest = JSON.parse(body);
        console.log('[FileProcessingAPI] File:', uploadRequest.fileName);
        
        // Calculate hash directly from base64 content
        const fileContent = Buffer.from(uploadRequest.content, 'base64');
        console.log('[FileProcessingAPI] File size:', fileContent.length, 'bytes');
        
        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
        console.log('[FileProcessingAPI] File hash:', hash);

        // Use virtual path for uploaded files (no temp folder needed)
        const virtualPath = `uploaded:${uploadRequest.fileName}`;
        
        // Enqueue file with content stored in metadata
        console.log('[FileProcessingAPI] Enqueueing file with embedded content...');
        const fileId = await this.queue.enqueueWithContent(
          virtualPath,
          uploadRequest.fileName,
          hash,
          uploadRequest.content, // Keep as base64
          fileContent.length
        );
        console.log('[FileProcessingAPI] ✅ File enqueued with ID:', fileId);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          fileId,
          status: 'pending',
          message: 'File enqueued for processing'
        }));
      } catch (error) {
        console.error('[FileProcessingAPI] ❌ Enqueue error:', error);
        console.error('[FileProcessingAPI] Error stack:', error instanceof Error ? error.stack : 'N/A');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to enqueue file' }));
      }
    });
  }

  private async handleGetStatus(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '', `http://localhost:${this.port}`);
    const fileIdStr = url.searchParams.get('fileId');
    
    if (!fileIdStr) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing fileId parameter' }));
      return;
    }

    const metadata = await this.database.getFile(fileIdStr);

    if (!metadata) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }

    // Calculate progress based on status
    let progress = 0;
    let summary = '';
    
    switch (metadata.status) {
      case 'pending':
        progress = 0;
        summary = 'Waiting in queue...';
        break;
      case 'processing':
        progress = metadata.progress || 50;
        summary = metadata.currentStep || 'Processing file...';
        break;
      case 'completed':
        progress = 100;
        summary = '✅ Successfully processed';
        break;
      case 'failed':
      case 'cancelled':
        progress = 0;
        summary = `❌ Failed: ${metadata.errorMessage}`;
        break;
    }

    const statusResponse: FileStatusResponse = {
      fileId: metadata.id,
      status: metadata.status === 'cancelled' ? 'failed' : metadata.status,
      progress,
      summary,
      error: metadata.errorMessage || undefined,
      chunksCount: metadata.chunksCount,
      nodesCount: metadata.nodesCount,
      relationshipsCount: metadata.relationshipsCount,
      fileSize: metadata.fileSize
    };

    console.log(`[FileProcessingAPI] Status response for ${fileIdStr}:`, statusResponse);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statusResponse));
  }

  private async handleGetAllFiles(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const allFiles = this.database.getAllFileMetadata();
    
  const statusResponses: FileStatusResponse[] = allFiles.map((metadata: FileMetadata) => {
      let progress = 0;
      let summary = '';
      
      switch (metadata.status) {
        case 'pending':
          progress = 0;
          summary = 'Waiting in queue...';
          break;
        case 'processing':
          progress = metadata.progress || 50;
          summary = metadata.currentStep || 'Processing file...';
          break;
        case 'completed':
          progress = 100;
          summary = '✅ Successfully processed';
          break;
        case 'failed':
        case 'cancelled':
          progress = 0;
          summary = `❌ Failed: ${metadata.errorMessage}`;
          break;
      }

      return {
        fileId: metadata.id,
        fileName: metadata.fileName,
        filePath: metadata.filePath,
        status: metadata.status === 'cancelled' ? 'failed' : metadata.status,
        progress,
        summary,
        // Only include error message for failed/cancelled files, not for completed ones
        error: (metadata.status === 'failed' || metadata.status === 'cancelled') 
          ? metadata.errorMessage || undefined 
          : undefined,
        chunksCount: metadata.chunksCount,
        nodesCount: metadata.nodesCount,
        relationshipsCount: metadata.relationshipsCount,
        fileSize: metadata.fileSize
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statusResponses));
  }

  /**
   * Returns files indexed in the graph store (from workspace scan)
   */
  private async handleGetIndexedFiles(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      if (!this.graphStore) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Graph store not available' }));
        return;
      }

      const indexedFiles = await this.graphStore.listAllFiles();

      // Enrich with actual chunk counts from the graph store so UI doesn't show "No chunks"
      const statusResponses: FileStatusResponse[] = await Promise.all(
        indexedFiles.map(async (file) => {
          const fileName = file.path.split('/').pop() || file.path;

          let chunksCount = 0;
          try {
            const chunks = await this.graphStore!.getFileChunks(file.path);
            chunksCount = chunks.length;
          } catch (err) {
            // If chunk retrieval fails, keep 0 but don't break the entire response
            console.warn('[FileProcessingAPI] ⚠️ Could not get chunks for', file.path, err);
          }

          return {
            fileId: `indexed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            fileName,
            filePath: file.path,
            status: 'completed',
            progress: 100,
            summary: `✅ ${file.language} - ${file.linesOfCode} lines`,
            chunksCount,
            nodesCount: undefined,
            relationshipsCount: undefined,
            fileSize: 0
          };
        })
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(statusResponses));
    } catch (error) {
      console.error('[FileProcessingAPI] ❌ Error getting indexed files:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to get indexed files' 
      }));
    }
  }

  private async handleClearAll(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      console.log('[FileProcessingAPI] 🗑️ Clearing all files from database');
      
      // Clear all files from database
      this.database.clearAll();
      
      console.log('[FileProcessingAPI] ✅ All files cleared from database');
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'All files cleared successfully' 
      }));
    } catch (error) {
      console.error('[FileProcessingAPI] ❌ Error clearing files:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  }
}
