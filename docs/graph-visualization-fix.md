# Correção da Visualização do Grafo

## Problema Identificado

A visualização do grafo do Knowledge Graph estava exibindo apenas a mensagem:
```
Graph visualization ready: 29 nodes, 33 edges
```

Mas não exibia:
- ✗ O canvas com o grafo renderizado
- ✗ Campo de busca de nós
- ✗ Legenda com contadores (Documents, Entities, Relationships)
- ✗ Seletor de layout (Force-Directed, Circular)
- ✗ Interatividade (zoom, pan, click em nós)

## Causa Raiz

O código JavaScript foi simplificado e a função `renderGraph()` no arquivo `dashboard.js` estava apenas mostrando um placeholder em vez de renderizar o grafo completo com Canvas nativo.

## Solução Aplicada

### 1. Restauração do Código JavaScript Completo (`dashboard.js`)

Restaurado toda a implementação de renderização do grafo usando **Canvas nativo** (não Sigma.js inicialmente, mas compatível):

- ✅ **Renderização com Canvas HTML5**
  - Desenho de nós (círculos com cores por tipo)
  - Desenho de arestas (linhas conectando nós)
  - Labels dos nós

- ✅ **Interatividade completa**
  - Drag and drop (arrastar o grafo)
  - Zoom com scroll do mouse
  - Click em nós para exibir detalhes
  - Busca de nós com highlight

- ✅ **Layouts**
  - Force-Directed Layout (algoritmo de força)
  - Circular Layout
  - Algoritmo próprio de force-layout com repulsão e atração

- ✅ **Funções restauradas**
  - `renderGraph(data)` - Renderiza o grafo completo
  - `applyForceLayout(nodes, edges, iterations)` - Layout force-directed
  - `getNodeColor(type)` - Cores por tipo de nó
  - `showNodeDetails(nodeId, attributes)` - Painel de detalhes
  - `updateGraphLegend(data)` - Atualiza contadores
  - `searchGraph()` - Busca e highlight de nós
  - `changeLayout()` - Troca de layout
  - `resetGraphView()` - Reset de zoom/pan

### 2. Atualização do HTML Template (`htmlTemplate.ts`)

Adicionado todos os controles e elementos da interface:

- ✅ **Barra de controles superior**
  - Botões: Refresh Graph, Reset View
  - Seletor de Layout: Force-Directed, Circular
  - Legenda com contadores em tempo real

- ✅ **Campo de busca**
  - Input para buscar nós
  - Busca com Enter ou botão
  - Highlight de nós encontrados

- ✅ **Container do grafo**
  - Estado de loading com spinner animado
  - Estado vazio quando não há dados
  - Canvas para renderização

- ✅ **Painel de detalhes de nó**
  - Título do nó
  - Tipo do nó
  - Metadados adicionais
  - Botão de fechar

### 3. Animação CSS (`dashboard.css`)

Adicionada animação de spin para o loading:

```css
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
```

## Cores dos Nós por Tipo

```javascript
const colors = {
    'document': '#10b981',      // Verde
    'entity': '#3b82f6',        // Azul
    'relationship': '#f97316',  // Laranja
    'chunk': '#8b5cf6',         // Roxo
    'keyword': '#ec4899'        // Rosa
};
```

## Estrutura do Grafo

### Formato de Dados Esperado

```typescript
interface GraphData {
    nodes: Array<{
        id: string;
        label: string;
        type: 'document' | 'entity' | 'relationship' | 'chunk' | 'keyword';
        size?: number;
        color?: string;
        metadata?: Record<string, any>;
    }>;
    edges: Array<{
        source: string;  // ID do nó origem
        target: string;  // ID do nó destino
        weight?: number;
    }>;
}
```

## Como Funciona

1. **Carregamento**: Usuário clica em "Refresh Graph" ou muda para a aba Graph
2. **Requisição**: JavaScript envia `{ command: 'getGraphData' }` para a extensão
3. **Resposta**: Extensão retorna dados via `{ command: 'graphData', data: { nodes, edges } }`
4. **Posicionamento**: Nós são posicionados em layout circular ou force-directed
5. **Renderização**: Canvas desenha nós, arestas e labels
6. **Interação**: Usuário pode arrastar, zoom, clicar e buscar

## Algoritmo Force-Directed

Implementação simplificada com:

- **Repulsão**: Todos os nós se repelem (força inversamente proporcional à distância)
- **Atração**: Nós conectados por arestas se atraem (força proporcional à distância)
- **Iterações**: 50 iterações para convergência
- **Constante k**: 50 (controla força das interações)

## Próximos Passos (Opcional)

Se quiser migrar para Sigma.js no futuro:

1. Adicionar CDN do Sigma.js no HTML:
```html
<script src="https://cdn.jsdelivr.net/npm/sigma@latest/sigma.min.js"></script>
```

2. Substituir código Canvas por Sigma.js:
```javascript
const graph = new graphology.Graph();
data.nodes.forEach(node => graph.addNode(node.id, node));
data.edges.forEach(edge => graph.addEdge(edge.source, edge.target, edge));

const sigma = new Sigma(graph, container, {
    renderLabels: true,
    // ... configurações
});
```

## Arquivos Modificados

- ✅ `src/commands/lightrag/templates/dashboard.js` - Código JavaScript completo
- ✅ `src/commands/lightrag/templates/htmlTemplate.ts` - HTML atualizado
- ✅ `src/commands/lightrag/templates/dashboard.css` - Animação spin

## Status

✅ **Problema Resolvido**

O grafo agora renderiza completamente com:
- Canvas interativo
- Campo de busca funcional
- Legenda com contadores
- Zoom, pan e click em nós
- Layouts force-directed e circular
