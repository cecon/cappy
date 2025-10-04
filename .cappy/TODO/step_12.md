# Ferramentas para LLM: MCP / LM Tools

> Data: 2025-10-03

## Objetivo
Expor operações como “model tools” para Copilot/Cursor.

### Tools mínimas
- `rag.search(query, topK, filtros)` → itens + subgrafo resumido
- `graph.expand(nodeId, hops=1, edgeTypes[])` → subgrafo
- `symbols.lookup(name)` → assinatura + doc
- `cite.open(path, startLine, endLine)` → ação no editor
- `index.status()` / `index.update(scope)`

### Regras de projeto
- Descrições claras (pensadas para LLM), parâmetros com enums/defaults, respostas concisas.
- Idempotentes e seguras (timeouts, payload pequeno).
- Erros pedagógicos.

### Critérios de aceite
- Catálogo de tools definido (nome, descrição, inputs/outputs).
