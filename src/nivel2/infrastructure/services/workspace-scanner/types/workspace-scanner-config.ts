import type { FileMetadataDatabase } from "../../file-metadata-database";
import type { ParserService } from "../../parser-service";

/**
 * Workspace scanner configuration
 */
export interface WorkspaceScannerConfig {
  workspaceRoot: string;
  repoId: string;
  parserService: ParserService;
  metadataDatabase?: FileMetadataDatabase;

  batchSize?: number;
  concurrency?: number;
}