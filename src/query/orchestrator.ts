import * as vscode from 'vscode';
import * as path from 'path';
import { LanceDBStore } from '../store/lancedb';
import { EmbeddingService } from '../core/embeddings';
import { ChunkingService } from '../core/chunking';
import { LightGraphService } from '../core/lightgraph';
import { IncrementalIndexer } from '../indexer/incremental-indexer';
import { HybridSearchPipeline, SearchQuery, SearchResponse } from './hybrid-search';

export interface MiniLightRAGConfig {
  // Database configuration
  database: {
    path: string;
    vectorDimension: number;
    indexType: 'HNSW' | 'IVF_PQ';
  };
  
  // Indexing configuration
  indexing: {
    batchSize: number;
    maxConcurrency: number;
    chunkSize: { min: number; max: number };
    skipPatterns: string[];
    includePatterns: string[];
    autoIndexOnSave: boolean;
    autoIndexInterval: number; // minutes
  };
  
  // Search configuration
  search: {
    defaultMaxResults: number;
    defaultExpandHops: number;
    vectorWeight: number;
    graphWeight: number;
    freshnessWeight: number;
    cacheTimeMinutes: number;
  };
  
  // Graph configuration
  graph: {
    maxEdgesPerNode: number;
    similarityThreshold: number;
    enableSemanticEdges: boolean;
  };
}

export interface IndexingStatus {
  isIndexing: boolean;
  progress: number; // 0-100
  currentFile?: string;
  totalFiles: number;
  processedFiles: number;
  errors: string[];
  startTime?: Date;
  estimatedTimeRemaining?: number; // milliseconds
}

export interface SearchContext {
  workspacePath: string;
  activeDocument?: vscode.TextDocument;
  selection?: vscode.Selection;
  cursorContext?: {
    line: number;
    character: number;
    surroundingText: string;
  };
}

export interface OpenFileRequest {
  path: string;
  startLine?: number;
  endLine?: number;
  highlight?: boolean;
  preview?: boolean;
}

export interface CitationInfo {
  chunkId: string;
  path: string;
  startLine: number;
  endLine: number;
  relevantText: string;
  score: number;
  context: string;
}

export class QueryOrchestrator {
  private lancedb: LanceDBStore;
  private embeddings: EmbeddingService;
  private chunking: ChunkingService;
  private lightgraph: LightGraphService;
  private indexer: IncrementalIndexer;
  private searchPipeline: HybridSearchPipeline;
  private config: MiniLightRAGConfig;
  private context: vscode.ExtensionContext;
  
  private indexingStatus: IndexingStatus;
  private autoIndexTimer?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  constructor(context: vscode.ExtensionContext, config?: Partial<MiniLightRAGConfig>) {
    this.context = context;
    
    // Default configuration
    this.config = {
      database: {
        path: path.join(context.globalStorageUri.fsPath, 'mini-lightrag'),
        vectorDimension: 384,
        indexType: 'HNSW'
      },
      indexing: {
        batchSize: 100,
        maxConcurrency: 3,
        chunkSize: { min: 200, max: 800 },
        skipPatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**'],
        includePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx', '**/*.md', '**/*.json'],
        autoIndexOnSave: true,
        autoIndexInterval: 30 // 30 minutes
      },
      search: {
        defaultMaxResults: 20,
        defaultExpandHops: 1,
        vectorWeight: 0.6,
        graphWeight: 0.3,
        freshnessWeight: 0.1,
        cacheTimeMinutes: 10
      },
      graph: {
        maxEdgesPerNode: 10,
        similarityThreshold: 0.3,
        enableSemanticEdges: true
      },
      ...config
    };

    this.indexingStatus = {
      isIndexing: false,
      progress: 0,
      totalFiles: 0,
      processedFiles: 0,
      errors: []
    };

    // Initialize services (async initialization will be done in initialize())
    this.lancedb = new LanceDBStore({
      dbPath: this.config.database.path,
      vectorDimension: this.config.database.vectorDimension,
      writeMode: 'append',
      indexConfig: {
        metric: 'cosine',
        indexType: this.config.database.indexType,
        m: 16,
        efConstruction: 200
      }
    });

    this.embeddings = new EmbeddingService();
    this.chunking = new ChunkingService();
    this.lightgraph = new LightGraphService(this.lancedb, this.embeddings);
    
    this.indexer = new IncrementalIndexer(
      this.lancedb,
      this.embeddings,
      this.chunking,
      this.lightgraph,
      {
        batchSize: this.config.indexing.batchSize,
        maxConcurrency: this.config.indexing.maxConcurrency,
        chunkSize: this.config.indexing.chunkSize,
        skipPatterns: this.config.indexing.skipPatterns,
        includePatterns: this.config.indexing.includePatterns,
        enableTombstones: true,
        retentionDays: 14
      }
    );

    this.searchPipeline = new HybridSearchPipeline(
      this.lancedb,
      this.embeddings,
      this.lightgraph,
      {
        defaultMaxResults: this.config.search.defaultMaxResults,
        defaultExpandHops: this.config.search.defaultExpandHops,
        defaultVectorWeight: this.config.search.vectorWeight,
        defaultGraphWeight: this.config.search.graphWeight,
        defaultFreshnessWeight: this.config.search.freshnessWeight,
        cacheResultsMinutes: this.config.search.cacheTimeMinutes
      }
    );
  }

