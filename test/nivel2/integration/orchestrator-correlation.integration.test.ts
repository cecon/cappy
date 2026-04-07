/**
 * @fileoverview Integration tests for orchestrator correlation and timeline reconstruction.
 * @module tests/integration/orchestrator-correlation
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { AuditTrailService } from '../../../src/nivel2/application/audit/AuditTrailService'
import { PlanningModeEngine } from '../../../src/nivel2/application/modes/PlanningModeEngine'
import { AgentOrchestrator } from '../../../src/nivel2/application/orchestrator/AgentOrchestrator'
import { SessionStore } from '../../../src/nivel2/application/session/SessionStore'
import { JsonlAuditTrailStore } from '../../../src/nivel2/infrastructure/audit/JsonlAuditTrailStore'
import type {
  IProviderGateway,
  ProviderChatRequest,
  ProviderChatResponse,
  ProviderSettings,
  SandboxResult,
  UserTurnInput,
} from '../../../src/shared/types/agent'

const tempDirs: string[] = []

/**
 * Creates isolated workspace root for integration test artifacts.
 */
function createWorkspaceRoot(): string {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'cappy-orchestrator-audit-'))
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

class FakeProviderGateway implements IProviderGateway {
  /**
   * Returns static settings for test doubles.
   */
  async getSettings(): Promise<ProviderSettings> {
    return {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      backend: 'openai',
      apiKey: 'test-key',
    }
  }

  /**
   * No-op secret persistence for tests.
   */
  async setApiKey(_apiKey: string): Promise<void> {}

  /**
   * Always healthy in tests.
   */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'ok' }
  }

  /**
   * Returns deterministic response payload.
   */
  async chat(_request: ProviderChatRequest): Promise<ProviderChatResponse> {
    return { text: 'Resumo de teste' }
  }
}

class FakeSandboxRuntime {
  /**
   * Produces deterministic sandbox output with correlated run id.
   */
  async execute(input: UserTurnInput): Promise<SandboxResult> {
    return {
      runId: input.runId,
      worktreePath: '/tmp/worktree',
      commands: ['npm run test:run'],
      logs: ['ok'],
      diff: '',
      status: 'success',
      report: `SANDBOX:${input.prompt}`,
    }
  }
}

describe('AgentOrchestrator correlation', () => {
  it('gera timeline completa por sessionId/runId do início ao fim', async () => {
    const workspaceRoot = createWorkspaceRoot()
    const auditService = new AuditTrailService(new JsonlAuditTrailStore(workspaceRoot))
    const orchestrator = new AgentOrchestrator(
      new SessionStore(),
      new PlanningModeEngine(new FakeProviderGateway()),
      new FakeSandboxRuntime(),
      auditService,
    )

    const result = await orchestrator.runTurn({
      mode: 'planning',
      prompt: 'planejar PR1',
    })
    await auditService.flush()

    const timeline = await auditService.getRunTimeline(result.runId)
    expect(timeline.map((item) => item.eventType)).toEqual([
      'turn.started',
      'turn.user_appended',
      'turn.assistant_appended',
      'turn.completed',
    ])
    expect(new Set(timeline.map((item) => item.sessionId))).toEqual(new Set([result.sessionId]))
    expect(new Set(timeline.map((item) => item.runId))).toEqual(new Set([result.runId]))
    expect(result.responseText).toContain('Planejamento Estruturado')
  })
})

