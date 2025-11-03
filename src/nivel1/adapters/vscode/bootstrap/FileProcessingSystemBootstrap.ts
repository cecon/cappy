/**
 * @fileoverview Bootstrap for File Processing System initialization
 * @module bootstrap/FileProcessingSystemBootstrap
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import { GraphPanel } from '../dashboard/GraphPanel';
import { DocumentsViewProvider } from '../documents/DocumentsViewProvider';
import { FileMetadataDatabase } from '../../../../nivel2/infrastructure/services/file-metadata-database';
import { FileProcessingQueue } from '../../../../nivel2/infrastructure/services/file-processing-queue';
import { FileProcessingWorker } from '../../../../nivel2/infrastructure/services/file-processing-worker';
import { FileChangeWatcher } from '../../../../nivel2/infrastructure/services/file-change-watcher';
import { createVectorStore } from '../../../../nivel2/infrastructure/vector/sqlite-vector-adapter';
import type { GraphStorePort } from '../../../../domains/dashboard/ports/indexing-port';
import { SQLiteAdapter } from '../../../../nivel2/infrastructure/database/index.js';
import { GraphCleanupService } from '../../../../nivel2/infrastructure/services/graph-cleanup-service';
import type { ContextRetrievalTool } from '../../../../domains/chat/tools/native/context-retrieval';
import type {
  FileProcessingSystemResult,
  CoreServices,
  ConfigService
} from './types';

/**
 * Initializes the file processing system (database, queue, worker, graph store)
 */
