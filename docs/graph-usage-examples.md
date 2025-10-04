# 🎯 Exemplo de Uso - Mini-LightRAG Graph Visualization

Este documento demonstra como usar os componentes implementados do sistema de visualização de grafo.

## 📦 Imports

```typescript
import {
  // Configuration
  graphLimits,
  defaultGraphConfig,
  DetailLevel,
  
  // Core components
  LabelExtractor,
  GraphSizeController,
  NodeExpander,
  LODManager,
  ContentLoader,
  
  // Types
  GraphNode,
  GraphEdge,
  Graph,
  ChunkReference
} from '../src/graph';

import { LanceDBStore } from '../src/store/lancedb';
```

## 🚀 Exemplo Completo: Busca e Visualização

```typescript
// 1. Inicializar componentes
const lancedb = new LanceDBStore({ dbPath: './data/mini-lightrag' });
await lancedb.initialize();

const labelExtractor = new LabelExtractor();
const sizeController = new GraphSizeController();
const nodeExpander = new NodeExpander(lancedb);
const lodManager = new LODManager();
const contentLoader = new ContentLoader();

// Configurar workspace path para content loader
contentLoader.setWorkspacePath('/path/to/workspace');

// 2. Buscar nodes iniciais (ex: resultado de busca vetorial)
const initialNodeIds = [
  'chunk:abc123',
  'chunk:def456',
  'chunk:ghi789'
];

// 3. Construir subgrafo inicial
const subgraph = await nodeExpander.buildSubgraph(initialNodeIds, {
  maxDepth: 1,
  maxNeighbors: 10,
  minWeight: 0.5
});

console.log(`Subgrafo inicial: ${subgraph.nodes.length} nodes, ${subgraph.edges.length} edges`);

// 4. Aplicar LOD se necessário
let displayGraph: Graph;

if (lodManager.needsLOD(subgraph)) {
  console.log('Aplicando LOD...');
  displayGraph = lodManager.applyLOD(subgraph);
  
  const stats = lodManager.getLODStats(subgraph);
  console.log(`LOD: ${stats.level}, redução de ${stats.reductionPercent.toFixed(1)}%`);
} else {
  displayGraph = subgraph;
}

// 5. Adicionar nodes ao size controller
const addResult = await sizeController.addNodesWithLimit(
  displayGraph.nodes,
  displayGraph.edges
);

console.log(`Adicionados: ${addResult.added} nodes, removidos: ${addResult.removed}`);

// 6. Exibir informações de capacidade
const capacity = sizeController.getCapacityInfo();
console.log(`Capacidade: ${capacity.nodes.percentage.toFixed(1)}% nodes, ${capacity.edges.percentage.toFixed(1)}% edges`);

// 7. Handler de clique em node (carregar conteúdo)
async function onNodeClick(nodeId: string) {
  // Buscar chunk original
  const chunks = await lancedb.getChunksByIds([nodeId]);
  if (chunks.length === 0) {
    return;
  }
  
  const chunk = chunks[0];
  
  // Carregar snippet (com cache)
  const chunkRef: ChunkReference = {
    id: chunk.id,
    path: chunk.path,
    startLine: chunk.startLine,
    endLine: chunk.endLine
  };
  
  const details = await contentLoader.loadNodeDetails(chunkRef);
  
  // Exibir detalhes
  console.log('Node Details:');
  console.log(`  Path: ${details.path}:${details.startLine}-${details.endLine}`);
  console.log(`  Language: ${details.language}`);
  console.log(`  Preview: ${details.preview}`);
  
  // Marcar node como acessado (para LRU)
  sizeController.accessNode(nodeId);
}

// 8. Handler de expansão de node
async function onNodeExpand(nodeId: string) {
  // Verificar capacidade
  if (sizeController.isAtCapacity()) {
    console.warn('Grafo está cheio. Removendo nodes menos relevantes...');
  }
  
  // Expandir 1-hop
  const expansion = await nodeExpander.expandNode(nodeId, {
    maxNeighbors: 10,
    minWeight: 0.5
  });
  
  console.log(`Expandindo ${nodeId}: +${expansion.stats.addedNodes} nodes, +${expansion.stats.addedEdges} edges`);
  
  // Adicionar novos nodes
  const result = await sizeController.addNodesWithLimit(
    expansion.nodes,
    expansion.edges
  );
  
  if (result.removedNodeIds && result.removedNodeIds.length > 0) {
    console.log(`Removidos ${result.removedNodeIds.length} nodes menos relevantes`);
  }
  
  // Retornar nodes atualizados para UI
  return {
    nodes: sizeController.getNodes(),
    edges: sizeController.getEdges()
  };
}

// 9. Buscar siblings de um node
async function findRelatedNodes(nodeId: string) {
  const siblings = await nodeExpander.findSiblings(nodeId);
  
  console.log(`Found ${siblings.nodes.length} siblings for ${nodeId}`);
  
  return siblings;
}

// 10. Encontrar caminho entre dois nodes
async function findConnectionPath(sourceId: string, targetId: string) {
  const path = await nodeExpander.findPath(sourceId, targetId, 3);
  
  if (path) {
    console.log(`Path found: ${path.nodes.length} nodes, ${path.edges.length} edges`);
    return path;
  } else {
    console.log('No path found');
    return null;
  }
}

// 11. Preload de conteúdo (otimização)
async function preloadVisibleNodes() {
  const visibleNodes = sizeController.getNodes();
  const chunks = await lancedb.getChunksByIds(visibleNodes.map(n => n.id));
  
  const chunkRefs: ChunkReference[] = chunks.map(chunk => ({
    id: chunk.id,
    path: chunk.path,
    startLine: chunk.startLine,
    endLine: chunk.endLine
  }));
  
  await contentLoader.preloadChunks(chunkRefs);
  
  console.log(`Preloaded ${chunkRefs.length} chunks`);
}

// 12. Obter estatísticas
function getGraphStats() {
  const graphStats = sizeController.getStats();
  const cacheStats = contentLoader.getCacheStats();
  
  return {
    graph: {
      totalNodes: graphStats.totalNodes,
      totalEdges: graphStats.totalEdges,
      nodesByType: Object.fromEntries(graphStats.nodesByType),
      edgesByType: Object.fromEntries(graphStats.edgesByType),
      averageScore: graphStats.averageScore.toFixed(3)
    },
    cache: {
      size: cacheStats.size,
      maxSize: cacheStats.maxSize,
      hitRate: (cacheStats.hitRate * 100).toFixed(1) + '%',
      totalAccesses: cacheStats.totalAccesses
    },
    capacity: sizeController.getCapacityInfo()
  };
}
```

