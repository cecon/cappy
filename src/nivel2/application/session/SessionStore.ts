/**
 * @fileoverview In-memory session store for chat panel history.
 * @module application/session/SessionStore
 */

import * as crypto from 'crypto';
import type { ChatMessage, ChatMode, ChatSession } from '../../../shared/types/agent';

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
    session.updatedAt = new Date().toISOString();
    return appended;
  }

  /**
   * Lists all sessions sorted by recency.
   */
  listSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

