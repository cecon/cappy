# LightGraph (Nodes/Edges) no LanceDB

> Data: 2025-10-03

## Objetivo
Persistir grafo leve no próprio LanceDB.

### Nós importantes
- `Document`, `Section`, `Keyword`, `Symbol`

### Arestas
- `CONTAINS` (doc→section; class→method)
- `HAS_KEYWORD` (section/doc→keyword)
- `REFERS_TO` (links/@see)
- `MENTIONS_SYMBOL` (doc/section→symbol)
- `MEMBER_OF` (method→class)
- `SIMILAR_TO` (opcional; pré-compute)

### Pesos sugeridos (inicial)
- `REFERS_TO`: 1.0
- `MENTIONS_SYMBOL`: 0.8
- `MEMBER_OF`: 0.6
- `CONTAINS`: 0.4
- `HAS_KEYWORD`: 0.3
- `SIMILAR_TO`: 0.2

## Tarefas
- Documentar como criar/upsert nodes/edges vinculados aos chunks/símbolos.
- Definir `updatedAt` e versionamento simples.

## Critérios de aceite
- SPEC com mapeamento de arestas e pesos.
