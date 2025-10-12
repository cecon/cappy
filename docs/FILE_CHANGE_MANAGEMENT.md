# 🔄 Gerenciamento de Mudanças de Arquivos - CAPPY

## 🎯 Problema

**Desafios Críticos**:
1. **Arquivos Grandes**: 15k+ linhas de código
2. **Granularidade de Linha**: Preciso saber exatamente ONDE está o código
3. **Detecção de Mudanças**: Arquivos locais mudam frequentemente
4. **Estabilidade**: Não posso reprocessar tudo toda vez
5. **Unicidade**: Preciso identificar arquivos e detectar mudanças
6. **Status de Freshness**: Saber se o índice está desatualizado

---

## 📊 Estratégia Completa de Gestão de Mudanças

### **1. Granularidade de Linha** ⭐ **CRÍTICO**

#### **Problema do LightRAG**:
```typescript
// LightRAG armazena apenas:
{
  chunk_id: "doc_123_chunk_5",
  content: "...large text block...",
  // ❌ Não tem referência de linha!
}
```

#### **Nossa Solução: Line-Aware Chunks**

```typescript
interface DocumentChunk {
  // Identificação
  id: string;                    // UUID único
  file_path: string;             // Caminho completo
  file_hash: string;             // MD5 do arquivo inteiro
  chunk_hash: string;            // MD5 deste chunk específico
  
  // Granularidade de linha ⭐
  line_start: number;            // Linha inicial (1-indexed)
  line_end: number;              // Linha final (inclusive)
  char_start: number;            // Posição char inicial
  char_end: number;              // Posição char final
  
  // Conteúdo
  content: string;               // Conteúdo do chunk
  content_preview: string;       // Primeiras 200 chars (para UI)
  
  // Contexto
  file_type: string;             // .ts, .py, .md
  language: string;              // typescript, python, markdown
  
  // Metadata específica por tipo
  metadata: {
    // Para código
    function_name?: string;      // "getUserById"
    class_name?: string;         // "UserService"
    node_type?: string;          // "FunctionDeclaration"
    
    // Para Markdown
    section_title?: string;      // "## Installation"
    section_level?: number;      // 2
    
    // Timing
    indexed_at: string;          // ISO timestamp
    file_modified_at: string;    // File mtime
  };
  
  // Embeddings e relações
  embedding: number[];
  entities: string[];
  
  // Status
  status: 'active' | 'outdated' | 'deleted';
}
```

#### **Exemplo Real - TypeScript**:
```typescript
// Arquivo: src/services/UserService.ts (500 linhas)
const chunks = [
  {
    id: "chunk_uuid_1",
    file_path: "/projeto/src/services/UserService.ts",
    file_hash: "a1b2c3d4e5f6...",
    chunk_hash: "x7y8z9...",
    
    line_start: 15,
    line_end: 45,
    char_start: 350,
    char_end: 1250,
    
    content: `
      async getUserById(id: string): Promise<User> {
        // ... código completo ...
      }
    `,
    content_preview: "async getUserById(id: string): Promise<User> {...",
    
    metadata: {
      function_name: "getUserById",
      class_name: "UserService",
      node_type: "MethodDeclaration",
      indexed_at: "2025-10-11T14:30:00Z",
      file_modified_at: "2025-10-11T14:25:00Z"
    }
  }
];
```

#### **Exemplo Real - Markdown**:
```typescript
// Arquivo: docs/API.md (15000 linhas!)
const chunks = [
  {
    id: "chunk_uuid_2",
    file_path: "/projeto/docs/API.md",
    file_hash: "f1e2d3c4...",
    chunk_hash: "k9j8h7...",
    
    line_start: 5432,
    line_end: 5567,
    char_start: 125000,
    char_end: 132000,
    
    content: `
      ## Authentication
      
      The API uses JWT tokens...
      ...detailed explanation...
    `,
    content_preview: "## Authentication\n\nThe API uses JWT tokens...",
    
    metadata: {
      section_title: "Authentication",
      section_level: 2,
      indexed_at: "2025-10-11T14:30:00Z",
      file_modified_at: "2025-10-11T14:20:00Z"
    }
  }
];
```

