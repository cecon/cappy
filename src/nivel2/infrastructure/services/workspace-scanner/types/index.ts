import type { ScanProgress } from "./scan-progress";

export type { CrossFileRelationship } from "./cross-file-relationship";
export type { FileProcessorConfig } from "./file-processor-config";
export type { ScanProgress } from "./scan-progress";
export type { SortedFiles } from "./sorted-files";
export type { WorkspaceScannerConfig } from "./workspace-scanner-config";

/**
 * Progress callback function
 */
export type ProgressCallback = (progress: ScanProgress) => void;
