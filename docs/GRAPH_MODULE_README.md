# 📊 Graph Module

Sistema completo de grafos de conhecimento para o Cappy, implementado com Clean Architecture.

## 🎯 Visão Geral

O módulo de Graph permite:

- 📥 **Carregar** dados de grafo do LanceDB
- 🔍 **Buscar** nodes e edges (fuzzy, exact, regex, semantic)
- 🎯 **Filtrar** por tipos, confiança, datas, conexões
- 🌳 **Expandir** vizinhança de nodes com BFS
- 📊 **Calcular** métricas (PageRank, Betweenness, Clustering)
- 💾 **Exportar** em múltiplos formatos (JSON, GraphML, GEXF, DOT, CSV, Cytoscape)

## 📁 Estrutura

```
src/
├── domains/graph/              # Domain Layer (entidades, ports)
│   ├── entities/              # GraphNode, GraphEdge, GraphData
│   ├── ports/                 # Interfaces (Repository, Services)
│   ├── types/                 # TypeScript interfaces
│   └── use-cases/             # Lógica de negócio
│       ├── LoadGraphDataUseCase.ts
│       ├── FilterGraphUseCase.ts
│       ├── ExpandNodeUseCase.ts
│       ├── CalculateMetricsUseCase.ts
│       ├── SearchGraphUseCase.ts
│       └── ExportGraphUseCase.ts
│
├── adapters/secondary/graph/   # Infrastructure Layer
│   └── lancedb-graph-repository.ts
│
└── services/                   # Application Services
    └── graph-service.ts
```

## 🚀 Quick Start

### 1. Setup

```typescript
import { createLanceDBAdapter } from './adapters/secondary/vector/lancedb-adapter';
import { createLanceDBGraphRepository } from './adapters/secondary/graph';
import { createGraphService } from './services/graph-service';
import { EmbeddingService } from './services/embedding-service';

// Setup dependencies
const embeddingService = new EmbeddingService();
const vectorStore = createLanceDBAdapter('path/to/db', embeddingService);
await vectorStore.initialize();

// Create repository and service
const repository = createLanceDBGraphRepository({ vectorStore });
await repository.initialize();

const graphService = createGraphService({ repository });
```

### 2. Load Graph

```typescript
// Load all data
const result = await graphService.loadGraph();
console.log(`Loaded ${result.metadata.nodeCount} nodes, ${result.metadata.edgeCount} edges`);
console.log(`Time: ${result.metadata.loadTimeMs}ms`);

// Load with filters
const filtered = await graphService.loadGraph({
  filter: {
    nodeTypes: ['document', 'entity'],
    minConfidence: 0.8
  },
  maxNodes: 100
});
```

### 3. Search

```typescript
// Fuzzy search (default)
const fuzzy = await graphService.search(result.data, 'authentication', {
  mode: 'fuzzy',
  minScore: 0.5,
  maxResults: 20
});

// Exact search
const exact = await graphService.search(result.data, 'getUserById', {
  mode: 'exact',
  searchLabels: true,
  searchIds: true
});

// Regex search
const regex = await graphService.search(result.data, 'get.*User', {
  mode: 'regex'
});

// With related nodes
const withContext = await graphService.searchAndExpand(
  result.data,
  'database',
  { relatedDepth: 2 }
);

console.log(`Found ${withContext.results.length} matches`);
console.log('Top result:', withContext.results[0]);
```

### 4. Filter

```typescript
const filtered = await graphService.filterGraph(result.data, {
  nodeTypes: ['document', 'chunk'],
  edgeTypes: ['contains'],
  minConfidence: 0.9,
  minConnections: 3,
  dateRange: {
    start: '2024-01-01T00:00:00Z',
    end: '2024-12-31T23:59:59Z'
  },
  searchQuery: 'auth'
});

console.log(`Filtered to ${filtered.data.nodes.length} nodes`);
console.log('Applied filters:', filtered.metadata.appliedFilters);
```

### 5. Expand Node

```typescript
const expanded = await graphService.expandNode(
  result.data,
  'doc:src/api/auth.ts',
  {
    depth: 2,
    maxNeighborsPerLevel: 10,
    direction: 'both', // 'incoming' | 'outgoing' | 'both'
    minConfidence: 0.7
  }
);

console.log(`Expanded to ${expanded.metadata.nodeCount} nodes`);
console.log('Nodes by depth:', expanded.metadata.nodesByDepth);
// { 0: ['center-node'], 1: ['neighbor1', 'neighbor2'], 2: [...] }
```

### 6. Calculate Metrics

```typescript
const withMetrics = await graphService.calculateMetrics(result.data, {
  includePageRank: true,
  includeBetweenness: false, // Expensive! O(n³)
  includeClustering: true,
  dampingFactor: 0.85,
  maxIterations: 100
});

// PageRank results
console.log('PageRank converged:', withMetrics.metadata.pageRankStats?.converged);
console.log('Top nodes by PageRank:', withMetrics.metadata.pageRankStats?.topNodes);

// Clustering results
console.log('Avg clustering:', withMetrics.metadata.clusteringStats?.average);

// Metrics are now in each node
for (const node of withMetrics.data.nodes) {
  console.log(`${node.label}:`, {
    pageRank: node.metrics.pageRank,
    clustering: node.metrics.clustering,
    centrality: node.metrics.centrality
  });
}
```