## 🎨 Exemplo de Integração com UI

```typescript
// Componente React (pseudo-código)
function GraphVisualization() {
  const [graph, setGraph] = useState<Graph>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);
  
  // Carregar grafo inicial
  useEffect(() => {
    async function loadInitialGraph() {
      const subgraph = await nodeExpander.buildSubgraph(initialNodeIds);
      const displayGraph = lodManager.applyLOD(subgraph);
      
      await sizeController.addNodesWithLimit(
        displayGraph.nodes,
        displayGraph.edges
      );
      
      setGraph({
        nodes: sizeController.getNodes(),
        edges: sizeController.getEdges()
      });
    }
    
    loadInitialGraph();
  }, []);
  
  // Handler de clique
  const handleNodeClick = async (nodeId: string) => {
    setSelectedNode(nodeId);
    
    // Carregar detalhes
    const chunks = await lancedb.getChunksByIds([nodeId]);
    if (chunks.length > 0) {
      const details = await contentLoader.loadNodeDetails({
        id: chunks[0].id,
        path: chunks[0].path,
        startLine: chunks[0].startLine,
        endLine: chunks[0].endLine
      });
      
      setNodeDetails(details);
    }
  };
  
  // Handler de expansão
  const handleNodeExpand = async (nodeId: string) => {
    const result = await onNodeExpand(nodeId);
    setGraph(result);
  };
  
  return (
    <div className="graph-container">
      <CytoscapeGraph
        nodes={graph.nodes}
        edges={graph.edges}
        onNodeClick={handleNodeClick}
        onNodeExpand={handleNodeExpand}
      />
      
      {nodeDetails && (
        <DetailsPanel
          details={nodeDetails}
          onClose={() => setNodeDetails(null)}
        />
      )}
      
      <GraphStats stats={getGraphStats()} />
    </div>
  );
}
```