---

### **2. File Hashing & Change Detection** ⭐ **CRÍTICO**

#### **Sistema de Hashing Duplo**

```typescript
import crypto from 'crypto';
import fs from 'fs/promises';

class FileHashManager {
  /**
   * Hash do arquivo completo (para detectar mudanças)
   */
  async computeFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    return crypto
      .createHash('md5')
      .update(content)
      .digest('hex');
  }
  
  /**
   * Hash de um chunk específico (para detectar mudanças granulares)
   */
  computeChunkHash(content: string, lineStart: number, lineEnd: number): string {
    const data = `${content}|${lineStart}|${lineEnd}`;
    return crypto
      .createHash('md5')
      .update(data)
      .digest('hex');
  }
  
  /**
   * Hash composto (file + path) para unicidade absoluta
   */
  async computeCompositeHash(filePath: string): Promise<string> {
    const fileHash = await this.computeFileHash(filePath);
    const pathHash = crypto.createHash('md5').update(filePath).digest('hex');
    
    return `${pathHash.substring(0, 8)}_${fileHash}`;
  }
}
```

#### **Tabela de Status de Arquivos**

```typescript
// LanceDB table: file_status
interface FileStatusRecord {
  // Identificação única
  composite_id: string;          // path_hash + file_hash
  file_path: string;             // Caminho absoluto
  file_path_hash: string;        // MD5 do path
  
  // Hashing
  file_hash_current: string;     // MD5 atual do arquivo
  file_hash_indexed: string;     // MD5 quando foi indexado
  
  // Status
  status: 'indexed' | 'outdated' | 'pending' | 'deleted';
  freshness: 'fresh' | 'stale';  // fresh se hash_current === hash_indexed
  
  // Metadata
  file_size: number;             // Bytes
  line_count: number;            // Total de linhas
  chunk_count: number;           // Quantos chunks gerou
  
  // Timestamps
  file_modified_at: string;      // mtime do arquivo
  indexed_at: string;            // Quando indexamos
  checked_at: string;            // Última verificação
  
  // Stats
  entity_count: number;          // Quantas entidades extraiu
  relation_count: number;        // Quantas relações
}
```

---

### **3. Estratégias de Atualização** ⭐ **CRUCIAL**

#### **Opção A: Reprocessamento Completo** ❌ **NÃO recomendado para arquivos grandes**

```typescript
async function fullReindex(filePath: string) {
  // 1. Deletar todos os chunks antigos
  await deleteChunksByFile(filePath);
  
  // 2. Deletar entidades e relações
  await deleteEntitiesByFile(filePath);
  await deleteRelationsByFile(filePath);
  
  // 3. Reindexar do zero
  await indexFile(filePath);
}

// ❌ Problemas:
// - Lento para arquivos grandes (15k linhas)
// - Perde histórico e embeddings
// - Impacto em grafo (remove/adiciona nós)
// - Precisa recomputar TUDO
```

#### **Opção B: Incremental Update (Diff-based)** ✅ **RECOMENDADO**

```typescript
async function incrementalUpdate(filePath: string) {
  // 1. Detectar mudanças
  const oldHash = await getIndexedFileHash(filePath);
  const newHash = await computeFileHash(filePath);
  
  if (oldHash === newHash) {
    return { status: 'no_changes' };
  }
  
  // 2. Fazer diff linha por linha
  const oldContent = await getIndexedFileContent(filePath);
  const newContent = await fs.readFile(filePath, 'utf-8');
  
  const diff = computeLineDiff(oldContent, newContent);
  
  // 3. Processar apenas chunks afetados
  const affectedChunks = findAffectedChunks(diff);
  
  for (const chunk of affectedChunks) {
    if (diff.hasChangesInRange(chunk.line_start, chunk.line_end)) {
      // Marcar como outdated
      await markChunkAsOutdated(chunk.id);
      
      // Reprocessar apenas este chunk
      const newChunk = await reprocessChunk(filePath, chunk);
      
      // Atualizar embeddings
      await updateChunkEmbedding(newChunk);
      
      // Atualizar entidades afetadas
      await updateAffectedEntities(chunk.id, newChunk);
    }
  }
  
  // 4. Atualizar file status
  await updateFileStatus(filePath, newHash);
  
  return {
    status: 'updated',
    chunks_updated: affectedChunks.length
  };
}
```

