# Decisões Iniciais e Estrutura do Projeto

> Data: 2025-10-03

## Decisões
1. **Armazenamento vetorial**: LanceDB **in-process** (pasta `globalStorage` da extensão).
2. **Grafo (LightGraph)**: guardar **nodes/edges** no próprio LanceDB (graph-lite).
3. **Modelos de embedding**: 
   - **Rápido**: `all-MiniLM-L6-v2` (384d) local (transformers.js no Node).
   - **Qualidade**: `bge-m3` (opcional, fase 2).
4. **Fonte de docs**: priorizar **JSDoc/TypeDoc JSON**; `.md` quando houver.
5. **Hash**: **BLAKE3** por *chunk*, com `textHash`, `startLine`, `endLine` e offsets opcionais.

## Estrutura sugerida (sem código)
- `src/`
  - `core/` (contratos de dados, ranking, chunking, hashing)
  - `indexer/` (ingestão + atualização incremental)
  - `store/` (LanceDB: chunks, nodes, edges)
  - `graph/` (consulta/expansão 1-hop, construção de subgrafo)
  - `query/` (orquestrador de busca + fusão de ranking)
  - `tools/` (MCP/LMTools: rag.search, graph.expand, cite.open, symbols.lookup)
  - `webview/graph-ui/` (React + motor de grafo)
- `assets/` (ícones, CSS do webview)
- `SPEC.md` (linkará para estes steps)

## Tarefas
- Criar as pastas.
- Registrar no SPEC as decisões acima.
- Definir o caminho do **globalStorage** que abrigará o LanceDB.

## Critérios de aceite
- Pastas criadas.
- SPEC atualizado com decisões e diretórios.
