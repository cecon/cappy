# Pipeline de Filtragem de Entidades

## Visão Geral

Este módulo implementa o **fluxo completo de filtragem** que acontece entre a extração do AST e o armazenamento no banco de dados. O objetivo é **reduzir ruído** e manter apenas entidades relevantes para o grafo de conhecimento.

> 💡 **Analogia**: É como limpar e organizar uma biblioteca. Você não guarda cada rascunho e anotação temporária - apenas livros completos e bem catalogados. O pipeline faz isso com código: mantém a estrutura importante (classes, funções públicas, dependências) e descarta detalhes de implementação (variáveis temporárias, tipos primitivos).

## Fluxo do Pipeline

```
┌─────────────┐
│ Código      │
│ Fonte       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ AST Parser  │ ← TypeScript/JavaScript/PHP/etc
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ETAPA 1:    │ ← Extração bruta do AST
│ Entidades   │   • Imports (20)
│ Brutas      │   • Exports (5)
│             │   • Classes (3)
│ Total: 150  │   • Funções (15)
└──────┬──────┘   • Variáveis (50)
       │          • TypeRefs (40)
       │          • Calls (17)
       ▼
┌─────────────┐
│ ETAPA 2:    │ ← Filtro de Relevância
│ Filtradas   │   ❌ Variáveis locais
│             │   ❌ Tipos primitivos
│ Total: 80   │   ❌ Imports de assets
└──────┬──────┘   ❌ Membros privados (score reduzido)
       │
       ▼
┌─────────────┐
│ ETAPA 3:    │ ← Deduplicação
│ Dedupli-    │   🔗 Merge imports do mesmo pacote
│ cadas       │   🔗 Combina specifiers
│             │   🔗 Conta ocorrências
│ Total: 45   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ETAPA 4:    │ ← Normalização
│ Normali-    │   📦 Resolve package.json
│ zadas       │   🏷️  Categoriza (internal/external/builtin)
│             │   🔄 Normaliza paths
│ Total: 45   │   📊 Adiciona metadata
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ETAPA 5:    │ ← Enriquecimento
│ Enriquecidas│   🔗 Infere relacionamentos
│             │   📈 Calcula confiança
│ Total: 45   │   📚 Extrai documentação
└──────┬──────┘   ✍️  Extrai assinaturas
       │
       ▼
┌─────────────┐
│ Banco de    │ ← SQLite + Vector Store + Graph
│ Dados       │
└─────────────┘
```

## Exemplo Prático

### Código de Entrada

```typescript
import { Router } from 'express';
import './styles.css';

class UserService {
  private db: Database;
  
  async getUser(id: string) {
    const temp = 'SELECT * FROM users';
    return this.db.query(temp);
  }
}

export { UserService };
```

### Entidades Brutas (Extraídas do AST)

```javascript
[
  { type: 'import', name: 'Router', source: 'express' },
  { type: 'import', name: 'styles.css', source: './styles.css' },
  { type: 'class', name: 'UserService' },
  { type: 'variable', name: 'db', isPrivate: true },
  { type: 'function', name: 'getUser' },
  { type: 'typeRef', name: 'string' },
  { type: 'variable', name: 'temp', scope: 'local' },
  { type: 'typeRef', name: 'Database' },
  { type: 'call', name: 'query' },
  { type: 'export', name: 'UserService' }
]
// Total: 10 entidades
```

### Após Filtro 1: Relevância

```javascript
[
  { type: 'import', name: 'Router', source: 'express', relevanceScore: 1.0 },
  // ❌ './styles.css' REMOVIDO (asset import)
  { type: 'class', name: 'UserService', relevanceScore: 1.0 },
  { type: 'variable', name: 'db', isPrivate: true, relevanceScore: 0.3 },
  { type: 'function', name: 'getUser', relevanceScore: 1.0 },
  // ❌ 'string' REMOVIDO (tipo primitivo)
  // ❌ 'temp' REMOVIDO (variável local)
  { type: 'typeRef', name: 'Database', relevanceScore: 1.0 },
  { type: 'call', name: 'query', relevanceScore: 1.0 },
  { type: 'export', name: 'UserService', relevanceScore: 1.0 }
]
// Total: 7 entidades (-3 descartadas)
```

### Após Filtro 2: Deduplicação

```javascript
// Neste exemplo não há duplicatas, mas se houvesse:
[
  { 
    type: 'import', 
    source: 'express', 
    specifiers: ['Router', 'Request', 'Response'], // ← Combinado
    occurrences: 3, // ← Contado
    mergedFrom: ['line-1', 'line-2', 'line-2']
  }
]
```

### Após Filtro 3: Normalização

```javascript
[
  { 
    type: 'import',
    name: 'Router',
    source: 'express',
    normalizedName: 'Router',
    category: 'external', // ← Categorizado
    packageInfo: { // ← Resolvido do package.json
      name: 'express',
      version: '4.18.2',
      manager: 'npm',
      isDevDependency: false
    }
  },
  // ... outras entidades
]
```

### Após Filtro 4: Enriquecimento (Salvo no Banco)

