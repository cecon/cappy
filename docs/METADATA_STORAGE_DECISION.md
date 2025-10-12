# Metadata Storage Decision: LanceDB vs Arquivo Separado

## 🎯 Decisão: Onde Salvar Metadados de Arquivo?

Metadados em questão:
- `file_path`, `file_hash`, `structure_hash`
- `indexing_mode` (signature/full)
- `total_tokens`, `embedding_tokens`, `embedding_cost_usd`
- `total_chunks`, `total_entities`, `total_relations`
- `indexed_at`, `last_modified`, `status`

---

## ✅ Opção 1: Tabela no LanceDB (RECOMENDADO)

### **Sim! LanceDB suporta tabelas sem vetores**

```typescript
// file_metadata table (SEM vector obrigatório)
interface FileMetadata {
  // Identificação
  file_path: string;              // PK
  file_name: string;
  file_extension: string;
  
  // Hashes
  content_hash: string;           // MD5 completo
  structure_hash: string;         // MD5 apenas estrutura
  
  // Indexing
  indexing_mode: 'signature' | 'full' | 'hybrid';
  indexed_at: string;
  last_modified: string;
  
  // Token accounting
  total_tokens: number;
  total_chunks: number;
  total_entities: number;
  total_relations: number;
  embedding_tokens: number;
  embedding_cost_usd: number;
  
  // File stats
  line_count: number;
  byte_size: number;
  
  // Status
  status: 'indexed' | 'indexing' | 'failed' | 'stale';
  error_message?: string;
  
  // Metadata
  language?: string;
  repo_path?: string;
  git_commit?: string;
}
```

### ✅ **Vantagens**

1. **Query Unificada** 🎯
   ```typescript
   // Buscar tudo em um lugar
   const metadata = await lancedb.query('file_metadata')
     .filter(`file_path = '${filePath}'`)
     .first();
   
   // Join com chunks
   const fileWithChunks = await lancedb.query('file_metadata')
     .join('document_chunks', 'file_path')
     .where(`file_path = '${filePath}'`)
     .execute();
   ```

2. **Analytics Nativo** 📊
   ```typescript
   // Queries SQL-like direto no LanceDB
   const stats = await lancedb.query('file_metadata')
     .select([
       'indexing_mode',
       'COUNT(*) as file_count',
       'SUM(total_tokens) as total_tokens',
       'AVG(embedding_cost_usd) as avg_cost'
     ])
     .groupBy('indexing_mode')
     .execute();
   
   // Resultado:
   [
     { indexing_mode: 'signature', file_count: 150, total_tokens: 500000, avg_cost: 0.001 },
     { indexing_mode: 'full', file_count: 20, total_tokens: 300000, avg_cost: 0.006 }
   ]
   ```

3. **Atomicidade** ⚛️
   ```typescript
   // Transação única: metadata + chunks + entities
   await lancedb.transaction(async (tx) => {
     // 1. Update metadata
     await tx.upsert('file_metadata', {
       file_path: filePath,
       total_chunks: chunks.length,
       indexed_at: new Date().toISOString()
     });
     
     // 2. Insert chunks
     await tx.insert('document_chunks', chunks);
     
     // 3. Insert entities
     await tx.insert('entities', entities);
   });
   
   // Se qualquer operação falhar, tudo é revertido
   ```

4. **Indexação Automática** 🚀
   ```typescript
   // LanceDB cria índices B-tree automaticamente
   await lancedb.createIndex('file_metadata', 'file_path');  // PK
   await lancedb.createIndex('file_metadata', 'indexing_mode');  // Para queries
   await lancedb.createIndex('file_metadata', 'status');
   
   // Queries ficam instantâneas
   const staleFiles = await lancedb.query('file_metadata')
     .filter(`status = 'stale'`)
     .execute();  // Usa índice, super rápido
   ```

5. **Single Source of Truth** 🎯
   ```typescript
   // Tudo no mesmo lugar = consistência garantida
   .cappy/
     data/
       file_metadata.lance      ← Metadados aqui
       document_chunks.lance    ← Chunks aqui
       entities.lance           ← Entidades aqui
       relations.lance          ← Relações aqui
   
   // Backup = copiar pasta .cappy/data/
   // Restore = colar pasta de volta
   ```

6. **Sem Parsing Externo** 🛠️
   ```typescript
   // Não precisa ler/parsear JSON ou YAML
   // LanceDB já retorna objetos tipados
   
   const metadata: FileMetadata = await lancedb
     .query('file_metadata')
     .filter(`file_path = '${filePath}'`)
     .first();
   
   // Pronto para usar, zero parsing
   console.log(metadata.total_tokens);
   ```

7. **Histórico Automático** 📜
   ```typescript
   // LanceDB mantém versões (se configurado)
   await lancedb.config({
     enableVersioning: true,
     retainVersions: 10
   });
   
   // Buscar versão anterior
   const oldMetadata = await lancedb.query('file_metadata')
     .asOfVersion(5)  // Versão 5 do arquivo
     .filter(`file_path = '${filePath}'`)
     .first();
   ```

---

## ❌ Opção 2: Arquivo JSON/YAML Separado

```typescript
// .cappy/metadata/file_registry.json
{
  "src/services/auth.ts": {
    "content_hash": "abc123",
    "structure_hash": "def456",
    "indexing_mode": "signature",
    "total_tokens": 1500,
    "indexed_at": "2025-10-11T10:00:00Z"
  },
  "src/utils/crypto.ts": {
    // ...
  }
}
```

### ❌ **Desvantagens**

