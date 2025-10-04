# Graph UI - Interface React para Visualização do Grafo

## Propósito
Interface web em React para navegação explicável do subgrafo gerado pelas consultas híbridas.

## Responsabilidades

### Motor de Grafo (Step 11)
- **Cytoscape.js** como motor principal
- Layouts: force (cose-bilkent) + hierárquico (ELK/Dagre)
- Suporte para até 5k nós / 10k arestas por view
- LOD: esconder labels em zoom out

### Contrato de Dados
```typescript
// Frontend JSON
nodes[]: { id, label, type, score?, path? }
edges[]: { id, source, target, type, weight }
view: { layout, filters, focus? }
```

### Interações Principais
- **Clique no nó** → painel com snippet/metadados/botões
- **Duplo clique** → expandir vizinhança (até N nós)
- **Botões de ação**: Abrir arquivo, Expandir 1-hop
- **Chips de filtro** por tipo de nó/aresta

### Componentes UI
- **GraphCanvas**: Renderização Cytoscape.js
- **NodePanel**: Detalhes do nó selecionado
- **FilterBar**: Controles de filtro
- **Minimap**: Navegação em grafos grandes
- **LayoutControls**: Seleção de algoritmos

### Comunicação VS Code
- Postmessage API para webview
- Commands para abrir arquivos no editor
- State sync entre webview e extensão

## Arquivos Futuros
- `GraphWebview.tsx` - Componente principal
- `CytoscapeCanvas.tsx` - Wrapper Cytoscape.js
- `NodeDetailsPanel.tsx` - Painel de detalhes
- `webviewProvider.ts` - Provider VS Code
