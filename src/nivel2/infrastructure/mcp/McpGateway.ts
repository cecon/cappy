/**
 * @fileoverview MCP gateway with policy guard.
 * @module infrastructure/mcp/McpGateway
 */

import * as vscode from 'vscode';
import type { IMcpGateway, McpToolRequest } from '../../../shared/types/agent';
import { McpPolicyEngine } from './McpPolicyEngine';

/**
 * Executes MCP tools under policy constraints.
 */
export class McpGateway implements IMcpGateway {
  constructor(private readonly policyEngine = new McpPolicyEngine()) {}

  /**
   * Evaluates request and executes when policy allows.
   */
  async execute(request: McpToolRequest): Promise<unknown> {
    const decision = this.policyEngine.evaluate(request);
    if (!decision.allow) {
      throw new Error(decision.reason ?? 'MCP request blocked by policy.');
    }

    if (decision.risk !== 'low') {
      const choice = await vscode.window.showWarningMessage(
        `Executar MCP tool "${request.toolName}" (${decision.risk})?`,
        { modal: true },
        'Executar',
        'Cancelar',
      );
      if (choice !== 'Executar') {
        throw new Error('Execução MCP cancelada pelo usuário.');
      }
    }

    // In this architecture layer we keep MCP invocation decoupled from concrete SDK.
    // The concrete transport can be injected later without changing orchestrator contracts.
    return {
      ok: true,
      server: request.server,
      toolName: request.toolName,
      arguments: request.arguments,
      note: 'MCP execution adapter not bound in this build.',
    };
  }
}

