/**
 * @fileoverview ApprovalFlow — HITL (Human-in-the-Loop) confirmation via WhatsApp
 * @module bridge/ApprovalFlow
 *
 * Key fix over the original WhatsAppApprovalManager:
 * - Each pending approval stores the originating chatId.
 * - resolveApproval() validates chatId so a "sim" from an unrelated
 *   WhatsApp conversation cannot accidentally authorize a pending action.
 *
 * Kept as a singleton so both CappyBridge and WhatsAppConfirmationTool
 * share the same approval queue.
 */

export type RiskLevel = 'low' | 'medium' | 'high';

interface PendingApproval {
  resolve: (approved: boolean) => void;
  action: string;
  command?: string;
  chatId: string;
  risk: RiskLevel;
  createdAt: number;
}

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class ApprovalFlow {
  private static _instance: ApprovalFlow;

  private readonly pending = new Map<string, PendingApproval>();

  static getInstance(): ApprovalFlow {
    if (!ApprovalFlow._instance) {
      ApprovalFlow._instance = new ApprovalFlow();
    }
    return ApprovalFlow._instance;
  }

  // ── Request ───────────────────────────────────────────────────────

  request(
    action: string,
    chatId: string,
    command?: string,
    risk: RiskLevel = 'medium',
  ): { id: string; promise: Promise<boolean> } {
    const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const promise = new Promise<boolean>((resolve) => {
      this.pending.set(id, { resolve, action, command, chatId, risk, createdAt: Date.now() });

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(false);
          console.log(`[ApprovalFlow] ${id} expired (timeout)`);
        }
      }, TIMEOUT_MS);
    });

    return { id, promise };
  }

  // ── Resolve ───────────────────────────────────────────────────────

  /**
   * Resolve the most recent pending approval that originated from `chatId`.
   * Returns true if a match was found and resolved.
   *
   * Requires chatId match — prevents cross-conversation authorization.
   */
  resolve(chatId: string, approved: boolean): boolean {
    const match = this._latestForChat(chatId);
    if (!match) return false;

    const [id, approval] = match;
    approval.resolve(approved);
    this.pending.delete(id);
    console.log(`[ApprovalFlow] ${id} resolved: ${approved ? 'APPROVED' : 'REJECTED'} (chat: ${chatId})`);
    return true;
  }

  // ── Queries ───────────────────────────────────────────────────────

  hasPendingFor(chatId: string): boolean {
    return this._latestForChat(chatId) !== null;
  }

  /** Backward-compat: true if any approval is pending (used by tools that lack chatId). */
  hasPendingApprovals(): boolean {
    return this.pending.size > 0;
  }

  getCurrent(chatId: string): { action: string; command?: string; risk: RiskLevel } | null {
    const match = this._latestForChat(chatId);
    if (!match) return null;
    const [, a] = match;
    return { action: a.action, command: a.command, risk: a.risk };
  }

  // ── Private ───────────────────────────────────────────────────────

  private _latestForChat(chatId: string): [string, PendingApproval] | null {
    let latest: [string, PendingApproval] | null = null;

    for (const [id, approval] of this.pending) {
      if (approval.chatId !== chatId) continue;
      if (!latest || approval.createdAt > latest[1].createdAt) {
        latest = [id, approval];
      }
    }

    return latest;
  }
}
