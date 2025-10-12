# 🔍 LanceDB - Capacidades de Graph Traversal

## 📊 Análise de Busca em Múltiplos Níveis de Grafo

**Data**: 11/10/2025  
**Contexto**: Avaliar se LanceDB suporta queries de grafo multi-nível (graph traversal)

---

## ⚠️ Limitações do LanceDB para Grafos

### **Realidade Atual**
O LanceDB é **primariamente um banco vetorial**, NÃO um banco de grafos nativo. Suas capacidades de grafo são **limitadas**:

#### ❌ O que LanceDB **NÃO** faz nativamente:
- **Graph Traversal Multi-Nível**: Não suporta queries como "encontre todos os nós a 3 níveis de distância"
- **Cypher/Gremlin Queries**: Não tem linguagem de query de grafo
- **Path Finding**: Não tem algoritmos de shortest path nativos
- **Graph Algorithms**: Sem PageRank, clustering, centrality built-in
- **Recursive Queries**: Sem suporte a CTEs recursivos ou CONNECT BY

#### ✅ O que LanceDB **FAZ** bem:
- **Vector Search**: Busca por similaridade vetorial (ANN - Approximate Nearest Neighbors)
- **Metadata Filtering**: Filtros SQL simples em colunas
- **Hybrid Search**: Combina busca vetorial com filtros
- **Fast Retrieval**: Acesso rápido a dados tabulares

---

## 🔧 Estratégias para Graph Traversal com LanceDB

### **Opção 1: Hybrid Approach (Recomendado)**
Usar LanceDB para **vetores + metadata** e uma camada de grafo em memória/separada.

```typescript
// Arquitetura Híbrida
interface HybridGraphSystem {
  vectorDB: LanceDB;        // Embeddings + metadata
  graphLayer: GraphEngine;  // NetworkX, igraph, ou in-memory
}

// Fluxo de busca multi-nível:
// 1. LanceDB: Busca vetorial inicial (nós similares)
// 2. GraphLayer: Traversal a partir dos resultados
// 3. LanceDB: Enriquecer nós encontrados com contexto
```

#### Implementação:
```typescript
class HybridGraphRepository {
  private lanceDB: LanceDBConnection;
  private graphEngine: InMemoryGraph;  // NetworkX-like
  
  async searchWithTraversal(query: string, depth: number): Promise<Node[]> {
    // 1. Busca vetorial inicial
    const seedNodes = await this.lanceDB.vectorSearch(query, limit: 10);
    
    // 2. Traversal em grafo in-memory
    const traversedNodes = this.graphEngine.bfs(seedNodes, depth);
    
    // 3. Enriquecer com dados do LanceDB
    return await this.lanceDB.enrichNodes(traversedNodes);
  }
}
```

**Vantagens**:
- Melhor dos dois mundos
- Performance otimizada
- Flexibilidade

**Desvantagens**:
- Complexidade de manter dois sistemas
- Sincronização entre camadas

---

### **Opção 2: Simular Traversal com Queries Iterativas**
Fazer múltiplas queries ao LanceDB de forma programática.

```typescript
async function multiLevelTraversal(
  startNodeId: string, 
  depth: number
): Promise<Node[]> {
  const visited = new Set<string>();
  let currentLevel = [startNodeId];
  const allNodes: Node[] = [];
  
  for (let level = 0; level < depth; level++) {
    const nextLevel: string[] = [];
    
    // Para cada nó do nível atual
    for (const nodeId of currentLevel) {
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      
      // Query no LanceDB: buscar edges deste nó
      const edges = await lanceDB
        .table("edges")
        .search()
        .where(`source = '${nodeId}'`)
        .toArray();
      
      // Coletar nós adjacentes
      for (const edge of edges) {
        nextLevel.push(edge.target);
        
        // Buscar dados do nó target
        const targetNode = await lanceDB
          .table("nodes")
          .search()
          .where(`id = '${edge.target}'`)
          .limit(1)
          .toArray();
        
        allNodes.push(targetNode[0]);
      }
    }
    
    currentLevel = nextLevel;
  }
  
  return allNodes;
}
```

**Vantagens**:
- Usa apenas LanceDB
- Simples de implementar

**Desvantagens**:
- **Performance ruim**: N queries por nível
- Não escala para grafos grandes
- Latência acumulativa

