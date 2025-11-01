# Fix: Graph Vazio com Chunks no Vector

## 🐛 Problema Identificado

O `ExportGraphUseCase` e `LoadGraphDataUseCase` **não validam se o grafo está vazio** mesmo havendo dados na tabela `vectors`. 

### Cenário do Bug

1. ✅ Há chunks na tabela `vectors` (conteúdo indexado)
2. ❌ Tabela `nodes` está vazia ou não tem nós dos chunks
3. ❌ `getSubgraph()` retorna `{ nodes: [], edges: [] }`
4. ❌ Validação apenas verifica se arrays existem, não se estão vazios
5. ❌ Export/Load prosseguem com grafo vazio

## 🔍 Análise do Código

### ExportGraphUseCase.ts (Linha 599-615)

```typescript
private validateInput(data: GraphData, options: ExportGraphOptions): void {
  if (!data) {
    throw new Error('Graph data is required');
  }
  
  if (!data.nodes || !data.edges) {
    throw new Error('Graph data must contain nodes and edges arrays');
  }
  
  // ❌ NÃO VALIDA SE OS ARRAYS ESTÃO VAZIOS!
  
  if (options.indent !== undefined) {
    if (!Number.isInteger(options.indent) || options.indent < 0) {
      throw new Error('Indent must be a non-negative integer');
    }
  }
}
```

### LoadGraphDataUseCase.ts (Linha 195-212)

```typescript
private validateLoadedData(data: GraphData): void {
  if (!data) {
    throw new Error('Repository returned null or undefined data');
  }
  
  if (!data.nodes || !data.edges) {
    throw new Error('Loaded data is missing nodes or edges collections');
  }
  
  // ❌ NÃO VALIDA SE OS ARRAYS ESTÃO VAZIOS!
}
```

### SQLiteAdapter.ts getSubgraph (Linha 303-475)

```typescript
async getSubgraph(
  seeds: string[] | undefined,
  depth: number,
  maxNodes = 1000
): Promise<{
  nodes: Array<{...}>;
  edges: Array<{...}>;
}> {
  if (!this.db) throw new Error("SQLite not initialized");

  const nodes: Array<...> = [];  // ✅ Inicializa vazio
  const edges: Array<...> = [];  // ✅ Inicializa vazio
  
  // Se não há seeds, buscar todos os nós até o limite
  if (!seeds || seeds.length === 0) {
    const allNodes = await this.all<...>(
      `SELECT id, label, type, ... FROM nodes 
       ORDER BY ... LIMIT ?`,
      [maxNodes]
    );
    
    // ⚠️ Se tabela nodes está vazia, allNodes.length === 0
    // ⚠️ Retorna { nodes: [], edges: [] } sem erro!
    
    console.log(`Found ${allNodes.length} nodes`);
  }
  
  return { nodes, edges };  // ❌ Pode retornar vazio!
}
```

## 🎯 Raiz do Problema

**A tabela `nodes` pode estar vazia mesmo com chunks em `vectors` porque:**

1. **Scan incompleto**: O scan não criou nós para os chunks
2. **Migração falhou**: Migração de dados não completou
3. **Inconsistência**: Chunks foram adicionados mas nós não
4. **Rollback**: Uma operação falhou e deixou dados inconsistentes

## ✅ Solução

### 1. Adicionar Validação de Grafo Vazio

#### Em ExportGraphUseCase.ts

```typescript
private validateInput(data: GraphData, options: ExportGraphOptions): void {
  if (!data) {
    throw new Error('Graph data is required');
  }
  
  if (!data.nodes || !data.edges) {
    throw new Error('Graph data must contain nodes and edges arrays');
  }
  
  // ✅ NOVO: Validar se grafo está vazio
  if (data.nodes.length === 0) {
    throw new Error(
      'Graph has no nodes. Please run workspace scan to index files first.'
    );
  }
}
```

#### Em LoadGraphDataUseCase.ts

```typescript
private validateLoadedData(data: GraphData): void {
  if (!data) {
    throw new Error('Repository returned null or undefined data');
  }
  
  if (!data.nodes || !data.edges) {
    throw new Error('Loaded data is missing nodes or edges collections');
  }
  
  // ✅ NOVO: Validar se grafo está vazio
  if (data.nodes.length === 0) {
    throw new Error(
      'Loaded graph has no nodes. Database may be empty or corrupted. ' +
      'Please run workspace scan to rebuild the graph.'
    );
  }
}
```

### 2. Adicionar Verificação de Consistência

#### Em SQLiteAdapter.ts