#### **Implementação do Diff**

```typescript
import * as diff from 'diff';

class IncrementalUpdateManager {
  async computeLineDiff(
    oldContent: string,
    newContent: string
  ): Promise<DiffResult> {
    const changes = diff.diffLines(oldContent, newContent);
    
    const result: DiffResult = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };
    
    let lineNumber = 1;
    
    for (const change of changes) {
      const lineCount = change.count || 0;
      const range = {
        start: lineNumber,
        end: lineNumber + lineCount - 1
      };
      
      if (change.added) {
        result.added.push(range);
      } else if (change.removed) {
        result.removed.push(range);
      } else {
        result.unchanged.push(range);
      }
      
      if (!change.removed) {
        lineNumber += lineCount;
      }
    }
    
    return result;
  }
  
  findAffectedChunks(
    diff: DiffResult,
    existingChunks: DocumentChunk[]
  ): DocumentChunk[] {
    const affected: DocumentChunk[] = [];
    
    for (const chunk of existingChunks) {
      // Verifica se o chunk intersecta com mudanças
      const hasChanges = 
        this.rangesIntersect(chunk.line_start, chunk.line_end, diff.added) ||
        this.rangesIntersect(chunk.line_start, chunk.line_end, diff.removed) ||
        this.rangesIntersect(chunk.line_start, chunk.line_end, diff.modified);
      
      if (hasChanges) {
        affected.push(chunk);
      }
    }
    
    return affected;
  }
  
  private rangesIntersect(
    chunkStart: number,
    chunkEnd: number,
    changeRanges: Array<{start: number, end: number}>
  ): boolean {
    return changeRanges.some(range => 
      !(range.end < chunkStart || range.start > chunkEnd)
    );
  }
}
```

#### **Opção C: Smart Hybrid** ✅ **MELHOR para arquivos gigantes**

```typescript
async function smartUpdate(filePath: string): Promise<UpdateResult> {
  const oldHash = await getIndexedFileHash(filePath);
  const newHash = await computeFileHash(filePath);
  
  if (oldHash === newHash) {
    return { strategy: 'skip', reason: 'no_changes' };
  }
  
  // Decisão baseada em tamanho da mudança
  const changePercentage = await estimateChangePercentage(filePath);
  
  if (changePercentage > 0.5) {
    // Mudança >50% → reprocessamento completo é mais eficiente
    console.log('Large change detected, full reindex');
    return await fullReindex(filePath);
  } else {
    // Mudança <50% → incremental
    console.log('Small change detected, incremental update');
    return await incrementalUpdate(filePath);
  }
}

async function estimateChangePercentage(filePath: string): Promise<number> {
  const oldSize = await getIndexedFileSize(filePath);
  const newSize = (await fs.stat(filePath)).size;
  
  const sizeDiff = Math.abs(newSize - oldSize);
  const changeRatio = sizeDiff / Math.max(oldSize, newSize);
  
  return changeRatio;
}
```

---

### **4. FileWatcher Integration** ⭐

