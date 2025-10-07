#!/usr/bin/env node
/**
 * Standalone MCP Server for Cappy - VS Code Commands Version
 * Communicates with VS Code extension via VS Code commands (no HTTP server needed)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * VS Code Command Executor
 * Executes VS Code commands and retrieves results via temporary files
 */
class VSCodeCommandExecutor {
  private tempDir: string;
  
  constructor() {
    this.tempDir = os.tmpdir();
  }
  
  /**
   * Execute VS Code command and get result
   */
  async executeCommand(commandId: string, args: any = {}): Promise<any> {
    // Create unique temp file for result
    const resultFile = path.join(this.tempDir, `cappy-mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
    
    try {
      // Prepare arguments
      const argsJson = JSON.stringify({ ...args, resultFile });
      
      // Execute VS Code command
      // VS Code will write result to the temp file
      const command = `code --command "${commandId}" --args="${argsJson.replace(/"/g, '\\"')}"`;
      
      console.error(`[MCP] Executing: ${commandId}`);
      await execAsync(command, { timeout: 30000 });
      
      // Wait for result file with timeout
      const result = await this.waitForResult(resultFile, 10000);
      
      // Cleanup temp file
      await fs.unlink(resultFile).catch(() => {});
      
      return result;
    } catch (error) {
      // Cleanup on error
      await fs.unlink(resultFile).catch(() => {});
      throw new Error(`Command execution failed: ${error}`);
    }
  }
  
  /**
   * Wait for result file to be created and read it
   */
  private async waitForResult(filePath: string, timeoutMs: number): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Check if file exists and has content
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          const content = await fs.readFile(filePath, 'utf8');
          return JSON.parse(content);
        }
      } catch (error) {
        // File doesn't exist yet, continue waiting
      }
      
      // Wait 100ms before checking again
      await this.sleep(100);
    }
    
    throw new Error('Timeout waiting for command result');
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Cappy MCP Server using VS Code Commands
 */
class CappyMCPServer {
  private server: Server;
  private commandExecutor: VSCodeCommandExecutor;
  
  constructor() {
    this.commandExecutor = new VSCodeCommandExecutor();
    
    this.server = new Server(
      {
        name: 'cappy',
        version: '2.0.0',
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
              text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }
  
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
        description: 'Query the CappyRAG knowledge base with semantic or text-based search',
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
              description: 'Type of search: semantic (vector), text (keyword), or hybrid (both)',
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
  
  private async handleAddDocument(args: any): Promise<any> {
    const result = await this.commandExecutor.executeCommand('cappy.mcp.addDocument', args);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Document added successfully!\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }
  
  private async handleQuery(args: any): Promise<any> {
    const result = await this.commandExecutor.executeCommand('cappy.mcp.query', args);
    
    return {
      content: [
        {
          type: 'text',
          text: `📚 Query results:\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }
  
  private async handleGetStats(): Promise<any> {
    const result = await this.commandExecutor.executeCommand('cappy.mcp.getStats', {});
    
    return {
      content: [
        {
          type: 'text',
          text: `📊 Knowledge base statistics:\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }
  
  private setupErrorHandling(): void {
    this.server.onerror = (error: any) => {
      console.error('[MCP Server Error]', error);
    };
    
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }
  
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('🦫 Cappy MCP Server started (VS Code Commands mode)');
  }
}

// Start the server
const server = new CappyMCPServer();
server.start().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
