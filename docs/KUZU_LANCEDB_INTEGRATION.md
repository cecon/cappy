# LanceDB + Kuzu Integration Strategy

## 🎯 Arquitetura Híbrida: Vector + Graph

**Data**: 11/10/2025  
**Decisão**: Usar **LanceDB** (vector search) + **Kuzu** (graph database)

---

## 📊 Divisão de Responsabilidades

| Aspecto | LanceDB | Kuzu |
|---------|---------|------|
| **Vector Embeddings** | ✅ Primary | ❌ |
| **Semantic Search** | ✅ Primary | ❌ |
| **Metadata Storage** | ✅ Primary | ⚠️ Referências |
| **Graph Relationships** | ❌ | ✅ Primary |
| **Multi-level Traversal** | ❌ | ✅ Primary |
| **Pattern Matching** | ❌ | ✅ Primary (Cypher) |
| **Full-text Search** | ✅ | ⚠️ Via LanceDB |
| **Persistence** | ✅ Disk | ✅ Disk |

---

## 🏗️ Schema Design

### **LanceDB Tables**

```typescript
// 1. file_metadata
interface FileMetadata {
  file_path: string;              // PK
  content_hash: string;
  structure_hash: string;
  indexing_mode: 'signature' | 'full';
  total_tokens: number;
  total_chunks: number;
  total_entities: number;
  indexed_at: string;
  status: 'indexed' | 'stale';
}

// 2. document_chunks (COM vector)
interface DocumentChunk {
  id: string;                     // UUID
  file_path: string;              // FK
  line_start: number;
  line_end: number;
  content: string;
  vector: number[];               // ⭐ Embedding
  indexing_mode: 'signature' | 'full';
  token_count: number;
  metadata: {
    chunk_type: string;
    signature?: string;
  };
}

// 3. entities (COM vector)
interface Entity {
  id: string;                     // UUID
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable';
  file_path: string;
  line_start: number;
  line_end: number;
  vector: number[];               // ⭐ Embedding do nome + descrição
  description: string;
  metadata: {
    indexing_mode: string;
    signature?: string;
    scope?: string;
  };
}
```

### **Kuzu Schema (Cypher)**

```cypher
-- ========================================
-- NODE TABLES
-- ========================================

-- Chunks (referencia LanceDB)
CREATE NODE TABLE Chunk(
  id STRING,                      -- Mesmo UUID do LanceDB
  file_path STRING,
  file_type STRING,
  line_start INT64,
  line_end INT64,
  chunk_type STRING,              -- function, class, etc.
  indexing_mode STRING,           -- signature, full
  PRIMARY KEY (id)
);

-- Entities (referencia LanceDB)
CREATE NODE TABLE Entity(
  id STRING,                      -- Mesmo UUID do LanceDB
  name STRING,
  type STRING,                    -- function, class, interface, etc.
  file_path STRING,
  scope STRING,                   -- public, private, etc.
  PRIMARY KEY (id)
);

-- Files (agregação)
CREATE NODE TABLE File(
  path STRING,                    -- Caminho completo
  name STRING,
  extension STRING,
  language STRING,                -- typescript, python, etc.
  PRIMARY KEY (path)
);

-- ========================================
-- RELATIONSHIP TABLES
-- ========================================

-- Chunk contém Entity
CREATE REL TABLE CONTAINS(
  FROM Chunk TO Entity,
  confidence DOUBLE DEFAULT 1.0
);

-- Chunk relacionado a Chunk (via entidades compartilhadas)
CREATE REL TABLE RELATES_TO(
  FROM Chunk TO Chunk,
  relation_type STRING,           -- shares_entity, calls, etc.
  weight DOUBLE DEFAULT 1.0,
  shared_entities STRING[]        -- IDs das entidades compartilhadas
);

-- Entity referencia Entity
CREATE REL TABLE REFERENCES(
  FROM Entity TO Entity,
  reference_type STRING,          -- calls, imports, extends, implements
  context STRING,                 -- Snippet do código
  line_number INT64,              -- Onde ocorre
  file_path STRING                -- Qual arquivo
);

-- File contém Chunk
CREATE REL TABLE HAS_CHUNK(
  FROM File TO Chunk,
  chunk_order INT64               -- Ordem no arquivo
);

-- File importa File
CREATE REL TABLE IMPORTS(
  FROM File TO File,
  import_type STRING,             -- default, named, namespace
  imported_names STRING[]         -- Nomes específicos importados
);
```

