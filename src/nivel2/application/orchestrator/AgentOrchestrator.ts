/**
 * @fileoverview Main orchestrator for planning/sandbox turns.
 * @module application/orchestrator/AgentOrchestrator
 */

import * as crypto from 'crypto';
import type {
  ChatMode,
  IAuditTrailService,
  IPlanningModeEngine,
  ISandboxRuntime,
  UserTurnInput,
} from '../../../shared/types/agent';
import { SessionStore } from '../session/SessionStore';

/**
 * Result of one orchestrated turn.
 */
export interface OrchestratorTurnResult {
  /**
   * Session id used in this turn.
   */
  sessionId: string;
  /**
   * Run id used across all events in this turn.
   */
  runId: string;
  /**
   * Assistant response markdown/text.
   */
  responseText: string;
  /**
   * Final mode used.
   */
  mode: ChatMode;
}

/**
 * Coordinates mode engines and updates chat session timeline.
 */
export class AgentOrchestrator {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly planningMode: IPlanningModeEngine,
    private readonly sandboxRuntime: ISandboxRuntime,
    private readonly auditTrail?: IAuditTrailService,
  ) {}

  /**
   * Executes one user turn in selected mode.
   */
  async runTurn(
    input: Omit<UserTurnInput, 'sessionId' | 'runId'> & { sessionId?: string; runId?: string; attempt?: number },
  ): Promise<OrchestratorTurnResult> {
    const session = this.sessionStore.getOrCreateSession(input.sessionId, input.mode);
    const runId = input.runId ?? `run-${crypto.randomUUID()}`;
    const attempt = input.attempt ?? 1;
    const turnInput: UserTurnInput = {
      sessionId: session.id,
      runId,
      prompt: input.prompt,
      mode: input.mode,
    };

    await this.auditTrail?.appendIfNew({
      eventType: 'turn.started',
      sessionId: session.id,
      runId,
      actor: 'orchestrator',
      payloadRef: turnInput.mode,
      attempt,
    });

    this.sessionStore.appendMessage(session.id, {
      role: 'user',
      content: input.prompt,
      mode: input.mode,
    });
    await this.auditTrail?.appendIfNew({
      eventType: 'turn.user_appended',
      sessionId: session.id,
      runId,
      actor: 'orchestrator',
      payloadRef: input.mode,
      attempt,
    });

    try {
      let responseText: string;
      if (turnInput.mode === 'planning') {
        const planning = await this.planningMode.run(turnInput);
        responseText = planning.markdown;
      } else {
        const sandbox = await this.sandboxRuntime.execute(turnInput);
        responseText = sandbox.report;
      }

      this.sessionStore.appendMessage(session.id, {
        role: 'assistant',
        content: responseText,
        mode: input.mode,
      });
      await this.auditTrail?.appendIfNew({
        eventType: 'turn.assistant_appended',
        sessionId: session.id,
        runId,
        actor: 'orchestrator',
        payloadRef: input.mode,
        attempt,
      });
      await this.auditTrail?.appendIfNew({
        eventType: 'turn.completed',
        sessionId: session.id,
        runId,
        actor: 'orchestrator',
        payloadRef: input.mode,
        attempt,
      });

      return {
        sessionId: session.id,
        runId,
        responseText,
        mode: input.mode,
      };
    } catch (error) {
      await this.auditTrail?.appendIfNew({
        eventType: 'turn.failed',
        sessionId: session.id,
        runId,
        actor: 'orchestrator',
        payloadRef: input.mode,
        attempt,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  /**
   * Exposes all sessions for UI sync.
   */
  listSessions() {
    return this.sessionStore.listSessions();
  }
}

