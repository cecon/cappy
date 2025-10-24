/**
 * CAPPY Task Types
 */

export type TaskStatus = 'active' | 'paused' | 'done';
export type TaskCategory = 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'chore';

export interface TaskData {
  id: string;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  pausedAt?: string;
  notes?: string;
}

export interface TaskContext {
  preventionRules: string[];
  relatedTasks: string[];
  relevantDocs: DocumentReference[];
}

export interface DocumentReference {
  path: string;
  title: string;
  content: string;
  relevance: number;
}

export interface CreateTaskInput {
  title: string;
  category: TaskCategory;
  description?: string;
}

export interface CreateTaskOutput {
  taskId: string;
  output: string;
  message: string;
}

export interface CompleteTaskInput {
  taskId?: string;
  notes?: string;
}

export interface CompleteTaskOutput {
  taskId: string;
  completedAt: string;
  message: string;
}
