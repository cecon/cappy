/**
 * Agent progress events for real-time "thinking" display
 * Shows what each agent is doing (like Cursor/Codex)
 */

export type AgentType = 
  | 'intention'
  | 'researcher'
  | 'summarizer'
  | 'debater'
  | 'planner'
  | 'critic'
  | 'refiner'
  | 'executor';

export type AgentStatus = 
  | 'started'
  | 'thinking'
  | 'searching'
  | 'analyzing'
  | 'completed'
  | 'failed';

/**
 * Event emitted when an agent changes status
 */
export interface AgentProgressEvent {
  agent: AgentType;
  status: AgentStatus;
  message: string;
  timestamp: number;
  details?: {
    toolUsed?: string;
    searchQuery?: string;
    findingsCount?: number;
    [key: string]: unknown;
  };
}

/**
 * Callback type for progress updates
 */
export type ProgressCallback = (event: AgentProgressEvent) => void;

/**
 * Helper to create progress events
 */
export function createProgressEvent(
  agent: AgentType,
  status: AgentStatus,
  message: string,
  details?: AgentProgressEvent['details']
): AgentProgressEvent {
  return {
    agent,
    status,
    message,
    timestamp: Date.now(),
    details
  };
}
