/**
 * @fileoverview In-memory session store for chat panel history.
 * @module application/session/SessionStore
 */

import * as crypto from 'crypto';
import type { ChatMessage, ChatMode, ChatSession } from '../../../shared/types/agent';

/**
 * Serializable payload used to persist sessions.
 */
export interface SessionStoreSnapshot {
  /**
   * Serialized sessions.
   */
  sessions: ChatSession[];
}

/**
 * Stores and mutates chat sessions.
 */
export class SessionStore {
  private sessions = new Map<string, ChatSession>();

  /**
   * Creates a new session and returns it.
   */
  createSession(mode: ChatMode): ChatSession {
    const now = new Date().toISOString();
    const id = `session-${crypto.randomUUID()}`;
    const session: ChatSession = {
      id,
      title: `Sessão ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      mode,
      status: 'active',
      pinned: false,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Returns an existing session or creates one with default mode.
   */
  getOrCreateSession(sessionId: string | undefined, mode: ChatMode): ChatSession {
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing) {
        existing.mode = mode;
        existing.status = 'active';
        existing.updatedAt = new Date().toISOString();
        return existing;
      }
    }
    return this.createSession(mode);
  }

  /**
   * Appends one message and updates timestamps.
   */
  appendMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const appended: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      ...message,
    };

    session.messages.push(appended);
    if (session.status === 'archived') {
      session.status = 'active';
    }
    session.updatedAt = new Date().toISOString();
    return appended;
  }

  /**
   * Renames one session.
   */
  renameSession(sessionId: string, title: string): ChatSession {
    const session = this.requireSession(sessionId);
    const nextTitle = title.trim();
    if (nextTitle.length === 0) {
      return session;
    }
    session.title = nextTitle;
    session.updatedAt = new Date().toISOString();
    return session;
  }

  /**
   * Toggles pin status.
   */
  togglePin(sessionId: string): ChatSession {
    const session = this.requireSession(sessionId);
    session.pinned = !session.pinned;
    session.updatedAt = new Date().toISOString();
    return session;
  }

  /**
   * Updates archive state.
   */
  setArchived(sessionId: string, archived: boolean): ChatSession {
    const session = this.requireSession(sessionId);
    session.status = archived ? 'archived' : 'active';
    session.updatedAt = new Date().toISOString();
    return session;
  }

  /**
   * Deletes one session by id.
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Returns one session when available.
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Lists all sessions sorted by recency.
   */
  listSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  /**
   * Serializes the session store for persistence.
   */
  createSnapshot(): SessionStoreSnapshot {
    return {
      sessions: this.listSessions(),
    };
  }

  /**
   * Replaces current in-memory sessions from snapshot.
   */
  restoreFromSnapshot(snapshot: SessionStoreSnapshot | null | undefined): void {
    this.sessions.clear();
    if (!snapshot?.sessions?.length) {
      return;
    }
    for (const item of snapshot.sessions) {
      const normalized: ChatSession = {
        ...item,
        mode: item.mode ?? 'planning',
        status: item.status === 'archived' ? 'archived' : 'active',
        pinned: Boolean(item.pinned),
        messages: Array.isArray(item.messages) ? item.messages : [],
      };
      this.sessions.set(normalized.id, normalized);
    }
  }

  /**
   * Reads one session or throws an error.
   */
  private requireSession(sessionId: string): ChatSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }
}