1. **Queries Complexas** 🐌
   ```typescript
   // Precisa carregar tudo na memória
   const registry = JSON.parse(
     await fs.readFile('.cappy/metadata/file_registry.json', 'utf-8')
   );
   
   // Filtrar manualmente
   const signatureFiles = Object.entries(registry)
     .filter(([_, meta]) => meta.indexing_mode === 'signature');
   
   // Analytics = código customizado
   const totalTokens = Object.values(registry)
     .reduce((sum, meta) => sum + meta.total_tokens, 0);
   ```

2. **Concorrência** ⚠️
   ```typescript
   // Race condition: 2 processos escrevendo ao mesmo tempo
   // Arquivo pode ficar corrompido ou perder updates
   
   // Precisa de lock file
   const lockfile = require('proper-lockfile');
   const release = await lockfile.lock('.cappy/metadata/file_registry.json');
   
   try {
     // Update metadata
   } finally {
     await release();
   }
   ```

3. **Sem Índices** 🐢
   ```typescript
   // Buscar por file_path = O(n)
   // Buscar por mode = O(n)
   // Aggregate = O(n)
   
   // Com 10k arquivos, queries ficam lentas
   ```

4. **Parsing Overhead** 💸
   ```typescript
   // Sempre precisa parsear JSON completo
   const registry = JSON.parse(
     await fs.readFile('.cappy/metadata/file_registry.json', 'utf-8')
   );  // Custo: ~100ms para 10k arquivos
   
   // Buscar 1 arquivo = parsear 10k registros
   const metadata = registry['src/services/auth.ts'];
   ```

5. **Backup Fragmentado** 📦
   ```typescript
   // Backup = copiar múltiplos lugares
   .cappy/
     metadata/
       file_registry.json    ← Copiar isso
     data/
       *.lance               ← E isso
   
   // Restore = garantir consistência manualmente
   ```

6. **Sem Joins** 🔗
   ```typescript
   // Precisa fazer joins manualmente
   const metadata = registry[filePath];
   
   const chunks = await lancedb.query('document_chunks')
     .filter(`file_path = '${filePath}'`)
     .execute();
   
   // Combinar os dois manualmente
   const combined = {
     ...metadata,
     chunks
   };
   ```

7. **Sem Histórico** 📜
   ```typescript
   // Precisa implementar versionamento customizado
   .cappy/
     metadata/
       file_registry.json
       file_registry.json.backup
       file_registry.json.2025-10-11
   
   // Git pode ajudar, mas precisa commit manual
   ```

---

## 📊 Comparação Direta

| Aspecto | LanceDB Table | JSON/YAML File |
|---------|---------------|----------------|
| **Query Performance** | ⭐⭐⭐⭐⭐ (índices) | ⭐⭐ (O(n) sempre) |
| **Analytics** | ⭐⭐⭐⭐⭐ (SQL-like) | ⭐⭐ (código manual) |
| **Concurrency** | ⭐⭐⭐⭐⭐ (built-in) | ⭐⭐ (lock file) |
| **Joins** | ⭐⭐⭐⭐⭐ (nativo) | ⭐ (manual) |
| **Backup** | ⭐⭐⭐⭐⭐ (1 pasta) | ⭐⭐⭐ (múltiplos arquivos) |
| **Histórico** | ⭐⭐⭐⭐ (versioning) | ⭐⭐ (manual) |
| **Type Safety** | ⭐⭐⭐⭐⭐ (schema) | ⭐⭐⭐ (TypeScript types) |
| **Human Readable** | ⭐⭐⭐ (SQL export) | ⭐⭐⭐⭐⭐ (direto) |
| **Debugging** | ⭐⭐⭐⭐ (queries) | ⭐⭐⭐⭐⭐ (editor) |

---

## 🎯 Decisão: **LanceDB Table** ✅

### **Implementação Recomendada**

```typescript
// 1. Schema da tabela
const fileMetadataSchema = {
  file_path: { type: 'string', primary_key: true },
  file_name: { type: 'string', indexed: true },
  file_extension: { type: 'string', indexed: true },
  
  content_hash: { type: 'string' },
  structure_hash: { type: 'string' },
  
  indexing_mode: { type: 'enum', values: ['signature', 'full', 'hybrid'], indexed: true },
  indexed_at: { type: 'timestamp', indexed: true },
  last_modified: { type: 'timestamp' },
  
  total_tokens: { type: 'int' },
  total_chunks: { type: 'int' },
  total_entities: { type: 'int' },
  total_relations: { type: 'int' },
  embedding_tokens: { type: 'int' },
  embedding_cost_usd: { type: 'float' },
  
  line_count: { type: 'int' },
  byte_size: { type: 'int' },
  
  status: { type: 'enum', values: ['indexed', 'indexing', 'failed', 'stale'], indexed: true },
  error_message: { type: 'string', nullable: true },
  
  language: { type: 'string', nullable: true },
  repo_path: { type: 'string', nullable: true },
  git_commit: { type: 'string', nullable: true }
};

// 2. Criar tabela
await lancedb.createTable('file_metadata', fileMetadataSchema);

// 3. Criar índices para queries rápidas
await lancedb.createIndex('file_metadata', ['indexing_mode']);
await lancedb.createIndex('file_metadata', ['status']);
await lancedb.createIndex('file_metadata', ['file_extension']);
await lancedb.createIndex('file_metadata', ['indexed_at']);
```

---

## 🔧 API de Acesso

