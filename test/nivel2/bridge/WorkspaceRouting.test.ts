/**
 * @fileoverview Tests for workspace routing — @project targeting and /commands
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageRouter } from '../../../src/nivel2/infrastructure/bridge/message-router';

describe('MessageRouter — workspace routing', () => {
  let router: MessageRouter;

  beforeEach(() => {
    router = new MessageRouter();
    router.registerProject('erp-dsl',   '/ws/erp');
    router.registerProject('mobile-app', '/ws/mobile');
  });

  it('routes @project message to correct project', () => {
    const parsed = router.parseMessage('@erp-dsl run tests');
    expect(parsed.type).toBe('chat');
    expect(parsed.targetProject).toBe('erp-dsl');
    expect(parsed.text).toBe('run tests');
  });

  it('routes plain message to last active project', () => {
    // Activate erp-dsl by parsing a targeted message first
    router.parseMessage('@erp-dsl hello');
    const parsed = router.parseMessage('what is the status?');
    expect(parsed.type).toBe('chat');
    expect(parsed.targetProject).toBe('erp-dsl');
  });

  it('routes to first registered project when no @target specified', () => {
    // MessageRouter auto-activates the first registered project
    const fresh = new MessageRouter();
    fresh.registerProject('proj-a', '/a');
    fresh.registerProject('proj-b', '/b');
    const parsed = fresh.parseMessage('any message');
    expect(parsed.type).toBe('chat');
    expect(parsed.targetProject).toBe('proj-a');
  });

  it('routes /ajuda command correctly', () => {
    const parsed = router.parseMessage('/ajuda');
    expect(parsed.type).toBe('command');
    expect(parsed.command).toBe('ajuda');
  });

  it('routes /projetos command correctly', () => {
    const parsed = router.parseMessage('/projetos');
    expect(parsed.type).toBe('command');
    expect(parsed.command).toBe('projetos');
  });

  it('routes /status command correctly', () => {
    const parsed = router.parseMessage('/status');
    expect(parsed.type).toBe('command');
    expect(parsed.command).toBe('status');
  });

  it('handles /new command', () => {
    const parsed = router.parseMessage('/new start fresh');
    expect(parsed.type).toBe('command');
    expect(parsed.command).toBe('new');
  });

  it('returns error type when no projects are registered', () => {
    const empty = new MessageRouter();
    const parsed = empty.parseMessage('any message');
    expect(parsed.type).toBe('error');
  });

  it('getProjectNames returns registered projects', () => {
    const names = router.getProjectNames();
    expect(names).toContain('erp-dsl');
    expect(names).toContain('mobile-app');
  });

  it('unregisterProject removes project from routing', () => {
    router.unregisterProject('mobile-app');
    const names = router.getProjectNames();
    expect(names).not.toContain('mobile-app');
  });

  it('partial name match works', () => {
    // @erp should match erp-dsl
    const parsed = router.parseMessage('@erp deploy');
    expect(parsed.type).toBe('chat');
    expect(parsed.targetProject).toBe('erp-dsl');
  });

  it('handleCommand /ajuda returns help text', () => {
    const reply = router.handleCommand('ajuda');
    expect(reply.length).toBeGreaterThan(10);
    expect(reply).toContain('@');
  });

  it('handleCommand /projetos lists project names', () => {
    const reply = router.handleCommand('projetos');
    expect(reply).toContain('erp-dsl');
    expect(reply).toContain('mobile-app');
  });
});