  /**
   * Initialize the Mini-LightRAG system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🚀 Initializing Mini-LightRAG system...');

      // Initialize all services
      await this.embeddings.initialize();
      console.log('✅ EmbeddingService initialized');

      await this.lancedb.initialize();
      console.log('✅ LanceDBStore initialized');

      await this.lightgraph.initialize();
      console.log('✅ LightGraphService initialized');

      // Setup auto-indexing if enabled
      if (this.config.indexing.autoIndexOnSave) {
        this.setupAutoIndexing();
      }

      // Setup periodic indexing
      this.setupPeriodicIndexing();

      this.isInitialized = true;
      console.log('✅ Mini-LightRAG system initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Mini-LightRAG system:', error);
      throw error;
    }
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Mini-LightRAG system...');

    // Clear timers
    if (this.autoIndexTimer) {
      clearInterval(this.autoIndexTimer);
      this.autoIndexTimer = undefined;
    }

    // Close database connections
    await this.lancedb.close();
    
    this.isInitialized = false;
    console.log('✅ Mini-LightRAG system shutdown complete');
  }

  /**
   * Index the current workspace
   */
  async indexWorkspace(workspacePath?: string, force: boolean = false): Promise<void> {
    if (this.indexingStatus.isIndexing) {
      throw new Error('Indexing is already in progress');
    }

    const wsPath = workspacePath || this.getActiveWorkspacePath();
    if (!wsPath) {
      throw new Error('No workspace found');
    }

    try {
      this.indexingStatus = {
        isIndexing: true,
        progress: 0,
        totalFiles: 0,
        processedFiles: 0,
        errors: [],
        startTime: new Date()
      };

      console.log(`📚 ${force ? 'Force ' : ''}Indexing workspace: ${wsPath}`);

      // Notify VS Code of indexing start
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Mini-LightRAG',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Indexing workspace...' });

        let stats;
        if (force) {
          stats = await this.indexer.forceReindex(wsPath);
        } else {
          stats = await this.indexer.indexWorkspace(wsPath);
        }

        this.indexingStatus.progress = 100;
        this.indexingStatus.processedFiles = stats.filesScanned;
        this.indexingStatus.totalFiles = stats.filesScanned;
        this.indexingStatus.errors = stats.errors;

        progress.report({ 
          increment: 100, 
          message: `Indexed ${stats.filesScanned} files, ${stats.chunksAdded} chunks added` 
        });

        console.log('📊 Indexing Statistics:');
        console.log(`- Files scanned: ${stats.filesScanned}`);
        console.log(`- Files modified: ${stats.filesModified}`);
        console.log(`- Chunks added: ${stats.chunksAdded}`);
        console.log(`- Duration: ${stats.duration}ms`);
        console.log(`- Errors: ${stats.errors.length}`);