---

## 🔄 Sync Service: Dual-Write Strategy

### **Arquitetura**

```typescript
class GraphSyncService {
  constructor(
    private lancedb: LanceDB,
    private kuzu: KuzuConnection
  ) {}
  
  // ========================================
  // Index novo arquivo
  // ========================================
  async indexFile(filePath: string, mode: IndexingMode): Promise<void> {
    // 1. Extrair chunks e entidades
    const { chunks, entities, relations } = await this.analyzeFile(filePath);
    
    // 2. DUAL WRITE
    await Promise.all([
      // LanceDB: Embeddings + metadata
      this.writeLanceDB(chunks, entities),
      
      // Kuzu: Graph structure
      this.writeKuzu(chunks, entities, relations)
    ]);
  }
  
  private async writeLanceDB(
    chunks: DocumentChunk[],
    entities: Entity[]
  ): Promise<void> {
    // 1. Gerar embeddings
    for (const chunk of chunks) {
      chunk.vector = await this.generateEmbedding(chunk.content);
    }
    
    for (const entity of entities) {
      entity.vector = await this.generateEmbedding(
        `${entity.name} ${entity.description}`
      );
    }
    
    // 2. Insert no LanceDB
    await this.lancedb.insert('document_chunks', chunks);
    await this.lancedb.insert('entities', entities);
  }
  
  private async writeKuzu(
    chunks: DocumentChunk[],
    entities: Entity[],
    relations: Relation[]
  ): Promise<void> {
    // Transaction ACID no Kuzu
    await this.kuzu.transaction(async (tx) => {
      // 1. Inserir chunks como nós
      for (const chunk of chunks) {
        await tx.query(`
          CREATE (c:Chunk {
            id: $id,
            file_path: $file_path,
            file_type: $file_type,
            line_start: $line_start,
            line_end: $line_end,
            chunk_type: $chunk_type,
            indexing_mode: $indexing_mode
          })
        `, chunk);
      }
      
      // 2. Inserir entidades como nós
      for (const entity of entities) {
        await tx.query(`
          MERGE (e:Entity {id: $id})
          ON CREATE SET 
            e.name = $name,
            e.type = $type,
            e.file_path = $file_path,
            e.scope = $scope
        `, entity);
      }
      
      // 3. Inserir relacionamentos
      for (const relation of relations) {
        if (relation.type === 'contains') {
          await tx.query(`
            MATCH (c:Chunk {id: $chunk_id})
            MATCH (e:Entity {id: $entity_id})
            CREATE (c)-[:CONTAINS {confidence: $confidence}]->(e)
          `, relation);
        } else if (relation.type === 'references') {
          await tx.query(`
            MATCH (e1:Entity {id: $source_id})
            MATCH (e2:Entity {id: $target_id})
            CREATE (e1)-[:REFERENCES {
              reference_type: $ref_type,
              context: $context,
              line_number: $line_number,
              file_path: $file_path
            }]->(e2)
          `, relation);
        }
      }
    });
  }
  
  // ========================================
  // Delete arquivo
  // ========================================
  async deleteFile(filePath: string): Promise<void> {
    // 1. Buscar IDs no LanceDB
    const chunks = await this.lancedb.query('document_chunks')
      .filter(`file_path = '${filePath}'`)
      .select(['id'])
      .execute();
    
    const entities = await this.lancedb.query('entities')
      .filter(`file_path = '${filePath}'`)
      .select(['id'])
      .execute();
    
    const chunkIds = chunks.map(c => c.id);
    const entityIds = entities.map(e => e.id);
    
    // 2. DUAL DELETE
    await Promise.all([
      // LanceDB: Delete chunks e entities
      this.deleteLanceDB(filePath),
      
      // Kuzu: Delete nós e relacionamentos
      this.deleteKuzu(chunkIds, entityIds)
    ]);
  }
  
  private async deleteLanceDB(filePath: string): Promise<void> {
    await this.lancedb.delete('document_chunks')
      .where(`file_path = '${filePath}'`)
      .execute();
    
    await this.lancedb.delete('entities')
      .where(`file_path = '${filePath}'`)
      .execute();
    
    await this.lancedb.delete('file_metadata')
      .where(`file_path = '${filePath}'`)
      .execute();
  }
  
  private async deleteKuzu(
    chunkIds: string[],
    entityIds: string[]
  ): Promise<void> {
    await this.kuzu.transaction(async (tx) => {
      // 1. Delete relacionamentos primeiro
      if (chunkIds.length > 0) {
        await tx.query(`
          MATCH (c:Chunk)-[r]-()
          WHERE c.id IN [${chunkIds.map(id => `'${id}'`).join(',')}]
          DELETE r
        `);
      }
      
      if (entityIds.length > 0) {
        await tx.query(`
          MATCH (e:Entity)-[r]-()
          WHERE e.id IN [${entityIds.map(id => `'${id}'`).join(',')}]
          DELETE r
        `);
      }
      
      // 2. Delete nós
      if (chunkIds.length > 0) {
        await tx.query(`
          MATCH (c:Chunk)
          WHERE c.id IN [${chunkIds.map(id => `'${id}'`).join(',')}]
          DELETE c
        `);
      }
      
      if (entityIds.length > 0) {
        await tx.query(`
          MATCH (e:Entity)
          WHERE e.id IN [${entityIds.map(id => `'${id}'`).join(',')}]
          DELETE e
        `);
      }
    });
  }
  
  // ========================================
  // Consistency Check
  // ========================================
  async verifyConsistency(): Promise<ConsistencyReport> {
    // 1. Contar no LanceDB
    const lancedbChunks = await this.lancedb.query('document_chunks')
      .select(['COUNT(*) as count'])
      .first();
    
    const lancedbEntities = await this.lancedb.query('entities')
      .select(['COUNT(*) as count'])
      .first();
    
    // 2. Contar no Kuzu
    const kuzuChunks = await this.kuzu.query(`
      MATCH (c:Chunk) RETURN COUNT(c) as count
    `);
    
    const kuzuEntities = await this.kuzu.query(`
      MATCH (e:Entity) RETURN COUNT(e) as count
    `);
    
    // 3. Comparar
    const consistent = 
      lancedbChunks.count === kuzuChunks.rows[0].count &&
      lancedbEntities.count === kuzuEntities.rows[0].count;
    
    return {
      consistent,
      lancedb: {
        chunks: lancedbChunks.count,
        entities: lancedbEntities.count
      },
      kuzu: {
        chunks: kuzuChunks.rows[0].count,
        entities: kuzuEntities.rows[0].count
      }
    };
  }
  
  // ========================================
  // Rebuild Kuzu from LanceDB
  // ========================================
  async rebuildKuzuFromLanceDB(): Promise<void> {
    console.log('🔄 Rebuilding Kuzu graph from LanceDB...');
    
    // 1. Clear Kuzu
    await this.kuzu.query('MATCH (n) DETACH DELETE n');
    
    // 2. Buscar todos os chunks e entities do LanceDB
    const chunks = await this.lancedb.query('document_chunks').execute();
    const entities = await this.lancedb.query('entities').execute();
    
    // 3. Reconstruir estrutura no Kuzu
    await this.writeKuzu(chunks, entities, []);
    
    // 4. Reconstruir relacionamentos (baseado em metadata)
    await this.rebuildRelationships(chunks, entities);
    
    console.log('✅ Kuzu graph rebuilt successfully');
  }
  
  private async rebuildRelationships(
    chunks: DocumentChunk[],
    entities: Entity[]
  ): Promise<void> {
    // 1. Chunk -> Entity (CONTAINS)
    for (const chunk of chunks) {
      const chunkEntities = entities.filter(
        e => e.file_path === chunk.file_path &&
             e.line_start >= chunk.line_start &&
             e.line_end <= chunk.line_end
      );
      
      for (const entity of chunkEntities) {
        await this.kuzu.query(`
          MATCH (c:Chunk {id: $chunk_id})
          MATCH (e:Entity {id: $entity_id})
          MERGE (c)-[:CONTAINS]->(e)
        `, { chunk_id: chunk.id, entity_id: entity.id });
      }
    }
    
    // 2. Chunk -> Chunk (RELATES_TO via entidades compartilhadas)
    await this.kuzu.query(`
      MATCH (c1:Chunk)-[:CONTAINS]->(e:Entity)<-[:CONTAINS]-(c2:Chunk)
      WHERE c1.id < c2.id
      WITH c1, c2, COLLECT(e.id) as shared_entities
      WHERE SIZE(shared_entities) > 0
      MERGE (c1)-[:RELATES_TO {
        relation_type: 'shares_entity',
        weight: SIZE(shared_entities),
        shared_entities: shared_entities
      }]->(c2)
    `);
  }
}
```

