/**
 * @fileoverview Tests for ApprovalFlow — HITL confirmation with chatId validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalFlow } from '../../../src/nivel2/infrastructure/bridge/ApprovalFlow';

// Reset singleton between tests
function freshFlow(): ApprovalFlow {
  // Bypass singleton for isolation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ApprovalFlow as any)._instance = undefined;
  return ApprovalFlow.getInstance();
}

describe('ApprovalFlow — request and resolve', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ApprovalFlow as any)._instance = undefined;
  });

  it('resolves to true when approved from same chatId', async () => {
    const flow = freshFlow();
    const { promise } = flow.request('deploy to prod', 'chat-123', 'npm run deploy', 'high');

    // Simulate user replying SIM
    const resolved = flow.resolve('chat-123', true);
    expect(resolved).toBe(true);

    const approved = await promise;
    expect(approved).toBe(true);
  });

  it('resolves to false when rejected from same chatId', async () => {
    const flow = freshFlow();
    const { promise } = flow.request('dangerous rm', 'chat-456', 'rm -rf /tmp/test', 'high');

    flow.resolve('chat-456', false);
    const approved = await promise;
    expect(approved).toBe(false);
  });

  it('does NOT resolve when chatId does not match', async () => {
    const flow = freshFlow();
    const { promise } = flow.request('action', 'chat-OWNER', 'cmd', 'medium');

    // Wrong chatId — should not resolve the approval
    const resolved = flow.resolve('chat-STRANGER', true);
    expect(resolved).toBe(false);

    // Original approval still pending
    expect(flow.hasPendingFor('chat-OWNER')).toBe(true);

    // Cleanup
    flow.resolve('chat-OWNER', false);
    await promise;
  });

  it('hasPendingFor returns true only for correct chatId', () => {
    const flow = freshFlow();
    flow.request('act', 'chat-A');

    expect(flow.hasPendingFor('chat-A')).toBe(true);
    expect(flow.hasPendingFor('chat-B')).toBe(false);

    flow.resolve('chat-A', false);
  });

  it('hasPendingApprovals is true while any approval is pending', () => {
    const flow = freshFlow();
    expect(flow.hasPendingApprovals()).toBe(false);
    flow.request('act', 'chat-X');
    expect(flow.hasPendingApprovals()).toBe(true);
    flow.resolve('chat-X', true);
    expect(flow.hasPendingApprovals()).toBe(false);
  });

  it('resolves latest approval when multiple pending for same chat', async () => {
    const flow = freshFlow();
    const first  = flow.request('first',  'chat-Y', 'cmd1');
    await new Promise(r => setTimeout(r, 5)); // ensure different timestamps
    const second = flow.request('second', 'chat-Y', 'cmd2');

    // Resolve — should pick the LATEST (second)
    flow.resolve('chat-Y', true);
    const secondResult = await second.promise;
    expect(secondResult).toBe(true);

    // First should still be pending
    expect(flow.hasPendingFor('chat-Y')).toBe(true);
    flow.resolve('chat-Y', false);
    const firstResult = await first.promise;
    expect(firstResult).toBe(false);
  });

  it('getCurrent returns action info for correct chatId', () => {
    const flow = freshFlow();
    flow.request('deploy', 'chat-Z', 'git push', 'high');

    const current = flow.getCurrent('chat-Z');
    expect(current).not.toBeNull();
    expect(current?.action).toBe('deploy');
    expect(current?.command).toBe('git push');
    expect(current?.risk).toBe('high');

    expect(flow.getCurrent('chat-OTHER')).toBeNull();

    flow.resolve('chat-Z', false);
  });

  it('auto-rejects after timeout', async () => {
    vi.useFakeTimers();
    const flow = freshFlow();
    const { promise } = flow.request('slow action', 'chat-timeout');

    vi.advanceTimersByTime(5 * 60 * 1000 + 100);
    const approved = await promise;
    expect(approved).toBe(false);
    vi.useRealTimers();
  });
});
