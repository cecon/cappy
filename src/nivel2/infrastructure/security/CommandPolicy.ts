/**
 * @fileoverview CommandPolicy — allowlist and audit trail for terminal commands
 * @module security/CommandPolicy
 *
 * Enforces a whitelist of safe command prefixes for the `!command` bridge feature.
 * Commands outside the whitelist require HITL confirmation before execution.
 * Every decision is appended to .cappy/audit.log as a JSON line.
 */

import * as fs   from 'node:fs';
import * as path from 'node:path';

// ── Allowlist ──────────────────────────────────────────────────────

/**
 * Commands that are safe to run without confirmation.
 * Matched as prefix (case-insensitive, trimmed).
 */
const SAFE_PREFIXES: readonly string[] = [
  // Node / package managers
  'npm test', 'npm run test', 'npm run lint', 'npm run build', 'npm ci',
  'yarn test', 'yarn build', 'yarn lint',
  'pnpm test', 'pnpm build', 'pnpm lint',
  // TypeScript / linters
  'npx tsc', 'npx eslint', 'npx prettier',
  // Git read-only
  'git status', 'git log', 'git diff', 'git branch', 'git fetch', 'git show',
  // File inspection
  'cat ', 'ls ', 'pwd', 'echo ', 'head ', 'tail ',
];

/**
 * Patterns that are always blocked, even if they start with a safe prefix.
 * Regex tested against the full (lowercased) command string.
 */
const BLOCKED_PATTERNS: readonly RegExp[] = [
  /rm\s+-[a-z]*r[a-z]*f/i,        // rm -rf / rm -fr / etc.
  /rm\s+-[a-z]*f[a-z]*r/i,
  /git\s+push\s+.*--force/i,       // force push
  /git\s+reset\s+--hard/i,         // hard reset
  /git\s+clean\s+-[a-z]*f/i,       // git clean -f
  /chmod\s+777/i,                   // world-writable
  /\bsudo\b/i,                      // privilege escalation
  /\|\s*(ba)?sh\b/i,               // pipe to shell
  /;\s*rm\b/i,                      // chained rm
  /&&\s*rm\b/i,                     // conditional rm
  />\s*\/dev\/(sd|nvme|disk)/i,     // disk overwrite
  /curl.*\|\s*(ba)?sh/i,            // curl pipe shell
  /wget.*-O.*\|\s*(ba)?sh/i,        // wget pipe shell
];

// ── Policy ─────────────────────────────────────────────────────────

export class CommandPolicy {
  /**
   * Returns true if the command is on the allowlist AND not blocked.
   */
  static isAllowed(cmd: string): boolean {
    const lower = cmd.trim().toLowerCase();
    if (BLOCKED_PATTERNS.some(p => p.test(lower))) return false;
    return SAFE_PREFIXES.some(prefix => lower.startsWith(prefix));
  }

  /**
   * Returns true if the command needs HITL confirmation before execution.
   */
  static requiresConfirmation(cmd: string): boolean {
    return !this.isAllowed(cmd);
  }
}

// ── Audit log ──────────────────────────────────────────────────────

export type AuditEventType =
  | 'command_allowed'
  | 'command_blocked'
  | 'hitl_requested'
  | 'hitl_approved'
  | 'hitl_rejected'
  | 'hitl_expired';

export interface AuditEvent {
  type: AuditEventType;
  timestamp: string;
  project: string;
  chatId?: string;
  command?: string;
  action?: string;
  risk?: string;
}

export class AuditLog {
  private readonly logPath: string;

  constructor(workspaceRoot: string) {
    this.logPath = path.join(workspaceRoot, '.cappy', 'audit.log');
  }

  write(event: AuditEvent): void {
    try {
      fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n', 'utf-8');
    } catch {
      // Audit failures must never break the main flow
    }
  }
}
