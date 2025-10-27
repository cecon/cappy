import type { FileIndexEntry } from "../../../../../shared/types/chunk";

/**
 * File sorting result
 */
export interface SortedFiles {
  sourceFiles: FileIndexEntry[];
  docFiles: FileIndexEntry[];
}