# Performance, Limites e Telemetria (Opt‑in)

> Data: 2025-10-03

## Objetivo
Manter UX fluida.

### Metas
- p95: busca ≤120 ms; expansão ≤150 ms; render ≤300 ms (1–2k elementos).
- Cotas: 50k chunks/workspace; 1–2 GB; 200 nós por resposta expandida.

### Estratégias
- Batch/lotes em ingestão e render.
- Índices vetoriais configurados.
- Cache de layout do grafo por workspace.
- Telemetria **opt‑in**: latência, tamanhos, erros (sem conteúdo).

## Critérios de aceite
- Metas documentadas
- Flags/limites configuráveis
