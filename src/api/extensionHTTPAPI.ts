/**
 * HTTP API Server for Extension
 * Exposes extension functionality to external MCP server via HTTP
 */

import * as http from 'http';
import * as vscode from 'vscode';
import { AddDocumentTool } from '../tools/addDocumentTool';

export class ExtensionHTTPAPI {
  private server: http.Server | null = null;
  private port: number;
  private addDocumentTool: AddDocumentTool;
  
  constructor(
    private context: vscode.ExtensionContext,
    port: number = 38194
  ) {
    this.port = port;
    this.addDocumentTool = new AddDocumentTool(context);
  }
  
  /**
   * Start HTTP API server
   */
  async start(): Promise<void> {
    if (this.server) {
      console.warn('HTTP API server already running');
      return;
    }
    
    this.server = http.createServer(async (req, res) => {
      await this.handleRequest(req, res);
    });
    
    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, 'localhost', () => {
        console.log(`✅ Cappy HTTP API listening on http://localhost:${this.port}`);
        resolve();
      });
      
      this.server!.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.warn(`Port ${this.port} already in use, trying next port...`);
          this.port++;
          this.server!.listen(this.port, 'localhost');
        } else {
          reject(error);
        }
      });
    });
  }
  
  /**
   * Stop HTTP API server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    
    return new Promise((resolve) => {
      this.server!.close(() => {
        console.log('✅ Cappy HTTP API stopped');
        this.server = null;
        resolve();
      });
    });
  }
  
  /**
   * Handle HTTP request
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      
      // Health check
      if (url.pathname === '/api/health') {
        this.sendJSON(res, 200, { status: 'ok', version: '1.0.0' });
        return;
      }
      
      // Add document
      if (url.pathname === '/api/cappyrag/addDocument' && req.method === 'POST') {
        const body = await this.parseBody(req);
        const result = await this.addDocumentTool.addDocument(
          body.filePath,
          body.title,
          body.author,
          body.tags,
          body.language,
          body.processingOptions
        );
        this.sendJSON(res, 200, result);
        return;
      }
      
      // Query (placeholder - implement when QueryTool exists)
      if (url.pathname === '/api/cappyrag/query' && req.method === 'POST') {
        this.sendJSON(res, 501, { error: 'Query endpoint not implemented yet' });
        return;
      }
      
      // Get stats (placeholder - implement when GetStatsTool exists)
      if (url.pathname === '/api/cappyrag/stats' && req.method === 'GET') {
        this.sendJSON(res, 501, { error: 'Stats endpoint not implemented yet' });
        return;
      }
      
      // Not found
      this.sendJSON(res, 404, { error: 'Not found' });
    } catch (error) {
      console.error('HTTP API error:', error);
      this.sendJSON(res, 500, {
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
  
  /**
   * Parse request body
   */
  private async parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
      
      req.on('error', reject);
    });
  }
  
  /**
   * Send JSON response
   */
  private sendJSON(res: http.ServerResponse, status: number, data: any): void {
    res.writeHead(status, { 'Content-Type': 'application/json' }); // eslint-disable-line
    res.end(JSON.stringify(data));
  }
  
  /**
   * Get current port
   */
  getPort(): number {
    return this.port;
  }
}