```typescript
import * as vscode from 'vscode';

class SmartFileWatcher {
  private watcher: vscode.FileSystemWatcher;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(
    private updateManager: IncrementalUpdateManager,
    private hashManager: FileHashManager
  ) {
    // Watch all supported file types
    this.watcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{ts,js,py,md,tsx,jsx}'
    );
    
    this.setupListeners();
  }
  
  private setupListeners() {
    // File changed
    this.watcher.onDidChange((uri) => {
      this.handleFileChange(uri.fsPath);
    });
    
    // File created
    this.watcher.onDidCreate((uri) => {
      this.handleFileCreate(uri.fsPath);
    });
    
    // File deleted
    this.watcher.onDidDelete((uri) => {
      this.handleFileDelete(uri.fsPath);
    });
  }
  
  private handleFileChange(filePath: string) {
    // Debounce: esperar 2s de inatividade antes de processar
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(async () => {
      console.log(`File changed: ${filePath}`);
      
      try {
        // Incremental update
        const result = await this.updateManager.smartUpdate(filePath);
        
        // Notificar UI
        vscode.window.showInformationMessage(
          `✅ Updated ${result.chunks_updated} chunks in ${path.basename(filePath)}`
        );
        
        // Atualizar status bar
        this.updateStatusBar(filePath, 'fresh');
        
      } catch (error) {
        console.error('Error updating file:', error);
        this.updateStatusBar(filePath, 'error');
      }
      
      this.debounceTimers.delete(filePath);
    }, 2000);
    
    this.debounceTimers.set(filePath, timer);
  }
  
  private async handleFileCreate(filePath: string) {
    console.log(`New file detected: ${filePath}`);
    
    // Index novo arquivo
    await this.updateManager.indexFile(filePath);
    
    vscode.window.showInformationMessage(
      `✅ Indexed new file: ${path.basename(filePath)}`
    );
  }
  
  private async handleFileDelete(filePath: string) {
    console.log(`File deleted: ${filePath}`);
    
    // Marcar chunks como deleted (soft delete)
    await this.updateManager.markFileAsDeleted(filePath);
    
    // Opcionalmente: limpar grafo
    // await this.updateManager.removeFromGraph(filePath);
    
    vscode.window.showInformationMessage(
      `🗑️ Removed ${path.basename(filePath)} from index`
    );
  }
  
  private updateStatusBar(filePath: string, status: 'fresh' | 'stale' | 'error') {
    const icon = {
      fresh: '✅',
      stale: '⚠️',
      error: '❌'
    }[status];
    
    // Atualizar status bar item
    vscode.commands.executeCommand('cappy.updateFileStatus', {
      filePath,
      status,
      icon
    });
  }
}
```

---

### **5. Freshness Check & Status UI** ⭐

#### **Freshness Checker**

```typescript
class FreshnessChecker {
  /**
   * Verifica se um arquivo está desatualizado
   */
  async checkFileFreshness(filePath: string): Promise<FreshnessStatus> {
    const indexed = await this.getFileStatus(filePath);
    
    if (!indexed) {
      return {
        status: 'not_indexed',
        message: 'File not in index',
        action: 'index'
      };
    }
    
    const currentHash = await this.hashManager.computeFileHash(filePath);
    
    if (currentHash === indexed.file_hash_indexed) {
      return {
        status: 'fresh',
        message: 'Index is up to date',
        indexed_at: indexed.indexed_at
      };
    }
    
    const fileStats = await fs.stat(filePath);
    const timeSinceModified = Date.now() - fileStats.mtimeMs;
    
    return {
      status: 'stale',
      message: 'Index is outdated',
      indexed_at: indexed.indexed_at,
      modified_at: fileStats.mtime.toISOString(),
      time_since_modified: timeSinceModified,
      action: 'reindex'
    };
  }
  
  /**
   * Verifica freshness de um chunk específico ao exibir resultado
   */
  async enrichSearchResultWithFreshness(
    result: SearchResult
  ): Promise<EnrichedSearchResult> {
    const freshness = await this.checkFileFreshness(result.file_path);
    
    return {
      ...result,
      freshness: freshness.status,
      freshness_message: freshness.message,
      indexed_at: freshness.indexed_at,
      modified_at: freshness.modified_at,
      // UI hint
      warning: freshness.status === 'stale' 
        ? '⚠️ This file has changed since indexing'
        : null
    };
  }
}
```

#### **UI Integration**

```typescript
// Quando mostrar resultado de busca:
const searchResults = await searchService.search("getUserById");

for (const result of searchResults) {
  const enriched = await freshnessChecker.enrichSearchResultWithFreshness(result);
  
  console.log(`
    📄 ${enriched.file_path}:${enriched.line_start}-${enriched.line_end}
    ${enriched.content_preview}
    
    ${enriched.freshness === 'stale' 
      ? '⚠️ WARNING: File modified since indexing' 
      : '✅ Index is fresh'}
    
    📅 Indexed: ${enriched.indexed_at}
    📝 Modified: ${enriched.modified_at}
    
    [Reindex Now] [View File] [Ignore]
  `);
}
```