```typescript
class FileMetadataRepository {
  constructor(private lancedb: LanceDB) {}
  
  // ========================================
  // CRUD Operations
  // ========================================
  
  async get(filePath: string): Promise<FileMetadata | null> {
    return await this.lancedb.query('file_metadata')
      .filter(`file_path = '${filePath}'`)
      .first();
  }
  
  async upsert(metadata: FileMetadata): Promise<void> {
    await this.lancedb.upsert('file_metadata', metadata);
  }
  
  async delete(filePath: string): Promise<void> {
    await this.lancedb.delete('file_metadata')
      .where(`file_path = '${filePath}'`)
      .execute();
  }
  
  async bulkUpsert(metadataList: FileMetadata[]): Promise<void> {
    await this.lancedb.bulkUpsert('file_metadata', metadataList);
  }
  
  // ========================================
  // Queries Complexas
  // ========================================
  
  async getAllByMode(mode: IndexingMode): Promise<FileMetadata[]> {
    return await this.lancedb.query('file_metadata')
      .filter(`indexing_mode = '${mode}'`)
      .execute();
  }
  
  async getStaleFiles(olderThan: Date): Promise<FileMetadata[]> {
    return await this.lancedb.query('file_metadata')
      .filter(`
        status = 'stale' OR
        indexed_at < '${olderThan.toISOString()}'
      `)
      .execute();
  }
  
  async getByExtension(extension: string): Promise<FileMetadata[]> {
    return await this.lancedb.query('file_metadata')
      .filter(`file_extension = '${extension}'`)
      .execute();
  }
  
  async searchByPath(pathPattern: string): Promise<FileMetadata[]> {
    return await this.lancedb.query('file_metadata')
      .filter(`file_path LIKE '%${pathPattern}%'`)
      .execute();
  }
  
  // ========================================
  // Analytics
  // ========================================
  
  async getTotalStats(): Promise<WorkspaceStats> {
    const result = await this.lancedb.query('file_metadata')
      .select([
        'COUNT(*) as total_files',
        'SUM(total_tokens) as total_tokens',
        'SUM(total_chunks) as total_chunks',
        'SUM(total_entities) as total_entities',
        'SUM(embedding_tokens) as embedding_tokens',
        'SUM(embedding_cost_usd) as total_cost'
      ])
      .first();
    
    return result;
  }
  
  async getStatsByMode(): Promise<ModeStats[]> {
    return await this.lancedb.query('file_metadata')
      .select([
        'indexing_mode',
        'COUNT(*) as file_count',
        'SUM(total_tokens) as total_tokens',
        'AVG(total_tokens) as avg_tokens',
        'SUM(embedding_cost_usd) as total_cost',
        'AVG(embedding_cost_usd) as avg_cost'
      ])
      .groupBy('indexing_mode')
      .execute();
  }
  
  async getStatsByExtension(): Promise<ExtensionStats[]> {
    return await this.lancedb.query('file_metadata')
      .select([
        'file_extension',
        'COUNT(*) as file_count',
        'AVG(line_count) as avg_lines',
        'AVG(total_tokens) as avg_tokens',
        'SUM(total_cost) as total_cost'
      ])
      .groupBy('file_extension')
      .orderBy('file_count', 'desc')
      .execute();
  }
  
  async getMostExpensive(limit = 10): Promise<FileMetadata[]> {
    return await this.lancedb.query('file_metadata')
      .orderBy('embedding_cost_usd', 'desc')
      .limit(limit)
      .execute();
  }
  
  async getLargestFiles(limit = 10): Promise<FileMetadata[]> {
    return await this.lancedb.query('file_metadata')
      .orderBy('total_tokens', 'desc')
      .limit(limit)
      .execute();
  }
  
  // ========================================
  // Batch Operations
  // ========================================
  
  async markAsStale(filePaths: string[]): Promise<void> {
    await this.lancedb.update('file_metadata')
      .set({ status: 'stale' })
      .where(`file_path IN (${filePaths.map(p => `'${p}'`).join(',')})`)
      .execute();
  }
  
  async deleteMultiple(filePaths: string[]): Promise<void> {
    await this.lancedb.delete('file_metadata')
      .where(`file_path IN (${filePaths.map(p => `'${p}'`).join(',')})`)
      .execute();
  }
  
  async convertMode(
    filePaths: string[],
    newMode: IndexingMode
  ): Promise<void> {
    await this.lancedb.update('file_metadata')
      .set({ 
        indexing_mode: newMode,
        status: 'stale'  // Marcar para reindex
      })
      .where(`file_path IN (${filePaths.map(p => `'${p}'`).join(',')})`)
      .execute();
  }
}
```

---

## 🔄 Integração com Change Detection

```typescript
class FileChangeDetector {
  constructor(
    private metadataRepo: FileMetadataRepository,
    private lancedb: LanceDB
  ) {}
  
  async detectChanges(filePath: string): Promise<ChangeType> {
    // 1. Buscar metadata do LanceDB
    const metadata = await this.metadataRepo.get(filePath);
    
    if (!metadata) {
      return { type: 'new', requiresReindex: true };
    }
    
    // 2. Calcular hashes atuais
    const content = await fs.readFile(filePath, 'utf-8');
    const contentHash = md5(content);
    const structureHash = await this.calculateStructureHash(filePath, content);
    
    // 3. Comparar por modo
    if (metadata.indexing_mode === 'signature') {
      // ⭐ Signature: só reindexar se estrutura mudou
      if (structureHash !== metadata.structure_hash) {
        return {
          type: 'structure_changed',
          requiresReindex: true,
          oldHash: metadata.structure_hash,
          newHash: structureHash
        };
      }
      
      // Implementação mudou, mas estrutura não
      if (contentHash !== metadata.content_hash) {
        // ⭐ Apenas atualizar content_hash, não reindexar
        await this.metadataRepo.upsert({
          ...metadata,
          content_hash: contentHash,
          last_modified: new Date().toISOString()
        });
        
        return {
          type: 'implementation_changed',
          requiresReindex: false  // 🎯 SKIP reindex!
        };
      }
    } else {
      // ⭐ Full mode: reindexar se conteúdo mudou
      if (contentHash !== metadata.content_hash) {
        return {
          type: 'content_changed',
          requiresReindex: true
        };
      }
    }
    
    return { type: 'unchanged', requiresReindex: false };
  }
  
  private async calculateStructureHash(
    filePath: string,
    content: string
  ): Promise<string> {
    const extractor = this.getExtractor(filePath);
    const signatures = await extractor.extract(content);
    
    // Hash apenas das signatures
    const structureString = signatures
      .map(sig => sig.signature)
      .sort()
      .join('\n');
    
    return md5(structureString);
  }
}
```

