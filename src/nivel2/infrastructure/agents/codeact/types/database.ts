/**
 * @fileoverview Database row type definitions
 * @module codeact/types/database
 */

/**
 * Base database row interface
 */
export interface DbRow {
  [key: string]: unknown
}

/**
 * Plan table row
 */
export interface PlanRow extends DbRow {
  id: string
  session_id: string
  goal: string
  context_used: string
  created_at: number
  version: number
}

/**
 * Task table row
 */
export interface TaskRow extends DbRow {
  id: string
  plan_id: string
  description: string
  files_to_modify: string
  dependencies: string
  estimated_complexity: string
  technical_notes: string | null
  position: number
}

/**
 * Version table row
 */
export interface VersionRow extends DbRow {
  id: string
  plan_id: string
  snapshot: string
  change_reason: string
  created_at: number
}
