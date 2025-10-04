# Core - Contratos de Dados e Fundamentos

## Propósito
Definir schemas, contratos de dados, chunking, hashing e ranking que serão usados em todo o Mini-LightRAG.

## Responsabilidades

### Schemas (Step 3)
- **Chunk**: Unidade buscável com id, path, lang, textHash, vector, etc.
- **Node**: Elementos do grafo (Document, Section, Keyword, Symbol)
- **Edge**: Conexões do grafo (CONTAINS, HAS_KEYWORD, REFERS_TO, etc.)

### Chunking (Step 5)
- Estratégias para dividir documentos em chunks semânticos
- Suporte para Markdown, código, JSDoc/TypeDoc
- Preservação de contexto e metadados

### Hashing (Step 4)
- BLAKE3 para gerar IDs estáveis de chunks
- Hash de conteúdo + posição (startLine, endLine)
- Detecção de mudanças incrementais

### Ranking
- Algoritmos de fusão de scores
- Combinação vetorial + grafo + frescor
- Normalização e pesos configuráveis

## Arquivos Futuros
- `schemas.ts` - Definições TypeScript dos contratos
- `chunking.ts` - Estratégias de divisão de texto
- `hashing.ts` - Utilitários BLAKE3
- `ranking.ts` - Algoritmos de ranking híbrido
