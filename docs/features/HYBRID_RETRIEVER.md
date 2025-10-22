# Hybrid Retriever - Documentação Completa

## 📖 Visão Geral

O **HybridRetriever** é um sistema de recuperação de contexto poderoso e flexível que combina múltiplas estratégias de busca para encontrar informações relevantes em diferentes fontes:

- 🔍 **Code Graph**: Busca semântica no grafo de código
- 📚 **Documentation**: Busca em documentação indexada
- 🛡️ **Prevention Rules**: Busca em regras de prevenção categorizadas
- ✅ **Tasks**: Busca em tasks ativas e completadas

## 🎯 Características Principais

### 1. **Multi-Source Fusion**
Busca simultânea em múltiplas fontes com weighted scoring:
```typescript
{
  codeWeight: 0.4,        // 40% para código
  docWeight: 0.3,         // 30% para documentação
  preventionWeight: 0.2,  // 20% para prevention rules
  taskWeight: 0.1         // 10% para tasks
}
```

### 2. **Estratégias de Retrieval**
- **Hybrid** (padrão): Combina todas as estratégias com pesos
- **Semantic**: Busca por similaridade semântica
- **Keyword**: Busca por palavras-chave exatas
- **Graph**: Busca baseada em travessia do grafo

### 3. **Re-Ranking Inteligente**
Sistema de re-ranking multi-sinal:
- ✅ Query-context similarity (keyword overlap)
- ✅ Recency boost (conteúdo recente tem prioridade)
- ✅ Category matching (filtro por categoria)
- ✅ Content quality (estrutura e tamanho do conteúdo)

### 4. **Filtering & Scoring**
- Minimum score threshold (padrão: 0.5)
- Maximum results limiting
- Category-based filtering
- File type filtering

## 🚀 Uso Básico

### Instalação

```typescript
import { HybridRetriever } from './services/hybrid-retriever';
import type { GraphData } from './domains/graph/types';

// Inicializar com graph data (opcional)
const retriever = new HybridRetriever(graphData);

// Ou inicializar sem graph e adicionar depois
const retriever = new HybridRetriever();
retriever.setGraphData(graphData);
```

### Busca Simples

```typescript
// Busca básica com defaults
const result = await retriever.retrieve('JWT authentication');

console.log(`Found ${result.contexts.length} contexts`);
result.contexts.forEach(ctx => {
  console.log(`[${ctx.source}] ${ctx.metadata.title} (score: ${ctx.score})`);
  console.log(`  ${ctx.snippet}`);
});
```

### Busca Avançada

```typescript
// Busca customizada com múltiplas opções
const result = await retriever.retrieve('database migration', {
  strategy: 'hybrid',
  maxResults: 20,
  minScore: 0.6,
  sources: ['code', 'documentation', 'prevention'],
  codeWeight: 0.5,
  docWeight: 0.3,
  preventionWeight: 0.2,
  category: 'database',
  rerank: true,
  includeRelated: true
});
```

## 📊 Tipos e Interfaces

### RetrievedContext

```typescript
interface RetrievedContext {
  id: string;                    // Identificador único
  content: string;               // Conteúdo completo
  source: ContextSource;         // Fonte do contexto
  score: number;                 // Score de relevância (0-1)
  filePath?: string;             // Caminho do arquivo
  metadata: {
    title?: string;              // Título do contexto
    category?: string;           // Categoria
    keywords?: string[];         // Keywords extraídas
    type?: string;               // Tipo (function, class, etc)
    lastModified?: string;       // Data de modificação
  };
  snippet?: string;              // Trecho destacando match
}
```

### HybridRetrieverOptions

```typescript
interface HybridRetrieverOptions {
  strategy?: RetrievalStrategy;        // 'hybrid' | 'semantic' | 'keyword' | 'graph'
  maxResults?: number;                 // Limite de resultados (padrão: 10)
  minScore?: number;                   // Score mínimo (padrão: 0.5)
  sources?: ContextSource[];           // Fontes para buscar
  codeWeight?: number;                 // Peso para código (0-1)
  docWeight?: number;                  // Peso para docs (0-1)
  preventionWeight?: number;           // Peso para prevention rules (0-1)
  taskWeight?: number;                 // Peso para tasks (0-1)
  rerank?: boolean;                    // Habilitar re-ranking (padrão: true)
  includeRelated?: boolean;            // Incluir contextos relacionados
  category?: string;                   // Filtrar por categoria
  fileTypes?: string[];                // Filtrar por tipos de arquivo
}
```

