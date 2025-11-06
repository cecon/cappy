/**
 * @fileoverview Event type union (Actions + Observations)
 * @module codeact/core/events
 */

import type { AnyAction } from './actions'
import type { AnyObservation } from './observations'

/**
 * Event is either an Action or an Observation
 * Forms the basis of the agent's history
 */
export type Event = AnyAction | AnyObservation

/**
 * Type guard to check if event is an action
 */
export function isAction(event: Event): event is AnyAction {
  return event.type === 'action'
}

/**
 * Type guard to check if event is an observation
 */
export function isObservation(event: Event): event is AnyObservation {
  return event.type === 'observation'
}
