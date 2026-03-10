/**
 * @fileoverview WhatsAppSessionManager — conversation state and inbox persistence
 * @module bridge/WhatsAppSessionManager
 *
 * Owns: active conversation tracking, pending chatId, workspace query state,
 * and inbox file I/O (.cappy/whatsapp-inbox/).
 * Does NOT know about WebSockets, routing, or message relay.
 */

import * as path from 'node:path';
import * as fs   from 'node:fs';

interface ActiveConversation {
  chatId: string;
  startedAt: number;
  lastMessageAt: number;
}

interface InboxEntry {
  text: string;
  chatId: string;
  timestamp: number;
  project: string;
}

export class WhatsAppSessionManager {
  static readonly CONVERSATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

  private activeConversation: ActiveConversation | null = null;
  private pendingChatId: string | null = null;
  private pendingWorkspaceQuery: { text: string; chatId: string } | null = null;

  // ── Conversation tracking ─────────────────────────────────────────

  isConversationActive(chatId: string): boolean {
    if (!this.activeConversation) return false;
    if (this.activeConversation.chatId !== chatId) return false;

    const elapsed = Date.now() - this.activeConversation.lastMessageAt;
    if (elapsed > WhatsAppSessionManager.CONVERSATION_TIMEOUT_MS) {
      console.log(`[SessionManager] Conversation expired (${Math.round(elapsed / 1000)}s idle)`);
      this.activeConversation = null;
      return false;
    }
    return true;
  }

  startConversation(chatId: string): void {
    const now = Date.now();
    this.activeConversation = { chatId, startedAt: now, lastMessageAt: now };
    this.pendingChatId = chatId;
  }

  touchConversation(): void {
    if (this.activeConversation) {
      this.activeConversation.lastMessageAt = Date.now();
    }
  }

  resetConversation(): void {
    this.activeConversation = null;
  }

  // ── ChatId tracking ───────────────────────────────────────────────

  getPendingChatId(): string | null   { return this.pendingChatId; }
  setPendingChatId(id: string): void  { this.pendingChatId = id; }
  clearPendingChatId(): void          { this.pendingChatId = null; }

  // ── Workspace query (user picking a project number) ───────────────

  getPendingWorkspaceQuery(): { text: string; chatId: string } | null { return this.pendingWorkspaceQuery; }
  setPendingWorkspaceQuery(q: { text: string; chatId: string }): void { this.pendingWorkspaceQuery = q; }
  clearPendingWorkspaceQuery(): void { this.pendingWorkspaceQuery = null; }

  // ── Inbox persistence ─────────────────────────────────────────────

  persistInbox(text: string, chatId: string, project: string, workspaceRoot: string): void {
    try {
      const inboxDir = path.join(workspaceRoot, '.cappy', 'whatsapp-inbox');
      if (!fs.existsSync(inboxDir)) {
        fs.mkdirSync(inboxDir, { recursive: true });
      }
      const entry: InboxEntry = { text, chatId, timestamp: Date.now(), project };
      fs.writeFileSync(
        path.join(inboxDir, `${Date.now()}.json`),
        JSON.stringify(entry, null, 2)
      );
    } catch (err) {
      console.error('[SessionManager] Failed to persist inbox:', err);
    }
  }

  readLatestChatId(workspaceRoot: string): string | null {
    const inboxDir = path.join(workspaceRoot, '.cappy', 'whatsapp-inbox');
    if (!fs.existsSync(inboxDir)) return null;

    const files = fs.readdirSync(inboxDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    if (files.length === 0) return null;

    try {
      const data: InboxEntry = JSON.parse(
        fs.readFileSync(path.join(inboxDir, files[files.length - 1]), 'utf-8')
      );
      return data.chatId;
    } catch {
      return null;
    }
  }

  clearInbox(workspaceRoot: string): void {
    const inboxDir = path.join(workspaceRoot, '.cappy', 'whatsapp-inbox');
    if (!fs.existsSync(inboxDir)) return;

    for (const file of fs.readdirSync(inboxDir).filter(f => f.endsWith('.json'))) {
      try { fs.unlinkSync(path.join(inboxDir, file)); } catch { /* ignore */ }
    }
  }
}
