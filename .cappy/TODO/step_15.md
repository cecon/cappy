# Roadmap Fase 2/3 e Riscos

> Data: 2025-10-03

## Fase 2
- `MENTIONS_SYMBOL` por AST + `SIMILAR_TO` pré-compute
- Reranker leve local (ex.: bge-reranker-base) no perfil “Preciso”
- Watcher incremental + fila com prioridades
- Heatmap/centralidade na UI

## Fase 3
- Ontologia leve: sinônimos, PT↔EN (`ALIAS_OF`)
- Export/Import do KG (JSON), snapshots por workspace
- Endpoint compatível com Ollama (opcional)

## Riscos
- “Tag sprawl” → dicionário canônico + limite de keywords por doc
- Explosão de nós/arestas → limites e expansão sob demanda
- Travar extension host → tarefas assíncronas e isoladas

## Critérios de aceite
- Roadmap anexado ao SPEC
