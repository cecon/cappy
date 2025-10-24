/**
 * CAPPY Document Types
 */

export type DocumentStatus = 'completed' | 'preprocessed' | 'processing' | 'pending' | 'failed';

export interface DocumentData {
  id: string;
  fileName: string;
  filePath: string;
  summary: string;
  status: DocumentStatus;
  length: number;
  chunks: number;
  nodesCount?: number;
  relationshipsCount?: number;
  created: string;
  updated: string;
  trackId?: string;
  processingStartTime?: string;
  processingEndTime?: string;
  currentStep?: string;
  progress?: number;
  error?: string;
}

export interface DocumentMetadata {
  id: string;
  filePath: string;
  language?: string;
  size: number;
  lastModified: string;
  hash: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  startLine: number;
  endLine: number;
  embedding?: number[];
}

export interface IndexedDocument {
  id: string;
  path: string;
  content: string;
  embedding: number[];
  metadata: DocumentMetadata;
  indexed: string;
}

export interface DocumentSearchResult {
  document: IndexedDocument;
  score: number;
  highlights?: string[];
}
