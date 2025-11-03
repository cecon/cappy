# Retrieval Domain - Arquitetura Hexagonal (Diagrama)

## 🏗️ Diagrama da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAMADA DE DOMÍNIO                                │
│                  (src/domains/retrieval/)                                │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      USE CASES                                   │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  RetrieveContextUseCase                                  │   │   │
│  │  │                                                           │   │   │
│  │  │  + execute(query, options): RetrievalResult              │   │   │
│  │  │                                                           │   │   │
│  │  │  Orquestra:                                              │   │   │
│  │  │  1. Validação                                            │   │   │
│  │  │  2. Retrieval paralelo (code + docs)                     │   │   │
│  │  │  3. Weighted scoring                                     │   │   │
│  │  │  4. Filtragem por minScore                               │   │   │
│  │  │  5. Re-ranking                                           │   │   │
│  │  │  6. Ordenação e limitação                                │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                           │                                      │   │
│  │                           │ usa                                  │   │
│  │                           ▼                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         PORTS                                    │   │
│  │                     (Interfaces)                                 │   │
│  │                                                                   │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │   │
│  │  │ContentRetriever  │  │   ScoringPort    │  │RerankingPort │  │   │
│  │  │      Port        │  │                  │  │              │  │   │
│  │  ├──────────────────┤  ├──────────────────┤  ├──────────────┤  │   │
│  │  │retrieve()        │  │applyWeighted     │  │rerank()      │  │   │
│  │  │getSourceType()   │  │  Scoring()       │  │              │  │   │
│  │  └──────────────────┘  │calculateNormal   │  └──────────────┘  │   │
│  │                        │  izedWeights()   │                    │   │
│  │                        └──────────────────┘                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         TYPES                                    │   │
│  │                                                                   │   │
│  │  • ContextSource                                                 │   │
│  │  • RetrievalStrategy                                             │   │
│  │  • RetrievedContext                                              │   │
│  │  • RetrievalOptions                                              │   │
│  │  • RetrievalResult                                               │   │
│  │  • SourceWeights                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ implementa
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                   CAMADA DE INFRAESTRUTURA                               │
│           (src/nivel2/infrastructure/adapters/retrieval/)                │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        ADAPTERS                                  │   │
│  │                  (Implementações Concretas)                      │   │
│  │                                                                   │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │   │
│  │  │GraphContent      │  │   DocContent     │  │              │  │   │
│  │  │   Adapter        │  │     Adapter      │  │              │  │   │
│  │  ├──────────────────┤  ├──────────────────┤  │              │  │   │
│  │  │implements        │  │implements        │  │              │  │   │
│  │  │ContentRetriever  │  │ContentRetriever  │  │              │  │   │
│  │  │     Port         │  │     Port         │  │              │  │   │
│  │  │                  │  │                  │  │              │  │   │
│  │  │Busca no graph    │  │Filtra docs do    │  │              │  │   │
│  │  │database (SQLite) │  │graph adapter     │  │              │  │   │
│  │  │                  │  │                  │  │              │  │   │
│  │  │- Query tokens    │  │- Markdown chunks │  │              │  │   │
│  │  │- Match scoring   │  │- Doc sections    │  │              │  │   │
│  │  │- Content map     │  │- File extensions │  │              │  │   │
│  │  └──────────────────┘  └──────────────────┘  │              │  │   │
│  │                                               │              │  │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  │              │  │   │
│  │  │  Scoring         │  │   Reranking      │  │              │  │   │
│  │  │   Adapter        │  │     Adapter      │  │              │  │   │
│  │  ├──────────────────┤  ├──────────────────┤  │              │  │   │
│  │  │implements        │  │implements        │  │              │  │   │
│  │  │  ScoringPort     │  │  RerankingPort   │  │              │  │   │
│  │  │                  │  │                  │  │              │  │   │
│  │  │Weighted scoring  │  │Advanced rerank:  │  │              │  │   │
│  │  │                  │  │                  │  │              │  │   │
│  │  │- Normalize       │  │- Keyword overlap │  │              │  │   │
│  │  │  weights         │  │- Recency boost   │  │              │  │   │
│  │  │- Apply to        │  │- Category match  │  │              │  │   │
│  │  │  contexts        │  │- Content quality │  │              │  │   │
│  │  └──────────────────┘  └──────────────────┘  │              │  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ usa
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                     CAMADA DE SERVIÇOS                                   │
│              (src/nivel2/infrastructure/services/)                       │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │            HybridRetriever (Thin Wrapper)                        │   │
│  │                                                                   │   │
│  │  + constructor(graphData?, graphStore?)                          │   │
│  │  + retrieve(query, options): RetrievalResult                     │   │
│  │  + setGraphData(graphData): void @deprecated                     │   │
│  │                                                                   │   │
│  │  Responsabilidades:                                              │   │
│  │  1. Criar instâncias dos adapters                                │   │
│  │  2. Injetar dependências no use case                             │   │
│  │  3. Delegar chamada para RetrieveContextUseCase                  │   │
│  │  4. Manter compatibilidade com código existente                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Fluxo de Dados

