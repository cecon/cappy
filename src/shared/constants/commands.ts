/**
 * CAPPY Command IDs
 * 
 * Centralized command identifiers used throughout the extension.
 * These IDs are registered in extension.ts and used in package.json
 */

export const CommandIds = {
  // Core Commands
  INIT: 'cappy.init',
  NEW_TASK: 'cappy.new',
  COMPLETE_TASK: 'cappy.complete',
  PAUSE_TASK: 'cappy.pause',
  RESUME_TASK: 'cappy.resume',
  
  // Indexing & Scanning
  REINDEX: 'cappy.reindex',
  SCAN_WORKSPACE: 'cappy.scanWorkspace',
  
  // Configuration
  SHOW_TELEMETRY_CONSENT: 'cappy.showTelemetryConsent',
  UPDATE_CONFIG: 'cappy.updateConfig',
  
  // Debug & Diagnostics
  DEBUG_RETRIEVAL: 'cappy.debugRetrieval',
  DEBUG_GRAPH: 'cappy.debugGraph',
  DIAGNOSE_GRAPH: 'cappy.diagnoseGraph',
  
  // Graph Operations
  RESET_DATABASE: 'cappy.resetDatabase',
  REANALYZE_RELATIONSHIPS: 'cappy.reanalyzeRelationships',
  PROCESS_SINGLE_FILE: 'cappy.processSingleFile',
  
  // UI Commands
  OPEN_CHAT: 'cappy.openChat',
  OPEN_KNOWLEDGE_BASE: 'cappy.openKnowledgeBase',
} as const;

export type CommandId = typeof CommandIds[keyof typeof CommandIds];
