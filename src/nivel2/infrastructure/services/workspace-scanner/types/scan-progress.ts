/**
 * Scan progress information
 */
export interface ScanProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  status: 'scanning' | 'processing' | 'completed' | 'error';
  errors: Array<{ file: string; error: string }>;
}