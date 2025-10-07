#!/usr/bin/env node
/**
 * Standalone MCP Server for Cappy
 * This runs as a separate Node.js process and communicates via stdio
 * Does NOT require the vscode module
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as http from 'http';

/**
 * Extension HTTP API Client
 * Communicates with the running VS Code extension via HTTP
 */
class ExtensionAPIClient {
  private baseUrl: string;
  
  constructor() {
    // Try to detect port from environment or use default
    const port = process.env.CAPPY_API_PORT || '38194';
    this.baseUrl = `http://localhost:${port}`;
  }
  
  /**
   * Make HTTP request to extension API
   */
  private async request(method: string, path: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      
      const options: http.RequestOptions = {
        method,
        headers: {
          'content-type': 'application/json', // eslint-disable-line
          'user-agent': 'Cappy-MCP-Server/1.0', // eslint-disable-line
        },
      };
      
      const req = http.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }
  
  /**
   * Add document via extension API
   */
  async addDocument(filePath: string, options?: any): Promise<any> {
    return this.request('POST', '/api/cappyrag/addDocument', {
      filePath,
      ...options,
    });
  }
  
  /**
   * Query knowledge base via extension API
   */
  async query(query: string, maxResults?: number): Promise<any> {
    return this.request('POST', '/api/cappyrag/query', {
      query,
      maxResults,
    });
  }
  
  /**
   * Get statistics via extension API
   */
  async getStats(): Promise<any> {
    return this.request('GET', '/api/cappyrag/stats');
  }
  
  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      await this.request('GET', '/api/health');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Cappy MCP Server
 * Provides tools for CappyRAG via Model Context Protocol
 */
class CappyMCPServer {
  private server: Server;
  private apiClient: ExtensionAPIClient;
  
  constructor() {
    this.apiClient = new ExtensionAPIClient();
    
    this.server = new Server(
      {
        name: 'cappy',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupToolHandlers();
    this.setupErrorHandling();
  }
  
  /**
   * Setup tool handlers
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });
    
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'cappyrag_add_document':
            return await this.handleAddDocument(args);
          
          case 'cappyrag_query':
            return await this.handleQuery(args);
          
          case 'cappyrag_get_stats':
            return await this.handleGetStats();
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }
  
  /**
   * Get list of available tools
   */
  private getTools(): Tool[] {
    return [
      {
        name: 'cappyrag_add_document',
        description: 'Add a document to the CappyRAG knowledge base',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the document file',
            },
            title: {
              type: 'string',
              description: 'Optional document title',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional document tags',
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'cappyrag_query',
        description: 'Query the CappyRAG knowledge base',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 5)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'cappyrag_get_stats',
        description: 'Get statistics about the knowledge base',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }
  
  /**
   * Handle add document tool
   */
  private async handleAddDocument(args: any): Promise<any> {
    const result = await this.apiClient.addDocument(args.filePath, {
      title: args.title,
      tags: args.tags,
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Document added successfully!\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }
  
  /**
   * Handle query tool
   */
  private async handleQuery(args: any): Promise<any> {
    const result = await this.apiClient.query(args.query, args.maxResults);
    
    return {
      content: [
        {
          type: 'text',
          text: `📚 Query results:\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }
  
  /**
   * Handle get stats tool
   */
  private async handleGetStats(): Promise<any> {
    const result = await this.apiClient.getStats();
    
    return {
      content: [
        {
          type: 'text',
          text: `📊 Knowledge base statistics:\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }
  
  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error: any) => {
      console.error('[MCP Server Error]', error);
    };
    
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }
  
  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Check if extension API is available
    const isHealthy = await this.apiClient.health();
    
    if (!isHealthy) {
      console.error('⚠️  Warning: Extension API is not available. Some features may not work.');
      console.error('   Make sure the Cappy extension is running in VS Code.');
    }
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('🦫 Cappy MCP Server started successfully');
  }
}

// Start the server
const server = new CappyMCPServer();
server.start().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
