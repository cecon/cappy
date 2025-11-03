# Retrieval Domain - Arquitetura Hexagonal

## 📋 Visão Geral

O domínio de **Retrieval** (Recuperação de Contexto) foi refatorado seguindo os princípios da **Arquitetura Hexagonal** (Ports & Adapters), separando a lógica de negócio das implementações técnicas.

## 🏗️ Estrutura

```
src/domains/retrieval/
├── types/                          # Tipos e interfaces do domínio
│   └── index.ts                    # ContextSource, RetrievalOptions, RetrievalResult, etc.
├── ports/                          # Interfaces (contratos)
│   ├── content-retriever-port.ts   # Port para recuperação de conteúdo
│   ├── scoring-port.ts             # Port para scoring e weighting
│   ├── reranking-port.ts           # Port para re-ranking
│   └── index.ts
├── use-cases/                      # Casos de uso (lógica de negócio)
│   ├── retrieve-context-use-case.ts
│   └── index.ts
└── entities/                       # Entidades do domínio (vazias por enquanto)

src/nivel2/infrastructure/adapters/retrieval/
├── graph-content-adapter.ts        # Implementação: recuperação do graph database
├── doc-content-adapter.ts          # Implementação: recuperação de documentação
├── scoring-adapter.ts              # Implementação: scoring e weights
├── reranking-adapter.ts            # Implementação: re-ranking avançado
└── index.ts

src/nivel2/infrastructure/services/
└── hybrid-retriever.ts             # Thin wrapper (orquestrador) - mantém compatibilidade
```

## 🎯 Princípios Aplicados

### 1. **Separation of Concerns**
- **Domain** (`src/domains/retrieval`): Contém a lógica de negócio pura, sem dependências de infraestrutura
- **Infrastructure** (`src/nivel2/infrastructure/adapters`): Implementações técnicas que dependem de bibliotecas externas

### 2. **Dependency Inversion**
- O domínio define **ports** (interfaces)
- A infraestrutura implementa **adapters** (classes concretas)
- As dependências apontam sempre para o domínio (interior), nunca o contrário

### 3. **Testability**
- Use cases podem ser testados isoladamente com mocks dos ports
- Adapters podem ser testados independentemente
- Facilita TDD (Test-Driven Development)

## 🔌 Ports (Interfaces)

### ContentRetrieverPort
Interface para recuperação de conteúdo de uma fonte específica.

```typescript
interface ContentRetrieverPort {
  retrieve(query: string, options: RetrievalOptions): Promise<RetrievedContext[]>;
  getSourceType(): 'code' | 'documentation' | 'metadata';
}
```

**Implementações:**
- `GraphContentAdapter`: Recupera do graph database (código)
- `DocContentAdapter`: Filtra documentação do graph database

### ScoringPort
Interface para aplicar scoring e weighting aos contextos.

```typescript
interface ScoringPort {
  applyWeightedScoring(contexts: RetrievedContext[], options: RetrievalOptions): RetrievedContext[];
  calculateNormalizedWeights(contexts: RetrievedContext[], baseWeights: SourceWeights): Partial<SourceWeights>;
}
```

**Implementação:**
- `ScoringAdapter`: Aplica pesos normalizados baseados nas fontes disponíveis

### RerankingPort
Interface para re-ranking avançado baseado em sinais múltiplos.

```typescript
interface RerankingPort {
  rerank(query: string, contexts: RetrievedContext[], options: RetrievalOptions): Promise<RetrievedContext[]>;
}
```

**Implementação:**
- `RerankingAdapter`: Re-ranking por keyword overlap, recency, categoria, qualidade do conteúdo

## 📦 Use Cases

### RetrieveContextUseCase
**Responsabilidade:** Orquestrar o processo completo de recuperação de contexto.

**Fluxo:**
1. Valida a query de entrada
2. Executa retrieval em paralelo de múltiplas fontes (code, docs)
3. Aplica weighted scoring
4. Filtra por score mínimo
5. Re-rankeia os resultados
6. Ordena e limita a quantidade de resultados
7. Retorna `RetrievalResult` com metadados

**Injeção de Dependências:**
```typescript
constructor(
  scoringService: ScoringPort,
  rerankingService: RerankingPort,
  codeRetriever?: ContentRetrieverPort,
  docRetriever?: ContentRetrieverPort
)
```

## 🔄 Fluxo de Execução

