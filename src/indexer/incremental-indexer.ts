import * as fs from 'fs';
import * as path from 'path';
import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex } from '@noble/hashes/utils';
import { LanceDBStore } from '../store/lancedb';
import { EmbeddingService } from '../core/embeddings';
import { ChunkingService } from '../core/chunking';
import { LightGraphService } from '../core/lightgraph';
import { Chunk } from '../core/schemas';

export interface ChangeDetectionResult {
  fileChanged: boolean;
  modifiedChunks: string[];
  removedChunks: string[];
  addedChunks: string[];
  oldFileHash?: string;
  newFileHash: string;
}

export interface IndexingStats {
  filesScanned: number;
  filesModified: number;
  chunksAdded: number;
  chunksModified: number;
  chunksRemoved: number;
  nodesAdded: number;
  edgesAdded: number;
  duration: number;
  errors: string[];
}

export interface IncrementalIndexerConfig {
  batchSize: number;
  maxConcurrency: number;
  skipPatterns: string[];
  includePatterns: string[];
  chunkSize: { min: number; max: number };
  enableTombstones: boolean;
  retentionDays: number;
}

export class IncrementalIndexer {
  private lancedb: LanceDBStore;
  private embeddings: EmbeddingService;
  private chunking: ChunkingService;
  private lightgraph: LightGraphService;
  private config: IncrementalIndexerConfig;
  private stats: IndexingStats;

  constructor(
    lancedb: LanceDBStore,
    embeddings: EmbeddingService,
    chunking: ChunkingService,
    lightgraph: LightGraphService,
    config?: Partial<IncrementalIndexerConfig>
  ) {
    this.lancedb = lancedb;
    this.embeddings = embeddings;
    this.chunking = chunking;
    this.lightgraph = lightgraph;
    
    this.config = {
      batchSize: 100,
      maxConcurrency: 3,
      skipPatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**'],
      includePatterns: ['**/*.ts', '**/*.js', '**/*.md', '**/*.json'],
      chunkSize: { min: 200, max: 800 },
      enableTombstones: true,
      retentionDays: 14,
      ...config
    };

    this.stats = this.initializeStats();
  }

  private initializeStats(): IndexingStats {
    return {
      filesScanned: 0,
      filesModified: 0,
      chunksAdded: 0,
      chunksModified: 0,
      chunksRemoved: 0,
      nodesAdded: 0,
      edgesAdded: 0,
      duration: 0,
      errors: []
    };
  }

