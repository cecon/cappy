import type * as vscode from 'vscode';

export type WebviewMessage = {
  type: string;
  query?: string;
  filePath?: string;
  line?: number;
  depth?: number;
  payload?: unknown;
};

export interface UseCaseContext {
  vscode: typeof import('vscode');
  panel: vscode.WebviewPanel | undefined;
  log: (msg: string) => void;
  sendMessage: (message: Record<string, unknown>) => void;
  getIndexingService: () => unknown | undefined;
  getGraphPath: () => string | null;
  getGraphDbCreated: () => boolean;
  ensureGraphDataDir: (dbPath: string) => Promise<void>;
  refreshSubgraph: (depth?: number) => Promise<void>;
  openFile: (filePath: string, line?: number) => Promise<void>;
  indexWorkspace: () => Promise<void>;
  triggerWorkspaceScan: () => Promise<void>;
}

export interface UseCase {
  canHandle(message: WebviewMessage): boolean;
  handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void>;
}
