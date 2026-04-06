/**
 * @fileoverview Main orchestrator for planning/sandbox turns.
 * @module application/orchestrator/AgentOrchestrator
 */

import type {
  ChatMode,
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
  ) {}

  /**
   * Executes one user turn in selected mode.
   */
  async runTurn(input: Omit<UserTurnInput, 'sessionId'> & { sessionId?: string }): Promise<OrchestratorTurnResult> {
    const session = this.sessionStore.getOrCreateSession(input.sessionId, input.mode);
    const turnInput: UserTurnInput = {
      sessionId: session.id,
      prompt: input.prompt,
      mode: input.mode,
    };

    this.sessionStore.appendMessage(session.id, {
      role: 'user',
      content: input.prompt,
      mode: input.mode,
    });

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

    return {
      sessionId: session.id,
      responseText,
      mode: input.mode,
    };
  }

  /**
   * Exposes all sessions for UI sync.
   */
  listSessions() {
    return this.sessionStore.listSessions();
  }
}