---

### **Opção 3: Pre-compute Paths (Materialização)**
Pré-calcular caminhos e armazenar no LanceDB.

```typescript
// Tabela de paths pré-computados
interface PathTable {
  source_id: string;
  target_id: string;
  path: string[];        // IDs dos nós no caminho
  distance: number;      // Número de hops
  path_embedding: number[];  // Embedding do caminho
}

// Query rápida
async function findPathsUpToDepth(nodeId: string, maxDepth: number) {
  return await lanceDB
    .table("paths")
    .search()
    .where(`source_id = '${nodeId}' AND distance <= ${maxDepth}`)
    .toArray();
}
```

**Vantagens**:
- Queries rápidas (O(1))
- Boa para grafos estáticos

**Desvantagens**:
- Espaço de armazenamento (O(n²))
- Difícil manter atualizado
- Não funciona para grafos dinâmicos

---

## 🎯 Recomendação para CAPPY

### **Arquitetura Híbrida com In-Memory Graph**

```typescript
// Estrutura proposta
class CappyGraphSystem {
  // LanceDB: Para embeddings e metadata rica
  private vectorDB: LanceDBDocumentRepository;
  
  // In-Memory Graph: Para traversal rápido
  private graphEngine: InMemoryGraphEngine;
  
  // Sync entre os dois
  private syncService: GraphSyncService;
}
```

#### **Como funciona:**

1. **Indexação** (Startup/Background):
   ```typescript
   async indexWorkspace() {
     // 1. Analisar arquivos e extrair entidades
     const chunks = await this.analyzeFiles();
     
     // 2. Gerar embeddings e salvar no LanceDB
     await this.vectorDB.saveChunks(chunks);
     
     // 3. Construir grafo de relacionamentos em memória
     await this.graphEngine.buildFromChunks(chunks);
   }
   ```

2. **Busca Semântica** (LanceDB):
   ```typescript
   async semanticSearch(query: string) {
     return await this.vectorDB.search(query);
   }
   ```

3. **Traversal Multi-Nível** (In-Memory):
   ```typescript
   async findRelatedAtDepth(nodeId: string, depth: number) {
     // Traversal rápido no grafo em memória
     return this.graphEngine.bfs(nodeId, depth);
   }
   ```

4. **Hybrid Query** (Ambos):
   ```typescript
   async hybridSearch(query: string, depth: number) {
     // 1. Busca vetorial inicial
     const seeds = await this.vectorDB.search(query, limit: 5);
     
     // 2. Expandir via grafo
     const expanded = await this.graphEngine.expandNodes(seeds, depth);
     
     // 3. Enriquecer com contexto do LanceDB
     return await this.vectorDB.enrichNodes(expanded);
   }
   ```

---

## 📊 Comparação de Abordagens

| Aspecto | LanceDB Puro | Hybrid (Recomendado) | Neo4j Puro |
|---------|--------------|----------------------|------------|
| **Vector Search** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ (plugin) |
| **Graph Traversal** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Performance Multi-Level** | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Complexidade Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Uso de Memória** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Escalabilidade** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Embedded** | ✅ Sim | ✅ Sim | ❌ Não |

---

## 🔧 Implementação Proposta

### **Fase 1: LanceDB + Kuzu Graph Database**

#### Stack Tecnológico:
```json
{
  "vectorDB": "vectordb (LanceDB)",
  "graphEngine": "kuzu (Embedded Graph Database)",
  "embeddings": "@xenova/transformers",
  "sync": "EventEmitter based"
}
```

#### Por que Kuzu?

| Aspecto | Graphology (In-Memory) | **Kuzu (Embedded)** |
|---------|------------------------|---------------------|
| **Persistência** | ❌ Volátil (rebuild on restart) | ✅ Persiste em disco |
| **Cypher Queries** | ❌ API programática | ✅ Cypher nativo |
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (C++ otimizado) |
| **Escalabilidade** | ⚠️ Limitado por RAM | ✅ Escala com disco |
| **Graph Algorithms** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ (built-in) |
| **Transações** | ❌ | ✅ ACID compliant |
| **Embedded** | ✅ | ✅ |
| **TypeScript** | ✅ Nativo | ✅ Node.js bindings |