### HybridRetrieverResult

```typescript
interface HybridRetrieverResult {
  contexts: RetrievedContext[];        // Contextos recuperados
  metadata: {
    query: string;                     // Query executada
    strategy: RetrievalStrategy;       // Estratégia usada
    totalFound: number;                // Total encontrado
    returned: number;                  // Total retornado
    sourceBreakdown: Record<ContextSource, number>; // Breakdown por fonte
    retrievalTimeMs: number;           // Tempo de execução (ms)
    reranked: boolean;                 // Se foi re-ranqueado
  };
}
```

## 💡 Exemplos de Uso

### 1. Buscar Contexto para Feature Específica

```typescript
// Buscar tudo relacionado a autenticação
const authContext = await retriever.retrieve('JWT authentication', {
  category: 'auth',
  maxResults: 15,
  sources: ['code', 'documentation', 'prevention']
});

// Usar contextos para gerar código
const codeSnippets = authContext.contexts
  .filter(ctx => ctx.source === 'code')
  .map(ctx => ctx.content);

const preventionRules = authContext.contexts
  .filter(ctx => ctx.source === 'prevention')
  .map(ctx => ctx.content);
```

### 2. Buscar Documentação Relevante

```typescript
// Apenas documentação, alta relevância
const docs = await retriever.retrieve('API design patterns', {
  sources: ['documentation'],
  minScore: 0.7,
  docWeight: 1.0,
  rerank: true
});

console.log('Documentos relevantes:');
docs.contexts.forEach(doc => {
  console.log(`📄 ${doc.metadata.title}`);
  console.log(`   ${doc.filePath}`);
  console.log(`   Score: ${doc.score.toFixed(2)}\n`);
});
```

### 3. Buscar Prevention Rules por Categoria

```typescript
// Buscar rules de database
const dbRules = await retriever.retrieve('SQL injection validation', {
  sources: ['prevention'],
  category: 'database',
  preventionWeight: 1.0,
  maxResults: 5
});

// Aplicar rules no código
dbRules.contexts.forEach(rule => {
  console.log(`⚠️  ${rule.metadata.title}`);
  console.log(`   ${rule.snippet}`);
});
```

### 4. Buscar Código Relacionado no Grafo

```typescript
// Busca no grafo com expansão de relacionamentos
const graphContext = await retriever.retrieve('UserService', {
  strategy: 'graph',
  sources: ['code'],
  includeRelated: true,
  maxResults: 20
});

// Analisar dependências
const nodes = graphContext.contexts.map(ctx => ctx.id);
console.log(`Found ${nodes.length} related code elements`);
```

### 5. Buscar Tasks Similares

```typescript
// Encontrar tasks relacionadas
const relatedTasks = await retriever.retrieve('implement authentication', {
  sources: ['task'],
  taskWeight: 1.0,
  rerank: true
});

console.log('Tasks relacionadas:');
relatedTasks.contexts.forEach(task => {
  console.log(`✓ ${task.metadata.title}`);
  console.log(`  Category: ${task.metadata.category}`);
  console.log(`  Modified: ${task.metadata.lastModified}\n`);
});
```

### 6. Busca Híbrida Completa

```typescript
// Busca em todas as fontes com pesos balanceados
const fullContext = await retriever.retrieve('user profile management', {
  strategy: 'hybrid',
  maxResults: 30,
  minScore: 0.4,
  sources: ['code', 'documentation', 'prevention', 'task'],
  codeWeight: 0.4,
  docWeight: 0.3,
  preventionWeight: 0.2,
  taskWeight: 0.1,
  rerank: true,
  includeRelated: true
});

// Agrupar por fonte
const bySource = fullContext.contexts.reduce((acc, ctx) => {
  if (!acc[ctx.source]) acc[ctx.source] = [];
  acc[ctx.source].push(ctx);
  return acc;
}, {} as Record<ContextSource, RetrievedContext[]>);

console.log('Contexto Completo:');
console.log(`📊 Source Breakdown:`, fullContext.metadata.sourceBreakdown);
console.log(`⏱️  Retrieval Time: ${fullContext.metadata.retrievalTimeMs}ms`);
```

## 🎯 Casos de Uso

### Para LLM/RAG Integration