---

## 💾 Backup & Restore

```typescript
class BackupManager {
  async backup(outputPath: string): Promise<void> {
    // LanceDB armazena tudo em .lance files
    // Backup = copiar pasta inteira
    await fs.cp('.cappy/data/', outputPath, { recursive: true });
    
    console.log(`✅ Backup complete: ${outputPath}`);
    console.log(`  - file_metadata.lance`);
    console.log(`  - document_chunks.lance`);
    console.log(`  - entities.lance`);
    console.log(`  - relations.lance`);
  }
  
  async restore(backupPath: string): Promise<void> {
    // Restore = copiar de volta
    await fs.cp(backupPath, '.cappy/data/', { recursive: true });
    
    console.log(`✅ Restore complete from: ${backupPath}`);
  }
  
  async exportToJSON(outputPath: string): Promise<void> {
    // Export para JSON (human-readable)
    const metadata = await this.lancedb.query('file_metadata')
      .execute();
    
    await fs.writeFile(
      outputPath,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );
    
    console.log(`✅ Exported to JSON: ${outputPath}`);
  }
  
  async importFromJSON(inputPath: string): Promise<void> {
    // Import de JSON
    const data = JSON.parse(
      await fs.readFile(inputPath, 'utf-8')
    );
    
    await this.metadataRepo.bulkUpsert(data);
    
    console.log(`✅ Imported ${data.length} records from: ${inputPath}`);
  }
}
```

---

## 🎨 Debug & Inspection

```typescript
class MetadataInspector {
  async inspectFile(filePath: string): Promise<void> {
    // 1. Metadata
    const metadata = await this.metadataRepo.get(filePath);
    
    console.log(`\n📋 File Metadata: ${filePath}`);
    console.log(`  Mode: ${metadata.indexing_mode}`);
    console.log(`  Status: ${metadata.status}`);
    console.log(`  Tokens: ${metadata.total_tokens.toLocaleString()}`);
    console.log(`  Chunks: ${metadata.total_chunks}`);
    console.log(`  Entities: ${metadata.total_entities}`);
    console.log(`  Cost: $${metadata.embedding_cost_usd.toFixed(6)}`);
    console.log(`  Indexed: ${metadata.indexed_at}`);
    console.log(`  Hashes:`);
    console.log(`    Content: ${metadata.content_hash}`);
    console.log(`    Structure: ${metadata.structure_hash}`);
    
    // 2. Chunks
    const chunks = await this.lancedb.query('document_chunks')
      .filter(`file_path = '${filePath}'`)
      .execute();
    
    console.log(`\n📦 Chunks (${chunks.length}):`);
    chunks.slice(0, 5).forEach((chunk, i) => {
      console.log(`  ${i + 1}. Lines ${chunk.line_start}-${chunk.line_end}: ${chunk.chunk_type}`);
      console.log(`     Tokens: ${chunk.token_count}`);
    });
    
    // 3. Entities
    const entities = await this.lancedb.query('entities')
      .filter(`file_path = '${filePath}'`)
      .execute();
    
    console.log(`\n🏷️  Entities (${entities.length}):`);
    entities.slice(0, 5).forEach((entity, i) => {
      console.log(`  ${i + 1}. ${entity.name} (${entity.type})`);
    });
  }
  
  async inspectWorkspace(): Promise<void> {
    const stats = await this.metadataRepo.getTotalStats();
    const modeStats = await this.metadataRepo.getStatsByMode();
    
    console.log(`\n📊 Workspace Stats:`);
    console.log(`  Files: ${stats.total_files}`);
    console.log(`  Tokens: ${stats.total_tokens.toLocaleString()}`);
    console.log(`  Chunks: ${stats.total_chunks}`);
    console.log(`  Entities: ${stats.total_entities}`);
    console.log(`  Cost: $${stats.total_cost.toFixed(4)}`);
    
    console.log(`\n📋 By Mode:`);
    modeStats.forEach(m => {
      console.log(`  ${m.indexing_mode}:`);
      console.log(`    Files: ${m.file_count}`);
      console.log(`    Tokens: ${m.total_tokens.toLocaleString()}`);
      console.log(`    Avg Tokens/File: ${Math.round(m.avg_tokens)}`);
      console.log(`    Cost: $${m.total_cost.toFixed(4)}`);
    });
  }
}
```

---

## 🎯 Conclusão: **LanceDB Table é a Melhor Escolha** ✅

### **Por quê?**

1. ✅ **Performance**: Queries com índices, joins nativos
2. ✅ **Consistência**: Transações atômicas, single source of truth
3. ✅ **Analytics**: SQL-like queries, agregações built-in
4. ✅ **Concurrency**: Safe para múltiplos processos
5. ✅ **Backup**: 1 pasta = tudo
6. ✅ **Type Safety**: Schema enforcement
7. ✅ **Histórico**: Versioning opcional

### **Estrutura Final**

```
.cappy/
  data/
    file_metadata.lance      ← ⭐ Metadados aqui
    document_chunks.lance
    entities.lance
    relations.lance
    indexing_stats.lance
```

