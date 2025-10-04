# 🎨 Limites de Visualização do Grafo - Mini-LightRAG

## 🎯 Objetivo

Garantir que a visualização do grafo seja **sempre navegável**, independente do tamanho do database, através de limites inteligentes e carregamento incremental.

## 📏 Limites Recomendados

### Constantes de Configuração

```typescript
// src/graph/config.ts
export const GRAPH_LIMITS = {
  // Visualização
  MAX_VISIBLE_NODES: 100,      // Máximo de nodes na tela
  MAX_VISIBLE_EDGES: 200,      // Máximo de arestas na tela
  MAX_LABEL_LENGTH: 40,        // Tamanho máximo do label
  
  // Expansão
  MAX_EXPANSION_DEPTH: 2,      // Profundidade máxima de expansão
  MAX_NEIGHBORS_PER_NODE: 10,  // Vizinhos por node ao expandir
  
  // Filtros
  MIN_EDGE_WEIGHT: 0.5,        // Peso mínimo de arestas visíveis
  MIN_NODE_SCORE: 0.3,         // Score mínimo de nodes visíveis
  
  // Performance
  LAZY_LOAD_THRESHOLD: 50,     // Carregar incrementalmente se > 50 nodes
  DEBOUNCE_MS: 300,            // Debounce para expansão
  
  // LOD (Level of Detail)
  LOD_THRESHOLDS: {
    DETAILED: 30,              // Mostrar tudo se <= 30 nodes
    SIMPLIFIED: 70,            // Simplificar se 30-70 nodes
    CLUSTERED: 100             // Agrupar se > 70 nodes
  }
} as const;
```

## 🔍 Estratégia de Busca Limitada

### 1. Query Inicial (Top-K)

```typescript
// src/query/GraphQueryOrchestrator.ts
async function searchAndBuildGraph(query: string): Promise<GraphResult> {
  // 1. Buscar apenas top-10 chunks mais relevantes
  const topChunks = await vectorSearch(query, {
    limit: 10,
    minScore: 0.5
  });
  
  // 2. Construir nodes iniciais
  const initialNodes = topChunks.map(chunk => ({
    id: `chunk:${chunk.id}`,
    type: 'Chunk',
    label: extractShortLabel(chunk),  // Max 40 chars
    path: chunk.path,
    score: chunk.score,
    // Metadados para expansão lazy
    _expandable: true,
    _expanded: false
  }));
  
  // 3. Retornar grafo inicial compacto
  return {
    nodes: initialNodes,
    edges: [],
    stats: {
      totalNodes: initialNodes.length,
      expandableNodes: initialNodes.length,
      hasMore: true
    }
  };
}
```

### 2. Expansão Incremental (1-Hop)

```typescript
// src/graph/GraphExpander.ts
async function expandNode(
  nodeId: string, 
  options: ExpansionOptions = {}
): Promise<GraphExpansion> {
  const maxNeighbors = options.maxNeighbors || GRAPH_LIMITS.MAX_NEIGHBORS_PER_NODE;
  const minWeight = options.minWeight || GRAPH_LIMITS.MIN_EDGE_WEIGHT;
  
  // 1. Buscar arestas do node (limitadas)
  const edges = await db.query(`
    SELECT e.*, n.*
    FROM edges e
    JOIN nodes n ON e.target = n.id
    WHERE e.source = ? 
      AND e.weight >= ?
    ORDER BY e.weight DESC
    LIMIT ?
  `, [nodeId, minWeight, maxNeighbors]);
  
  // 2. Criar nodes vizinhos com labels curtos
  const newNodes = edges.map(edge => ({
    id: edge.target,
    type: edge.targetType,
    label: truncateLabel(edge.targetLabel, GRAPH_LIMITS.MAX_LABEL_LENGTH),
    score: edge.weight,
    _expandable: true,
    _expanded: false
  }));
  
  // 3. Criar arestas
  const newEdges = edges.map(edge => ({
    id: edge.id,
    source: nodeId,
    target: edge.target,
    type: edge.type,
    weight: edge.weight,
    label: edge.type.toLowerCase().replace('_', ' ')
  }));
  
  return {
    nodes: newNodes,
    edges: newEdges,
    stats: {
      addedNodes: newNodes.length,
      addedEdges: newEdges.length,
      hasMore: edges.length === maxNeighbors
    }
  };
}
```

### 3. Controle de Tamanho Total

