/**
 * @fileoverview Tests for WhatsAppSessionManager — conversation state and inbox
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs   from 'node:fs';
import * as path from 'node:path';
import * as os   from 'node:os';
import { WhatsAppSessionManager } from '../../../src/nivel2/infrastructure/bridge/WhatsAppSessionManager';

let tmpDir: string;
let manager: WhatsAppSessionManager;

beforeEach(() => {
  tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'cappy-test-'));
  manager = new WhatsAppSessionManager();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Conversation tracking ──────────────────────────────────────────

describe('WhatsAppSessionManager — conversation tracking', () => {
  it('isConversationActive returns false before any conversation', () => {
    expect(manager.isConversationActive('chat-1')).toBe(false);
  });

  it('isConversationActive returns true after startConversation', () => {
    manager.startConversation('chat-1');
    expect(manager.isConversationActive('chat-1')).toBe(true);
  });

  it('isConversationActive returns false for a different chatId', () => {
    manager.startConversation('chat-1');
    expect(manager.isConversationActive('chat-2')).toBe(false);
  });

  it('resetConversation clears state', () => {
    manager.startConversation('chat-1');
    manager.resetConversation();
    expect(manager.isConversationActive('chat-1')).toBe(false);
  });

  it('isConversationActive returns false after timeout', () => {
    vi.useFakeTimers();
    manager.startConversation('chat-1');
    vi.advanceTimersByTime(WhatsAppSessionManager.CONVERSATION_TIMEOUT_MS + 1000);
    expect(manager.isConversationActive('chat-1')).toBe(false);
    vi.useRealTimers();
  });

  it('touchConversation extends timeout', () => {
    vi.useFakeTimers();
    manager.startConversation('chat-1');

    // Advance close to timeout, then touch
    vi.advanceTimersByTime(WhatsAppSessionManager.CONVERSATION_TIMEOUT_MS - 1000);
    manager.touchConversation();

    // Advance past the original timeout — should still be active
    vi.advanceTimersByTime(2000);
    expect(manager.isConversationActive('chat-1')).toBe(true);

    vi.useRealTimers();
  });
});

// ── ChatId tracking ────────────────────────────────────────────────

describe('WhatsAppSessionManager — chatId tracking', () => {
  it('getPendingChatId returns null initially', () => {
    expect(manager.getPendingChatId()).toBeNull();
  });

  it('setPendingChatId / getPendingChatId roundtrip', () => {
    manager.setPendingChatId('chat-abc');
    expect(manager.getPendingChatId()).toBe('chat-abc');
  });

  it('clearPendingChatId removes chatId', () => {
    manager.setPendingChatId('chat-abc');
    manager.clearPendingChatId();
    expect(manager.getPendingChatId()).toBeNull();
  });

  it('startConversation sets pendingChatId', () => {
    manager.startConversation('chat-xyz');
    expect(manager.getPendingChatId()).toBe('chat-xyz');
  });
});

// ── WhatsApp reply (inbox) ─────────────────────────────────────────

describe('WhatsAppSessionManager — inbox persistence', () => {
  it('persistInbox creates a JSON file', () => {
    manager.persistInbox('hello world', 'chat-1', 'proj', tmpDir);
    const inboxDir = path.join(tmpDir, '.cappy', 'whatsapp-inbox');
    const files = fs.readdirSync(inboxDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/\.json$/);
  });

  it('readLatestChatId returns the stored chatId', () => {
    manager.persistInbox('test msg', 'chat-99', 'proj', tmpDir);
    expect(manager.readLatestChatId(tmpDir)).toBe('chat-99');
  });

  it('readLatestChatId returns null when inbox is empty', () => {
    expect(manager.readLatestChatId(tmpDir)).toBeNull();
  });

  it('clearInbox removes all json files', () => {
    manager.persistInbox('msg1', 'chat-A', 'proj', tmpDir);
    manager.persistInbox('msg2', 'chat-B', 'proj', tmpDir);
    manager.clearInbox(tmpDir);
    const inboxDir = path.join(tmpDir, '.cappy', 'whatsapp-inbox');
    expect(fs.readdirSync(inboxDir).filter(f => f.endsWith('.json'))).toHaveLength(0);
  });

  it('readLatestChatId returns the most recent entry', async () => {
    manager.persistInbox('first',  'chat-FIRST',  'proj', tmpDir);
    await new Promise(r => setTimeout(r, 5));
    manager.persistInbox('second', 'chat-SECOND', 'proj', tmpDir);
    // Sorted by filename (timestamp), last = most recent
    expect(manager.readLatestChatId(tmpDir)).toBe('chat-SECOND');
  });
});