### **API Unificada**

```typescript
// Tudo via LanceDB
const metadata = await metadataRepo.get(filePath);
const chunks = await lancedb.query('document_chunks')
  .filter(`file_path = '${filePath}'`)
  .execute();

// Joins nativos
const fileWithChunks = await lancedb.query('file_metadata')
  .join('document_chunks', 'file_path')
  .where(`file_path = '${filePath}'`)
  .execute();
```

**Decisão final**: Usar **tabela `file_metadata` no LanceDB** para máxima performance, consistência e facilidade de uso! 🚀

---

## 🔄 Sistema de Fila para Processamento Sequencial

### **Por que precisamos de uma fila?**

1. **Evitar race conditions** ao indexar/deletar múltiplos arquivos
2. **Garantir ordem de processamento** (importante para dependencies)
3. **Controle de concorrência** (1 arquivo por vez = mais estável)
4. **Progress tracking** (UI mostra fila e progresso)
5. **Retry automático** em caso de falha
6. **Cancelamento gracioso** (pode parar a fila sem corromper dados)

---

## 📋 Schema da Fila

```typescript
// ========================================
// TABELA: processing_queue (no LanceDB)
// ========================================
interface QueueItem {
  id: string;                     // UUID
  
  // Tipo de operação
  operation: 'index' | 'reindex' | 'delete' | 'convert_mode';
  
  // Alvo
  file_path: string;
  
  // Parâmetros da operação
  params?: {
    indexing_mode?: 'signature' | 'full' | 'hybrid';
    target_mode?: 'signature' | 'full';  // Para convert_mode
    force?: boolean;
  };
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  
  // Prioridade (maior = mais prioritário)
  priority: number;               // Default: 0
  
  // Tentativas
  retry_count: number;            // Default: 0
  max_retries: number;            // Default: 3
  
  // Timestamps
  created_at: string;
  started_at?: string;
  completed_at?: string;
  
  // Resultado
  error?: string;
  result?: {
    chunks_created?: number;
    entities_created?: number;
    relations_created?: number;
    tokens_processed?: number;
    duration_ms?: number;
  };
  
  // Metadata
  triggered_by?: 'user' | 'file_watcher' | 'workspace_scan';
  batch_id?: string;              // Agrupar operações relacionadas
}
```

---

## 🏗️ Implementação da Fila