## 📊 Exemplo de Métricas

```typescript
// Monitorar performance
function monitorGraphPerformance() {
  const stats = getGraphStats();
  
  console.log('=== Graph Metrics ===');
  console.log('Nodes:', stats.graph.totalNodes);
  console.log('Edges:', stats.graph.totalEdges);
  console.log('Avg Score:', stats.graph.averageScore);
  console.log('Cache Hit Rate:', stats.cache.hitRate);
  console.log('Node Capacity:', stats.capacity.nodes.percentage.toFixed(1) + '%');
  console.log('Edge Capacity:', stats.capacity.edges.percentage.toFixed(1) + '%');
  
  // Alertas
  if (stats.capacity.nodes.percentage > 90) {
    console.warn('⚠️  Node capacity almost full!');
  }
  
  if (parseFloat(stats.cache.hitRate) < 50) {
    console.warn('⚠️  Low cache hit rate. Consider preloading.');
  }
}
```

## 🔧 Configuração Customizada

```typescript
// Criar configuração customizada
const customConfig = {
  maxVisibleNodes: 150,      // Aumentar limite (padrão: 100)
  maxVisibleEdges: 300,      // Aumentar limite (padrão: 200)
  maxLabelLength: 50,        // Labels mais longos
  minEdgeWeight: 0.7,        // Apenas edges fortes
  enableLazyLoading: true,
  cacheSize: 200             // Cache maior
};

// Usar nos componentes
const customController = new GraphSizeController(customConfig);
const customExpander = new NodeExpander(lancedb, customConfig);
const customLOD = new LODManager(customConfig);
const customLoader = new ContentLoader(customConfig.cacheSize);
```

## 🎯 Casos de Uso Reais

### 1. Busca Híbrida com Visualização

```typescript
async function searchAndVisualize(query: string) {
  // 1. Busca vetorial
  const results = await lancedb.vectorSearch(queryVector, 10);
  const chunkIds = results.map(r => r.chunk.id);
  
  // 2. Construir grafo
  const subgraph = await nodeExpander.buildSubgraph(chunkIds, {
    maxDepth: 1,
    minWeight: 0.6
  });
  
  // 3. Aplicar LOD
  const displayGraph = lodManager.applyLOD(subgraph);
  
  // 4. Retornar para UI
  return displayGraph;
}
```

### 2. Navegação de Código

```typescript
async function exploreCodebase(startingFile: string) {
  // 1. Encontrar chunks do arquivo
  const chunks = await lancedb.getChunksByIds([`doc:${startingFile}`]);
  
  // 2. Expandir para mostrar símbolos
  const expansion = await nodeExpander.expandNode(chunks[0].id, {
    edgeTypes: ['CONTAINS', 'MEMBER_OF']
  });
  
  // 3. Visualizar estrutura
  return expansion;
}
```

### 3. Análise de Dependências

```typescript
async function analyzeDependencies(symbolId: string) {
  // Encontrar todos os nodes que referenciam este símbolo
  const edges = await lancedb.queryEdges({
    target: symbolId,
    edgeTypes: ['REFERS_TO', 'MENTIONS_SYMBOL']
  });
  
  // Construir grafo de dependências
  const dependencyGraph = await nodeExpander.buildSubgraph(
    edges.map(e => e.source),
    { maxDepth: 2 }
  );
  
  return dependencyGraph;
}
```

## 📝 Notas Importantes

1. **Sempre verificar capacidade** antes de adicionar nodes
2. **Usar preload** para otimizar performance de UI
3. **Aplicar LOD** para grafos grandes (>30 nodes)
4. **Invalidar cache** quando arquivos são modificados
5. **Monitorar métricas** para identificar gargalos

## 🚀 Performance Tips

1. Use `preloadChunks()` para carregar conteúdo em lote
2. Configure `cacheSize` adequadamente ao tamanho do projeto
3. Use `minWeight` filtros para reduzir edges irrelevantes
4. Limite `maxDepth` para evitar explosão combinatória
5. Monitore `hitRate` do cache e ajuste estratégia se necessário

---

**Última atualização:** 2025-10-04
**Status:** Documentação completa dos componentes implementados
