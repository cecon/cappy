import * as http from 'http';
import type { FileProcessingQueue } from './file-processing-queue';
import type { FileMetadataDatabase, FileMetadata } from './file-metadata-database';
import type { GraphStorePort } from '../../../domains/graph/ports/indexing-port';

export interface FileUploadRequest {
  filePath: string;
  fileName: string;
  content: string; // base64 encoded
}

export interface FileStatusResponse {
  fileId: string; // Changed from number to string to match FileMetadata
  fileName?: string;
  filePath?: string;
  status: 'pending' | 'processing' | 'extracting_entities' | 'creating_relationships' | 'entity_discovery' | 'processed' | 'completed' | 'error' | 'failed' | 'paused';
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
  private database: FileMetadataDatabase;
  private graphStore: GraphStorePort | null;
  private port: number;
  private onScanWorkspace?: () => Promise<void>;
  private onReprocessFile?: (filePath: string) => Promise<void>;

  constructor(
    _queue: FileProcessingQueue,
    database: FileMetadataDatabase,
    _workspaceRoot: string, // kept for compatibility but no longer used
    port: number = 3456,
    graphStore: GraphStorePort | null = null,
    onScanWorkspace?: () => Promise<void>,
    onReprocessFile?: (filePath: string) => Promise<void>
  ) {
    this.database = database;
    this.port = port;
    this.graphStore = graphStore;
    this.onScanWorkspace = onScanWorkspace;
    this.onReprocessFile = onReprocessFile;
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
        const { filePath } = JSON.parse(body || '{}');
        if (!filePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing filePath' }));
          return;
        }

        // Check if file exists in graph store
        if (this.graphStore) {
          const indexedFiles = await this.graphStore.listAllFiles();
          const fileExists = indexedFiles.some(f => f.path === filePath);
          
          if (!fileExists) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found in graph' }));
            return;
          }
        }

        // Trigger reprocessing via callback
        if (!this.onReprocessFile) {
          res.writeHead(501, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Reprocess not supported' }));
          return;
        }

        console.log(`[FileProcessingAPI] 🔄 Reprocess requested for ${filePath}`);
        await this.onReprocessFile(filePath);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'File reprocessed successfully', filePath }));
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

        // Try to fetch metadata from DB (may be absent for indexed-only entries)
        const metadata = this.database.getFile(String(fileId));

        // Determine the file path to operate on (prefer explicit filePath from request)
        const actualFilePath = filePath || metadata?.filePath;
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

        // 2. Delete from database if it exists (for uploaded/queued files)
        if (metadata) {
          this.database.deleteFile(String(fileId));
          console.log(`[FileProcessingAPI] ✅ File metadata deleted from database`);
        } else {
          // If no metadata, this is likely an indexed-only entry; treat as best-effort graph cleanup
          console.log(`[FileProcessingAPI] ℹ️  No metadata found for ${fileId}. Skipped DB deletion.`);
        }

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

        // Use virtual path for uploaded files
        const virtualPath = `uploaded:${uploadRequest.fileName}`;
        
        // Check if file already exists
        const existing = this.database.getFileByPath(virtualPath);
        
        let fileId: string;
        if (existing) {
          // File already uploaded, check hash
          if (existing.fileHash === hash) {
            // Same file, return existing
            console.log('[FileProcessingAPI] ✅ File already in queue:', existing.id);
            fileId = existing.id;
          } else {
            // Different content, mark for reprocessing
            this.database.updateFile(existing.id, {
              status: 'pending',
              fileHash: hash,
              fileContent: uploadRequest.content,
              fileSize: fileContent.length,
              retryCount: 0,
              errorMessage: undefined,
              currentStep: 'File updated, reprocessing',
              updatedAt: new Date().toISOString()
            });
            console.log('[FileProcessingAPI] 🔄 File updated, marked for reprocessing:', existing.id);
            fileId = existing.id;
          }
        } else {
          // New file, add to metadata database
          fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          
          this.database.insertFile({
            id: fileId,
            filePath: virtualPath,
            fileName: uploadRequest.fileName,
            fileSize: fileContent.length,
            fileHash: hash,
            fileContent: uploadRequest.content, // Store base64 content
            status: 'pending', // UnifiedQueueProcessor will pick it up
            progress: 0,
            retryCount: 0,
            maxRetries: 3
          });
          
          console.log('[FileProcessingAPI] ✅ File added to queue:', fileId);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          fileId,
          status: 'pending',
          message: 'File added to processing queue'
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

          // Use stable ID based on file path for consistent reprocessing
          const fileId = `indexed-${Buffer.from(file.path).toString('base64').replace(/[/+=]/g, '')}`;

          return {
            fileId,
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
      console.log('[FileProcessingAPI] 🗑️ Clearing all files from database and graph...');
      
      // Clear all files from metadata database (memory + disk)
      this.database.clearAll();
      console.log('[FileProcessingAPI] ✅ File metadata cleared');
      
      // Clear all data from graph database (memory + disk)
      if (this.graphStore) {
        await this.graphStore.clearAll();
        console.log('[FileProcessingAPI] ✅ Graph database cleared');
      }
      
      console.log('[FileProcessingAPI] ✅ All data cleared successfully');
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'All files and graph data cleared successfully' 
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
