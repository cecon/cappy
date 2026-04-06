/**
 * @fileoverview MCP policy engine for risk-based execution control.
 * @module infrastructure/mcp/McpPolicyEngine
 */

import type { McpToolRequest, RiskLevel } from '../../../shared/types/agent';

/**
 * Policy result for one MCP call.
 */
export interface McpPolicyDecision {
  /**
   * Whether execution should proceed.
   */
  allow: boolean;
  /**
   * Classified risk.
   */
  risk: RiskLevel;
  /**
   * Optional denial reason.
   */
  reason?: string;
}

/**
 * Applies conservative allowlist rules for MCP tool calls.
 */
export class McpPolicyEngine {
  private readonly denyExactTools = new Set([
    'delete_database',
    'drop_table',
    'force_push',
  ]);

  /**
   * Evaluates request and returns allow/deny decision.
   */
  evaluate(request: McpToolRequest): McpPolicyDecision {
    if (this.denyExactTools.has(request.toolName)) {
      return {
        allow: false,
        risk: 'high',
        reason: `Tool bloqueada por policy: ${request.toolName}`,
      };
    }
    if (/(delete|drop|remove|destroy)/i.test(request.toolName)) {
      return {
        allow: false,
        risk: 'high',
        reason: `Tool sensível bloqueada: ${request.toolName}`,
      };
    }
    if (/(update|write|insert|create)/i.test(request.toolName)) {
      return {
        allow: true,
        risk: 'medium',
      };
    }
    return {
      allow: true,
      risk: 'low',
    };
  }
}

