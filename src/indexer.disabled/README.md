# Indexer - Ingestão e Atualização Incremental

## Propósito
Gerenciar a indexação de documentos com atualização incremental baseada em hash por chunk.

## Responsabilidades

### Ingestão (Step 8)
- Descoberta de arquivos (.md, .ts, .js, JSDoc/TypeDoc JSON)
- Parsing e extração de conteúdo
- Geração de chunks com metadados
- Criação de embeddings via transformers.js

### Atualização Incremental
- Detecção de mudanças via hash comparison
- Update apenas dos chunks modificados
- Preserve/Remove de relacionamentos do grafo
- Batch processing para performance

### Estratégia Prepare/Commit
- **Prepare**: Analisa mudanças, calcula diffs
- **Commit**: Aplica mudanças atomicamente
- Rollback em caso de erro

### Fonte de Documentos
- **Prioridade**: JSDoc/TypeDoc JSON
- **Secundário**: Arquivos .md quando disponível
- Detecção automática de formato

## Arquivos Futuros
- `documentScanner.ts` - Descoberta de arquivos
- `contentParser.ts` - Parsing por tipo
- `incrementalUpdater.ts` - Lógica de diff/update
- `batchProcessor.ts` - Processamento em lotes