```
┌─────────────────────────────────────────────────────────────┐
│  HybridRetriever (Thin Wrapper)                             │
│  - Cria instâncias dos adapters                             │
│  - Injeta dependências no use case                          │
│  - Delega chamadas para RetrieveContextUseCase              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  RetrieveContextUseCase (Domain)                            │
│  1. Valida input                                            │
│  2. Chama ContentRetrieverPort.retrieve() (code + docs)     │
│  3. Chama ScoringPort.applyWeightedScoring()                │
│  4. Filtra por minScore                                     │
│  5. Chama RerankingPort.rerank()                            │
│  6. Retorna RetrievalResult                                 │
└─────────────┬───────────────────────┬───────────────────────┘
              │                       │
              ▼                       ▼
┌────────────────────────┐  ┌────────────────────────┐
│  GraphContentAdapter   │  │  DocContentAdapter     │
│  (Infrastructure)      │  │  (Infrastructure)      │
│  - Query graph DB      │  │  - Filtra por tipo     │
│  - Extrai chunks       │  │  - Classifica fonte    │
│  - Calcula scores      │  │                        │
└────────────────────────┘  └────────────────────────┘
```

## 🧪 Como Testar

### Testando o Use Case (Isolado)
```typescript
import { RetrieveContextUseCase } from './use-cases';

// Mock dos ports
const mockCodeRetriever: ContentRetrieverPort = {
  retrieve: vi.fn().mockResolvedValue([/* ... */]),
  getSourceType: () => 'code'
};

const mockScoring: ScoringPort = {
  applyWeightedScoring: vi.fn(contexts => contexts),
  calculateNormalizedWeights: vi.fn()
};

const mockReranking: RerankingPort = {
  rerank: vi.fn(async (_, contexts) => contexts)
};

// Criar use case com mocks
const useCase = new RetrieveContextUseCase(
  mockScoring,
  mockReranking,
  mockCodeRetriever
);

// Testar
const result = await useCase.execute('test query', { maxResults: 5 });
expect(result.contexts).toHaveLength(5);
expect(mockCodeRetriever.retrieve).toHaveBeenCalled();
```

### Testando Adapters (Integração)
```typescript
import { GraphContentAdapter } from './adapters/retrieval';

const graphStore = createTestGraphStore(); // Helper de teste
const adapter = new GraphContentAdapter(graphStore);

const contexts = await adapter.retrieve('function', { maxResults: 10 });
expect(contexts.every(c => c.source === 'code')).toBe(true);
```

## 🔧 Como Usar

### Uso Básico (via HybridRetriever)
```typescript
import { HybridRetriever } from './nivel2/infrastructure/services/hybrid-retriever';

const retriever = new HybridRetriever(graphData, graphStore);

const result = await retriever.retrieve('authentication logic', {
  strategy: 'hybrid',
  maxResults: 20,
  minScore: 0.6,
  sources: ['code', 'documentation'],
  codeWeight: 0.6,
  docWeight: 0.4
});

console.log(`Found ${result.contexts.length} contexts`);
```

### Uso Avançado (Injeção Customizada)
```typescript
import { RetrieveContextUseCase } from './domains/retrieval/use-cases';
import { 
  GraphContentAdapter, 
  ScoringAdapter, 
  RerankingAdapter 
} from './nivel2/infrastructure/adapters/retrieval';

// Criar adapters customizados
const codeAdapter = new GraphContentAdapter(myGraphStore);
const scoring = new ScoringAdapter();
const reranking = new RerankingAdapter();

// Criar use case com injeção manual
const useCase = new RetrieveContextUseCase(
  scoring,
  reranking,
  codeAdapter
);

// Usar diretamente
const result = await useCase.execute('search term', options);
```

## 📝 Vantagens da Refatoração

### ✅ Antes (Monolítico)
- `HybridRetriever` tinha ~900 linhas
- Lógica de negócio misturada com implementação
- Difícil de testar isoladamente
- Acoplamento forte com GraphStorePort e GraphData
- Difícil de estender com novos retrievers

### ✅ Depois (Hexagonal)
- Código separado por responsabilidade
- Domain independente de infraestrutura
- Fácil de testar com mocks
- Baixo acoplamento (dependency injection)
- Fácil adicionar novos adapters (ex: VectorContentAdapter)
- `HybridRetriever` é apenas um thin wrapper (~100 linhas)

## 🚀 Próximos Passos

1. **Adicionar mais adapters:**
   - `VectorContentAdapter` para busca vetorial pura
   - `MetadataContentAdapter` para busca em metadados de arquivos

2. **Implementar cache:**
   - Criar `CachedContentRetrieverAdapter` (decorator pattern)
   - Cache LRU para queries frequentes

3. **Adicionar métricas:**
   - Tempo de retrieval por fonte
   - Hit rate do cache
   - Score distribution

4. **Melhorar re-ranking:**
   - Implementar BM25 para keyword scoring
   - Adicionar semantic embeddings
   - Cross-encoder para re-ranking neural

## 📚 Referências

- [Hexagonal Architecture (Alistair Cockburn)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
