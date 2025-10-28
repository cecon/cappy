import type { WorkspaceScannerConfig } from "./workspace-scanner-config";

export interface FileProcessorConfig {
  workspaceRoot: string;
  repoId: string;
  config: WorkspaceScannerConfig;
}