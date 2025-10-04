# Orquestração de Consulta e Ranking Híbrido

> Data: 2025-10-03

## Objetivo
Definir pipeline de consulta e fusão de scores.

### Pipeline
1. **Vetorial**: Top-K em `chunks` (K=20 por padrão).
2. **Expansão 1-hop** no grafo: `REFERS_TO`, `MEMBER_OF`, `HAS_KEYWORD`, irmãos do mesmo doc/section.
3. **Re-rank** (fusão simples):
   - `score_final = 0.6·cos + 0.2·overlap_keywords + 0.15·peso_aresta + 0.05·frescor`
4. **Filtros**: pasta, linguagem, tipo de nó, data.
5. **Limites**: até 200 nós no subgrafo de resposta (LOD).

### Saída
- Lista de itens (path, startLine–endLine, snippet, score, why{})
- Subgrafo JSON para a UI.

## Tarefas
- Documentar cálculo de `overlap_keywords` (ex.: Jaccard).
- Definir frescor (dias desde `updatedAt`).

## Critérios de aceite
- SPEC com fórmula de ranking e defaults.