```typescript
async function getContextForLLM(query: string): Promise<string> {
  const result = await retriever.retrieve(query, {
    strategy: 'hybrid',
    maxResults: 10,
    minScore: 0.6,
    rerank: true
  });
  
  // Formatar contextos para o LLM
  const contextText = result.contexts
    .map(ctx => `[${ctx.source}] ${ctx.metadata.title}\n${ctx.content}`)
    .join('\n\n---\n\n');
  
  return contextText;
}

// Usar com Copilot
const context = await getContextForLLM('implement JWT validation');
// Passar context para o LLM...
```

### Para Code Review

```typescript
async function getReviewContext(filePath: string): Promise<RetrievedContext[]> {
  const fileName = path.basename(filePath);
  
  const result = await retriever.retrieve(fileName, {
    sources: ['prevention', 'documentation'],
    preventionWeight: 0.6,
    docWeight: 0.4,
    category: inferCategoryFromPath(filePath),
    maxResults: 10
  });
  
  return result.contexts;
}
```

### Para Task Creation

```typescript
async function getTaskContext(taskDescription: string): Promise<HybridRetrieverResult> {
  return await retriever.retrieve(taskDescription, {
    sources: ['task', 'prevention', 'documentation'],
    taskWeight: 0.4,
    preventionWeight: 0.3,
    docWeight: 0.3,
    rerank: true,
    includeRelated: true
  });
}
```

## ⚙️ Configuração Avançada

### Custom Weights por Projeto

```typescript
// Para projeto focado em docs
const docsRetriever = new HybridRetriever(graphData);
const docsResult = await docsRetriever.retrieve('architecture', {
  docWeight: 0.6,
  codeWeight: 0.2,
  preventionWeight: 0.1,
  taskWeight: 0.1
});

// Para projeto focado em código
const codeRetriever = new HybridRetriever(graphData);
const codeResult = await codeRetriever.retrieve('refactor service', {
  codeWeight: 0.7,
  docWeight: 0.1,
  preventionWeight: 0.1,
  taskWeight: 0.1
});
```

### Filtros Avançados

```typescript
const result = await retriever.retrieve('API endpoint', {
  category: 'api',
  fileTypes: ['.ts', '.js'],
  minScore: 0.7,
  sources: ['code', 'documentation']
});
```

## 🔧 Performance

- **Parallel Retrieval**: Busca em múltiplas fontes simultaneamente
- **Lazy Loading**: Carrega apenas o necessário
- **Score Caching**: Cache de scores calculados
- **Incremental Re-ranking**: Re-ranking eficiente

### Benchmarks (estimados)

- Busca simples: ~50-100ms
- Busca híbrida completa: ~200-400ms
- Com re-ranking: +50-100ms
- Com related contexts: +100-200ms

## 🐛 Troubleshooting

### Poucos Resultados

```typescript
// Diminuir minScore
const result = await retriever.retrieve(query, {
  minScore: 0.3  // Padrão é 0.5
});

// Aumentar maxResults
const result = await retriever.retrieve(query, {
  maxResults: 50  // Padrão é 10
});
```

### Resultados Irrelevantes

```typescript
// Aumentar minScore
const result = await retriever.retrieve(query, {
  minScore: 0.7  // Mais restritivo
});

// Habilitar re-ranking
const result = await retriever.retrieve(query, {
  rerank: true
});

// Filtrar por categoria
const result = await retriever.retrieve(query, {
  category: 'auth'
});
```

### Performance Lenta

```typescript
// Limitar fontes
const result = await retriever.retrieve(query, {
  sources: ['code']  // Apenas código
});

// Reduzir maxResults
const result = await retriever.retrieve(query, {
  maxResults: 5
});

// Desabilitar related contexts
const result = await retriever.retrieve(query, {
  includeRelated: false
});
```

## 🚀 Próximas Melhorias

- [ ] Vector embeddings para semantic search real
- [ ] Cache de resultados frequentes
- [ ] Índice invertido para keyword search
- [ ] Support para custom scorers
- [ ] Feedback loop para melhorar ranking
- [ ] Streaming de resultados
- [ ] Cluster-based retrieval

## 📝 Contribuindo

Contribuições são bem-vindas! Áreas que precisam de atenção:

1. **Semantic Search Real**: Integrar embeddings (OpenAI, local models)
2. **Advanced Re-ranking**: ML-based re-ranking
3. **Performance**: Otimizações de cache e índices
4. **Testing**: Mais testes de integração

---

**Criado por**: Cappy Team  
**Versão**: 3.0.0  
**Última atualização**: 20 de outubro de 2025