---

## 🔍 Query Patterns: Hybrid Search

### **Pattern 1: Semantic Search → Graph Expansion**

```typescript
async function semanticSearchWithExpansion(
  query: string,
  depth: number = 2
): Promise<any[]> {
  // 1. Busca vetorial no LanceDB (seed nodes)
  const seedChunks = await lancedb.search('document_chunks')
    .where('vector')
    .nearestTo(await generateEmbedding(query))
    .limit(5)
    .execute();
  
  const seedIds = seedChunks.map(c => c.id);
  
  // 2. Expandir no Kuzu (graph traversal)
  const expanded = await kuzu.query(`
    MATCH (seed:Chunk)
    WHERE seed.id IN [${seedIds.map(id => `'${id}'`).join(',')}]
    
    MATCH path = (seed)-[*1..${depth}]-(related:Chunk)
    
    WITH related, MIN(length(path)) as distance
    ORDER BY distance, related.file_path
    
    RETURN DISTINCT related.id, related.file_path, 
           related.line_start, distance
  `);
  
  // 3. Enriquecer com dados do LanceDB (conteúdo completo)
  const relatedIds = expanded.rows.map(r => r['related.id']);
  
  const enriched = await lancedb.query('document_chunks')
    .filter(`id IN (${relatedIds.map(id => `'${id}'`).join(',')})`)
    .execute();
  
  return enriched;
}
```

