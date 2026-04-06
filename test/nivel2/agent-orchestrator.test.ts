/**
 * @fileoverview Unit tests for AgentOrchestrator.
 * @module tests/agent-orchestrator
 */

import { describe, expect, it } from 'vitest'
import { AgentOrchestrator } from '../../src/nivel2/application/orchestrator/AgentOrchestrator'
import { SessionStore } from '../../src/nivel2/application/session/SessionStore'
import type {
  IPlanningModeEngine,
  ISandboxRuntime,
  PlanningResult,
  SandboxResult,
  UserTurnInput,
} from '../../src/shared/types/agent'

class FakePlanningEngine implements IPlanningModeEngine {
  async run(input: UserTurnInput): Promise<PlanningResult> {
    return {
      objective: input.prompt,
      assumptions: ['a1'],
      steps: ['s1'],
      risks: ['r1'],
      validation: ['v1'],
      markdown: `PLANNING:${input.prompt}`,
    }
  }
}

class FakeSandboxRuntime implements ISandboxRuntime {
  async execute(input: UserTurnInput): Promise<SandboxResult> {
    return {
      runId: 'run-1',
      worktreePath: '/tmp/wt',
      commands: ['npm run test:run'],
      logs: [],
      diff: '',
      status: 'success',
      report: `SANDBOX:${input.prompt}`,
    }
  }
}

describe('AgentOrchestrator', () => {
  it('roteia turn para planning mode', async () => {
    const orchestrator = new AgentOrchestrator(
      new SessionStore(),
      new FakePlanningEngine(),
      new FakeSandboxRuntime(),
    )

    const result = await orchestrator.runTurn({
      mode: 'planning',
      prompt: 'criar plano',
    })

    expect(result.responseText).toContain('PLANNING:criar plano')
  })

  it('roteia turn para sandbox mode', async () => {
    const orchestrator = new AgentOrchestrator(
      new SessionStore(),
      new FakePlanningEngine(),
      new FakeSandboxRuntime(),
    )

    const result = await orchestrator.runTurn({
      mode: 'sandbox',
      prompt: 'executar testes',
    })

    expect(result.responseText).toContain('SANDBOX:executar testes')
  })
})

