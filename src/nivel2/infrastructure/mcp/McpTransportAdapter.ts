/**
 * @fileoverview MCP transport adapter based on host command bridge.
 * @module infrastructure/mcp/McpTransportAdapter
 */

import * as vscode from 'vscode';
import type {
  IMcpTransportAdapter,
  McpExecutionContext,
  McpToolRequest,
} from '../../../shared/types/agent';

type CommandExecutor = (command: string, ...rest: unknown[]) => Thenable<unknown>;

/**
 * Executes MCP tool calls through host commands (real transport bridge).
 */
export class McpTransportAdapter implements IMcpTransportAdapter {
  private readonly commandCandidates = [
    'mcp.callTool',
    'mcp.executeTool',
    'cursor.mcp.callTool',
  ];

  constructor(
    private readonly commandExecutor: CommandExecutor = vscode.commands.executeCommand,
    private readonly listCommands: () => Thenable<string[]> = () => vscode.commands.getCommands(true),
  ) {}

  /**
   * Executes one MCP call using the first available host command.
   */
  async execute(request: McpToolRequest, context: McpExecutionContext): Promise<unknown> {
    const available = new Set(await this.listCommands());
    const command = this.commandCandidates.find((item) => available.has(item));
    if (!command) {
      throw new Error('Nenhum comando MCP disponível no host para transporte real.');
    }
    return this.commandExecutor(command, {
      server: request.server,
      toolName: request.toolName,
      arguments: request.arguments,
      sessionId: context.sessionId,
      runId: context.runId,
      actor: context.actor,
    });
  }
}