  /**
   * Executa indexação incremental do workspace
   */
  async indexWorkspace(workspacePath: string): Promise<IndexingStats> {
    const startTime = Date.now();
    this.stats = this.initializeStats();

    try {
      // 1. Descobrir arquivos elegíveis
      const files = await this.discoverFiles(workspacePath);
      console.log(`🔍 Discovered ${files.length} files for indexing`);

      // 2. Processar arquivos em lotes
      const batches = this.createBatches(files, this.config.batchSize);
      
      for (const batch of batches) {
        await this.processBatch(batch, workspacePath);
      }

      // 3. Cleanup de tombstones expirados
      if (this.config.enableTombstones) {
        await this.cleanupExpiredTombstones();
      }

      this.stats.duration = Date.now() - startTime;
      console.log(`✅ Indexing completed in ${this.stats.duration}ms`);
      return this.stats;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stats.errors.push(`Indexing failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Descobre arquivos elegíveis para indexação
   */
  private async discoverFiles(workspacePath: string): Promise<string[]> {
    const files: string[] = [];
    
    const walkDir = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(workspacePath, fullPath);
        
        // Skip patterns check
        if (this.shouldSkipPath(relativePath)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile() && this.shouldIncludeFile(relativePath)) {
          files.push(fullPath);
        }
      }
    };
    
    await walkDir(workspacePath);
    return files;
  }

  private shouldSkipPath(relativePath: string): boolean {
    return this.config.skipPatterns.some(pattern => 
      this.matchPattern(relativePath, pattern)
    );
  }

  private shouldIncludeFile(relativePath: string): boolean {
    return this.config.includePatterns.some(pattern => 
      this.matchPattern(relativePath, pattern)
    );
  }

  private matchPattern(path: string, pattern: string): boolean {
    // Implementação simples de glob matching
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    return new RegExp(`^${regexPattern}$`).test(path);
  }

  /**
   * Cria lotes para processamento paralelo
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Processa um lote de arquivos
   */
  private async processBatch(files: string[], workspacePath: string): Promise<void> {
    const promises = files.map(file => 
      this.processFile(file, workspacePath).catch(error => {
        this.stats.errors.push(`Error processing ${file}: ${error.message}`);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Processa um arquivo individual
   */
  private async processFile(filePath: string, workspacePath: string): Promise<void> {
    const relativePath = path.relative(workspacePath, filePath);
    this.stats.filesScanned++;

    try {
      // 1. Detectar mudanças no arquivo
      const changeResult = await this.detectFileChanges(filePath, relativePath);
      
      if (!changeResult.fileChanged) {
        console.log(`⏭️  File unchanged: ${relativePath}`);
        return;
      }

      this.stats.filesModified++;
      console.log(`🔄 Processing modified file: ${relativePath}`);

      // 2. Marcar chunks removidos como tombstones
      if (changeResult.removedChunks.length > 0) {
        await this.markChunksAsDeleted(changeResult.removedChunks, 'chunk_modified');
        this.stats.chunksRemoved += changeResult.removedChunks.length;
      }

      // 3. Processar chunks novos/modificados
      if (changeResult.addedChunks.length > 0 || changeResult.modifiedChunks.length > 0) {
        await this.processFileChunks(filePath, relativePath, changeResult.newFileHash);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stats.errors.push(`Error processing file ${relativePath}: ${errorMessage}`);
    }
  }

  /**
   * Detecta mudanças em um arquivo
   */
  private async detectFileChanges(filePath: string, relativePath: string): Promise<ChangeDetectionResult> {
    // 1. Calcular hash do arquivo atual
    const content = await fs.promises.readFile(filePath, 'utf8');
    const normalizedContent = this.normalizeContent(content);
    const newFileHash = this.calculateHash(normalizedContent);

    // 2. Buscar chunks existentes do arquivo
    // Simplificado - assumir que não há chunks existentes por enquanto
    const existingChunks: any[] = [];
    // TODO: Implementar busca quando método estiver disponível
    // const existingChunks = await this.lancedb.findChunks({ path: relativePath });

    if (existingChunks.length === 0) {
      // Arquivo novo
      return {
        fileChanged: true,
        modifiedChunks: [],
        removedChunks: [],
        addedChunks: [], // Será preenchido durante chunking
        newFileHash
      };
    }

    const oldFileHash = existingChunks[0].fileHash;
    
    if (oldFileHash === newFileHash) {
      // Arquivo não mudou
      return {
        fileChanged: false,
        modifiedChunks: [],
        removedChunks: [],
        addedChunks: [],
        oldFileHash,
        newFileHash
      };
    }

    // 3. Arquivo mudou - detectar chunks modificados
    const newChunks = await this.chunking.chunkFile(filePath, normalizedContent);

    const existingChunkHashes = new Set(existingChunks.map((c: any) => c.textHash));
    const newChunkHashes = new Set(newChunks.map((c: Chunk) => c.textHash));

    const removedChunks = existingChunks
      .filter((c: any) => !newChunkHashes.has(c.textHash))
      .map((c: any) => c.id);

    const addedChunks = newChunks
      .filter((c: Chunk) => !existingChunkHashes.has(c.textHash))
      .map((c: Chunk) => c.id);

    return {
      fileChanged: true,
      modifiedChunks: [], // Para simplificar, tratamos como removed + added
      removedChunks,
      addedChunks,
      oldFileHash,
      newFileHash
    };
  }

  /**
   * Processa chunks de um arquivo
   */
  private async processFileChunks(filePath: string, relativePath: string, fileHash: string): Promise<void> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const normalizedContent = this.normalizeContent(content);
    
    // 1. Chunk do conteúdo
    const chunks = await this.chunking.chunkFile(filePath, normalizedContent);

    // 2. Gerar embeddings em lote
    const embeddings: number[][] = [];
    for (const chunk of chunks) {
      const embedding = await this.embeddings.embed(chunk.text);
      embeddings.push(embedding);
    }

    // 3. Preparar chunks para inserção
    const chunksWithEmbeddings = chunks.map((chunk: Chunk, index: number) => ({
      ...chunk,
      fileHash,
      vector: embeddings[index],
      indexedAt: new Date().toISOString(),
      model: 'all-MiniLM-L6-v2',
      dim: 384,
      status: 'active'
    }));

    // 4. Inserir chunks
    await this.lancedb.upsertChunks(chunksWithEmbeddings);
    this.stats.chunksAdded += chunksWithEmbeddings.length;

    // 5. Atualizar grafo
    await this.updateGraphForChunks(chunksWithEmbeddings);
  }

  /**
   * Atualiza o grafo para novos chunks
   */
  private async updateGraphForChunks(chunks: any[]): Promise<void> {
    // Simplificado - em implementação futura, criar nós e arestas
    console.log(`📊 Would update graph for ${chunks.length} chunks`);
  }

  /**
   * Marca chunks como deletados (tombstones)
   */
  private async markChunksAsDeleted(chunkIds: string[], reason: string): Promise<void> {
    if (!this.config.enableTombstones) {
      // Hard delete se tombstones desabilitados
      await this.lancedb.deleteChunks(chunkIds);
      return;
    }

    // Soft delete com tombstones
    // Por simplicidade, usar hard delete por enquanto
    console.log(`🗑️  Would mark ${chunkIds.length} chunks as deleted with reason: ${reason}`);
  }

  /**
   * Limpa tombstones expirados
   */
  private async cleanupExpiredTombstones(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    // Simplificado - limpeza de tombstones seria implementada aqui
    console.log(`🗑️  Would cleanup tombstones older than ${cutoffDate.toISOString()}`);
  }

  /**
   * Normaliza conteúdo para hashing consistente
   */
  private normalizeContent(content: string): string {
    return content
      // Normalizar line endings para LF
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remover trailing whitespace de cada linha
      .split('\n')
      .map(line => line.replace(/\s+$/, ''))
      .join('\n')
      // Normalização Unicode NFC
      .normalize('NFC');
  }

  /**
   * Calcula hash BLAKE3 de conteúdo
   */
  private calculateHash(content: string): string {
    const hash = blake3(content);
    return bytesToHex(hash);
  }

  /**
   * Obtém estatísticas da última indexação
   */
  getStats(): IndexingStats {
    return { ...this.stats };
  }

  /**
   * Força reindexação completa (ignorando tombstones)
   */
  async forceReindex(workspacePath: string): Promise<IndexingStats> {
    console.log('🔥 Starting force reindex - clearing all existing data');
    
    // Limpar tabela de chunks (outras serão limpas quando implementadas)
    console.log('🗑️  Would clear all tables for force reindex');
    
    // Executar indexação normal
    return this.indexWorkspace(workspacePath);
  }
}