---

### **6. Go-to-Line Integration** ⭐

```typescript
class NavigationService {
  /**
   * Abrir arquivo na linha exata
   */
  async goToChunk(chunk: DocumentChunk) {
    const uri = vscode.Uri.file(chunk.file_path);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    
    // Posicionar cursor na linha inicial do chunk
    const position = new vscode.Position(chunk.line_start - 1, 0);
    const range = new vscode.Range(
      position,
      new vscode.Position(chunk.line_end - 1, Number.MAX_SAFE_INTEGER)
    );
    
    // Highlight range
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }
  
  /**
   * Peek definition no hover
   */
  async peekChunk(chunk: DocumentChunk): Promise<string> {
    // Retorna conteúdo para preview
    return `
      File: ${chunk.file_path}
      Lines: ${chunk.line_start}-${chunk.line_end}
      
      ${chunk.content}
      
      [Go to Line] [Copy]
    `;
  }
}
```

---

## 📊 Schema Completo do LanceDB

```typescript
// Tabela 1: document_chunks
interface DocumentChunksTable {
  // Identificação
  id: string;                      // UUID
  file_path: string;               // Path completo
  file_hash: string;               // MD5 do arquivo
  chunk_hash: string;              // MD5 do chunk
  
  // Granularidade ⭐
  line_start: number;
  line_end: number;
  char_start: number;
  char_end: number;
  
  // Conteúdo
  content: string;
  content_preview: string;
  embedding: number[];             // Vector [384] ou [768]
  
  // Metadata
  file_type: string;
  language: string;
  metadata_json: string;           // JSON stringified
  
  // Timing
  indexed_at: string;
  file_modified_at: string;
  
  // Status
  status: string;                  // active | outdated | deleted
  
  // Entities
  entities: string;                // Comma-separated
}

// Tabela 2: entities
interface EntitiesTable {
  // Identificação
  id: string;
  name: string;
  type: string;                    // function, class, concept, etc
  
  // Referência
  chunk_ids: string;               // Comma-separated chunk IDs
  file_paths: string;              // Comma-separated paths
  
  // Locations (múltiplas)
  locations_json: string;          // JSON: [{file, line_start, line_end}]
  
  // Semântica
  description: string;
  embedding: number[];
  
  // Timing
  indexed_at: string;
}

// Tabela 3: relations
interface RelationsTable {
  // Identificação
  id: string;
  source_entity: string;
  target_entity: string;
  relation_type: string;           // imports, extends, calls, etc
  
  // Context
  description: string;
  chunk_id: string;                // Onde foi encontrada
  file_path: string;
  line_number: number;             // Linha onde ocorre
  
  // Semântica
  embedding: number[];             // Composite embedding
  weight: number;                  // 0-1
  
  // Timing
  indexed_at: string;
}

// Tabela 4: file_status
interface FileStatusTable {
  // Identificação
  composite_id: string;            // path_hash + file_hash
  file_path: string;
  file_path_hash: string;
  
  // Hashing
  file_hash_current: string;
  file_hash_indexed: string;
  
  // Status
  status: string;                  // indexed | outdated | pending | deleted
  freshness: string;               // fresh | stale
  
  // Stats
  file_size: number;
  line_count: number;
  chunk_count: number;
  entity_count: number;
  relation_count: number;
  
  // Timestamps
  file_modified_at: string;
  indexed_at: string;
  checked_at: string;
}
```

---

## 🎯 Fluxo Completo de Indexação e Atualização

