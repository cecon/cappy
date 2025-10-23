# Entity Discovery & Resolution System

## Visão Geral

Sistema de descoberta e resolução incremental de entidades inspirado no LightRAG, que integra a extração de entidades semânticas via LLM com o grafo de conhecimento existente.

## Arquitetura

### Componentes Principais

1. **EntityDiscoveryService** - Extrai entidades e relacionamentos de conteúdo usando LLM
2. **EntityResolutionService** - Resolve entidades descobertas contra o grafo global
3. **VSCodeLLMProvider** - Adapter para usar o VS Code Language Model API
4. **IndexingService** - Orquestra descoberta e resolução durante indexação

## Fluxo de Processamento

### Antes (Problemático - 2 Fases)
```
Fase 1: Processar arquivo → Salvar chunks
Fase 2: Rodar indexador global de relacionamentos
```

### Agora (Incremental - LightRAG-like)
```
Por arquivo:
  1. Processar chunks (AST ou LLM)
  2. Para cada chunk relevante:
     a. Descobrir entidades via LLM
     b. Resolver cada entidade contra grafo global
     c. Conectar chunk → entidade
     d. Criar relacionamentos semânticos
  3. Grafo sempre atualizado incrementalmente
```

## Uso

### Configuração Automática

O sistema é inicializado automaticamente no `extension.ts`:

```typescript
// LLM Provider é inicializado e passado ao IndexingService
const llmProvider = new VSCodeLLMProvider();
await llmProvider.initialize();

const indexingService = new IndexingService(
  vectorStore,
  graphStore,
  embeddingService,
  workspaceRoot,
  llmProvider // <- Descoberta de entidades habilitada
);
```

### Quando Ocorre a Descoberta

A descoberta de entidades ocorre automaticamente para:
- **JSDoc comments** - Extrai conceitos, padrões, entidades de negócio
- **Markdown sections** - Extrai entidades de documentação
- **Document sections** - Extrai entidades de arquivos PDF, Word, etc.

### Exemplo de Entidades Descobertas

De um JSDoc comment:
```javascript
/**
 * AuthenticationService handles user authentication using JWT tokens.
 * It depends on UserRepository for user data and TokenStore for session management.
 */
```

Entidades extraídas:
```json
{
  "entities": [
    {
      "name": "AuthenticationService",
      "type": "Service",
      "confidence": 0.95,
      "properties": {
        "purpose": "Handles user authentication",
        "dependencies": ["UserRepository", "TokenStore"]
      }
    },
    {
      "name": "JWT",
      "type": "Technology",
      "confidence": 0.90
    }
  ],
  "relationships": [
    {
      "from": "AuthenticationService",
      "to": "UserRepository",
      "type": "depends_on",
      "confidence": 0.92
    }
  ]
}
```

### Resolução de Entidades

O `EntityResolutionService` normaliza nomes e resolve duplicatas:

```typescript
// "Express" vs "ExpressJS" vs "express framework" → "express"
const normalizedName = normalizeEntityName(discovered.name);

// Busca entidades similares no grafo
const existing = await findSimilarEntity(normalizedName, type);

// Reutiliza se existir, cria se nova
const entityId = existing?.id || await createEntity(...);
```

## Schema do Banco de Dados

### Tabela: nodes

Campos adicionados para suporte a entidades descobertas:

```sql
-- Dynamic Discovery (LightRAG-inspired)
discovered_type TEXT,           -- Tipo descoberto pela LLM
discovered_properties TEXT,     -- Propriedades JSON
entity_confidence REAL,         -- Confiança da descoberta (0-1)
```

### Tabela: edges

Campos adicionados para relacionamentos semânticos:

```sql
-- Dynamic Discovery
discovered_relationship_type TEXT,  -- Tipo do relacionamento descoberto
semantic_context TEXT,              -- Contexto semântico
relationship_confidence REAL,       -- Confiança (0-1)
```

