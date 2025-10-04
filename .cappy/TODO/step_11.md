# Webview React: UI de Grafo

> Data: 2025-10-03

## Objetivo
Planejar a janela do grafo (sem código).

### Motor
- **Cytoscape.js** (default). Layouts: force (*cose-bilkent*) + hierárquico (ELK/Dagre).

### Contrato de dados (frontend)
- `nodes[]`: `{ id, label, type, score?, path? }`
- `edges[]`: `{ id, source, target, type, weight }`
- `view`: `{ layout, filters, focus? }`

### Interações
- Clique no nó → painel com snippet/metadados/botões (Abrir arquivo, Expandir 1-hop).
- Duplo clique → expandir vizinhança (até N nós).
- Chips de filtro por tipo de nó/aresta.
- Minimap + zoom/pan.
- LOD: esconder labels em zoom out.

### Critérios de aceite
- Contrato JSON fechado
- Limite inicial de 5k nós/10k arestas por view
