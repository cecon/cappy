# 🚀 HybridRetriever - Quick Start

## ⚡ Instalação Rápida

```typescript
import { HybridRetriever } from './services/hybrid-retriever';
import type { GraphData } from './domains/graph/types';

// 1. Inicializar
const retriever = new HybridRetriever(graphData);

// 2. Buscar
const result = await retriever.retrieve('JWT authentication');

// 3. Usar
console.log(`Found ${result.contexts.length} contexts in ${result.metadata.retrievalTimeMs}ms`);
```

## 📚 Exemplos Rápidos

### Busca Básica

```typescript
const result = await retriever.retrieve('database migration');

result.contexts.forEach(ctx => {
  console.log(`[${ctx.source}] ${ctx.metadata.title}`);
  console.log(`Score: ${ctx.score.toFixed(2)}`);
});
```

### Para RAG/LLM

```typescript
const result = await retriever.retrieve('implement OAuth2', {
  maxResults: 10,
  minScore: 0.6,
  sources: ['code', 'documentation', 'prevention'],
  rerank: true
});

const context = result.contexts
  .map(ctx => `${ctx.metadata.title}\n${ctx.content}`)
  .join('\n\n---\n\n');

// Use 'context' com seu LLM
```

### Buscar Código

```typescript
const code = await retriever.retrieve('authentication service', {
  sources: ['code'],
  codeWeight: 1.0,
  includeRelated: true
});
```

### Buscar Documentação

```typescript
const docs = await retriever.retrieve('API design patterns', {
  sources: ['documentation'],
  docWeight: 1.0,
  minScore: 0.7
});
```

### Buscar Prevention Rules

```typescript
const rules = await retriever.retrieve('SQL injection', {
  sources: ['prevention'],
  category: 'database',
  preventionWeight: 1.0
});
```

### Busca Híbrida Completa

```typescript
const fullContext = await retriever.retrieve('user management', {
  strategy: 'hybrid',
  sources: ['code', 'documentation', 'prevention', 'task'],
  codeWeight: 0.4,
  docWeight: 0.3,
  preventionWeight: 0.2,
  taskWeight: 0.1,
  maxResults: 20,
  rerank: true
});

console.log('Source Breakdown:', fullContext.metadata.sourceBreakdown);
```

## 🎯 Casos de Uso

### 1. Context for Task Creation

```typescript
async function getTaskContext(description: string) {
  const result = await retriever.retrieve(description, {
    sources: ['task', 'prevention', 'documentation'],
    taskWeight: 0.4,
    preventionWeight: 0.3,
    docWeight: 0.3
  });
  
  return {
    relatedTasks: result.contexts.filter(c => c.source === 'task'),
    rules: result.contexts.filter(c => c.source === 'prevention'),
    docs: result.contexts.filter(c => c.source === 'documentation')
  };
}
```

### 2. Code Review Assistant

```typescript
async function getReviewContext(filePath: string) {
  const fileName = path.basename(filePath);
  
  return await retriever.retrieve(fileName, {
    sources: ['prevention', 'documentation'],
    preventionWeight: 0.6,
    docWeight: 0.4,
    minScore: 0.6
  });
}
```

### 3. Smart Search

```typescript
async function smartSearch(query: string) {
  // Adapta estratégia baseado na query
  const isCodeQuery = /class|function|method/.test(query);
  const isDocQuery = /how to|guide|tutorial/.test(query);
  
  if (isCodeQuery) {
    return await retriever.retrieve(query, {
      sources: ['code'],
      codeWeight: 1.0,
      includeRelated: true
    });
  } else if (isDocQuery) {
    return await retriever.retrieve(query, {
      sources: ['documentation'],
      docWeight: 1.0
    });
  } else {
    return await retriever.retrieve(query, {
      strategy: 'hybrid'
    });
  }
}
```

## ⚙️ Configuração

### Defaults

```typescript
{
  strategy: 'hybrid',
  maxResults: 10,
  minScore: 0.5,
  sources: ['code', 'documentation', 'prevention'],
  codeWeight: 0.4,
  docWeight: 0.3,
  preventionWeight: 0.2,
  taskWeight: 0.1,
  rerank: true,
  includeRelated: true
}
```

### Custom Config

```typescript
const retriever = new HybridRetriever(graphData);

// Docs-focused project
const docsResult = await retriever.retrieve(query, {
  docWeight: 0.6,
  codeWeight: 0.2,
  preventionWeight: 0.1,
  taskWeight: 0.1
});

// Code-focused project
const codeResult = await retriever.retrieve(query, {
  codeWeight: 0.7,
  docWeight: 0.1,
  preventionWeight: 0.1,
  taskWeight: 0.1
});
```

## 📊 Response Structure

```typescript
{
  contexts: [
    {
      id: 'doc-123',
      content: 'Full content...',
      source: 'documentation',
      score: 0.87,
      filePath: '/docs/auth.md',
      metadata: {
        title: 'Authentication Guide',
        category: 'auth',
        keywords: ['jwt', 'oauth', 'security'],
        lastModified: '2025-10-20T10:00:00Z'
      },
      snippet: '...JWT token validation...'
    }
  ],
  metadata: {
    query: 'JWT authentication',
    strategy: 'hybrid',
    totalFound: 25,
    returned: 10,
    sourceBreakdown: {
      code: 4,
      documentation: 3,
      prevention: 2,
      task: 1,
      metadata: 0
    },
    retrievalTimeMs: 150,
    reranked: true
  }
}
```

## 🔧 Tips & Tricks

### Aumentar Relevância

```typescript
// Mais restritivo
await retriever.retrieve(query, {
  minScore: 0.7,  // Padrão é 0.5
  rerank: true
});
```

### Mais Resultados

```typescript
// Busca ampla
await retriever.retrieve(query, {
  maxResults: 50,  // Padrão é 10
  minScore: 0.3
});
```

### Performance

```typescript
// Mais rápido
await retriever.retrieve(query, {
  sources: ['code'],  // Apenas uma fonte
  rerank: false,      // Sem re-ranking
  includeRelated: false
});
```

### Category Filtering

```typescript
// Filtrar por categoria
await retriever.retrieve(query, {
  category: 'auth',  // Apenas categoria 'auth'
  minScore: 0.6
});
```

## 📖 Documentação Completa

Ver: [docs/HYBRID_RETRIEVER.md](./docs/HYBRID_RETRIEVER.md)

## 🧪 Testes

```bash
npm test -- hybrid-retriever
```

## 🎓 Mais Exemplos

Ver: [src/examples/hybrid-retriever-integration.ts](./src/examples/hybrid-retriever-integration.ts)

---

**Criado por**: Cappy Team  
**Versão**: 3.0.0
