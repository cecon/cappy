import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import type { McpServerConfig } from "../config";

/**
 * Tool metadata exposed by connected MCP servers.
 */
export interface McpTool {
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface ConnectedServer {
  client: Client;
  transport: Transport;
  tools: McpTool[];
}

/**
 * Manages MCP server connections and tool execution.
 */
export class McpManager {
  private readonly connections = new Map<string, ConnectedServer>();

  /**
   * Connects all configured MCP servers and loads their tools.
   * Errors are isolated per server and logged.
   */
  public async connect(servers: McpServerConfig[]): Promise<void> {
    await this.disconnect();

    for (const server of servers) {
      try {
        const transport = createTransport(server.url);
        const client = new Client(
          {
            name: "cappy-extension",
            version: "0.1.0",
          },
          { capabilities: {} },
        );

        await client.connect(transport);
        const listedTools = await client.listTools();
        const tools = listedTools.tools.map<McpTool>((tool) => ({
          serverName: server.name,
          name: tool.name,
          description: tool.description ?? "",
          inputSchema: normalizeSchema(tool.inputSchema),
        }));

        this.connections.set(server.name, {
          client,
          transport,
          tools,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        console.error(`[mcp] Falha ao conectar servidor "${server.name}": ${message}`);
      }
    }
  }

  /**
   * Returns all discovered tools across connected servers.
   */
  public listTools(): McpTool[] {
    const tools: McpTool[] = [];
    for (const connection of this.connections.values()) {
      tools.push(...connection.tools);
    }
    return tools;
  }

  /**
   * Executes one MCP tool call and returns a serialized string result.
   */
  public async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Servidor MCP nao conectado: ${serverName}`);
    }

    const result = await connection.client.callTool({
      name: toolName,
      arguments: args,
    });

    return serializeResult(result);
  }

  /**
   * Disconnects all active MCP transports.
   */
  public async disconnect(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [serverName, connection] of this.connections.entries()) {
      closePromises.push(
        connection.transport.close().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Erro desconhecido";
          console.error(`[mcp] Falha ao desconectar servidor "${serverName}": ${message}`);
        }),
      );
    }

    this.connections.clear();
    await Promise.all(closePromises);
  }
}

/**
 * Creates transport based on URL/command format.
 */
function createTransport(urlOrCommand: string): Transport {
  if (isHttpUrl(urlOrCommand)) {
    return new SSEClientTransport(new URL(urlOrCommand));
  }

  const { command, args } = parseCommand(urlOrCommand);
  return new StdioClientTransport({ command, args });
}

/**
 * Normalizes schema to a serializable object.
 */
function normalizeSchema(schema: unknown): Record<string, unknown> {
  if (isRecord(schema)) {
    return schema;
  }
  return {};
}

/**
 * Converts unknown tool result to string for chat history.
 */
function serializeResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (result === null || typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

/**
 * Checks whether value is an HTTP/HTTPS URL.
 */
function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

/**
 * Parses command strings with optional quoted arguments.
 */
function parseCommand(input: string): { command: string; args: string[] } {
  const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];
  const [command, ...args] = parts;

  if (!command) {
    throw new Error("Comando MCP invalido.");
  }

  return { command, args };
}

/**
 * Narrows unknown values to plain object records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
