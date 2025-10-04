# Contratos de Dados (Schemas)

> Data: 2025-10-03

## Objetivo
Definir **schemas** que serão usados no LanceDB e nos payloads internos.

### Chunk (unidade buscável)
- `id` (string): estável (ex.: `hash(path + startLine + endLine + textHash)`).
- `path` (string)
- `lang` (string)
- `startLine`, `endLine` (int, 1-based)
- `startChar`, `endChar` (int, opcional)
- `textHash` (string, blake3 do texto do chunk)
- `fileHash` (string, blake3 do arquivo)
- `keywords` (string[], opt.)
- `symbolId` (string, opt. para JSDoc/TypeDoc)
- `vector` (float[], 384 ou 1024)
- `indexedAt` (datetime ISO)
- `model` (string) e `dim` (int)

### Node (grafo)
- `id` (string): ex.: `doc:...`, `sym:...`, `kw:...`, `sec:...`
- `type` ("Document" | "Section" | "Keyword" | "Symbol")
- `label` (string)
- `path?`, `lang?`, `score?`, `tags?` (metadados)
- `updatedAt` (datetime)

### Edge (grafo)
- `id` (string): ex.: `sourceId->targetId:type`
- `source`, `target` (string)
- `type` ("CONTAINS" | "HAS_KEYWORD" | "REFERS_TO" | "MENTIONS_SYMBOL" | "MEMBER_OF" | "SIMILAR_TO")
- `weight` (float)
- `updatedAt` (datetime)

## Tarefas
- Documentar schemas no SPEC.
- Mapear coleções/tabelas no LanceDB: `chunks`, `nodes`, `edges`.

## Critérios de aceite
- SPEC com os campos aceitos; dimensões vetoriais e tipos de arestas definidos.