---

### **Pattern 2: Find Cross-File Dependencies**

```typescript
async function findCrossFileDependencies(
  filePath: string
): Promise<any[]> {
  // Cypher query puro no Kuzu
  const result = await kuzu.query(`
    MATCH (f1:File {path: $filePath})
    MATCH (f1)-[:HAS_CHUNK]->(c1:Chunk)
    MATCH (c1)-[:CONTAINS]->(e1:Entity)
    
    MATCH (e1)-[:REFERENCES]->(e2:Entity)
    MATCH (c2:Chunk)-[:CONTAINS]->(e2)
    MATCH (f2:File)-[:HAS_CHUNK]->(c2)
    
    WHERE f1.path <> f2.path
    
    RETURN DISTINCT 
      f2.path as dependency_file,
      e2.name as referenced_entity,
      e2.type as entity_type,
      COUNT(*) as reference_count
    ORDER BY reference_count DESC
  `, { filePath });
  
  return result.rows;
}
```

---

### **Pattern 3: Find Unused Entities**

```typescript
async function findUnusedEntities(): Promise<any[]> {
  // Kuzu: entidades sem referências
  const unused = await kuzu.query(`
    MATCH (e:Entity)
    WHERE NOT EXISTS {
      MATCH (e)<-[:REFERENCES]-()
    }
    AND e.scope = 'public'  -- Apenas públicas não usadas
    
    RETURN e.name, e.type, e.file_path, e.line_start
    ORDER BY e.file_path, e.line_start
  `);
  
  // Enriquecer com contexto do LanceDB
  const ids = unused.rows.map(r => r['e.id']);
  
  const enriched = await lancedb.query('entities')
    .filter(`id IN (${ids.map(id => `'${id}'`).join(',')})`)
    .execute();
  
  return enriched;
}
```

