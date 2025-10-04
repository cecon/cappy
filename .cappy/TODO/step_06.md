# Embeddings e Persistência (LanceDB)

> Data: 2025-10-03

## Objetivo
Gravar vetores no LanceDB e preparar consultas ANN.

### Decisões
- **Modelo Rápido**: MiniLM-L6-v2 (384d). **Qualidade**: BGE-M3 (fase 2).
- Normalizar vetores (L2).

### Coleções (LanceDB)
- `chunks`: schema do Step 3 (inclui `vector(384)` ou `vector(1024)`)
- (Opcional) `neighbors`: pré-compute top-N `SIMILAR_TO` por chunk

### Índices
- HNSW/IVF conforme suporte (config mínima no SPEC).

## Tarefas
- Definir estratégia de download/cache de modelo (on-demand, checksum).
- Especificar parâmetros de índice (ex.: HNSW M/efConstruction).

## Critérios de aceite
- SPEC com coleção `chunks` e plano de índice.
