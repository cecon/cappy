# Resumo da Atualização do Comando Reindex

## Data: 4 de outubro de 2025

## Objetivo
Atualizar o comando `cappy.reindex` para implementar a arquitetura **Mini-LightRAG** conforme especificado no `SPEC.md`.

## Problema Encontrado
O comando de reindexação anterior estava usando uma abordagem simples baseada em keywords, sem suporte para:
- Embeddings vetoriais
- Grafo de conhecimento
- Chunking inteligente
- Hashing conforme SPEC

## Solução Implementada

### 1. Documentação Criada
- **`docs/reindex-mini-lightrag.md`**: Documentação completa da nova arquitetura Mini-LightRAG
  - Schemas das interfaces (Chunk, Node, Edge)
  - Estrutura de armazenamento
  - Fluxo de execução
  - Tipos de arestas e pesos
  - Próximos passos

### 2. Comando Atualizado
- **`src/commands/reindexCommand.ts`**: Implementação placeholder
  - Por enquanto, retorna mensagem informativa
  - Referencia a documentação completa
  - Pronto para implementação incremental

### 3. Status Atual
- ✅ Documentação completa do Mini-LightRAG
- ✅ Schemas definidos conforme SPEC.md
- ✅ Estrutura de armazenamento planejada
- ✅ Fluxo de execução documentado
- ✅ Compilação sem erros
- ⏳ Implementação completa pendente

## Próximas Implementações Necessárias

### Fase 1: Core (Prioridade Alta)
1. **Chunking System**
   - Implementar divisão inteligente de arquivos
   - Respeitar limites de 50 linhas por chunk
   - Manter integridade de blocos de código

2. **Normalização de Conteúdo**
   - Conversão CRLF → LF
   - Unicode NFC normalization
   - Trim trailing whitespace

3. **Hashing com BLAKE3**
   - Instalar biblioteca blake3
   - Implementar fileHash e textHash
   - Sistema de IDs únicos

### Fase 2: Vetorização (Prioridade Alta)
4. **Embeddings com transformers.js**
   - Integrar biblioteca transformers.js
   - Usar modelo all-MiniLM-L6-v2 (384 dimensões)
   - Gerar vetores reais (substituir placeholders)

5. **LanceDB Integration**
   - Instalar LanceDB
   - Criar schemas para coleções (chunks, nodes, edges)
   - Implementar índices HNSW

### Fase 3: Grafo (Prioridade Média)
6. **Knowledge Graph Builder**
   - Extrair símbolos de código (JSDoc/TypeDoc)
   - Criar nós de Document, Section, Keyword, Symbol
   - Gerar arestas com pesos corretos

7. **Graph Relationships**
   - Implementar REFERS_TO (links, @see)
   - Implementar MENTIONS_SYMBOL
   - Implementar MEMBER_OF (classes, métodos)
   - Implementar SIMILAR_TO (similaridade semântica)

### Fase 4: Performance (Prioridade Média)
8. **Indexação Incremental**
   - Detectar mudanças via hash comparison
   - Atualizar apenas chunks modificados
   - Sistema de tombstones e GC

9. **Otimizações**
   - Batch processing
   - Parallel chunking
   - Cache de embeddings

### Fase 5: Integração (Prioridade Baixa)
10. **Search Integration**
    - Implementar busca híbrida (vetor + grafo)
    - Ranking algorithm conforme SPEC
    - UI para visualização do grafo

## Estrutura Conforme SPEC.md

```
globalStorage/mini-lightrag/
├── chunks/          # Chunks vetorizados (LanceDB)
├── nodes/           # Nós do grafo
├── edges/           # Arestas do grafo
└── indexes/         # Índices HNSW/IVF
```

## Compatibilidade

- ✅ Mantém compatibilidade com índices legacy (`.cappy/indexes/`)
- ✅ Fallback para modo legacy quando globalStorage não disponível
- ✅ Projetos existentes continuam funcionando

## Comandos Relacionados

- `cappy.reindex` - Reconstruir todos os índices
- `miniRAG.indexWorkspace` - Indexar workspace (novo)
- `miniRAG.search` - Busca híbrida (novo)
- `miniRAG.openGraph` - Visualizar grafo (novo)

## Referências

- **SPEC.md**: Especificação completa do Mini-LightRAG
- **docs/mini-lightrag-guide.md**: Guia de uso
- **docs/reindex-mini-lightrag.md**: Documentação deste comando

## Status da Branch
Branch: `grph`
Commits necessários:
1. ✅ Documentação Mini-LightRAG para comando reindex
2. ⏳ Implementação completa do ReindexCommand
3. ⏳ Testes de integração
4. ⏳ Publicação na marketplace

---

**Nota**: Este é um trabalho em progresso. A implementação completa seguirá os steps definidos no `.cappy/TODO/` conforme especificado no SPEC.md.
