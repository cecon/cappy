/**
 * @fileoverview Workspace scanner module - public exports
 * @module workspace-scanner
 */

// Core
export { WorkspaceScanner } from './core/WorkspaceScanner';

// Types
export type {
  WorkspaceScannerConfig,
  ScanProgress,
  CrossFileRelationship,
  SortedFiles,
  ProgressCallback
} from './types';

// Submodules (optional exports for advanced usage)
export { FileDiscovery } from './discovery/FileDiscovery';
export { FileMetadadoProcessor  } from './processing/FileMetadadoProcessor';
export { CrossFileRelationships } from './relationships/CrossFileRelationships';
export { FileIndexManager } from './helpers/FileIndexManager';
export { FileSorter } from './helpers/FileSorter';