### 1. Inicialização
```
┌──────────────┐
│ extension.ts │
└──────┬───────┘
       │ new HybridRetriever(graphData, graphStore)
       ▼
┌────────────────────┐
│ HybridRetriever    │
│                    │
│ Cria instâncias:   │
│ • GraphContent     │──┐
│   Adapter          │  │
│ • DocContent       │  │
│   Adapter          │  │
│ • ScoringAdapter   │  │
│ • RerankingAdapter │  │
└────────┬───────────┘  │
         │              │
         │ Injeta       │
         ▼              │
┌──────────────────────┐│
│RetrieveContextUseCase││
│                      ││
│ Constructor(         ││
│   scoring,           ││
│   reranking,         ││
│   codeRetriever,     │◀┘
│   docRetriever       │
│ )                    │
└──────────────────────┘
```

### 2. Execução de Query

```
┌────────────┐
│ User/Tool  │
└─────┬──────┘
      │ retrieve("authentication", { maxResults: 10 })
      ▼
┌────────────────────┐
│ HybridRetriever    │
└─────┬──────────────┘
      │ useCase.execute(query, options)
      ▼
┌──────────────────────────────────────────────────────────────┐
│ RetrieveContextUseCase                                        │
│                                                               │
│ 1. Valida query                                              │
│    ✓ query não vazio                                         │
│                                                               │
│ 2. Retrieval paralelo                                        │
│    ┌─────────────────┐          ┌─────────────────┐         │
│    │ GraphContent    │          │ DocContent      │         │
│    │ Adapter         │          │ Adapter         │         │
│    │ .retrieve()     │          │ .retrieve()     │         │
│    └────────┬────────┘          └────────┬────────┘         │
│             │                            │                   │
│             └────────────┬───────────────┘                   │
│                          │                                   │
│                          ▼                                   │
│             allContexts = [...code, ...docs]                 │
│                                                               │
│ 3. Weighted Scoring                                          │
│    ┌─────────────────┐                                       │
│    │ ScoringAdapter  │                                       │
│    │ .applyWeighted  │                                       │
│    │  Scoring()      │                                       │
│    └────────┬────────┘                                       │
│             │                                                 │
│             ▼                                                 │
│    allContexts = [...with adjusted scores]                   │
│                                                               │
│ 4. Filter by minScore                                        │
│    allContexts.filter(ctx => ctx.score >= minScore)          │
│                                                               │
│ 5. Re-ranking                                                │
│    ┌─────────────────┐                                       │
│    │ RerankingAdapter│                                       │
│    │ .rerank()       │                                       │
│    └────────┬────────┘                                       │
│             │                                                 │
│             ▼                                                 │
│    allContexts = [...boosted by signals]                     │
│                                                               │
│ 6. Sort & Limit                                              │
│    allContexts.sort((a,b) => b.score - a.score)              │
│    contexts = allContexts.slice(0, maxResults)               │
│                                                               │
│ 7. Return RetrievalResult                                    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
                ┌──────────────┐
                │RetrievalResult│
                │              │
                │ contexts[]   │
                │ metadata{}   │
                └──────────────┘
```

## 🎯 Responsabilidades por Camada

### Domain Layer (Domínio)
**Localização:** `src/domains/retrieval/`

**Responsabilidades:**
- ✅ Definir regras de negócio (orquestração no use case)
- ✅ Definir contratos (ports/interfaces)
- ✅ Definir tipos do domínio
- ❌ **NÃO** depender de bibliotecas externas
- ❌ **NÃO** saber sobre banco de dados, APIs, frameworks

**Componentes:**
- `RetrieveContextUseCase`: Orquestra o fluxo de retrieval
- `ContentRetrieverPort`, `ScoringPort`, `RerankingPort`: Contratos
- `RetrievalOptions`, `RetrievalResult`, etc: Tipos

### Infrastructure Layer (Infraestrutura)
**Localização:** `src/nivel2/infrastructure/adapters/retrieval/`

**Responsabilidades:**
- ✅ Implementar os ports definidos no domínio
- ✅ Acessar recursos externos (DB, filesystem, APIs)
- ✅ Fazer transformações técnicas (parsing, serialização)
- ❌ **NÃO** conter lógica de negócio
- ❌ **NÃO** acoplar o domínio a detalhes técnicos

**Componentes:**
- `GraphContentAdapter`: Acessa SQLite graph database
- `DocContentAdapter`: Filtra documentação
- `ScoringAdapter`: Implementa algoritmo de scoring
- `RerankingAdapter`: Implementa algoritmo de re-ranking

### Service Layer (Serviços)
**Localização:** `src/nivel2/infrastructure/services/`

**Responsabilidades:**
- ✅ Fornecer interface pública conveniente
- ✅ Gerenciar injeção de dependências
- ✅ Manter compatibilidade com código legacy
- ❌ **NÃO** conter lógica de negócio
- ❌ **NÃO** implementar retrieval diretamente

**Componentes:**
- `HybridRetriever`: Thin wrapper, cria adapters e usa o use case

