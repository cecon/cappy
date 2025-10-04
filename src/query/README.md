# Query - Orquestração de Busca Híbrida

## Propósito
Orquestrar pipeline de consulta combinando busca vetorial e expansão de grafo com ranking híbrido.

## Responsabilidades

### Pipeline de Consulta (Step 9)
1. **Vetorial**: Top-K em chunks (K=20 por padrão)
2. **Expansão 1-hop**: Vizinhança no grafo
3. **Re-rank**: Fusão de scores múltiplos
4. **Filtros**: Pasta, linguagem, tipo, data
5. **Limites**: Até 200 nós no subgrafo final

### Ranking Híbrido
```
score_final = 0.6·cos + 0.2·overlap_keywords + 0.15·peso_aresta + 0.05·frescor
```
- **cos**: Similaridade cosine vetorial
- **overlap_keywords**: Jaccard de palavras-chave
- **peso_aresta**: Força da conexão no grafo
- **frescor**: Baseado em updatedAt

### Saída Estruturada
- Lista de itens: path, startLine-endLine, snippet, score, why{}
- Subgrafo JSON para UI: nodes[], edges[], view{}
- Metadados explicativos de relevância

### Filtros e Configuração
- Filtros por pasta/linguagem/tipo
- Configuração de pesos de ranking
- Limits e timeouts configuráveis

## Arquivos Futuros
- `queryOrchestrator.ts` - Pipeline principal
- `hybridRanker.ts` - Algoritmos de ranking
- `filterEngine.ts` - Sistema de filtros
- `resultFormatter.ts` - Formatação de saída