```typescript
// src/graph/GraphSizeController.ts
class GraphSizeController {
  private visibleNodes: Set<string> = new Set();
  private visibleEdges: Set<string> = new Set();
  
  canAddNodes(count: number): boolean {
    return this.visibleNodes.size + count <= GRAPH_LIMITS.MAX_VISIBLE_NODES;
  }
  
  canAddEdges(count: number): boolean {
    return this.visibleEdges.size + count <= GRAPH_LIMITS.MAX_VISIBLE_EDGES;
  }
  
  async addNodesWithLimit(
    newNodes: Node[], 
    newEdges: Edge[]
  ): Promise<AddResult> {
    // 1. Verificar se cabe
    if (!this.canAddNodes(newNodes.length)) {
      // 2. Remover nodes menos relevantes
      const nodesToRemove = this.getLeastRelevantNodes(newNodes.length);
      await this.removeNodes(nodesToRemove);
    }
    
    // 3. Adicionar novos nodes
    newNodes.forEach(n => this.visibleNodes.add(n.id));
    newEdges.forEach(e => this.visibleEdges.add(e.id));
    
    return {
      added: newNodes.length,
      removed: nodesToRemove.length,
      total: this.visibleNodes.size
    };
  }
  
  private getLeastRelevantNodes(count: number): string[] {
    // Remover nodes com menor score ou mais antigos
    return Array.from(this.visibleNodes)
      .sort((a, b) => {
        const scoreA = this.getNodeScore(a);
        const scoreB = this.getNodeScore(b);
        return scoreA - scoreB;  // Menor score primeiro
      })
      .slice(0, count);
  }
}
```

## 🎨 Otimização de Labels

### Função de Extração de Labels Curtos

```typescript
// src/graph/LabelExtractor.ts
function extractShortLabel(chunk: Chunk): string {
  const maxLen = GRAPH_LIMITS.MAX_LABEL_LENGTH;
  
  // 1. Se tem symbolId, usar ele
  if (chunk.symbolId) {
    const parts = chunk.symbolId.split('.');
    const name = parts[parts.length - 1];  // Último segmento
    return truncate(name, maxLen);
  }
  
  // 2. Extrair nome do arquivo
  const fileName = path.basename(chunk.path);
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  
  // 3. Adicionar indicador de linha se necessário
  const lineIndicator = `:${chunk.startLine}`;
  const availableLen = maxLen - lineIndicator.length;
  
  return truncate(nameWithoutExt, availableLen) + lineIndicator;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return text.slice(0, maxLen - 3) + '...';
}

// Exemplos:
// "FileManager.readFile" → "readFile"
// "src/utils/very-long-file-name.ts:42" → "very-long-file-na...:42"
// "MyClass.constructor" → "constructor"
```

## 🎭 Level of Detail (LOD)

### Implementação de LOD

```typescript
// src/graph/LODManager.ts
enum DetailLevel {
  DETAILED = 'detailed',      // Todos os detalhes visíveis
  SIMPLIFIED = 'simplified',  // Alguns detalhes ocultos
  CLUSTERED = 'clustered'     // Nodes agrupados
}

class LODManager {
  getDetailLevel(nodeCount: number): DetailLevel {
    const { DETAILED, SIMPLIFIED, CLUSTERED } = GRAPH_LIMITS.LOD_THRESHOLDS;
    
    if (nodeCount <= DETAILED) {
      return DetailLevel.DETAILED;
    } else if (nodeCount <= SIMPLIFIED) {
      return DetailLevel.SIMPLIFIED;
    } else {
      return DetailLevel.CLUSTERED;
    }
  }
  
  applyLOD(graph: Graph): Graph {
    const level = this.getDetailLevel(graph.nodes.length);
    
    switch (level) {
      case DetailLevel.DETAILED:
        return graph;  // Sem modificações
        
      case DetailLevel.SIMPLIFIED:
        return this.simplifyGraph(graph);
        
      case DetailLevel.CLUSTERED:
        return this.clusterGraph(graph);
    }
  }
  
  private simplifyGraph(graph: Graph): Graph {
    return {
      nodes: graph.nodes.map(node => ({
        ...node,
        // Ocultar alguns metadados
        tags: undefined,
        score: undefined
      })),
      edges: graph.edges.filter(edge => 
        // Mostrar apenas arestas fortes
        edge.weight > 0.7
      )
    };
  }
  
  private clusterGraph(graph: Graph): Graph {
    // Agrupar nodes por tipo ou path
    const clusters = this.groupNodesByPath(graph.nodes);
    
    return {
      nodes: clusters.map(cluster => ({
        id: `cluster:${cluster.name}`,
        type: 'Cluster',
        label: `${cluster.name} (${cluster.count})`,
        _isCluster: true,
        _members: cluster.nodeIds
      })),
      edges: this.aggregateEdges(clusters, graph.edges)
    };
  }
}
```

## 🔄 Lazy Loading de Conteúdo

### Carregar Snippets Sob Demanda

