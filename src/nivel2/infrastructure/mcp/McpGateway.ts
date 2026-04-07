/**
 * @fileoverview MCP gateway with policy guard.
 * @module infrastructure/mcp/McpGateway
 */

import * as vscode from 'vscode';
import type {
  IAuditTrailService,
  IMcpGateway,
  IMcpTransportAdapter,
  McpExecutionContext,
  McpToolRequest,
} from '../../../shared/types/agent';
import { McpPolicyEngine } from './McpPolicyEngine';
import { McpTransportAdapter } from './McpTransportAdapter';

/**
 * Executes MCP tools under policy constraints.
 */
export class McpGateway implements IMcpGateway {
  constructor(
    private readonly transport: IMcpTransportAdapter = new McpTransportAdapter(),
    private readonly auditTrail?: IAuditTrailService,
    private readonly policyEngine = new McpPolicyEngine(),
  ) {}

  /**
   * Evaluates request and executes when policy allows.
   */
  async execute(request: McpToolRequest, context: McpExecutionContext): Promise<unknown> {
    await this.auditTrail?.appendIfNew({
      eventType: 'mcp.requested',
      sessionId: context.sessionId,
      runId: context.runId,
      actor: 'mcp-gateway',
      payloadRef: `${request.server}:${request.toolName}`,
      attempt: context.attempt ?? 1,
    });

    const decision = this.policyEngine.evaluate(request);
    if (!decision.allow) {
      await this.auditTrail?.appendIfNew({
        eventType: 'mcp.blocked',
        sessionId: context.sessionId,
        runId: context.runId,
        actor: 'mcp-gateway',
        payloadRef: `${request.server}:${request.toolName}`,
        attempt: context.attempt ?? 1,
        metadata: {
          reason: decision.reason,
          risk: decision.risk,
        },
      });
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
        await this.auditTrail?.appendIfNew({
          eventType: 'mcp.user_rejected',
          sessionId: context.sessionId,
          runId: context.runId,
          actor: 'mcp-gateway',
          payloadRef: `${request.server}:${request.toolName}`,
          attempt: context.attempt ?? 1,
          metadata: {
            risk: decision.risk,
          },
        });
        throw new Error('Execução MCP cancelada pelo usuário.');
      }
    }

    await this.auditTrail?.appendIfNew({
      eventType: 'mcp.approved',
      sessionId: context.sessionId,
      runId: context.runId,
      actor: 'mcp-gateway',
      payloadRef: `${request.server}:${request.toolName}`,
      attempt: context.attempt ?? 1,
      metadata: {
        risk: decision.risk,
      },
    });

    try {
      const result = await this.transport.execute(request, context);
      await this.auditTrail?.appendIfNew({
        eventType: 'mcp.succeeded',
        sessionId: context.sessionId,
        runId: context.runId,
        actor: 'mcp-gateway',
        payloadRef: `${request.server}:${request.toolName}`,
        attempt: context.attempt ?? 1,
      });
      return result;
    } catch (error) {
      await this.auditTrail?.appendIfNew({
        eventType: 'mcp.failed',
        sessionId: context.sessionId,
        runId: context.runId,
        actor: 'mcp-gateway',
        payloadRef: `${request.server}:${request.toolName}`,
        attempt: context.attempt ?? 1,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}