### 7. Export

```typescript
// Export to JSON
const json = await graphService.export(result.data, {
  format: 'json',
  prettyPrint: true,
  includeMetadata: true
});
console.log('Exported JSON:', json.metadata.sizeBytes, 'bytes');

// Export to GraphML
const graphml = await graphService.export(result.data, {
  format: 'graphml'
});

// Export to CSV (returns multiple files)
const csv = await graphService.export(result.data, {
  format: 'csv'
});
console.log('Nodes CSV:', csv.data);
console.log('Edges CSV:', csv.additionalFiles?.['edges.csv']);

// Export to other formats
const formats = ['cytoscape', 'gexf', 'dot'];
for (const format of formats) {
  const exported = await graphService.export(result.data, { format });
  console.log(`${format}:`, exported.metadata.fileExtension);
}
```

### 8. Convenience Methods

```typescript
// Load and process in one go
const processed = await graphService.loadAndProcess(
  { maxNodes: 500 },
  { nodeTypes: ['document', 'entity'] },
  true // calculate metrics
);

// Get statistics without loading full data
const stats = await graphService.getStatistics();
console.log('Total nodes:', stats.totalNodes);
console.log('Nodes by type:', stats.nodesByType);
console.log('Avg confidence:', stats.avgConfidence);
console.log('Graph density:', stats.density);
```

## 📊 Use Cases

### LoadGraphDataUseCase

Carrega dados do repositório com opções de filtragem.

**Options:**
- `filter?: GraphFilter` - Filtro aplicado no repository
- `includeDeleted?: boolean` - Incluir nodes/edges deletados
- `maxNodes?: number` - Limitar número de nodes
- `includeEdges?: boolean` - Incluir edges

**Returns:**
- `data: GraphData` - Dados do grafo
- `metadata` - Contadores e tempo de execução

### FilterGraphUseCase

Filtra dados do grafo por múltiplos critérios.

**Options:**
- `nodeTypes?: NodeType[]` - Tipos de nodes
- `edgeTypes?: EdgeType[]` - Tipos de edges
- `minConfidence?: number` - Confiança mínima (0-1)
- `minConnections?: number` - Conexões mínimas
- `dateRange?: { start, end }` - Range de datas
- `searchQuery?: string` - Busca textual

**Returns:**
- `data: GraphData` - Dados filtrados
- `metadata` - Contadores originais/filtrados e filtros aplicados

### ExpandNodeUseCase

Expande vizinhança de um nó com BFS.

**Options:**
- `depth?: number` - Profundidade máxima
- `maxNeighborsPerLevel?: number` - Limite por nível
- `direction?: 'incoming' | 'outgoing' | 'both'`
- `minConfidence?: number`
- `includeNodeTypes?: string[]`
- `includeEdgeTypes?: string[]`

**Returns:**
- `subgraph: GraphData` - Subgrafo expandido
- `metadata.nodesByDepth` - Nodes organizados por profundidade

### CalculateMetricsUseCase

Calcula métricas do grafo.

**Options:**
- `includePageRank?: boolean` - PageRank (padrão: true)
- `includeBetweenness?: boolean` - Betweenness Centrality (padrão: false, caro!)
- `includeClustering?: boolean` - Clustering Coefficient (padrão: true)
- `dampingFactor?: number` - Damping do PageRank (padrão: 0.85)
- `maxIterations?: number` - Iterações máximas (padrão: 100)
- `convergenceThreshold?: number` - Threshold de convergência (padrão: 0.0001)

**Returns:**
- `data: GraphData` - Dados com métricas calculadas
- `metadata.pageRankStats` - Estatísticas do PageRank
- `metadata.clusteringStats` - Estatísticas de clustering

### SearchGraphUseCase

Busca no grafo com múltiplos modos.

**Options:**
- `mode?: 'fuzzy' | 'exact' | 'regex' | 'semantic'`
- `searchLabels?: boolean`
- `searchIds?: boolean`
- `searchMetadata?: boolean`
- `minScore?: number`
- `maxResults?: number`
- `caseSensitive?: boolean`
- `includeRelated?: boolean`
- `relatedDepth?: number`

**Returns:**
- `results: SearchResultItem[]` - Resultados com score
- `subgraph?: GraphData` - Subgrafo com resultados relacionados
- `metadata` - Estatísticas da busca

### ExportGraphUseCase

Exporta grafo em múltiplos formatos.

**Options:**
- `format?: 'json' | 'graphml' | 'cytoscape' | 'gexf' | 'dot' | 'csv'`
- `includeMetadata?: boolean`
- `includeVisual?: boolean`
- `includeMetrics?: boolean`
- `prettyPrint?: boolean`

**Returns:**
- `data: string` - Dados exportados
- `additionalFiles?: Record<string, string>` - Arquivos adicionais (CSV)
- `metadata` - Formato, tamanho, MIME type, extensão

## 🏗️ Arquitetura

