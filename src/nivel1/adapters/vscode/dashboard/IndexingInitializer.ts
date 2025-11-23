import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EmbeddingService } from '../../../../nivel2/infrastructure/services/embedding-service';
import { SQLiteAdapter } from '../../../../nivel2/infrastructure/database/sqlite-adapter';
import { IndexingService } from '../../../../nivel2/infrastructure/services/indexing-service';
import { createVectorStore } from '../../../../nivel2/infrastructure/vector/sqlite-vector-adapter';

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
  async initialize(context: vscode.ExtensionContext, host: GraphInitHost): Promise<GraphInitResult> {
    host.log('🔧 Initializing indexing services...');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }
    const workspaceRoot = workspaceFolder.uri.fsPath;

    // Check if .cappy folder exists (must be initialized first)
    const baseDataDir = path.join(workspaceRoot, '.cappy', 'data');
    if (!fs.existsSync(baseDataDir)) {
      throw new Error('Cappy is not initialized. Please run "Cappy: Initialize Workspace" first.');
    }
    host.log(`📁 Base data folder exists: ${baseDataDir}`);

    // Create embedding service
    const modelsCacheDir = path.join(context.globalStorageUri.fsPath, 'models');
    const embeddingService = new EmbeddingService(modelsCacheDir);
    await embeddingService.initialize();

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
  await graphStore.ensureWorkspaceNode(workspaceFolder.name);
      host.log(`✅ Workspace node ensured: ${workspaceFolder.name}`);
    } catch (e) {
      host.log(`❌ Could not ensure workspace node: ${e}`);
      console.error('Workspace node error:', e);
    }

    // Create vector store
    const vectorStore = createVectorStore(graphStore, embeddingService);

    // Create indexing service
    const indexingService = new IndexingService(
      vectorStore, // Vector store usando SQLite plugin (sqlite-vss)
      graphStore,
      embeddingService,
      workspaceRoot,
      undefined
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
  const labelSuffix = label ? ' (' + label + ')' : '';
  host.log(`   First node: ${id}${labelSuffix}`);
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