```typescript
// src/graph/ContentLoader.ts
class ContentLoader {
  private cache = new Map<string, string>();
  
  async loadSnippet(chunk: Chunk): Promise<string> {
    // 1. Verificar cache
    const cacheKey = `${chunk.path}:${chunk.startLine}-${chunk.endLine}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // 2. Ler arquivo original
    const fileContent = await fs.readFile(chunk.path, 'utf8');
    const lines = fileContent.split('\n');
    
    // 3. Extrair linhas do chunk
    const snippet = lines
      .slice(chunk.startLine - 1, chunk.endLine)
      .join('\n');
    
    // 4. Cachear
    this.cache.set(cacheKey, snippet);
    
    return snippet;
  }
  
  // Carregar apenas quando usuário clica no node
  async onNodeClick(nodeId: string): Promise<NodeDetails> {
    const chunk = await db.getChunk(nodeId);
    const snippet = await this.loadSnippet(chunk);
    
    return {
      ...chunk,
      snippet: snippet,
      preview: snippet.slice(0, 200)
    };
  }
}
```

## 📊 Indicadores Visuais

### Mostrar Estado de Expansão

```typescript
// src/webview/GraphNode.tsx
interface GraphNodeProps {
  node: Node;
  onExpand: (nodeId: string) => void;
}

function GraphNode({ node, onExpand }: GraphNodeProps) {
  const hasMore = node._expandable && !node._expanded;
  
  return (
    <div className="graph-node">
      <span className="node-label">{node.label}</span>
      
      {hasMore && (
        <button 
          className="expand-button"
          onClick={() => onExpand(node.id)}
          title="Expand node"
        >
          +
        </button>
      )}
      
      {node._isCluster && (
        <span className="cluster-badge">
          {node._members.length} items
        </span>
      )}
    </div>
  );
}
```

## 🎯 Exemplo Completo de Uso

```typescript
// Uso completo da estratégia de limitação
async function visualizeQuery(query: string) {
  // 1. Busca inicial (top-10)
  const initialGraph = await searchAndBuildGraph(query);
  
  // 2. Aplicar LOD
  const lodManager = new LODManager();
  const optimizedGraph = lodManager.applyLOD(initialGraph);
  
  // 3. Renderizar
  const graphView = new GraphWebview();
  await graphView.render(optimizedGraph);
  
  // 4. Handler de expansão (lazy)
  graphView.onNodeExpand(async (nodeId) => {
    // 4a. Expandir 1-hop
    const expansion = await expandNode(nodeId, {
      maxNeighbors: 10,
      minWeight: 0.5
    });
    
    // 4b. Verificar limites
    const controller = new GraphSizeController();
    if (!controller.canAddNodes(expansion.nodes.length)) {
      vscode.window.showWarningMessage(
        'Graph is full. Remove some nodes before expanding.'
      );
      return;
    }
    
    // 4c. Adicionar ao grafo
    await graphView.addNodes(expansion.nodes, expansion.edges);
  });
  
  // 5. Handler de detalhes (lazy loading de conteúdo)
  graphView.onNodeClick(async (nodeId) => {
    const loader = new ContentLoader();
    const details = await loader.onNodeClick(nodeId);
    await graphView.showDetailsPanel(details);
  });
}
```

## ✅ Checklist de Implementação

- [ ] **Limites de Visualização**
  - [ ] MAX_VISIBLE_NODES = 100
  - [ ] MAX_VISIBLE_EDGES = 200
  - [ ] MAX_LABEL_LENGTH = 40
  
- [ ] **Busca Limitada**
  - [ ] Top-K inicial (K=10)
  - [ ] Expansão 1-hop limitada
  - [ ] Filtro por peso de arestas
  
- [ ] **Labels Otimizados**
  - [ ] Extrair nomes curtos de símbolos
  - [ ] Truncar paths longos
  - [ ] Usar indicadores de linha
  
- [ ] **LOD (Level of Detail)**
  - [ ] Detailed (≤30 nodes)
  - [ ] Simplified (31-70 nodes)
  - [ ] Clustered (>70 nodes)
  
- [ ] **Lazy Loading**
  - [ ] Carregar snippets sob demanda
  - [ ] Cache de conteúdo
  - [ ] Expansão incremental
  
- [ ] **Controle de Tamanho**
  - [ ] Remover nodes menos relevantes
  - [ ] Prevenir overflow
  - [ ] Indicadores de "tem mais"

## 📈 Métricas de Performance

| Operação | Sem Limites | Com Limites |
|----------|-------------|-------------|
| **Busca inicial** | 1000+ nodes | 10 nodes |
| **Tempo de render** | 5-10s | <100ms |
| **Memória** | 50+ MB | <5 MB |
| **Expansão** | Todo o grafo | 10 neighbors/vez |
| **Navegabilidade** | Impossível | Fácil |

---

**Conclusão:** A visualização do grafo deve ser **incremental e inteligente**, não tentar mostrar tudo de uma vez. Use limites, LOD e lazy loading para manter a interface sempre responsiva e navegável.
