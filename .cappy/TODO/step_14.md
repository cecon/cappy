# Testes, QA e Métricas de Qualidade

> Data: 2025-10-03

## Objetivo
Validar precisão e estabilidade.

### Conjunto de queries reais (20–30)
- “Onde está o fluxo de refresh token?”
- “Símbolos que emitem NFC-e e onde documentados?”
- “Abrir AuthService.login e docs relacionadas.”

### Métricas
- nDCG@10 / MRR (só vetorial vs híbrido)
- Taxa de tool calls corretas (quando usado via LLM)
- p95/p99 de latência

### QA
- Workspaces grandes x pequenos
- Arquivos grandes, minificados, binários (exclusões corretas)
- Renomear/mover arquivos (hash/path estáveis)

## Critérios de aceite
- Planilha simples com resultados e deltas
