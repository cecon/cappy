/**
 * @fileoverview Central broker for tool executions with correlation and audit.
 * @module application/tools/ToolBroker
 */

import type {
  IAuditTrailService,
  IMcpGateway,
  McpExecutionContext,
  McpToolRequest,
} from '../../../shared/types/agent';

/**
 * Centralizes MCP tool calls and emits unified audit events.
 */
export class ToolBroker {
  constructor(
    private readonly mcpGateway: IMcpGateway,
    private readonly auditTrail: IAuditTrailService,
  ) {}

  /**
   * Executes one MCP tool request under correlation context.
   */
  async executeMcpTool(request: McpToolRequest, context: McpExecutionContext): Promise<unknown> {
    await this.auditTrail.appendIfNew({
      eventType: 'toolbroker.mcp.requested',
      sessionId: context.sessionId,
      runId: context.runId,
      actor: 'tool-broker',
      payloadRef: `${request.server}:${request.toolName}`,
      attempt: context.attempt ?? 1,
      metadata: {
        server: request.server,
        toolName: request.toolName,
      },
    });

    try {
      const result = await this.mcpGateway.execute(request, context);
      await this.auditTrail.appendIfNew({
        eventType: 'toolbroker.mcp.succeeded',
        sessionId: context.sessionId,
        runId: context.runId,
        actor: 'tool-broker',
        payloadRef: `${request.server}:${request.toolName}`,
        attempt: context.attempt ?? 1,
      });
      return result;
    } catch (error) {
      await this.auditTrail.appendIfNew({
        eventType: 'toolbroker.mcp.failed',
        sessionId: context.sessionId,
        runId: context.runId,
        actor: 'tool-broker',
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

