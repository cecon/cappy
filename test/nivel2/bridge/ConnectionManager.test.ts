/**
 * @fileoverview Tests for ConnectionManager — server/client election and reconnect
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConnectionManager } from '../../../src/nivel2/infrastructure/bridge/ConnectionManager';
import type { BridgeMessage } from '../../../src/nivel2/infrastructure/bridge/types';

// ── Helpers ───────────────────────────────────────────────────────

function makeMsg(overrides: Partial<BridgeMessage> = {}): BridgeMessage {
  return { type: 'chat', text: 'hello', chatId: 'c1', timestamp: Date.now(), ...overrides };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('ConnectionManager — server/client election', () => {
  afterEach(() => {
    // Ensure no dangling servers across tests
  });

  it('starts with no role', () => {
    const cm = new ConnectionManager();
    expect(cm.getRole()).toBeNull();
  });

  it('becomes server when port is free', async () => {
    const cm = new ConnectionManager();
    const port = 19700;
    try {
      await cm.tryBecomeServer(port);
      expect(cm.getRole()).toBe('server');
    } finally {
      cm.stop();
    }
  });

  it('rejects when port is already taken', async () => {
    const server = new ConnectionManager();
    const port = 19701;
    await server.tryBecomeServer(port);

    const client = new ConnectionManager();
    try {
      await expect(client.tryBecomeServer(port)).rejects.toThrow();
    } finally {
      server.stop();
      client.stop();
    }
  });

  it('becomes client when connecting to existing server', async () => {
    const server = new ConnectionManager();
    const port = 19702;
    await server.tryBecomeServer(port);

    const client = new ConnectionManager();
    try {
      await client.connectAsClient(port, 'proj-a', '/workspace/a');
      expect(client.getRole()).toBe('client');
    } finally {
      client.stop();
      server.stop();
    }
  });

  it('fires onClientConnect when client registers', async () => {
    const server = new ConnectionManager();
    const port = 19703;
    await server.tryBecomeServer(port);

    const connected = vi.fn();
    server.onClientConnect(connected);

    const client = new ConnectionManager();
    try {
      await client.connectAsClient(port, 'my-project', '/workspace');
      // Allow time for the register message to propagate
      await new Promise(r => setTimeout(r, 80));
      expect(connected).toHaveBeenCalledWith('my-project', '/workspace', expect.anything());
    } finally {
      client.stop();
      server.stop();
    }
  });

  it('fires onClientDisconnect when client closes', async () => {
    const server = new ConnectionManager();
    const port = 19704;
    await server.tryBecomeServer(port);

    const disconnected = vi.fn();
    server.onClientDisconnect(disconnected);

    const client = new ConnectionManager();
    await client.connectAsClient(port, 'bye-project', '/workspace');
    await new Promise(r => setTimeout(r, 80));
    client.stop();

    await new Promise(r => setTimeout(r, 100));
    expect(disconnected).toHaveBeenCalledWith('bye-project');

    server.stop();
  });

  it('stops cleanly — no dangling handles', async () => {
    const cm = new ConnectionManager();
    const port = 19705;
    await cm.tryBecomeServer(port);
    cm.stop();
    expect(cm.getRole()).toBeNull();
  });
});

describe('ConnectionManager — message routing', () => {
  it('sendToServer returns false when not connected as client', () => {
    const cm = new ConnectionManager();
    const sent = cm.sendToServer(makeMsg());
    expect(sent).toBe(false);
  });

  it('sendToClient returns false for unknown project', async () => {
    const cm = new ConnectionManager();
    const port = 19706;
    await cm.tryBecomeServer(port);
    const sent = cm.sendToClient('nonexistent', makeMsg());
    expect(sent).toBe(false);
    cm.stop();
  });

  it('server receives messages from client', async () => {
    const server = new ConnectionManager();
    const port = 19707;
    await server.tryBecomeServer(port);

    const received: BridgeMessage[] = [];
    server.onClientMessage((_, msg) => received.push(msg));

    const client = new ConnectionManager();
    await client.connectAsClient(port, 'sender', '/ws');
    await new Promise(r => setTimeout(r, 80));

    // After register, send a custom message directly to server
    client.sendToServer(makeMsg({ type: 'response', text: 'pong' }));
    await new Promise(r => setTimeout(r, 80));

    expect(received.some(m => m.type === 'response' && m.text === 'pong')).toBe(true);

    client.stop();
    server.stop();
  });
});