```javascript
[
  { 
    type: 'import',
    name: 'Router',
    source: 'express',
    confidence: 1.0, // ← Confiança calculada
    relationships: [ // ← Relacionamentos inferidos
      { 
        target: 'express', 
        type: 'imports', 
        confidence: 1.0 
      }
    ],
    packageInfo: { /* ... */ }
  },
  { 
    type: 'export',
    name: 'UserService',
    confidence: 1.2, // ← Exports têm confiança aumentada
    relationships: [
      { 
        target: 'UserService', 
        type: 'exports', 
        confidence: 1.2 
      }
    ]
  }
]
// Total: 7 entidades finais
```

## Configuração

```typescript
const pipeline = new EntityFilterPipeline({
  // Filtro 1: Relevância
  skipLocalVariables: true,    // Descarta variáveis locais
  skipPrimitiveTypes: true,     // Descarta string, number, etc
  skipAssetImports: true,       // Descarta .css, .png, etc
  skipPrivateMembers: false,    // Mantém mas reduz score
  
  // Filtro 2: Deduplicação
  mergeIdenticalEntities: true, // Mescla duplicatas
  mergeImportsBySource: true,   // Combina imports do mesmo pacote
  
  // Filtro 3: Normalização
  resolvePackageInfo: true,     // Busca info no package.json
  normalizePathSeparators: true, // ./ → / (consistência)
  
  // Filtro 4: Enriquecimento
  extractSignatures: true,      // Extrai assinaturas de funções
  extractDocumentation: false,  // Extrai JSDoc (custoso)
  inferRelationships: true,     // Infere imports/exports/calls
  calculateConfidence: true     // Calcula score de confiança
});
```

## Uso

```typescript
import { EntityFilterPipeline } from './entity-filter-pipeline';

// 1. Extrair entidades brutas do AST
const rawEntities = extractFromAST(code);

// 2. Processar através do pipeline
const result = await pipeline.process(
  rawEntities,
  '/workspace/src/user-service.ts'
);

// 3. Salvar no banco apenas entidades finais
for (const entity of result.enriched) {
  await db.saveEntity(entity);
  
  // Salvar relacionamentos no grafo
  for (const rel of entity.relationships) {
    await graphStore.createRelationship(
      entity.name,
      rel.target,
      rel.type,
      rel.confidence
    );
  }
}

// 4. Ver estatísticas
console.log(`Processadas: ${result.stats.finalCount} entidades`);
console.log(`Descartadas: ${result.stats.discardedCount} entidades`);
console.log(`Taxa de compressão: ${(1 - result.stats.finalCount / result.stats.totalRaw) * 100}%`);
```

## Executar Demonstração

```bash
cd src/nivel2/infrastructure/services/entity-filtering
npx ts-node example-pipeline-demo.ts
```

Isso mostrará o fluxo completo com exemplos visuais de cada etapa.

## Estatísticas Típicas

Para um projeto médio (1500 arquivos):

```
Entidades brutas:       ~225,000  (extraídas do AST)
Após filtro relevância: ~80,000   (-145k descartadas)
Após deduplicação:      ~50,000   (-30k mescladas)
Entidades finais:       ~50,000   (salvas no banco)

Taxa de compressão:     ~78%
Tempo por arquivo:      ~5-15ms
```

## Por Que Filtrar?

### ✅ Vantagens

1. **Performance**: Menos dados = consultas mais rápidas
2. **Custos**: Menos embeddings = menos API calls
3. **Qualidade**: Menos ruído = resultados mais relevantes
4. **Manutenção**: Menos dados = mais fácil de debugar

### ❌ Sem Filtragem

- Banco com 225k entidades (ingerenciável)
- Embeddings custando $50+/mês
- Consultas lentas (>1s)
- Resultados poluídos com ruído

### ✅ Com Filtragem

- Banco com 50k entidades (gerenciável)
- Embeddings custando $10/mês
- Consultas rápidas (<100ms)
- Resultados precisos e relevantes

## Relacionamentos Externos

Entidades externas são identificadas através de:

1. **Análise de imports**: `from 'express'` → external
2. **Resolução package.json**: Busca versão e metadata
3. **Categorização**: builtin (fs, path) vs external (express, react) vs internal (./utils)
4. **Tracking**: Salva no grafo como `USES` ou `IMPORTS`

```javascript
// Exemplo de entidade externa enriquecida:
{
  type: 'import',
  name: 'Router',
  source: 'express',
  category: 'external',
  packageInfo: {
    name: 'express',
    version: '4.18.2',
    manager: 'npm',
    isDevDependency: false
  },
  relationships: [
    {
      target: 'express',
      type: 'imports',
      confidence: 1.0
    }
  ]
}
```

## Arquitetura

```
entity-filtering/
├── entity-filter-pipeline.ts    ← Pipeline principal
├── example-pipeline-demo.ts     ← Demonstração prática
├── README.md                     ← Esta documentação
└── __tests__/
    └── pipeline.test.ts          ← Testes
```

## Ver Também

- `file-processing-worker.ts` - Worker que usa o pipeline
- `ast-relationship-extractor.ts` - Extração de relacionamentos
- `parser-service.ts` - Parsers por linguagem
- `indexing-service.ts` - Indexação após filtragem