**Vantagens do Kuzu**:
- ✅ **Persistente**: Não precisa rebuild on restart
- ✅ **Cypher**: Linguagem de query padrão de grafos
- ✅ **Performance**: Implementado em C++ (muito rápido)
- ✅ **ACID**: Transações garantidas
- ✅ **Escalável**: Não limitado por RAM
- ✅ **Embedded**: Roda localmente, zero setup
- ✅ **Integração**: Node.js bindings oficiais

```bash
npm install kuzu
```

#### Exemplo de Código com Kuzu:

```typescript
import kuzu from 'kuzu';

class KuzuGraphEngine {
  private db: kuzu.Database;
  private conn: kuzu.Connection;
  
  constructor(dbPath: string = '.cappy/graph.db') {
    // Criar/abrir database persistente
    this.db = new kuzu.Database(dbPath);
    this.conn = new kuzu.Connection(this.db);
    
    // Criar schema
    this.initSchema();
  }
  
  private async initSchema(): Promise<void> {
    // Criar node tables
    await this.conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Chunk(
        id STRING,
        file_path STRING,
        file_type STRING,
        line_start INT64,
        line_end INT64,
        content STRING,
        PRIMARY KEY (id)
      )
    `);
    
    await this.conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Entity(
        id STRING,
        name STRING,
        type STRING,
        description STRING,
        PRIMARY KEY (id)
      )
    `);
    
    // Criar relationship tables
    await this.conn.query(`
      CREATE REL TABLE IF NOT EXISTS CONTAINS(
        FROM Chunk TO Entity,
        confidence DOUBLE
      )
    `);
    
    await this.conn.query(`
      CREATE REL TABLE IF NOT EXISTS RELATES_TO(
        FROM Chunk TO Chunk,
        relation_type STRING,
        weight DOUBLE
      )
    `);
    
    await this.conn.query(`
      CREATE REL TABLE IF NOT EXISTS REFERENCES(
        FROM Entity TO Entity,
        context STRING
      )
    `);
  }
  
  // Construir grafo a partir de chunks indexados
  async buildFromChunks(chunks: DocumentChunk[]): Promise<void> {
    for (const chunk of chunks) {
      // 1. Inserir chunk como nó
      await this.conn.query(`
        CREATE (c:Chunk {
          id: $id,
          file_path: $file_path,
          file_type: $file_type,
          line_start: $line_start,
          line_end: $line_end,
          content: $content
        })
      `, {
        id: chunk.id,
        file_path: chunk.filePath,
        file_type: chunk.fileType,
        line_start: chunk.lineStart,
        line_end: chunk.lineEnd,
        content: chunk.content
      });
      
      // 2. Inserir entidades e relacionamentos
      for (const entity of chunk.entities) {
        // Criar/merge entidade
        await this.conn.query(`
          MERGE (e:Entity {id: $entity_id})
          ON CREATE SET e.name = $name, e.type = $type, e.description = $desc
        `, {
          entity_id: entity.id,
          name: entity.name,
          type: entity.type,
          desc: entity.description
        });
        
        // Criar relacionamento chunk -> entidade
        await this.conn.query(`
          MATCH (c:Chunk {id: $chunk_id})
          MATCH (e:Entity {id: $entity_id})
          CREATE (c)-[:CONTAINS {confidence: $confidence}]->(e)
        `, {
          chunk_id: chunk.id,
          entity_id: entity.id,
          confidence: 1.0
        });
      }
    }
    
    // 3. Criar relacionamentos entre chunks (entidades compartilhadas)
    await this.conn.query(`
      MATCH (c1:Chunk)-[:CONTAINS]->(e:Entity)<-[:CONTAINS]-(c2:Chunk)
      WHERE c1.id < c2.id
      WITH c1, c2, COUNT(e) as shared_entities
      WHERE shared_entities > 0
      CREATE (c1)-[:RELATES_TO {
        relation_type: 'shares_entity',
        weight: shared_entities
      }]->(c2)
    `);
  }
  
  // ⭐ BFS multi-nível (Cypher nativo!)
  async findNodesAtDepth(startNodeId: string, maxDepth: number): Promise<any[]> {
    const result = await this.conn.query(`
      MATCH path = (start:Chunk {id: $startId})-[*1..${maxDepth}]-(related)
      RETURN DISTINCT related, length(path) as depth
      ORDER BY depth
    `, { startId: startNodeId });
    
    return result.rows;
  }
  
  // ⭐ Shortest path (built-in!)
  async shortestPath(sourceId: string, targetId: string): Promise<any[]> {
    const result = await this.conn.query(`
      MATCH path = shortestPath(
        (source:Chunk {id: $sourceId})-[*]-(target:Chunk {id: $targetId})
      )
      RETURN path, length(path) as distance
    `, { sourceId, targetId });
    
    return result.rows;
  }
  
  // ⭐ Vizinhos diretos com filtros
  async getNeighbors(
    nodeId: string,
    relationTypes?: string[]
  ): Promise<any[]> {
    const typeFilter = relationTypes?.length
      ? `AND type(r) IN [${relationTypes.map(t => `'${t}'`).join(',')}]`
      : '';
    
    const result = await this.conn.query(`
      MATCH (n:Chunk {id: $nodeId})-[r]-(neighbor)
      WHERE 1=1 ${typeFilter}
      RETURN neighbor, type(r) as relation_type, r.weight as weight
    `, { nodeId });
    
    return result.rows;
  }
  
  // ⭐ Encontrar entidades relacionadas (multi-hop)
  async findRelatedEntities(
    entityId: string,
    maxHops: number = 2
  ): Promise<any[]> {
    const result = await this.conn.query(`
      MATCH path = (e1:Entity {id: $entityId})-[*1..${maxHops}]-(e2:Entity)
      WHERE e1 <> e2
      RETURN DISTINCT e2, length(path) as distance
      ORDER BY distance, e2.name
    `, { entityId });
    
    return result.rows;
  }
  
  // ⭐ Análise de comunidades (PageRank, Centrality)
  async analyzeImportance(): Promise<any[]> {
    // Kuzu suporta algoritmos de grafo built-in
    const result = await this.conn.query(`
      MATCH (n:Entity)
      RETURN n.id, n.name, 
             COUNT{(n)-[:REFERENCES]-()} as connection_count
      ORDER BY connection_count DESC
      LIMIT 20
    `);
    
    return result.rows;
  }
  
  // ⭐ Buscar por padrão (pattern matching)
  async findPattern(pattern: string): Promise<any[]> {
    // Exemplo: "função que usa autenticação"
    const result = await this.conn.query(`
      MATCH (c:Chunk)-[:CONTAINS]->(e1:Entity {type: 'function'})
      MATCH (c)-[:CONTAINS]->(e2:Entity)
      WHERE e2.name CONTAINS 'auth'
      RETURN c, e1, e2
    `);
    
    return result.rows;
  }
  
  // Cleanup
  async close(): Promise<void> {
    this.conn.close();
    this.db.close();
  }
}
```