### Clean Architecture (Hexagonal)

```
┌─────────────────────────────────────────────┐
│         Presentation Layer                  │
│  (React Components - TODO)                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Application Services                │
│  GraphService (Orchestration)               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Use Cases (Business Logic)          │
│  Load, Filter, Expand, Metrics,             │
│  Search, Export                             │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Domain Layer                        │
│  Entities: GraphNode, GraphEdge, GraphData  │
│  Ports: GraphRepository, Services           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Infrastructure Layer                │
│  LanceDBGraphRepository                     │
│  LanceDBAdapter (Vector Store)              │
└─────────────────────────────────────────────┘
```

### Dependency Injection

```typescript
// All dependencies are injected via constructors
const vectorStore = createLanceDBAdapter(dbPath, embeddingService);
const repository = createLanceDBGraphRepository({ vectorStore });
const graphService = createGraphService({ repository });

// Easy to mock for tests
const mockRepository: GraphRepository = {
  loadGraphData: async () => mockGraphData,
  // ...
};
const testService = createGraphService({ repository: mockRepository });
```

## 📖 Tipos Principais

### GraphNode

```typescript
interface GraphNode {
  id: string;
  label: string;
  type: NodeType; // 'document' | 'entity' | 'chunk' | 'concept' | 'keyword'
  created: string;
  updated: string;
  confidence: number; // 0-1
  
  position?: { x: number; y: number; z?: number };
  visual: VisualProperties;
  state: ElementState;
  connections: ConnectionMetrics;
  metrics: CalculatedMetrics;
  metadata: Record<string, unknown>;
}
```

### GraphEdge

```typescript
interface GraphEdge {
  id: string;
  label: string;
  type: EdgeType; // 'contains' | 'mentions' | 'similar_to' | 'refers_to' | ...
  source: string; // Node ID
  target: string; // Node ID
  weight: number;
  created: string;
  updated: string;
  confidence: number; // 0-1
  bidirectional: boolean;
  
  visual: VisualProperties;
  state: ElementState;
  metadata: Record<string, unknown>;
}
```

### GraphData

```typescript
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  statistics: GraphStatistics;
  lastUpdated: string;
}
```

## 🎯 Performance

### Complexidade dos Algoritmos

- **LoadGraph:** O(n) - n = número de chunks
- **Filter:** O(n) - n = número de nodes + edges
- **ExpandNode (BFS):** O(V + E) - V = nodes, E = edges
- **PageRank:** O(n × iterations) - tipicamente 10-100 iterações
- **Betweenness Centrality:** O(n³) - **CUIDADO!** Desabilitado por padrão
- **Clustering:** O(V × k²) - k = grau médio
- **Fuzzy Search (Levenshtein):** O(m × n) - m, n = comprimento das strings

### Otimizações

- ✅ Cache com TTL no repository
- ✅ Immutable data structures (sem mutação)
- ✅ Lazy loading de edges (quando possível)
- ✅ Early termination em algoritmos iterativos
- ⏳ TODO: Virtual scrolling para grafos grandes
- ⏳ TODO: Web Workers para cálculos pesados
- ⏳ TODO: Streaming para dados grandes

### Limites Recomendados

- **Nodes:** <10.000 para visualização fluida
- **Edges:** <50.000 para performance aceitável
- **Betweenness:** <1.000 nodes (ou use sampling)
- **Search results:** <100 para UX responsiva

## 🧪 Testing

```typescript
// TODO: Implementar testes
describe('LoadGraphDataUseCase', () => {
  it('should load graph data from repository', async () => {
    const mockRepo: GraphRepository = {
      loadGraphData: jest.fn().mockResolvedValue(mockGraphData)
    };
    const useCase = new LoadGraphDataUseCase(mockRepo);
    const result = await useCase.execute();
    
    expect(result.data.nodes.length).toBe(10);
    expect(mockRepo.loadGraphData).toHaveBeenCalledTimes(1);
  });
});
```

## 📝 TODO

- [ ] Testes unitários (>80% coverage)
- [ ] D3 Visualization Service
- [ ] React Components
- [ ] VS Code Integration
- [ ] Implementar `getAllChunks()` no repository
- [ ] Implementar `saveGraphData()` (write operations)
- [ ] Web Workers para PageRank/Betweenness
- [ ] Virtual scrolling para grafos grandes
- [ ] Progressive loading
- [ ] Telemetria e logging estruturado

## 🐛 Known Issues

1. `getAllChunks()` retorna array vazio (mock)
2. `saveGraphData()` não implementado no MVP
3. Betweenness Centrality é O(n³) - usar com cuidado

## 📚 Referências

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [PageRank Algorithm](https://en.wikipedia.org/wiki/PageRank)
- [Betweenness Centrality](https://en.wikipedia.org/wiki/Betweenness_centrality)
- [GraphML Format](http://graphml.graphdrawing.org/)
- [GEXF Format](https://gexf.net/)
- [Graphviz DOT](https://graphviz.org/doc/info/lang.html)

---

**Status:** 🟢 Ready for use (read-only)  
**Version:** 3.0.0  
**Last Updated:** 12/10/2025
