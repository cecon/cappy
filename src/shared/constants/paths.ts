/**
 * CAPPY Default Paths
 * 
 * Centralized path constants for file system operations
 */

export const CappyPaths = {
  // Root directory
  ROOT: '.cappy',
  
  // Configuration
  CONFIG_FILE: 'config.yaml',
  COPILOT_INSTRUCTIONS: '.github/copilot-instructions.md',
  
  // Tasks
  TASKS_DIR: 'tasks',
  HISTORY_DIR: 'history',
  OUTPUT_FILE: 'output.txt',
  
  // Documentation
  DOCS_DIR: 'docs',
  STACK_FILE: 'stack.md',
  PREVENTION_RULES_FILE: 'prevention-rules.xml',
  
  // Indexes
  INDEXES_DIR: 'indexes',
  TASKS_INDEX_FILE: 'indexes/tasks.json',
  DOCS_INDEX_FILE: 'indexes/docs.json',
  RULES_INDEX_FILE: 'indexes/rules.json',
  
  // Graph
  GRAPH_DIR: 'graph',
  GRAPH_DB_FILE: 'graph/db.json',
  
  // Templates
  TEMPLATES_DIR: 'templates',
} as const;

/**
 * Get full path to a Cappy file/directory
 */
export function getCappyPath(...segments: string[]): string {
  return [CappyPaths.ROOT, ...segments].join('/');
}

/**
 * Task file patterns
 */
export const TaskFilePatterns = {
  ACTIVE: '.ACTIVE.xml',
  PAUSED: '.PAUSED.xml',
  DONE: '.DONE.xml',
} as const;

/**
 * Generate task filename
 */
export function getTaskFileName(taskId: string, status: 'active' | 'paused' | 'done'): string {
  let pattern: string;
  
  if (status === 'active') {
    pattern = TaskFilePatterns.ACTIVE;
  } else if (status === 'paused') {
    pattern = TaskFilePatterns.PAUSED;
  } else {
    pattern = TaskFilePatterns.DONE;
  }
  
  return `TASK_${taskId}${pattern}`;
}