```typescript
class DocumentIndexingOrchestrator {
  async indexWorkspace(rootPath: string) {
    const files = await this.findSupportedFiles(rootPath);
    
    for (const file of files) {
      await this.processFile(file);
    }
  }
  
  async processFile(filePath: string) {
    // 1. Compute hashes
    const fileHash = await this.hashManager.computeFileHash(filePath);
    const compositeId = await this.hashManager.computeCompositeHash(filePath);
    
    // 2. Check if already indexed
    const existingStatus = await this.getFileStatus(compositeId);
    
    if (existingStatus?.file_hash_indexed === fileHash) {
      console.log(`Skipping ${filePath}: already indexed`);
      return;
    }
    
    // 3. Decide strategy
    if (!existingStatus) {
      // New file: full index
      await this.fullIndexFile(filePath, fileHash);
    } else {
      // Existing file: incremental update
      await this.incrementalUpdateFile(filePath, fileHash);
    }
  }
  
  async fullIndexFile(filePath: string, fileHash: string) {
    console.log(`Full indexing: ${filePath}`);
    
    // 1. Analyze file
    const chunks = await this.analyzer.analyzeFile(filePath);
    
    // 2. Generate embeddings
    for (const chunk of chunks) {
      chunk.embedding = await this.embeddingService.generate(chunk.content);
      chunk.chunk_hash = this.hashManager.computeChunkHash(
        chunk.content,
        chunk.line_start,
        chunk.line_end
      );
    }
    
    // 3. Extract entities & relations
    const entities = await this.extractEntities(chunks);
    const relations = await this.extractRelations(chunks, entities);
    
    // 4. Save to LanceDB
    await this.vectorDB.saveChunks(chunks);
    await this.vectorDB.saveEntities(entities);
    await this.vectorDB.saveRelations(relations);
    
    // 5. Build graph
    await this.graphEngine.addNodesAndEdges(entities, relations);
    
    // 6. Update file status
    await this.saveFileStatus({
      composite_id: await this.hashManager.computeCompositeHash(filePath),
      file_path: filePath,
      file_hash_current: fileHash,
      file_hash_indexed: fileHash,
      status: 'indexed',
      freshness: 'fresh',
      chunk_count: chunks.length,
      entity_count: entities.length,
      relation_count: relations.length,
      indexed_at: new Date().toISOString()
    });
    
    console.log(`✅ Indexed ${filePath}: ${chunks.length} chunks, ${entities.length} entities`);
  }
  
  async incrementalUpdateFile(filePath: string, newFileHash: string) {
    console.log(`Incremental update: ${filePath}`);
    
    // 1. Get diff
    const oldContent = await this.getIndexedContent(filePath);
    const newContent = await fs.readFile(filePath, 'utf-8');
    const diff = this.diffManager.computeLineDiff(oldContent, newContent);
    
    // 2. Find affected chunks
    const allChunks = await this.getChunksByFile(filePath);
    const affectedChunks = this.diffManager.findAffectedChunks(diff, allChunks);
    
    console.log(`  ${affectedChunks.length} chunks affected by changes`);
    
    // 3. Reprocess affected chunks
    for (const oldChunk of affectedChunks) {
      // Mark as outdated
      await this.markChunkAsOutdated(oldChunk.id);
      
      // Reanalyze
      const newChunk = await this.reanalyzeChunk(filePath, oldChunk);
      
      // Update embedding
      newChunk.embedding = await this.embeddingService.generate(newChunk.content);
      
      // Update in DB
      await this.vectorDB.updateChunk(newChunk);
      
      // Update graph
      await this.graphEngine.updateNode(newChunk);
    }
    
    // 4. Update file status
    await this.updateFileStatus(filePath, newFileHash);
    
    console.log(`✅ Updated ${filePath}: ${affectedChunks.length} chunks reprocessed`);
  }
}
```

---

## 🎯 Casos de Uso Práticos

### **Caso 1: Busca em Arquivo Grande**

```typescript
// User query: "find authentication logic"
const results = await searchService.search("authentication logic");

// Result:
{
  file_path: "/projeto/src/services/AuthService.ts",
  line_start: 245,        // ⭐ Linha exata!
  line_end: 289,
  content: "async authenticate(credentials: Credentials) { ... }",
  
  // Freshness check
  freshness: "stale",     // ⚠️ Arquivo mudou!
  indexed_at: "2025-10-10T10:00:00Z",
  file_modified_at: "2025-10-11T14:30:00Z",
  
  warning: "⚠️ This file was modified 4 hours ago. Index may be outdated.",
  
  actions: [
    { label: "Go to Line 245", command: "cappy.goToLine" },
    { label: "Reindex Now", command: "cappy.reindex" },
    { label: "Ignore", command: "cappy.ignore" }
  ]
}
```

