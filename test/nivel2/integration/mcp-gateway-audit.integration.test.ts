/**
 * @fileoverview Integration tests for MCP gateway with persistent audit.
 * @module tests/integration/mcp-gateway-audit
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { AuditTrailService } from '../../../src/nivel2/application/audit/AuditTrailService'
import { JsonlAuditTrailStore } from '../../../src/nivel2/infrastructure/audit/JsonlAuditTrailStore'
import { McpGateway } from '../../../src/nivel2/infrastructure/mcp/McpGateway'
import type { IMcpTransportAdapter, McpExecutionContext, McpToolRequest } from '../../../src/shared/types/agent'

const tempDirs: string[] = []

/**
 * Creates isolated workspace root for file-backed integration tests.
 */
function createWorkspaceRoot(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'cappy-mcp-audit-'))
  tempDirs.push(target)
  return target
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
})

class FakeMcpTransportAdapter implements IMcpTransportAdapter {
  public calls = 0

  /**
   * Simulates a real MCP transport execution for tests.
   */
  async execute(request: McpToolRequest, context: McpExecutionContext): Promise<unknown> {
    this.calls += 1
    return {
      ok: true,
      server: request.server,
      toolName: request.toolName,
      sessionId: context.sessionId,
      runId: context.runId,
    }
  }
}

describe('McpGateway + AuditTrailService', () => {
  it('persiste trilha correlacionada e deduplica eventos em retry', async () => {
    const workspaceRoot = createWorkspaceRoot()
    const auditService = new AuditTrailService(new JsonlAuditTrailStore(workspaceRoot))
    const transport = new FakeMcpTransportAdapter()
    const gateway = new McpGateway(transport, auditService)
    const context: McpExecutionContext = {
      sessionId: 'session-mcp',
      runId: 'run-mcp',
      actor: 'tool-broker',
      attempt: 1,
    }

    await gateway.execute(
      {
        server: 'github',
        toolName: 'read_issue',
        arguments: { number: 1 },
      },
      context,
    )
    await gateway.execute(
      {
        server: 'github',
        toolName: 'read_issue',
        arguments: { number: 1 },
      },
      context,
    )
    await auditService.flush()

    const timeline = await auditService.getRunTimeline('run-mcp')
    expect(transport.calls).toBe(2)
    expect(timeline.map((item) => item.eventType)).toEqual([
      'mcp.requested',
      'mcp.approved',
      'mcp.succeeded',
    ])
    expect(new Set(timeline.map((item) => item.sessionId))).toEqual(new Set(['session-mcp']))
    expect(new Set(timeline.map((item) => item.runId))).toEqual(new Set(['run-mcp']))
  })
})

