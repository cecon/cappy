# Graph - Expansão e Construção de Subgrafo

## Propósito
Gerenciar operações de grafo para recuperação híbrida e construção de subgrafos explicáveis.

## Responsabilidades

### LightGraph no LanceDB (Step 7)
- Armazenar nodes/edges diretamente no LanceDB
- Tipos de nós: Document, Section, Keyword, Symbol
- Tipos de arestas: CONTAINS, HAS_KEYWORD, REFERS_TO, MEMBER_OF, SIMILAR_TO
- Pesos dinâmicos baseados em relevância

### Expansão 1-hop
- A partir de resultados vetoriais Top-K
- Expandir vizinhança por tipo de aresta
- Irmãos do mesmo documento/seção
- Limitar tamanho do subgrafo (LOD)

### Construção de Subgrafo
- Combinar resultados vetoriais + expansão
- Gerar JSON para UI React
- Incluir metadados de "por que apareceu"
- Otimizar para visualização (até 5k nós/10k arestas)

### Algoritmos de Caminho
- Caminhos explicativos entre nós
- Shortest path para relevância
- Detecção de clusters semânticos

## Arquivos Futuros
- `graphBuilder.ts` - Construção de grafo
- `nodeExpander.ts` - Expansão 1-hop
- `subgraphGenerator.ts` - Geração de subgrafos
- `pathFinder.ts` - Algoritmos de caminho