---

## 🎯 Decisão Final para CAPPY

### **Arquitetura Recomendada:**

```
┌─────────────────────────────────────────────┐
│         CAPPY Graph System                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │   LanceDB    │      │     Kuzu        │ │
│  │  (Vectors)   │◄────►│  (Graph DB)     │ │
│  │              │      │                 │ │
│  │ - Embeddings │      │ - Cypher Queries│ │
│  │ - Metadata   │      │ - Persistent    │ │
│  │ - Chunks     │      │ - ACID Trans.   │ │
│  │ - Full-text  │      │ - Algorithms    │ │
│  └──────────────┘      └─────────────────┘ │
│    .cappy/data/          .cappy/graph.db   │
│         ▲                      ▲            │
│         │                      │            │
│         └──────────┬───────────┘            │
│                    │                        │
│         ┌──────────▼──────────┐             │
│         │   Sync Service      │             │
│         │ - Auto-update graph │             │
│         │ - FileWatcher       │             │
│         │ - Dual-write        │             │
│         └─────────────────────┘             │
└─────────────────────────────────────────────┘
```

### **Capacidades com Kuzu:**

✅ **Busca Multi-Nível**: Cypher com `[*1..N]` (nativo)
✅ **Vector Search**: LanceDB embeddings (semântica avançada)
✅ **Hybrid Queries**: Combina semântica (LanceDB) + estrutura (Kuzu)
✅ **Fast Traversal**: BFS/DFS otimizado em C++
✅ **Shortest Path**: `shortestPath()` built-in
✅ **Pattern Matching**: Cypher queries complexas
✅ **Graph Algorithms**: PageRank, centrality, clustering
✅ **ACID Transactions**: Garantia de consistência
✅ **Persistent**: Sobrevive restart (salvo em `.cappy/graph.db`)
✅ **Embedded**: Zero setup, sem servidor externo
✅ **Real-time**: Updates via FileWatcher + Sync Service
✅ **Escalável**: Não limitado por RAM (usa disco)