---

### **Pattern 4: Shortest Path Between Entities**

```typescript
async function findConnectionBetweenEntities(
  entity1: string,
  entity2: string
): Promise<any> {
  const result = await kuzu.query(`
    MATCH (e1:Entity {name: $entity1})
    MATCH (e2:Entity {name: $entity2})
    
    MATCH path = shortestPath((e1)-[*]-(e2))
    
    WITH path, 
         [node IN nodes(path) | node.name] as entity_names,
         length(path) as distance
    
    RETURN entity_names, distance
  `, { entity1, entity2 });
  
  if (result.rows.length === 0) {
    return { connected: false };
  }
  
  return {
    connected: true,
    path: result.rows[0].entity_names,
    distance: result.rows[0].distance
  };
}
```

---

## 📊 Performance Considerations

### **Query Strategy**

| Query Type | Primary DB | Secondary DB | Pattern |
|------------|-----------|--------------|---------|
| **Semantic search** | LanceDB | - | Vector similarity |
| **Entity lookup** | LanceDB | Kuzu (optional) | ID-based |
| **Graph traversal** | Kuzu | LanceDB (enrich) | Cypher + ID list |
| **Cross-file refs** | Kuzu | LanceDB (enrich) | Cypher patterns |
| **Unused code** | Kuzu | LanceDB (context) | Negative match |
| **Shortest path** | Kuzu | - | Built-in algorithm |

### **Caching Strategy**

```typescript
class HybridQueryCache {
  private cache = new Map<string, any>();
  
  async cachedQuery(
    key: string,
    ttl: number,
    queryFn: () => Promise<any>
  ): Promise<any> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    
    const data = await queryFn();
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
}
```

---

## 🎯 Migration Strategy

### **Phase 1: Setup (Sprint 2.5)**
1. Install Kuzu: `npm install kuzu`
2. Create schema (Cypher DDL)
3. Implement GraphSyncService
4. Test dual-write

### **Phase 2: Migration (Sprint 3)**
1. Populate Kuzu from existing LanceDB
2. Verify consistency
3. Enable dual-write for new files
4. Add graph queries to search

### **Phase 3: Enhancement (Sprint 4+)**
1. Add advanced Cypher queries
2. Implement graph algorithms
3. Cross-file dependency analysis
4. Code quality insights (unused code, circular deps)

---

## 📋 Dependencies Update

```json
{
  "dependencies": {
    "vectordb": "^0.4.0",
    "kuzu": "^0.0.10",
    "@xenova/transformers": "^2.6.0",
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

---

## 🎯 Conclusão

**Stack Final**:
- ✅ **LanceDB**: Vector embeddings + semantic search
- ✅ **Kuzu**: Graph database + Cypher queries
- ✅ **Sync Service**: Dual-write strategy (consistency)
- ✅ **Hybrid Queries**: Best of both worlds

**Benefícios**:
1. 🎯 **Semantic search** (LanceDB vectors)
2. 🕸️ **Graph traversal** (Kuzu Cypher)
3. 💾 **Persistence** (ambos em disco)
4. 🚀 **Performance** (otimizado em C++)
5. 📦 **Embedded** (sem servidores externos)
6. 🔒 **Consistency** (dual-write + verify)

Esta é a arquitetura definitiva para o CAPPY! 🚀
