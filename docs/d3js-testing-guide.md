# Guia de Teste - D3.js Knowledge Graph

## Versão Instalada
**Cappy Framework v2.9.59** com Data URI approach para carregar D3.js

## Pré-requisitos
✅ VS Code recarregado após instalação  
✅ Extensão Cappy instalada e ativa  
✅ Dados existentes: 3 documentos, 388 entidades, 295 relacionamentos, 77 chunks  

## Passos para Testar

### 1. Recarregar VS Code
```
Ctrl+Shift+P → "Developer: Reload Window"
```
Ou feche e reabra o VS Code.

### 2. Abrir Dashboard
```
Ctrl+Shift+P → "Cappy: Open Knowledge Graph"
```
Ou:
```
Ctrl+Shift+P → "CappyRAG: Open Dashboard"
```

### 3. Navegar para Aba Knowledge Graph
Clique na aba **"Knowledge Graph"** no topo do dashboard.

### 4. Carregar Grafo
Clique no botão **"Load Graph"**.

## Verificações Esperadas

### Console do VS Code (DevTools)
Abra o console com `Ctrl+Shift+I` e verifique:

```javascript
[Dashboard] DOM loaded, initializing...
[Dashboard] Message received: initialData
[Stats] Updated: {documents: 3, entities: 388, relationships: 295, chunks: 77}
[Graph] Loading D3.js graph...
[Graph] Requesting D3.js HTML from extension...
[Dashboard] Message received: graphD3HTML
[Graph] Received D3.js HTML, loading in iframe...
[Graph] D3.js iframe loaded via data URI, requesting graph data...
[Backend] Getting graph data...
[Backend] Found: 3 docs, 388 entities, 295 rels, 77 chunks
[Backend] Sending graph data: 441 nodes, 733 edges
[Dashboard] Message received: graphData
[Graph] Received graph data, sending to D3.js iframe...
```

### Visual Esperado

1. **Loading State**: "Loading D3.js knowledge graph..." deve aparecer brevemente
2. **Iframe visível**: O iframe deve ocupar 600px de altura
3. **Grafo renderizado**: 
   - 441 nós (nodes) com emojis de categoria
   - 733 arestas (edges) conectando os nós
   - Cores variadas por tipo de nó
   - Animação de force-directed graph

### Interações Disponíveis

#### Controles Globais
- **🔍 Zoom**: Scroll do mouse ou pinch
- **🖱️ Pan**: Arrastar o fundo do grafo
- **🔄 Reset View**: Botão no canto superior direito

#### Filtros (Sidebar Esquerda)
- **Search**: Busca por nome/id de nó
- **Node Types**: Checkboxes para Document/Entity/Relationship/Chunk
- **Confidence**: Slider de 0 a 100%
- **Category**: Dropdown com categorias de arquivo

#### Nós (Nodes)
- **Hover**: Tooltip com informações detalhadas
- **Click**: Painel lateral com metadados completos
- **Drag**: Arrastar nós individualmente

#### Visualização
- **Emojis**: Ícones por categoria de arquivo
  - 🔷 C# (.cs)
  - 🐍 Python (.py)
  - 📘 TypeScript (.ts)
  - 📝 Markdown (.md)
  - 📦 JSON (.json)
  - etc.
- **Cores**: Por tipo de nó
  - Azul: Documents
  - Verde: Entities
  - Laranja: Relationships
  - Roxo: Chunks

### Estatísticas (Bottom Bar)
Verifique no rodapé:
```
Nodes: 441 | Edges: 733 | Avg Confidence: X.XX%
Documents: 3 | Entities: 388 | Relationships: 295 | Chunks: 77
```

## Problemas Comuns

### ❌ Erro: "d3 is not defined"
**Causa**: D3.js não carregou  
**Solução**: Recarregue o VS Code e tente novamente

### ❌ Erro: "Invalid or unexpected token"
**Causa**: Data URI não foi criado corretamente  
**Solução**: Versão antiga instalada - reinstale v2.9.59

### ❌ Iframe vazio/branco
**Causa**: CSP bloqueando data URI  
**Solução**: Verificar que CSP tem `frame-src data:;`

### ❌ Grafo não aparece
**Causa**: Dados não foram enviados  
**Solução**: Verificar console por erros na query do LanceDB

## Debug Avançado

### Inspecionar Iframe
```javascript
// No console do dashboard:
const iframe = document.getElementById('graph-d3-iframe');
console.log('Iframe src:', iframe.src.substring(0, 100));
console.log('Iframe loaded:', iframe.contentWindow !== null);
```

### Verificar D3.js no Iframe
```javascript
// No console do iframe (abrir DevTools no iframe):
console.log('D3 loaded:', typeof d3);
console.log('D3 version:', d3.version);
```

### Forçar Recarregamento
```javascript
// No console do dashboard:
window.loadGraph();
```

## Dados de Teste Atuais

### Documentos (3)
1. Arquivo TypeScript
2. Arquivo Markdown  
3. Arquivo JSON

### Estatísticas
- **Entidades**: 388 (pessoas, tecnologias, conceitos, etc.)
- **Relacionamentos**: 295 (conexões entre entidades)
- **Chunks**: 77 (pedaços de texto processados)
- **Total de Nós**: 441
- **Total de Arestas**: 733

## Próximos Passos

✅ Se o grafo renderizar corretamente → **SUCESSO!**  
⏳ Adicionar mais documentos para testar escalabilidade  
⏳ Implementar timeline component (opcional)  
⏳ Adicionar export para imagem  
⏳ Implementar seleção múltipla de nós  

## Suporte

Se encontrar problemas:
1. Verifique logs do console (`Ctrl+Shift+I`)
2. Verifique logs da extensão (`Ctrl+Shift+U` → Output → Cappy)
3. Consulte `docs/d3js-iframe-loading-solution.md`
4. Reinicie o VS Code completamente

## Versão
Guia atualizado para **Cappy Framework v2.9.59**  
Data: 6 de Outubro de 2025
