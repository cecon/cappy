/**
 * @fileoverview Command policy classifier for sandbox executions.
 * @module infrastructure/sandbox/CommandPolicy
 */

import type { RiskLevel } from '../../../shared/types/agent';

/**
 * Classifies and validates commands against allow/deny rules.
 */
export class CommandPolicy {
  private readonly denyPatterns = [/rm\s+-rf\s+\/?/i, /del\s+\/f\s+\/s\s+\/q/i, /format\s+[a-z]:/i];
  private readonly guardedPatterns = [/git\s+push/i, /npm\s+publish/i, /pnpm\s+publish/i, /deploy/i];

  /**
   * Classifies the command risk level.
   */
  classify(command: string): RiskLevel {
    if (this.denyPatterns.some((pattern) => pattern.test(command))) {
      return 'high';
    }
    if (this.guardedPatterns.some((pattern) => pattern.test(command))) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Hard-blocks known destructive commands.
   */
  isBlocked(command: string): boolean {
    return this.denyPatterns.some((pattern) => pattern.test(command));
  }
}

