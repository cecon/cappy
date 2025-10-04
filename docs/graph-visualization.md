# 📊 Visualização do Grafo de Conhecimento - Mini-LightRAG

## Como Ver o Grafo Visualmente

### Comando Disponível

O Cappy já possui um comando para abrir a visualização do grafo:

```
📊 Mini-LightRAG: Open Graph
```

### Como Usar

#### Opção 1: Command Palette (Recomendado)
1. Pressione `Ctrl+Shift+P` (Windows/Linux) ou `Cmd+Shift+P` (Mac)
2. Digite: `Mini-LightRAG: Open Graph`
3. Pressione Enter

#### Opção 2: Via Código
```typescript
await vscode.commands.executeCommand('miniRAG.openGraph');
```

#### Opção 3: Criar Atalho de Teclado
Adicione ao seu `keybindings.json`:
```json
{
  "key": "ctrl+shift+g",
  "command": "miniRAG.openGraph",
  "when": "editorTextFocus"
}
```

## Status Atual da Implementação

### ✅ Implementado
- ✅ Comando registrado no VS Code
- ✅ Webview panel criado
- ✅ Configurações de maxNodes e maxEdges
- ✅ Interface HTML básica

### ⏳ Em Desenvolvimento
- ⏳ Carregamento de dados do grafo (chunks, nodes, edges)
- ⏳ Visualização interativa com Cytoscape.js
- ⏳ Filtros por tipo de nó (Document, Section, Keyword, Symbol)
- ⏳ Filtros por tipo de aresta (CONTAINS, HAS_KEYWORD, etc.)
- ⏳ Zoom e pan
- ⏳ Detalhes ao clicar em nós
- ⏳ Busca no grafo
- ⏳ Exportação para PNG/SVG

## Estrutura do Grafo

### Tipos de Nós
```
📄 Document   - Arquivos do workspace
📑 Section    - Chunks de código/texto
🏷️  Keyword    - Palavras-chave extraídas
⚙️  Symbol     - Funções, classes, interfaces
```

### Tipos de Arestas
```
→ CONTAINS        (0.4) - Document contém Section
→ HAS_KEYWORD     (0.3) - Section tem Keyword
→ REFERS_TO       (1.0) - Referência direta
→ MENTIONS_SYMBOL (0.8) - Menção a símbolo
→ MEMBER_OF       (0.6) - Pertencimento
→ SIMILAR_TO      (0.2) - Similaridade semântica
```

## Configurações

Adicione ao seu `settings.json`:

```json
{
  "miniRAG.maxNodes": 10000,
  "miniRAG.maxEdges": 50000,
  "miniRAG.graphLayout": "cose",
  "miniRAG.graphTheme": "dark",
  "miniRAG.showLabels": true,
  "miniRAG.enablePhysics": true
}
```

## Roadmap de Desenvolvimento

### Fase 1: Carregamento de Dados (Em Breve)
- [ ] Ler arquivos JSON do globalStorage
- [ ] Parsear chunks, nodes, edges
- [ ] Validar estrutura de dados
- [ ] Limitar dados conforme maxNodes/maxEdges

### Fase 2: Visualização Básica (Em Breve)
- [ ] Integrar Cytoscape.js
- [ ] Renderizar nós coloridos por tipo
- [ ] Renderizar arestas com espessura baseada no peso
- [ ] Implementar layout (cose, dagre, etc.)

### Fase 3: Interatividade (Próximo)
- [ ] Click em nó → mostrar detalhes
- [ ] Hover → tooltip
- [ ] Seleção múltipla
- [ ] Navegação (zoom, pan, fit)

### Fase 4: Filtros e Busca (Próximo)
- [ ] Filtrar por tipo de nó
- [ ] Filtrar por tipo de aresta
- [ ] Busca por nome/label
- [ ] Highlight de caminhos

### Fase 5: Exportação e Compartilhamento (Futuro)
- [ ] Exportar para PNG
- [ ] Exportar para SVG
- [ ] Exportar dados JSON
- [ ] Compartilhar visualização

## Bibliotecas Planejadas

### Cytoscape.js (Recomendado)
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>
```

**Vantagens:**
- ✅ Otimizado para grandes grafos (10k+ nós)
- ✅ Múltiplos layouts
- ✅ Altamente customizável
- ✅ Boa documentação

### Alternativas Consideradas

#### D3.js + Force Layout
- Mais controle
- Mais complexo
- Performance inferior para grandes grafos

#### Vis.js Network
- Mais simples
- Performance inferior
- Menos customizável

## Exemplos de Uso

### Explorar Dependências de um Arquivo
1. Abra o grafo
2. Busque pelo arquivo (ex: `reindexCommand.ts`)
3. Expanda nós conectados
4. Veja imports, exports, símbolos referenciados

### Encontrar Código Similar
1. Abra o grafo
2. Selecione uma Section (chunk de código)
3. Filtrar arestas por `SIMILAR_TO`
4. Ver chunks semanticamente similares

### Navegar por Arquitetura
1. Abra o grafo
2. Filtrar apenas Document nodes
3. Ver estrutura de pastas e conexões
4. Identificar módulos acoplados

## Troubleshooting

### "Graph visualization will be implemented here"
Isso significa que você está vendo o placeholder. A implementação completa está em desenvolvimento.

### Grafo não abre
1. Verifique se a extensão está ativada
2. Verifique os logs do VS Code: `Help > Toggle Developer Tools > Console`
3. Recarregue o VS Code: `Developer: Reload Window`

### Performance ruim com muitos nós
Ajuste as configurações:
```json
{
  "miniRAG.maxNodes": 5000,
  "miniRAG.maxEdges": 20000,
  "miniRAG.enablePhysics": false
}
```

## Próximos Passos para Você

Se quiser acompanhar o desenvolvimento ou contribuir:

1. **Acompanhar**: Verifique `docs/REINDEX_UPDATE_SUMMARY.md` para roadmap
2. **Testar**: Execute `miniRAG.openGraph` para ver a versão atual
3. **Feedback**: Reporte bugs ou sugestões nas issues do projeto
4. **Contribuir**: Veja `SPEC.md` para detalhes da arquitetura

## Comandos Relacionados

- `miniRAG.indexWorkspace` - Indexar workspace (cria os dados do grafo)
- `miniRAG.search` - Busca híbrida (usa o grafo)
- `miniRAG.openGraph` - Visualizar grafo (este comando!)
- `cappy.reindex` - Reindexar tudo (atualiza o grafo)

---

**Nota**: Esta é uma feature em desenvolvimento ativo. A visualização completa será implementada nas próximas versões seguindo o roadmap do SPEC.md.