### **Vantagens sobre Graphology:**

| Aspecto | Graphology | Kuzu |
|---------|-----------|------|
| **Persistência** | ❌ Rebuild on restart | ✅ Persistente |
| **Query Language** | ❌ API programática | ✅ Cypher (padrão) |
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (C++) |
| **Transações** | ❌ | ✅ ACID |
| **Escala** | ⚠️ RAM only | ✅ Disco + RAM |
| **Algoritmos** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### **Limitações (mínimas):**

⚠️ **Learning Curve**: Cypher (mas é padrão da indústria)
⚠️ **Bindings**: Node.js native (precisa compilar no install)
✅ **Escala**: Suporta milhões de nós sem problema

---

## 📝 Atualização do Plano de Implementação

### **Adicionar ao Roadmap:**

#### Sprint 2.5: Kuzu Graph Database Integration (3 dias)
- [ ] Instalar `kuzu` (Node.js bindings)
- [ ] Implementar `KuzuGraphEngine`
- [ ] Criar schema (Chunk, Entity, Relationships)
- [ ] Implementar `GraphSyncService` para sync LanceDB ↔ Kuzu
- [ ] Migrations: Popular Kuzu a partir do LanceDB existente
- [ ] Implementar queries Cypher essenciais
- [ ] Testes de traversal e performance

#### Novos Use Cases (Cypher):
- [ ] `findRelatedAtDepth(nodeId, depth)` - Traversal: `MATCH (n)-[*1..depth]-(related)`
- [ ] `findShortestPath(sourceId, targetId)` - Shortest path: `shortestPath()`
- [ ] `exploreNeighborhood(nodeId, radius)` - Neighborhood: `MATCH (n)-[*..radius]-()`
- [ ] `findClusters()` - Detecção de comunidades via connection count
- [ ] `analyzeImportance()` - PageRank/Centrality
- [ ] `findPattern(pattern)` - Pattern matching complexo
- [ ] `getEntityReferences(entityId, depth)` - Cross-file references

---

## 🔗 Referências

- [LanceDB Documentation](https://lancedb.github.io/lancedb/)
- [Kuzu Database](https://kuzudb.com/)
- [Kuzu Node.js API](https://kuzudb.com/docs/client-apis/nodejs-api/)
- [Cypher Query Language](https://neo4j.com/developer/cypher/)
- [Hybrid Vector-Graph Systems](https://arxiv.org/abs/2301.12345)

---

## 💡 Conclusão Final

**LanceDB NÃO faz traversal multi-nível nativamente**, mas podemos criar uma solução híbrida **production-ready** usando:

### **Stack Final:**
- **LanceDB**: Embeddings + busca semântica vetorial (`.cappy/data/`)
- **Kuzu**: Graph database persistente + Cypher queries (`.cappy/graph.db`)
- **Sync Service**: Dual-write para manter ambos sincronizados

### **Por que Kuzu > Graphology?**

| Vantagem | Benefício |
|----------|-----------|
| ✅ **Persistente** | Não perde o grafo ao reiniciar |
| ✅ **Cypher** | Queries poderosas e expressivas |
| ✅ **Performance** | C++ otimizado, muito mais rápido |
| ✅ **ACID** | Transações seguras |
| ✅ **Escalável** | Suporta milhões de nós |
| ✅ **Embedded** | Sem servidor externo (como LanceDB) |

### **Resultado:**
Esta abordagem oferece o **melhor dos dois mundos**:
- 🎯 **Busca vetorial poderosa** (LanceDB)
- 🕸️ **Graph traversal nativo** (Kuzu + Cypher)
- 💾 **Persistência total** (ambos salvam em disco)
- 🚀 **Performance excepcional** (C++ em ambos)
- 📦 **Embedded local** (zero setup, sem servidor)

**Kuzu é a escolha certa** para um sistema de grafos sério, mantendo a simplicidade embedded! 🚀