## 📊 Métricas da Refatoração

### Antes (Monolítico)
```
hybrid-retriever.ts: ~900 linhas
├── Lógica de negócio
├── Acesso ao banco de dados
├── Scoring e weighting
├── Re-ranking
└── Parsing de nodes
```
**Problemas:**
- ❌ Alta complexidade ciclomática
- ❌ Difícil de testar (acoplamento)
- ❌ Difícil de estender (adicionar novo retriever)
- ❌ Difícil de entender (muitas responsabilidades)

### Depois (Hexagonal)
```
domains/retrieval/
├── types/index.ts: ~200 linhas
├── ports/
│   ├── content-retriever-port.ts: ~30 linhas
│   ├── scoring-port.ts: ~40 linhas
│   └── reranking-port.ts: ~20 linhas
└── use-cases/
    └── retrieve-context-use-case.ts: ~150 linhas

infrastructure/adapters/retrieval/
├── graph-content-adapter.ts: ~280 linhas
├── doc-content-adapter.ts: ~70 linhas
├── scoring-adapter.ts: ~80 linhas
└── reranking-adapter.ts: ~60 linhas

infrastructure/services/
└── hybrid-retriever.ts: ~100 linhas (thin wrapper)
```
**Benefícios:**
- ✅ Baixa complexidade ciclomática (cada classe tem uma responsabilidade)
- ✅ Fácil de testar (mocks dos ports)
- ✅ Fácil de estender (adicionar novo adapter)
- ✅ Fácil de entender (separação clara)

## 🧩 Padrões de Design Aplicados

### 1. **Hexagonal Architecture (Ports & Adapters)**
- Domínio no centro, isolado
- Ports definem contratos
- Adapters implementam contratos

### 2. **Dependency Inversion Principle (DIP)**
- Use case depende de abstrações (ports)
- Adapters dependem de abstrações (implementam ports)
- Direção de dependência: Infrastructure → Domain

### 3. **Strategy Pattern**
- `ContentRetrieverPort` define estratégia de retrieval
- Implementações concretas: `GraphContentAdapter`, `DocContentAdapter`
- Use case escolhe qual estratégia usar baseado em `options.sources`

### 4. **Dependency Injection**
- `RetrieveContextUseCase` recebe dependências no construtor
- `HybridRetriever` cria e injeta dependências
- Facilita testes e extensibilidade

### 5. **Facade Pattern**
- `HybridRetriever` é uma facade para o sistema de retrieval
- Esconde complexidade da criação de adapters
- Fornece interface simples: `retrieve(query, options)`

## 🔮 Próximas Evoluções Possíveis

### 1. Vector Search Adapter
```typescript
class VectorContentAdapter implements ContentRetrieverPort {
  constructor(private vectorDb: VectorDB) {}
  
  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievedContext[]> {
    const embedding = await embedQuery(query);
    const results = await this.vectorDb.similaritySearch(embedding, options.maxResults);
    return results.map(toRetrievedContext);
  }
  
  getSourceType(): 'code' {
    return 'code';
  }
}
```

### 2. Cached Retriever (Decorator)
```typescript
class CachedContentRetriever implements ContentRetrieverPort {
  private cache = new LRUCache<string, RetrievedContext[]>(100);
  
  constructor(private wrapped: ContentRetrieverPort) {}
  
  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievedContext[]> {
    const key = `${query}:${JSON.stringify(options)}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const results = await this.wrapped.retrieve(query, options);
    this.cache.set(key, results);
    return results;
  }
  
  getSourceType() {
    return this.wrapped.getSourceType();
  }
}
```

### 3. Neural Reranker
```typescript
class NeuralRerankingAdapter implements RerankingPort {
  constructor(private model: CrossEncoderModel) {}
  
  async rerank(query: string, contexts: RetrievedContext[], options: RetrievalOptions): Promise<RetrievedContext[]> {
    const pairs = contexts.map(ctx => [query, ctx.content]);
    const scores = await this.model.predict(pairs);
    
    return contexts.map((ctx, i) => ({
      ...ctx,
      score: scores[i]
    }));
  }
}
```

### 4. Metrics Port
```typescript
interface MetricsPort {
  recordRetrievalTime(source: ContextSource, timeMs: number): void;
  recordCacheHit(query: string): void;
  recordCacheMiss(query: string): void;
  getMetrics(): RetrievalMetrics;
}

class PrometheusMetricsAdapter implements MetricsPort {
  // Implementação com Prometheus
}
```

## 📖 Conclusão

A refatoração da classe `HybridRetriever` para arquitetura hexagonal trouxe:

1. **Separação de Responsabilidades:** Cada classe tem uma única responsabilidade clara
2. **Testabilidade:** Fácil criar mocks e testar isoladamente
3. **Extensibilidade:** Adicionar novos retrievers é trivial (criar novo adapter)
4. **Manutenibilidade:** Código organizado e fácil de entender
5. **Flexibilidade:** Fácil trocar implementações (ex: SQLite → Vector DB)

A arquitetura está pronta para evoluir com novos adapters e features sem quebrar código existente.