export class FileProcessingSystemBootstrap {
  /**
   * Initializes the file processing system
   */
  async initialize(
    context: vscode.ExtensionContext,
    graphPanel: GraphPanel,
    documentsViewProvider: DocumentsViewProvider,
    contextRetrievalTool: ContextRetrievalTool
  ): Promise<FileProcessingSystemResult> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('No workspace folder found');
    }

    console.log('⚙️  Initializing File Processing System...');

    try {
      // 1. Initialize database
      const fileDatabase = await this.initializeDatabase(workspaceRoot, documentsViewProvider);

      // 2. Initialize services
      const {
        parserService,
        hashService,
        embeddingService,
        configService
      } = await this.initializeServices(workspaceRoot);

      // 3. Initialize graph store
      const graphStore = await this.initializeGraphStore(
        workspaceRoot,
        configService,
        documentsViewProvider
      );

      // 4. Initialize cleanup service
      const cleanupService = this.initializeCleanupService(graphStore);

      // 5. Initialize vector store (cast to SQLiteAdapter for createVectorStore)
      const vectorStore = createVectorStore(graphStore as SQLiteAdapter, embeddingService);

      // 6. Initialize context retrieval tool
      await this.initializeContextRetrievalTool(contextRetrievalTool, graphStore);

      // 7. Initialize indexing service
      const indexingService = await this.initializeIndexingService(
        vectorStore,
        graphStore,
        embeddingService,
        workspaceRoot
      );

      // 8. Initialize worker
      const worker = new FileProcessingWorker(
        parserService,
        hashService,
        workspaceRoot,
        indexingService,
        graphStore
      );

      // 9. Initialize file watcher
      const fileWatcher = this.initializeFileWatcher(
        fileDatabase,
        hashService,
        workspaceRoot
      );

      // 10. Initialize queue
      const fileQueue = this.initializeQueue(
        fileDatabase,
        worker,
        graphPanel,
        documentsViewProvider
      );

      // 11. Register cleanup on deactivation
      this.registerCleanup(context, fileWatcher, fileQueue, fileDatabase);

      console.log('✅ File processing system initialized');

      return {
        fileDatabase,
        queue: fileQueue,
        worker,
        watcher: fileWatcher,
        graphStore,
        cleanupService,
        vectorStore,
        indexingService
      };
    } catch (error) {
      console.error('Failed to initialize file processing system:', error);
      throw error;
    }
  }

  /**
   * Initializes the file metadata database
   */
  private async initializeDatabase(
    workspaceRoot: string,
    documentsViewProvider: DocumentsViewProvider
  ): Promise<FileMetadataDatabase> {
    const cappyDataDir = path.join(workspaceRoot, '.cappy', 'data');
    const dbPath = path.join(cappyDataDir, 'file-metadata.db');
    
    const fileDatabase = new FileMetadataDatabase(dbPath);
    await fileDatabase.initialize();
    
    documentsViewProvider.setFileDatabase(fileDatabase);
    console.log('  ✅ File metadata database initialized');
    
    return fileDatabase;
  }

  /**
   * Initializes core services
   */
  private async initializeServices(workspaceRoot: string): Promise<CoreServices> {
    const { ParserService } = await import('../../../../nivel2/infrastructure/services/parser-service.js');
    const { FileHashService } = await import('../../../../nivel2/infrastructure/services/file-hash-service.js');
    const { EmbeddingService } = await import('../../../../nivel2/infrastructure/services/embedding-service.js');
    const { ConfigService } = await import('../../../../nivel2/infrastructure/services/config-service.js');

    const parserService = new ParserService();
    const hashService = new FileHashService();
    const configService = new ConfigService(workspaceRoot);
    
    const embeddingService = new EmbeddingService();
    try {
      await embeddingService.initialize();
      console.log('  ✅ Embedding service initialized');
    } catch (error) {
      console.warn('  ⚠️  Embedding service failed to initialize:', error);
    }

    return { parserService, hashService, embeddingService, configService };
  }

  /**
   * Initializes the graph store
   */
  private async initializeGraphStore(
    workspaceRoot: string,
    configService: ConfigService,
    documentsViewProvider: DocumentsViewProvider
  ): Promise<GraphStorePort> {
    const sqlitePath = configService.getGraphDataPath(workspaceRoot);
    const graphStore = new SQLiteAdapter(sqlitePath);
    await graphStore.initialize();
    
    documentsViewProvider.setGraphStore(graphStore);
    console.log('  ✅ Graph store initialized');
    
    return graphStore;
  }

  /**
   * Initializes the graph cleanup service
   */
  private initializeCleanupService(graphStore: GraphStorePort): GraphCleanupService {
    const cleanupService = new GraphCleanupService(graphStore, {
      intervalMs: 60 * 60 * 1000, // 1 hour
      enabled: true
    });
    cleanupService.start();
    console.log('  ✅ Graph cleanup service started');
    
    return cleanupService;
  }

  /**
   * Initializes context retrieval tool with graph store
   */
  private async initializeContextRetrievalTool(
    contextRetrievalTool: ContextRetrievalTool,
    graphStore: GraphStorePort
  ): Promise<void> {
    try {
      const { HybridRetriever } = await import('../../../../nivel2/infrastructure/services/hybrid-retriever.js');
      const hybridRetriever = new HybridRetriever(undefined, graphStore);
      contextRetrievalTool.setRetriever(hybridRetriever);
      console.log('  ✅ Context retrieval tool initialized');
    } catch (error) {
      console.error('  ❌ Failed to initialize context retrieval tool:', error);
    }
  }

  /**
   * Initializes the indexing service
   */
  private async initializeIndexingService(
    vectorStore: ReturnType<typeof createVectorStore>,
    graphStore: GraphStorePort,
    embeddingService: CoreServices['embeddingService'],
    workspaceRoot: string
  ) {
    const { IndexingService } = await import('../../../../nivel2/infrastructure/services/indexing-service.js');
    
    // Initialize LLM provider for entity discovery
    let llmProvider;
    try {
      const { VSCodeLLMProvider } = await import('../../../../nivel2/infrastructure/services/entity-discovery/providers/VSCodeLLMProvider.js');
      llmProvider = new VSCodeLLMProvider();
      await llmProvider.initialize();
      console.log('  ✅ VSCode LLM Provider initialized');
    } catch (error) {
      console.warn('  ⚠️  Failed to initialize LLM provider:', error);
      llmProvider = undefined;
    }

    const indexingService = new IndexingService(
      vectorStore,
      graphStore,
      embeddingService,
      workspaceRoot,
      llmProvider
    );
    await indexingService.initialize();
    console.log('  ✅ Indexing service initialized');
    
    return indexingService;
  }

  /**
   * Initializes the file change watcher
   */
  private initializeFileWatcher(
    fileDatabase: FileMetadataDatabase,
    hashService: CoreServices['hashService'],
    workspaceRoot: string
  ): FileChangeWatcher {
    const fileWatcher = new FileChangeWatcher(fileDatabase, hashService, {
      workspaceRoot,
      autoAddNewFiles: true,
      reprocessModified: true,
      removeDeleted: true
    });
    
    // TEMPORARILY DISABLED to prevent crashes
    // await fileWatcher.start();
    console.log('  ⏸️  FileChangeWatcher disabled (stability)');
    
    return fileWatcher;
  }

  /**
   * Initializes the file processing queue
   */
  private initializeQueue(
    fileDatabase: FileMetadataDatabase,
    worker: FileProcessingWorker,
    graphPanel: GraphPanel,
    documentsViewProvider: DocumentsViewProvider
  ): FileProcessingQueue {
    const fileQueue = new FileProcessingQueue(fileDatabase, worker, {
      concurrency: 2,
      maxRetries: 3,
      autoStart: true
    });
    
    // Setup event listeners
    this.setupQueueEventListeners(fileQueue, graphPanel, documentsViewProvider);
    
    console.log('  ✅ File processing queue initialized');
    
    return fileQueue;
  }

  /**
   * Setup queue event listeners
   */
  private setupQueueEventListeners(
    fileQueue: FileProcessingQueue,
    graphPanel: GraphPanel,
    documentsViewProvider: DocumentsViewProvider
  ): void {
    let refreshTimeout: NodeJS.Timeout | null = null;

    // File complete event
    fileQueue.on('file:complete', (metadata, result) => {
      documentsViewProvider.notifyFileUpdate({
        type: 'completed',
        fileId: metadata.id,
        filePath: metadata.filePath,
        progress: 100,
        currentStep: 'Completed',
        metrics: {
          chunksCount: result.chunksCount,
          nodesCount: result.nodesCount,
          relationshipsCount: result.relationshipsCount,
          duration: result.duration
        }
      });

      // Debounce graph refresh
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        graphPanel.refreshSubgraph(2).catch((err: unknown) => {
          console.error('Failed to refresh graph:', err);
        });
        refreshTimeout = null;
      }, 2000);
    });

    // File start event
    fileQueue.on('file:start', (metadata) => {
      documentsViewProvider.notifyFileUpdate({
        type: 'processing',
        fileId: metadata.id,
        filePath: metadata.filePath,
        progress: 0,
        currentStep: 'Starting...'
      });
    });

    // File failed event
    fileQueue.on('file:failed', (metadata, error) => {
      documentsViewProvider.notifyFileUpdate({
        type: 'error',
        fileId: metadata.id,
        filePath: metadata.filePath,
        error: error.message
      });
    });
  }

  /**
   * Registers cleanup handlers
   */
  private registerCleanup(
    context: vscode.ExtensionContext,
    fileWatcher: FileChangeWatcher,
    fileQueue: FileProcessingQueue,
    fileDatabase: FileMetadataDatabase
  ): void {
    context.subscriptions.push({
      dispose: async () => {
        fileWatcher.stop();
        fileQueue.stop();
        fileDatabase.close();
        console.log('  ✅ File processing system cleanup complete');
      }
    });
  }
}
