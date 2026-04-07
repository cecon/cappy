/**
 * @fileoverview Integration tests for JSONL append-only audit persistence.
 * @module tests/integration/audit-trail
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { AuditTrailService } from '../../../src/nivel2/application/audit/AuditTrailService'
import { JsonlAuditTrailStore } from '../../../src/nivel2/infrastructure/audit/JsonlAuditTrailStore'

const tempDirs: string[] = []

/**
 * Creates an isolated temporary workspace for file-based audit tests.
 */
function createWorkspaceRoot(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'cappy-audit-'))
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

describe('JsonlAuditTrailStore', () => {
  it('preserva ordem de eventos com escrita assíncrona em fila', async () => {
    const workspaceRoot = createWorkspaceRoot()
    const service = new AuditTrailService(new JsonlAuditTrailStore(workspaceRoot))

    await Promise.all(
      Array.from({ length: 20 }).map((_, index) =>
        service.append({
          eventType: `turn.chunk_${index + 1}`,
          sessionId: 'session-queue',
          runId: 'run-queue',
          actor: 'streaming-callback',
          payloadRef: `chunk-${index + 1}`,
          attempt: 1,
        }),
      ),
    )
    await service.flush()

    const timeline = await service.getRunTimeline('run-queue')
    expect(timeline).toHaveLength(20)
    expect(timeline.map((item) => item.payloadRef)).toEqual(
      Array.from({ length: 20 }).map((_, index) => `chunk-${index + 1}`),
    )
  })

  it('evita duplicidade de evento com appendIfNew em retry', async () => {
    const workspaceRoot = createWorkspaceRoot()
    const service = new AuditTrailService(new JsonlAuditTrailStore(workspaceRoot))

    await service.appendIfNew({
      eventType: 'mcp.requested',
      sessionId: 'session-retry',
      runId: 'run-retry',
      actor: 'mcp-gateway',
      payloadRef: 'github:list_issues',
      attempt: 1,
    })
    await service.appendIfNew({
      eventType: 'mcp.requested',
      sessionId: 'session-retry',
      runId: 'run-retry',
      actor: 'mcp-gateway',
      payloadRef: 'github:list_issues',
      attempt: 1,
    })
    await service.flush()

    const timeline = await service.getRunTimeline('run-retry')
    expect(timeline).toHaveLength(1)
    expect(timeline[0].eventType).toBe('mcp.requested')
  })
})