        if (stats.errors.length > 0) {
          vscode.window.showWarningMessage(
            `Indexing completed with ${stats.errors.length} errors. Check output for details.`
          );
        } else {
          vscode.window.showInformationMessage(
            `Workspace indexed successfully! ${stats.chunksAdded} chunks added.`
          );
        }
      });

    } catch (error) {
      console.error('❌ Indexing failed:', error);
      vscode.window.showErrorMessage(`Indexing failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      this.indexingStatus.isIndexing = false;
    }
  }

  /**
   * Search the knowledge base
   */
  async search(
    queryText: string, 
    searchContext?: SearchContext,
    options?: Partial<SearchQuery['options']>
  ): Promise<SearchResponse> {
    await this.ensureInitialized();

    try {
      // Build search context
      const context = searchContext || this.buildCurrentSearchContext();
      
      // Enhance query with context if available
      const enhancedQuery = this.enhanceQueryWithContext(queryText, context);

      // Build search query
      const searchQuery: SearchQuery = {
        text: enhancedQuery,
        filters: this.buildFiltersFromContext(context),
        options: {
          maxResults: this.config.search.defaultMaxResults,
          expandHops: this.config.search.defaultExpandHops,
          includeGraph: true,
          ...options
        }
      };

      console.log(`🔍 Searching: "${queryText}" (enhanced: "${enhancedQuery}")`);
      
      // Execute search
      const results = await this.searchPipeline.search(searchQuery);

      console.log(`✅ Search completed: ${results.results.length} results in ${results.stats.processingTime}ms`);
      
      return results;

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * Open a file at specific location
   */
  async openFile(request: OpenFileRequest): Promise<void> {
    try {
      const workspacePath = this.getActiveWorkspacePath();
      if (!workspacePath) {
        throw new Error('No active workspace');
      }

      const fullPath = path.isAbsolute(request.path) 
        ? request.path 
        : path.join(workspacePath, request.path);

      const uri = vscode.Uri.file(fullPath);
      
      // Open document
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(
        document, 
        request.preview ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active
      );

      // Navigate to specific line
      if (request.startLine !== undefined) {
        const startLine = Math.max(0, request.startLine - 1); // Convert to 0-based
        const endLine = request.endLine ? Math.max(0, request.endLine - 1) : startLine;
        
        const range = new vscode.Range(startLine, 0, endLine, Number.MAX_VALUE);
        
        // Reveal and select range
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        
        if (request.highlight) {
          editor.selection = new vscode.Selection(range.start, range.end);
        } else {
          // Just position cursor
          editor.selection = new vscode.Selection(range.start, range.start);
        }
      }

      const locationText = request.startLine ? ` at line ${request.startLine}` : '';
      console.log(`📂 Opened file: ${request.path}${locationText}`);

    } catch (error) {
      console.error('❌ Failed to open file:', error);
      vscode.window.showErrorMessage(`Failed to open file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Generate citations for search results
   */
  generateCitations(results: SearchResponse): CitationInfo[] {
    return results.results.map((result, index) => ({
      chunkId: result.chunk.id,
      path: result.chunk.path,
      startLine: result.chunk.startLine,
      endLine: result.chunk.endLine,
      relevantText: this.extractRelevantText(result.chunk.text, 200),
      score: result.score,
      context: `Result ${index + 1} of ${results.results.length} (score: ${result.score.toFixed(3)})`
    }));
  }

  /**
   * Get current indexing status
   */
  getIndexingStatus(): IndexingStatus {
    return { ...this.indexingStatus };
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<{
    database: { chunks: number; nodes: number; edges: number };
    cache: { size: number; hitRate: number };
    indexing: IndexingStatus;
    isInitialized: boolean;
  }> {
    const cacheStats = this.searchPipeline.getCacheStats();
    
    return {
      database: {
        chunks: 0, // Will be implemented when database queries are ready
        nodes: 0,  // Will be implemented when database queries are ready
        edges: 0   // Will be implemented when database queries are ready
      },
      cache: {
        size: cacheStats.size,
        hitRate: 0 // Will be implemented when hit rate tracking is added
      },
      indexing: this.getIndexingStatus(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * Private helper methods
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private getActiveWorkspacePath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0 
      ? workspaceFolders[0].uri.fsPath 
      : undefined;
  }

  private buildCurrentSearchContext(): SearchContext {
    const workspacePath = this.getActiveWorkspacePath();
    const activeEditor = vscode.window.activeTextEditor;

    const context: SearchContext = {
      workspacePath: workspacePath || ''
    };

    if (activeEditor) {
      context.activeDocument = activeEditor.document;
      context.selection = activeEditor.selection;
      
      if (!activeEditor.selection.isEmpty) {
        // User has text selected
        const selectedText = activeEditor.document.getText(activeEditor.selection);
        context.cursorContext = {
          line: activeEditor.selection.start.line,
          character: activeEditor.selection.start.character,
          surroundingText: selectedText
        };
      } else {
        // Get surrounding context at cursor
        const position = activeEditor.selection.active;
        const lineText = activeEditor.document.lineAt(position.line).text;
        
        context.cursorContext = {
          line: position.line,
          character: position.character,
          surroundingText: lineText
        };
      }
    }

    return context;
  }

  private enhanceQueryWithContext(queryText: string, context: SearchContext): string {
    let enhanced = queryText;

    // Add file type context if available
    if (context.activeDocument) {
      const ext = path.extname(context.activeDocument.fileName);
      const languageHints = new Map([
        ['.ts', 'typescript'],
        ['.tsx', 'tsx react'],
        ['.js', 'javascript'],
        ['.jsx', 'jsx react'],
        ['.py', 'python'],
        ['.md', 'markdown'],
        ['.json', 'json']
      ]);
      
      const hint = languageHints.get(ext);
      if (hint) {
        enhanced = `${queryText} ${hint}`;
      }
    }

    // Add cursor context if available
    if (context.cursorContext && context.cursorContext.surroundingText.trim()) {
      const surroundingKeywords = this.extractKeywords(context.cursorContext.surroundingText);
      if (surroundingKeywords.length > 0) {
        enhanced = `${enhanced} related to ${surroundingKeywords.slice(0, 3).join(' ')}`;
      }
    }

    return enhanced;
  }

  private buildFiltersFromContext(context: SearchContext): SearchQuery['filters'] {
    const filters: SearchQuery['filters'] = {};

    // Add language filter based on active document
    if (context.activeDocument) {
      const ext = path.extname(context.activeDocument.fileName);
      const languageMap = new Map([
        ['.ts', 'typescript'],
        ['.tsx', 'typescript'],
        ['.js', 'javascript'],
        ['.jsx', 'javascript'],
        ['.py', 'python'],
        ['.md', 'markdown']
      ]);
      
      const language = languageMap.get(ext);
      if (language) {
        filters.languages = [language];
      }
    }

    // Add path filters to prefer files in same directory
    if (context.activeDocument && context.workspacePath) {
      const relativePath = path.relative(context.workspacePath, context.activeDocument.fileName);
      const dir = path.dirname(relativePath);
      if (dir && dir !== '.') {
        filters.paths = [dir];
      }
    }

    return filters;
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length < 20)
      .slice(0, 10);
  }

  private extractRelevantText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
  }

  private setupAutoIndexing(): void {
    // Listen for file save events
    const disposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (this.shouldIndexFile(document.fileName)) {
        try {
          console.log(`📝 Auto-indexing saved file: ${document.fileName}`);
          // Single file indexing will be implemented in the future
          // await this.indexSingleFile(document.fileName);
        } catch (error) {
          console.error('Auto-indexing failed:', error);
        }
      }
    });

    this.context.subscriptions.push(disposable);
  }

  private setupPeriodicIndexing(): void {
    if (this.config.indexing.autoIndexInterval > 0) {
      this.autoIndexTimer = setInterval(async () => {
        if (!this.indexingStatus.isIndexing) {
          try {
            console.log('⏰ Running periodic indexing...');
            const workspacePath = this.getActiveWorkspacePath();
            if (workspacePath) {
              await this.indexWorkspace(workspacePath, false);
            }
          } catch (error) {
            console.error('Periodic indexing failed:', error);
          }
        }
      }, this.config.indexing.autoIndexInterval * 60 * 1000);
    }
  }

  private shouldIndexFile(fileName: string): boolean {
    const relativePath = this.getActiveWorkspacePath() 
      ? path.relative(this.getActiveWorkspacePath()!, fileName)
      : fileName;

    // Check skip patterns
    for (const pattern of this.config.indexing.skipPatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return false;
      }
    }

    // Check include patterns
    for (const pattern of this.config.indexing.includePatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    return new RegExp(`^${regexPattern}$`).test(filePath);
  }
}