```typescript
async getSubgraph(...): Promise<{...}> {
  if (!this.db) throw new Error("SQLite not initialized");

  const nodes: Array<...> = [];
  const edges: Array<...> = [];
  const visited = new Set<string>();

  // Se não há seeds, buscar todos os nós até o limite
  if (!seeds || seeds.length === 0) {
    const allNodes = await this.all<...>(
      `SELECT id, label, type, ... FROM nodes 
       ORDER BY ... LIMIT ?`,
      [maxNodes]
    );
    
    // ✅ NOVO: Verificar consistência com vectors
    if (allNodes.length === 0) {
      // Verificar se há dados em vectors
      const vectorCount = await this.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM vectors',
        []
      );
      
      if (vectorCount && vectorCount.count > 0) {
        console.warn(
          `⚠️ Inconsistency detected: ${vectorCount.count} vectors found ` +
          `but no nodes in graph. Database may be corrupted.`
        );
        throw new Error(
          `Graph is empty but ${vectorCount.count} vectors exist. ` +
          `Database inconsistency detected. Please run workspace scan to rebuild.`
        );
      }
      
      console.log('[SQLiteAdapter] No nodes found in empty database');
    }
    
    console.log(`Found ${allNodes.length} nodes`);
    // ... resto do código
  }
  
  return { nodes, edges };
}
```

### 3. Adicionar Comando de Diagnóstico

```typescript
/**
 * Diagnoses graph consistency issues
 * Returns info about database state
 */
async diagnoseConsistency(): Promise<{
  nodesCount: number;
  edgesCount: number;
  vectorsCount: number;
  chunksWithoutNodes: number;
  isConsistent: boolean;
  issues: string[];
}> {
  if (!this.db) throw new Error("SQLite not initialized");
  
  const nodesCount = await this.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM nodes',
    []
  );
  
  const edgesCount = await this.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM edges',
    []
  );
  
  const vectorsCount = await this.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM vectors',
    []
  );
  
  // Verificar chunks sem nós correspondentes
  const orphanChunks = await this.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM vectors v
     WHERE NOT EXISTS (
       SELECT 1 FROM nodes n WHERE n.id = v.rowid
     )`,
    []
  );
  
  const issues: string[] = [];
  
  if (nodesCount!.count === 0 && vectorsCount!.count > 0) {
    issues.push(
      `No nodes but ${vectorsCount!.count} vectors exist`
    );
  }
  
  if (orphanChunks!.count > 0) {
    issues.push(
      `${orphanChunks!.count} vectors without corresponding nodes`
    );
  }
  
  return {
    nodesCount: nodesCount!.count,
    edgesCount: edgesCount!.count,
    vectorsCount: vectorsCount!.count,
    chunksWithoutNodes: orphanChunks!.count,
    isConsistent: issues.length === 0,
    issues
  };
}
```

## 🧪 Testes

### Teste 1: Grafo Vazio com Vectors

```typescript
it('should throw error when graph is empty but vectors exist', async () => {
  // Setup: Database com vectors mas sem nodes
  await db.run('DELETE FROM nodes');
  await db.run('INSERT INTO vectors (embedding, metadata) VALUES (?, ?)', [...]);
  
  // Test
  await expect(
    adapter.getSubgraph(undefined, 0, 1000)
  ).rejects.toThrow('Graph is empty but');
});
```

### Teste 2: ExportGraphUseCase com Grafo Vazio

```typescript
it('should throw error when exporting empty graph', async () => {
  const emptyGraph: GraphData = {
    nodes: [],
    edges: [],
    lastUpdated: new Date().toISOString()
  };
  
  await expect(
    useCase.execute(emptyGraph)
  ).rejects.toThrow('Graph has no nodes');
});
```

### Teste 3: LoadGraphDataUseCase com Grafo Vazio

```typescript
it('should throw error when loading empty graph', async () => {
  const mockRepo: GraphRepository = {
    loadGraphData: jest.fn().mockResolvedValue({
      nodes: [],
      edges: [],
      lastUpdated: new Date().toISOString()
    })
  };
  
  const useCase = new LoadGraphDataUseCase(mockRepo);
  
  await expect(
    useCase.execute()
  ).rejects.toThrow('Loaded graph has no nodes');
});
```

## 📋 Checklist de Implementação

- [ ] Adicionar validação em `ExportGraphUseCase.validateInput()`
- [ ] Adicionar validação em `LoadGraphDataUseCase.validateLoadedData()`
- [ ] Adicionar verificação de consistência em `SQLiteAdapter.getSubgraph()`
- [ ] Adicionar método `diagnoseConsistency()` em `SQLiteAdapter`
- [ ] Adicionar testes unitários para validações
- [ ] Adicionar testes de integração para consistência
- [ ] Atualizar documentação com erros possíveis
- [ ] Adicionar comando de diagnóstico na UI

## 🎯 Benefícios

1. **Detecção Precoce**: Erros detectados antes de tentar usar grafo vazio
2. **Mensagens Claras**: Usuário sabe exatamente o que fazer (run scan)
3. **Consistência**: Detecta e reporta inconsistências no banco
4. **Debugging**: Comando de diagnóstico ajuda a identificar problemas
5. **Prevenção**: Evita operações inúteis em grafo vazio

## 📚 Referências

- `src/domains/dashboard/use-cases/ExportGraphUseCase.ts`
- `src/domains/dashboard/use-cases/LoadGraphDataUseCase.ts`
- `src/nivel2/infrastructure/database/sqlite-adapter.ts`

---

**Status**: 🔴 Não implementado  
**Prioridade**: 🔴 Alta  
**Impacto**: Consistência de dados e UX
