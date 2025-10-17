import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { FileProcessingQueue } from './file-processing-queue';
import { FileMetadataDatabase, type FileMetadata } from './file-metadata-database';

export interface FileUploadRequest {
  filePath: string;
  fileName: string;
  content: string; // base64 encoded
}

export interface FileStatusResponse {
  fileId: string; // Changed from number to string to match FileMetadata
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  summary: string;
  error?: string;
}

export class FileProcessingAPI {
  private server: http.Server | null = null;
  private queue: FileProcessingQueue;
  private database: FileMetadataDatabase;
  private port: number;
  private workspaceRoot: string;

  constructor(
    queue: FileProcessingQueue,
    database: FileMetadataDatabase,
    workspaceRoot: string,
    port: number = 3456
  ) {
    this.queue = queue;
    this.database = database;
    this.workspaceRoot = workspaceRoot;
    this.port = port;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // CORS headers for browser access
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
      } else if (req.method === 'GET' && url.pathname === '/files/status') {
        await this.handleGetStatus(req, res);
      } else if (req.method === 'GET' && url.pathname === '/files/all') {
        await this.handleGetAllFiles(req, res);
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
        
        // Save uploaded file to temp location
        const tempDir = path.join(this.workspaceRoot, '.cappy', 'temp');
        if (!fs.existsSync(tempDir)) {
          console.log('[FileProcessingAPI] Creating temp directory:', tempDir);
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, uploadRequest.fileName);
        console.log('[FileProcessingAPI] Saving to:', tempFilePath);
        
        const fileContent = Buffer.from(uploadRequest.content, 'base64');
        fs.writeFileSync(tempFilePath, fileContent);
        console.log('[FileProcessingAPI] File saved, size:', fileContent.length, 'bytes');

        // Calculate hash
        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
        console.log('[FileProcessingAPI] File hash:', hash);

        // Enqueue file for processing
        console.log('[FileProcessingAPI] Enqueueing file...');
        const fileId = await this.queue.enqueue(tempFilePath, hash);
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
      error: metadata.errorMessage || undefined
    };

    console.log(`[FileProcessingAPI] Status response for ${fileIdStr}:`, statusResponse);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statusResponse));
  }

  private async handleGetAllFiles(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const allFiles = await this.database.getAllFileMetadata();
    
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
        status: metadata.status === 'cancelled' ? 'failed' : metadata.status,
        progress,
        summary,
        error: metadata.errorMessage || undefined
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statusResponses));
  }
}