### **Caso 2: FileWatcher em Ação**

```typescript
// Developer edits UserService.ts (15000 lines)
// Changes lines 5432-5450 (apenas 18 linhas em 15k!)

// FileWatcher detecta mudança (debounced 2s)
// → Compute file hash
// → Detect only affected chunks (1-2 chunks)
// → Reprocess only those chunks
// → Update embeddings (apenas 2 chunks, não 15k linhas)
// → Update graph (incremental)
// → Update file status

// Total time: ~2 seconds (vs 2 minutos reprocessando tudo)
```

### **Caso 3: LLM Vê Status**

```typescript
// LLM query via Copilot
const context = await retrieveContext("how does authentication work?");

// Context includes freshness info:
{
  chunks: [
    {
      content: "...",
      file: "AuthService.ts",
      lines: "245-289",
      freshness: "fresh",     // ✅
      indexed_at: "2025-10-11T14:00:00Z"
    },
    {
      content: "...",
      file: "UserController.ts",
      lines: "89-120",
      freshness: "stale",     // ⚠️
      indexed_at: "2025-10-10T10:00:00Z",
      warning: "File modified 5 hours ago"
    }
  ]
}

// LLM pode avisar:
"Based on the code (note: UserController.ts may be outdated), 
authentication works by..."
```

---

## ✅ Checklist de Implementação

### **Sprint 1: Core Infrastructure** (3 dias)
- [ ] Implementar `FileHashManager`
- [ ] Criar schema LanceDB com `line_start/end`
- [ ] Implementar `file_status` table
- [ ] Testes de hashing e unicidade

### **Sprint 2: Incremental Updates** (4 dias)
- [ ] Implementar `IncrementalUpdateManager`
- [ ] Implementar diff-based detection
- [ ] Implementar `smartUpdate` (hybrid strategy)
- [ ] Testes de update scenarios

### **Sprint 3: FileWatcher** (2 dias)
- [ ] Implementar `SmartFileWatcher`
- [ ] Debouncing e batching
- [ ] Status bar integration
- [ ] Testes de file events

### **Sprint 4: Freshness & Navigation** (3 dias)
- [ ] Implementar `FreshnessChecker`
- [ ] Implementar `NavigationService` (go-to-line)
- [ ] UI para warnings de staleness
- [ ] Testes end-to-end

---

## 🎯 Benefícios da Nossa Abordagem

| Aspecto | LightRAG | CAPPY | Vantagem |
|---------|----------|-------|----------|
| **Line Granularity** | ❌ Não tem | ✅ Linha exata | 🏆 CAPPY |
| **Change Detection** | ⚠️ Básico | ✅ Diff-based | 🏆 CAPPY |
| **Incremental Updates** | ❌ Reprocess tudo | ✅ Apenas chunks afetados | 🏆 CAPPY |
| **File Hashing** | ❌ Não tem | ✅ Dual hash (file + chunk) | 🏆 CAPPY |
| **Freshness Status** | ❌ Não expõe | ✅ UI warnings | 🏆 CAPPY |
| **Large Files** | ⚠️ Lento (reprocess) | ✅ Otimizado | 🏆 CAPPY |

---

## 📚 Referências

- [diff library](https://www.npmjs.com/package/diff) - Line-by-line diffing
- [VS Code FileSystemWatcher](https://code.visualstudio.com/api/references/vscode-api#FileSystemWatcher)
- [Node.js crypto](https://nodejs.org/api/crypto.html) - MD5 hashing

---

**Conclusão**: Nossa abordagem com **line granularity**, **incremental updates**, e **freshness tracking** é **significativamente superior** ao LightRAG para casos de uso de código e arquivos grandes. 🚀
