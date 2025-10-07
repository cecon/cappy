import * as vscode from 'vscode';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { AddDocumentTool } from './addDocumentTool';
import { QueryTool } from './queryTool';
import { GetStatsTool } from './getStatsTool';

/**
 * Embedded MCP Server (runs inside VS Code extension)
 * Uses direct vscode.commands.executeCommand calls
 */
export class EmbeddedMCPServer {
  private server: Server;
  private addDocumentTool: AddDocumentTool;
  private queryTool: QueryTool;
  private getStatsTool: GetStatsTool;
  
  constructor(private context: vscode.ExtensionContext) {
    this.addDocumentTool = new AddDocumentTool(context);
    this.queryTool = new QueryTool(context);
    this.getStatsTool = new GetStatsTool(context);
    
    this.server = new Server(
      {
        name: 'cappy',
        version: '3.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupToolHandlers();
  }
  
  /**
   * Setup MCP tool handlers
   */
  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });
    
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
   * Get available tools
   */
  private getTools(): Tool[] {
    return [
      {
        name: 'cappyrag_add_document',
        description: 'Add a document to the CappyRAG knowledge base with cross-document relationship detection',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Absolute path to the document file',
            },
            title: {
              type: 'string',
              description: 'Optional document title (defaults to filename)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional document tags for categorization',
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'cappyrag_query',
        description: 'Query the CappyRAG knowledge base with semantic search',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query text',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 5)',
            },
            searchType: {
              type: 'string',
              enum: ['semantic', 'text', 'hybrid'],
              description: 'Type of search (default: hybrid)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'cappyrag_get_stats',
        description: 'Get comprehensive statistics about the CappyRAG knowledge base',
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
    const result = await this.addDocumentTool.addDocument(
      args.filePath,
      args.title,
      args.author,
      args.tags,
      args.language,
      args.processingOptions
    );
    
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
    const result = await this.queryTool.query(
      args.query,
      args.maxResults || 5,
      args.searchType || 'hybrid'
    );
    
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
    const result = await this.getStatsTool.getStats();
    
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
   * Start the embedded MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('🦫 Embedded Cappy MCP Server started (direct VS Code integration)');
  }
  
  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.server.close();
  }
}