## Métodos Adicionados

### GraphStorePort

```typescript
interface GraphStorePort {
  // Criar/atualizar entidade
  createEntity(entity: {
    name: string;
    type: string;
    confidence: number;
    properties: Record<string, unknown>;
  }): Promise<string>;

  // Buscar entidade similar
  findEntityByNameAndType(
    name: string, 
    type: string | undefined
  ): Promise<{ id: string } | null>;

  // Conectar chunk a entidade
  linkChunkToEntity(
    chunkId: string, 
    entityId: string
  ): Promise<void>;

  // Criar relacionamento semântico
  createRelationship(rel: {
    from: string;
    to: string;
    type: string;
    properties?: Record<string, unknown>;
  }): Promise<void>;
}
```

## Configuração do LLM Provider

### Usar VS Code Language Model (Copilot)

```typescript
import { VSCodeLLMProvider } from './services/entity-discovery';

const llmProvider = new VSCodeLLMProvider();
await llmProvider.initialize();
```

### Implementar Provider Customizado

```typescript
import type { LLMProvider } from './services/entity-discovery';

class MyCustomLLMProvider implements LLMProvider {
  async generate(prompt: string): Promise<string> {
    // Sua implementação (OpenAI, Anthropic, local, etc.)
  }
}
```

## Benefícios

### ✅ Antes vs Depois

| Antes | Depois |
|-------|--------|
| Relacionamentos apenas sintáticos (imports) | Relacionamentos semânticos (conceitos, dependências) |
| Grafo raso com pouca conexão | Grafo rico com entidades conceituais |
| Duas fases (lento, complexo) | Incremental (rápido, simples) |
| Difícil manutenção | Fácil adicionar novos arquivos |

### 🎯 Casos de Uso

1. **Busca Conceitual** - Encontrar "padrões de autenticação" mesmo sem código explícito
2. **Navegação Semântica** - Seguir relacionamentos de alto nível entre conceitos
3. **Documentação Automática** - Extrair arquitetura de JSDoc/Markdown
4. **Rastreamento de Dependências** - Entender não apenas imports, mas dependências conceituais

## Limitações e Considerações

### Performance

- LLM calls adicionam latência (~1-3s por chunk)
- Apenas chunks documentais são processados (não código puro)
- Processamento é assíncrono e não bloqueia indexação básica

### Custo

- Se usar API paga (OpenAI), considere limitar:
  - `maxEntities` (default: 20)
  - `confidenceThreshold` (default: 0.7)
  - Tipos de chunks processados

### Qualidade

- Depende da qualidade do LLM usado
- Normalize nomes consistentemente
- Ajuste `confidenceThreshold` conforme necessário

## Troubleshooting

### LLM Provider não inicializa

```
⚠️ Failed to initialize LLM provider for entity discovery
```

**Solução**: O sistema continua funcionando, mas sem descoberta de entidades. Verifique:
- VS Code Copilot está ativo
- Modelo `gpt-4o` está disponível
- Permissões de Language Model API

### Entidades duplicadas

**Sintoma**: "Express" e "express" aparecem como entidades separadas

**Solução**: Ajuste normalização em `EntityResolutionService.normalizeEntityName()`

### Relacionamentos não criados

**Sintoma**: Entidades criadas mas sem conexões

**Solução**: Verifique `confidence` dos relacionamentos descobertos e ajuste `confidenceThreshold`

## Próximos Passos

1. **Dual-Level Retrieval** - Implementar busca combinada (chunks + entidades)
2. **Entity-Aware Chunking** - Chunks que respeitam fronteiras de entidades
3. **Schema Evolution** - Ajustar schema dinamicamente baseado em descobertas
4. **Visualização** - Mostrar entidades descobertas no Graph Panel

## Referências

- [LightRAG Paper](https://arxiv.org/abs/2410.05779)
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [Entity Resolution Techniques](https://en.wikipedia.org/wiki/Record_linkage)