```typescript
class ProcessingQueue {
  private isProcessing = false;
  private currentItem: QueueItem | null = null;
  private abortController: AbortController | null = null;
  
  constructor(
    private lancedb: LanceDB,
    private indexer: DualModeIndexer,
    private metadataRepo: FileMetadataRepository
  ) {
    // Iniciar processamento automático
    this.startProcessing();
  }
  
  // ========================================
  // Adicionar à fila
  // ========================================
  
  async enqueue(
    operation: 'index' | 'reindex' | 'delete' | 'convert_mode',
    filePath: string,
    params?: QueueItem['params'],
    options?: {
      priority?: number;
      batchId?: string;
      triggeredBy?: string;
    }
  ): Promise<string> {
    // Verificar se já existe na fila
    const existing = await this.findPendingItem(filePath, operation);
    
    if (existing) {
      console.log(`⏭️  Item already in queue: ${filePath} (${operation})`);
      return existing.id;
    }
    
    // Criar item
    const item: QueueItem = {
      id: uuid(),
      operation,
      file_path: filePath,
      params,
      status: 'pending',
      priority: options?.priority || 0,
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
      triggered_by: options?.triggeredBy || 'user',
      batch_id: options?.batchId
    };
    
    // Salvar na tabela
    await this.lancedb.insert('processing_queue', item);
    
    console.log(`➕ Added to queue: ${filePath} (${operation})`);
    
    // Disparar processamento (se não estiver rodando)
    if (!this.isProcessing) {
      this.startProcessing();
    }
    
    return item.id;
  }
  
  async enqueueBatch(
    items: Array<{
      operation: QueueItem['operation'];
      filePath: string;
      params?: QueueItem['params'];
      priority?: number;
    }>,
    options?: {
      batchId?: string;
      triggeredBy?: string;
    }
  ): Promise<string[]> {
    const batchId = options?.batchId || uuid();
    const ids: string[] = [];
    
    for (const item of items) {
      const id = await this.enqueue(
        item.operation,
        item.filePath,
        item.params,
        {
          ...options,
          priority: item.priority,
          batchId
        }
      );
      ids.push(id);
    }
    
    console.log(`📦 Batch enqueued: ${ids.length} items (batch: ${batchId})`);
    
    return ids;
  }
  
  private async findPendingItem(
    filePath: string,
    operation: string
  ): Promise<QueueItem | null> {
    return await this.lancedb.query('processing_queue')
      .filter(`
        file_path = '${filePath}' AND
        operation = '${operation}' AND
        status IN ('pending', 'processing')
      `)
      .first();
  }
  
  // ========================================
  // Processamento da fila
  // ========================================
  
  private async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('🚀 Queue processing started');
    
    while (this.isProcessing) {
      try {
        // 1. Buscar próximo item (por prioridade)
        const item = await this.getNextItem();
        
        if (!item) {
          // Fila vazia, aguardar
          console.log('⏸️  Queue empty, waiting...');
          await this.sleep(1000);
          continue;
        }
        
        // 2. Processar item
        await this.processItem(item);
        
      } catch (error) {
        console.error('❌ Queue processing error:', error);
        await this.sleep(5000);  // Backoff em caso de erro
      }
    }
    
    console.log('⏹️  Queue processing stopped');
  }
  
  private async getNextItem(): Promise<QueueItem | null> {
    // Buscar item pending com maior prioridade
    return await this.lancedb.query('processing_queue')
      .filter(`status = 'pending'`)
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc')  // FIFO dentro da mesma prioridade
      .first();
  }
  
  private async processItem(item: QueueItem): Promise<void> {
    this.currentItem = item;
    this.abortController = new AbortController();
    
    const startTime = Date.now();
    
    try {
      // 1. Marcar como processing
      await this.updateItemStatus(item.id, 'processing', {
        started_at: new Date().toISOString()
      });
      
      console.log(`⚙️  Processing: ${item.file_path} (${item.operation})`);
      
      // 2. Executar operação
      let result: any;
      
      switch (item.operation) {
        case 'index':
          result = await this.executeIndex(item);
          break;
        
        case 'reindex':
          result = await this.executeReindex(item);
          break;
        
        case 'delete':
          result = await this.executeDelete(item);
          break;
        
        case 'convert_mode':
          result = await this.executeConvertMode(item);
          break;
        
        default:
          throw new Error(`Unknown operation: ${item.operation}`);
      }
      
      // 3. Marcar como completed
      const duration = Date.now() - startTime;
      
      await this.updateItemStatus(item.id, 'completed', {
        completed_at: new Date().toISOString(),
        result: {
          ...result,
          duration_ms: duration
        }
      });
      
      console.log(`✅ Completed: ${item.file_path} (${duration}ms)`);
      
    } catch (error: any) {
      // 4. Verificar se deve retry
      const shouldRetry = item.retry_count < item.max_retries;
      
      if (shouldRetry) {
        // Retry: voltar para pending
        console.log(`🔄 Retry ${item.retry_count + 1}/${item.max_retries}: ${item.file_path}`);
        
        await this.updateItemStatus(item.id, 'pending', {
          retry_count: item.retry_count + 1,
          error: error.message
        });
      } else {
        // Falhou definitivamente
        console.error(`❌ Failed: ${item.file_path} - ${error.message}`);
        
        await this.updateItemStatus(item.id, 'failed', {
          completed_at: new Date().toISOString(),
          error: error.message
        });
      }
    } finally {
      this.currentItem = null;
      this.abortController = null;
    }
  }
  
  private async updateItemStatus(
    id: string,
    status: QueueItem['status'],
    updates?: Partial<QueueItem>
  ): Promise<void> {
    await this.lancedb.update('processing_queue')
      .set({ status, ...updates })
      .where(`id = '${id}'`)
      .execute();
  }
  
  // ========================================
  // Operações específicas
  // ========================================
  
  private async executeIndex(item: QueueItem): Promise<any> {
    const mode = item.params?.indexing_mode || 'signature';
    
    // Indexar arquivo
    const result = await this.indexer.indexFile(item.file_path, mode);
    
    return {
      chunks_created: result.chunks.length,
      entities_created: result.entities.length,
      relations_created: result.relations.length,
      tokens_processed: result.chunks.reduce((sum, c) => sum + c.token_count, 0)
    };
  }
  
  private async executeReindex(item: QueueItem): Promise<any> {
    const mode = item.params?.indexing_mode || 'signature';
    
    // 1. Deletar dados antigos
    const deleted = await this.deleteAllData(item.file_path);
    
    // 2. Reindexar
    const result = await this.indexer.indexFile(item.file_path, mode);
    
    return {
      chunks_deleted: deleted.chunks,
      entities_deleted: deleted.entities,
      relations_deleted: deleted.relations,
      chunks_created: result.chunks.length,
      entities_created: result.entities.length,
      relations_created: result.relations.length,
      tokens_processed: result.chunks.reduce((sum, c) => sum + c.token_count, 0)
    };
  }
  
  private async executeDelete(item: QueueItem): Promise<any> {
    // ⭐ Deletar TUDO: metadata, chunks, entities, relations
    const deleted = await this.deleteAllData(item.file_path);
    
    // Deletar metadata por último
    await this.metadataRepo.delete(item.file_path);
    
    return {
      chunks_deleted: deleted.chunks,
      entities_deleted: deleted.entities,
      relations_deleted: deleted.relations,
      metadata_deleted: 1
    };
  }
  
  private async executeConvertMode(item: QueueItem): Promise<any> {
    const targetMode = item.params?.target_mode;
    
    if (!targetMode) {
      throw new Error('target_mode is required for convert_mode operation');
    }
    
    // 1. Deletar dados antigos
    const deleted = await this.deleteAllData(item.file_path);
    
    // 2. Reindexar com novo modo
    const result = await this.indexer.indexFile(item.file_path, targetMode);
    
    // 3. Atualizar metadata
    const metadata = await this.metadataRepo.get(item.file_path);
    await this.metadataRepo.upsert({
      ...metadata!,
      indexing_mode: targetMode
    });
    
    return {
      from_mode: metadata?.indexing_mode,
      to_mode: targetMode,
      chunks_deleted: deleted.chunks,
      chunks_created: result.chunks.length,
      entities_deleted: deleted.entities,
      entities_created: result.entities.length,
      relations_deleted: deleted.relations,
      relations_created: result.relations.length
    };
  }
  
  private async deleteAllData(filePath: string): Promise<{
    chunks: number;
    entities: number;
    relations: number;
  }> {
    console.log(`🗑️  Deleting all data for: ${filePath}`);
    
    // 1. Buscar entidades (para deletar relações)
    const entities = await this.lancedb.query('entities')
      .filter(`file_path = '${filePath}'`)
      .select(['id'])
      .execute();
    
    const entityIds = entities.map(e => e.id);
    
    // 2. Deletar relações (onde file_path OU entidades)
    let relationsDeleted = 0;
    
    if (entityIds.length > 0) {
      const relationsResult = await this.lancedb.delete('relations')
        .where(`
          file_path = '${filePath}' OR
          source_id IN (${entityIds.map(id => `'${id}'`).join(',')}) OR
          target_id IN (${entityIds.map(id => `'${id}'`).join(',')})
        `)
        .execute();
      
      relationsDeleted = relationsResult.deletedCount || 0;
    } else {
      const relationsResult = await this.lancedb.delete('relations')
        .where(`file_path = '${filePath}'`)
        .execute();
      
      relationsDeleted = relationsResult.deletedCount || 0;
    }
    
    // 3. Deletar entidades
    const entitiesResult = await this.lancedb.delete('entities')
      .where(`file_path = '${filePath}'`)
      .execute();
    
    // 4. Deletar chunks
    const chunksResult = await this.lancedb.delete('document_chunks')
      .where(`file_path = '${filePath}'`)
      .execute();
    
    const result = {
      chunks: chunksResult.deletedCount || 0,
      entities: entitiesResult.deletedCount || 0,
      relations: relationsDeleted
    };
    
    console.log(`  ✅ Deleted: ${result.chunks} chunks, ${result.entities} entities, ${result.relations} relations`);
    
    return result;
  }
  
  // ========================================
  // Controle da fila
  // ========================================
  
  async pause(): Promise<void> {
    console.log('⏸️  Pausing queue...');
    this.isProcessing = false;
  }
  
  async resume(): Promise<void> {
    console.log('▶️  Resuming queue...');
    this.startProcessing();
  }
  
  async cancel(itemId: string): Promise<void> {
    // Cancelar item específico
    await this.updateItemStatus(itemId, 'cancelled', {
      completed_at: new Date().toISOString()
    });
    
    console.log(`🚫 Cancelled: ${itemId}`);
  }
  
  async cancelBatch(batchId: string): Promise<void> {
    // Cancelar todos os items de um batch
    const items = await this.lancedb.query('processing_queue')
      .filter(`batch_id = '${batchId}' AND status = 'pending'`)
      .execute();
    
    for (const item of items) {
      await this.cancel(item.id);
    }
    
    console.log(`🚫 Cancelled batch: ${batchId} (${items.length} items)`);
  }
  
  async cancelAll(): Promise<void> {
    // Parar processamento
    this.pause();
    
    // Abortar item atual
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Cancelar todos os pending
    await this.lancedb.update('processing_queue')
      .set({
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .where(`status = 'pending'`)
      .execute();
    
    console.log('🚫 Cancelled all pending items');
  }
  
  async clear(): Promise<void> {
    // Limpar fila (remover completed/cancelled/failed)
    await this.lancedb.delete('processing_queue')
      .where(`status IN ('completed', 'cancelled', 'failed')`)
      .execute();
    
    console.log('🧹 Queue cleared');
  }
  
  // ========================================
  // Status & Monitoring
  // ========================================
  
  async getStatus(): Promise<QueueStatus> {
    const stats = await this.lancedb.query('processing_queue')
      .select([
        'status',
        'COUNT(*) as count'
      ])
      .groupBy('status')
      .execute();
    
    const statusMap = stats.reduce((map, s) => {
      map[s.status] = s.count;
      return map;
    }, {} as Record<string, number>);
    
    return {
      pending: statusMap['pending'] || 0,
      processing: statusMap['processing'] || 0,
      completed: statusMap['completed'] || 0,
      failed: statusMap['failed'] || 0,
      cancelled: statusMap['cancelled'] || 0,
      currentItem: this.currentItem,
      isProcessing: this.isProcessing
    };
  }
  
  async getQueue(options?: {
    status?: QueueItem['status'];
    limit?: number;
  }): Promise<QueueItem[]> {
    let query = this.lancedb.query('processing_queue');
    
    if (options?.status) {
      query = query.filter(`status = '${options.status}'`);
    }
    
    query = query
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc');
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    return await query.execute();
  }
  
  async getItemsByBatch(batchId: string): Promise<QueueItem[]> {
    return await this.lancedb.query('processing_queue')
      .filter(`batch_id = '${batchId}'`)
      .orderBy('created_at', 'asc')
      .execute();
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========================================
// Types
// ========================================

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  currentItem: QueueItem | null;
  isProcessing: boolean;
}
```

