import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EmbeddingService } from '../../../../services/embedding-service';
import { SQLiteAdapter } from '../../../secondary/graph/sqlite-adapter';
import { IndexingService } from '../../../../services/indexing-service';
import type { VectorStorePort } from '../../../../domains/graph/ports/indexing-port';

export interface GraphInitResult {
  indexingService: IndexingService;
  graphDataPath: string;
  graphDbCreated: boolean;
}

export interface GraphInitHost {
  log: (message: string) => void;
  sendMessage: (message: Record<string, unknown>) => void;
  setupGraphWatcher: (workspaceFolder: vscode.WorkspaceFolder) => void;
}

export class IndexingInitializer {
  async initialize(_context: vscode.ExtensionContext, host: GraphInitHost): Promise<GraphInitResult> {
    host.log('🔧 Initializing indexing services...');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }
    const workspaceRoot = workspaceFolder.uri.fsPath;

    // Create embedding service
    const embeddingService = new EmbeddingService();
    await embeddingService.initialize();

    // Ensure base data dir exists
    const baseDataDir = path.join(workspaceRoot, '.cappy', 'data');
    if (!fs.existsSync(baseDataDir)) {
      fs.mkdirSync(baseDataDir, { recursive: true });
      host.log(`🆕 Created base data folder: ${baseDataDir}`);
    } else {
      host.log(`📁 Base data folder exists: ${baseDataDir}`);
    }

    // Use .cappy/data directly for graph database (no subdirectory)
    const sqlitePath = baseDataDir;

    // SQLiteAdapter will create the database file (graph-store.db) inside baseDataDir
    host.log(`📊 Graph database path: ${sqlitePath}/graph-store.db`);
    host.sendMessage({ type: 'db-status', exists: true, created: false, path: sqlitePath });

    // Initialize SQLite graph store
    const graphStore = new SQLiteAdapter(sqlitePath);
    await graphStore.initialize();

    // Ensure workspace node
    try {
      host.log(`🔧 Creating workspace node: ${workspaceFolder.name}`);
      await (graphStore as SQLiteAdapter).ensureWorkspaceNode(workspaceFolder.name);
      host.log(`✅ Workspace node ensured: ${workspaceFolder.name}`);
    } catch (e) {
      host.log(`❌ Could not ensure workspace node: ${e}`);
      console.error('Workspace node error:', e);
    }

    // Create indexing service
    const indexingService = new IndexingService(
      null as unknown as VectorStorePort,
      graphStore,
      embeddingService
    );

    host.log('✅ Indexing services initialized');
    host.sendMessage({ type: 'status', status: 'ready' });

    // Load initial graph
    try {
      host.log('🔍 Loading initial graph...');
      const sub = await graphStore.getSubgraph(undefined, 2);
      host.log(`📊 Initial graph loaded: ${sub.nodes.length} nodes, ${sub.edges.length} edges`);
      if (sub.nodes.length > 0) {
        const firstNode = sub.nodes[0] as Record<string, unknown>;
        const label = typeof firstNode.label === 'string' ? firstNode.label : '';
        const id = typeof firstNode.id === 'string' ? firstNode.id : String(firstNode.id);
        host.log(`   First node: ${id}${label ? ` (${label})` : ''}`);
      }
      host.sendMessage({ type: 'subgraph', nodes: sub.nodes, edges: sub.edges });
    } catch (e) {
      host.log(`❌ Could not load initial graph: ${e}`);
      console.error('Load graph error:', e);
    }

    // Index workspace (lightweight placeholder)
    try {
      host.log('📂 Scanning workspace for files...');
      host.log('✅ Indexing system ready');
      host.sendMessage({ type: 'graph-data', data: { message: 'Indexing system ready - use search to test queries', ready: true } });
    } catch (e) {
      host.log(`❌ Indexing failed during init: ${e}`);
      host.sendMessage({ type: 'error', error: String(e) });
    }

    // Start watcher
    try {
      host.setupGraphWatcher(workspaceFolder);
    } catch (e) {
      host.log(`⚠️ Could not start graph watcher: ${e}`);
    }

    return {
      indexingService,
      graphDataPath: sqlitePath,
      graphDbCreated: false,
    };
  }
}
