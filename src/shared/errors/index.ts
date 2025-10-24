/**
 * Base CAPPY Error
 */
export class CappyError extends Error {
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;
  
  constructor(
    message: string,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CappyError';
    this.code = code;
    this.details = details;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Task-related errors
 */
export class TaskNotFoundError extends CappyError {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`, 'TASK_NOT_FOUND', { taskId });
    this.name = 'TaskNotFoundError';
  }
}

export class TaskAlreadyExistsError extends CappyError {
  constructor(taskId: string) {
    super(`Task already exists: ${taskId}`, 'TASK_EXISTS', { taskId });
    this.name = 'TaskAlreadyExistsError';
  }
}

export class InvalidTaskStatusError extends CappyError {
  constructor(status: string) {
    super(`Invalid task status: ${status}`, 'INVALID_STATUS', { status });
    this.name = 'InvalidTaskStatusError';
  }
}

/**
 * Configuration errors
 */
export class ConfigNotFoundError extends CappyError {
  constructor(path: string) {
    super(`Configuration not found: ${path}`, 'CONFIG_NOT_FOUND', { path });
    this.name = 'ConfigNotFoundError';
  }
}

export class ConfigInvalidError extends CappyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Invalid configuration: ${message}`, 'CONFIG_INVALID', details);
    this.name = 'ConfigInvalidError';
  }
}

/**
 * Document errors
 */
export class DocumentNotFoundError extends CappyError {
  constructor(documentId: string) {
    super(`Document not found: ${documentId}`, 'DOCUMENT_NOT_FOUND', { documentId });
    this.name = 'DocumentNotFoundError';
  }
}

export class IndexingError extends CappyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Indexing error: ${message}`, 'INDEXING_ERROR', details);
    this.name = 'IndexingError';
  }
}

/**
 * Graph errors
 */
export class GraphError extends CappyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Graph error: ${message}`, 'GRAPH_ERROR', details);
    this.name = 'GraphError';
  }
}

export class NodeNotFoundError extends CappyError {
  constructor(nodeId: string) {
    super(`Node not found: ${nodeId}`, 'NODE_NOT_FOUND', { nodeId });
    this.name = 'NodeNotFoundError';
  }
}

/**
 * File System errors
 */
export class FileNotFoundError extends CappyError {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', { filePath });
    this.name = 'FileNotFoundError';
  }
}

export class FileWriteError extends CappyError {
  constructor(filePath: string, reason?: string) {
    const reasonText = reason ? ` (${reason})` : '';
    const message = `Failed to write file: ${filePath}${reasonText}`;
    super(message, 'FILE_WRITE_ERROR', { filePath, reason });
    this.name = 'FileWriteError';
  }
}

/**
 * AI/Embedding errors
 */
export class EmbeddingError extends CappyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Embedding error: ${message}`, 'EMBEDDING_ERROR', details);
    this.name = 'EmbeddingError';
  }
}

export class AIProviderError extends CappyError {
  constructor(provider: string, message: string, details?: Record<string, unknown>) {
    super(
      `AI provider error (${provider}): ${message}`,
      'AI_PROVIDER_ERROR',
      { provider, ...details }
    );
    this.name = 'AIProviderError';
  }
}