---

## 🎨 VS Code Integration

### **1. Progress Notification**

```typescript
class QueueProgressNotification {
  private progressHandle: vscode.Progress<any> | null = null;
  
  constructor(private queue: ProcessingQueue) {
    // Monitorar status da fila
    this.startMonitoring();
  }
  
  private async startMonitoring() {
    while (true) {
      const status = await this.queue.getStatus();
      
      if (status.processing > 0 && !this.progressHandle) {
        // Iniciar notificação
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Cappy Indexing',
          cancellable: true
        }, async (progress, token) => {
          this.progressHandle = progress;
          
          // Atualizar progresso
          while (status.processing > 0) {
            progress.report({
              message: `Processing: ${status.currentItem?.file_path}`,
              increment: 1
            });
            
            if (token.isCancellationRequested) {
              await this.queue.cancelAll();
              break;
            }
            
            await this.sleep(500);
            const newStatus = await this.queue.getStatus();
            status.processing = newStatus.processing;
          }
          
          this.progressHandle = null;
          
          // Mostrar resultado
          vscode.window.showInformationMessage(
            `✅ Indexing complete: ${status.completed} files processed`
          );
        });
      }
      
      await this.sleep(1000);
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

### **2. Queue Status Bar**

```typescript
class QueueStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  
  constructor(private queue: ProcessingQueue) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'cappy.showQueue';
    this.statusBarItem.show();
    
    this.startUpdating();
  }
  
  private async startUpdating() {
    while (true) {
      const status = await this.queue.getStatus();
      
      if (status.processing > 0) {
        // Mostra progresso
        this.statusBarItem.text = `$(sync~spin) Cappy: ${status.pending + status.processing} queued`;
        this.statusBarItem.tooltip = `
          Processing: ${status.processing}
          Pending: ${status.pending}
          
          Current: ${status.currentItem?.file_path || 'None'}
          
          Click to view queue
        `;
      } else if (status.pending > 0) {
        // Fila parada
        this.statusBarItem.text = `$(warning) Cappy: ${status.pending} pending`;
        this.statusBarItem.tooltip = 'Queue paused. Click to resume';
      } else {
        // Ocioso
        this.statusBarItem.text = `$(check) Cappy: Idle`;
        this.statusBarItem.tooltip = 'All files indexed';
      }
      
      await this.sleep(1000);
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

### **3. Queue Webview**

```typescript
class QueueWebview {
  async render(): Promise<string> {
    const status = await this.queue.getStatus();
    const queue = await this.queue.getQueue({ limit: 50 });
    
    return `
      <h1>🔄 Processing Queue</h1>
      
      <div class="summary">
        <div class="stat">
          <h3>${status.pending}</h3>
          <p>Pending</p>
        </div>
        <div class="stat processing">
          <h3>${status.processing}</h3>
          <p>Processing</p>
        </div>
        <div class="stat success">
          <h3>${status.completed}</h3>
          <p>Completed</p>
        </div>
        <div class="stat error">
          <h3>${status.failed}</h3>
          <p>Failed</p>
        </div>
      </div>
      
      ${status.currentItem ? `
        <div class="current-item">
          <h3>⚙️ Currently Processing:</h3>
          <p><strong>${status.currentItem.file_path}</strong></p>
          <p>Operation: ${status.currentItem.operation}</p>
          <p>Started: ${new Date(status.currentItem.started_at!).toLocaleTimeString()}</p>
        </div>
      ` : ''}
      
      <h2>📋 Queue (${queue.length} items)</h2>
      <table>
        <tr>
          <th>Status</th>
          <th>File</th>
          <th>Operation</th>
          <th>Priority</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
        ${queue.map(item => `
          <tr class="status-${item.status}">
            <td>${this.getStatusIcon(item.status)}</td>
            <td title="${item.file_path}">${path.basename(item.file_path)}</td>
            <td>${item.operation}</td>
            <td>${item.priority}</td>
            <td>${new Date(item.created_at).toLocaleString()}</td>
            <td>
              ${item.status === 'pending' ? `
                <button onclick="cancelItem('${item.id}')">Cancel</button>
              ` : ''}
              ${item.status === 'failed' ? `
                <button onclick="retryItem('${item.id}')">Retry</button>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </table>
      
      <div class="actions">
        <button onclick="pauseQueue()" ${!status.isProcessing ? 'disabled' : ''}>
          ⏸️ Pause
        </button>
        <button onclick="resumeQueue()" ${status.isProcessing ? 'disabled' : ''}>
          ▶️ Resume
        </button>
        <button onclick="clearQueue()">
          🧹 Clear Completed
        </button>
        <button onclick="cancelAll()" class="danger">
          🚫 Cancel All
        </button>
      </div>
    `;
  }
  
  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: '⏳',
      processing: '⚙️',
      completed: '✅',
      failed: '❌',
      cancelled: '🚫'
    };
    return icons[status] || '❓';
  }
}
```

---

## 🎯 Uso Prático

### **Indexar múltiplos arquivos**

```typescript
// File watcher detectou mudanças
const changedFiles = ['file1.ts', 'file2.ts', 'file3.ts'];

// Adicionar todos à fila
const batchId = await queue.enqueueBatch(
  changedFiles.map(file => ({
    operation: 'reindex',
    filePath: file,
    params: { indexing_mode: 'signature' }
  })),
  { triggeredBy: 'file_watcher' }
);

console.log(`📦 Batch ${batchId}: ${changedFiles.length} files queued`);

// Processar sequencialmente, um por vez
```

---

### **Deletar arquivo**

```typescript
// Usuário deletou um arquivo
await queue.enqueue('delete', filePath, undefined, {
  priority: 10,  // Alta prioridade para deletar
  triggeredBy: 'user'
});

// Fila garante que:
// 1. Deleta chunks
// 2. Deleta entities
// 3. Deleta relations (incluindo cross-file)
// 4. Deleta metadata
// Tudo em ordem, sem race conditions
```

---

### **Converter workspace inteiro**

```typescript
// Converter todos os arquivos de full → signature
const files = await metadataRepo.getAllByMode('full');

await queue.enqueueBatch(
  files.map(f => ({
    operation: 'convert_mode',
    filePath: f.file_path,
    params: { target_mode: 'signature' }
  })),
  { triggeredBy: 'user' }
);

// Monitor progresso via status bar ou webview
```

---

## 📊 Resumo: Sistema de Fila

| Aspecto | Solução |
|---------|---------|
| **Concorrência** | 1 arquivo por vez, sem race conditions |
| **Ordem** | FIFO + prioridade |
| **Retry** | Automático até max_retries |
| **Cancelamento** | Gracioso, sem corromper dados |
| **Progress** | Notification + Status Bar + Webview |
| **Batch** | Agrupar operações relacionadas |
| **Persistence** | Tabela no LanceDB (sobrevive restart) |
| **Delete Cascade** | Garante remoção completa (chunks, entities, relations) |

**Conclusão**: Sistema de fila **production-ready** que garante consistência, ordem e rastreabilidade em todas as operações! 🚀
