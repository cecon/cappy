/**
 * @fileoverview Unified audit service with idempotent append semantics.
 * @module application/audit/AuditTrailService
 */

import * as crypto from 'crypto';
import type {
  AuditEvent,
  IAuditTrailService,
  IAuditTrailStore,
} from '../../../shared/types/agent';

/**
 * Handles event creation, deterministic ids and basic retry deduplication.
 */
export class AuditTrailService implements IAuditTrailService {
  private readonly seenEventIds = new Set<string>();

  constructor(private readonly store: IAuditTrailStore) {}

  /**
   * Persists one audit event.
   */
  async append(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<AuditEvent> {
    const normalized = this.normalizeEvent(event);
    await this.store.append(normalized);
    this.seenEventIds.add(normalized.eventId);
    return normalized;
  }

  /**
   * Persists one audit event only when not already processed.
   */
  async appendIfNew(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<AuditEvent | null> {
    const normalized = this.normalizeEvent(event);
    if (this.seenEventIds.has(normalized.eventId)) {
      return null;
    }
    await this.store.append(normalized);
    this.seenEventIds.add(normalized.eventId);
    return normalized;
  }

  /**
   * Returns one run timeline in timestamp order.
   */
  async getRunTimeline(runId: string): Promise<AuditEvent[]> {
    const events = await this.store.readByRunId(runId);
    return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Exposes low-level flush for orderly shutdown/tests.
   */
  async flush(): Promise<void> {
    await this.store.flush();
  }

  /**
   * Builds deterministic ids and timestamp values.
   */
  private normalizeEvent(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): AuditEvent {
    const timestamp = new Date().toISOString();
    const normalizedAttempt = Number.isInteger(event.attempt) ? event.attempt : 1;
    const eventId = this.buildEventId({
      eventType: event.eventType,
      sessionId: event.sessionId,
      runId: event.runId,
      actor: event.actor,
      payloadRef: event.payloadRef,
      attempt: normalizedAttempt,
    });
    return {
      ...event,
      attempt: normalizedAttempt,
      eventId,
      timestamp,
    };
  }

  /**
   * Computes deterministic hash for idempotent event identity.
   */
  private buildEventId(source: {
    eventType: string;
    sessionId: string;
    runId: string;
    actor: string;
    payloadRef: string;
    attempt: number;
  }): string {
    const raw = [
      source.eventType,
      source.sessionId,
      source.runId,
      source.actor,
      source.payloadRef,
      String(source.attempt),
    ].join('|');
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}

