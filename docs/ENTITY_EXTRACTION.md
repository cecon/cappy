# Enhanced Document Parser with Entity Extraction

## 📚 Overview

O **Enhanced Document Parser** é uma funcionalidade avançada do Cappy que extrai automaticamente **entidades** e **relacionamentos** de arquivos de documentação usando o LLM do GitHub Copilot.

## 🎯 Objetivo

Enriquecer o grafo de conhecimento do projeto conectando:
- 📄 **Documentação** → **Código**
- 🧠 **Conceitos** → **Implementações**
- 🔗 **Menções** → **Definições**

## ✨ Funcionalidades

### 1. **Chunking Inteligente com Overlap**
- Divide documentos em chunks de ~512 tokens
- Overlap de ~100 tokens para preservar contexto
- Suporta: `.md`, `.mdx`, `.pdf` (planejado), `.doc/.docx` (planejado)

### 2. **Extração de Entidades via LLM**
Identifica automaticamente:
- **Classes, funções, interfaces, tipos**
- **APIs, bibliotecas, frameworks**
- **Conceitos, padrões, tecnologias**
- **Serviços, componentes, módulos**

### 3. **Extração de Relacionamentos**
Detecta conexões entre entidades:
- `uses`, `implements`, `extends`
- `references`, `depends_on`, `mentions`
- `describes`, `contains`, `configures`
- `calls`, `instantiates`

### 4. **Integração com Graph**
- Verifica entidades existentes (deduplicação)
- Conecta documentação ao código
- Cria nós e relacionamentos no grafo

## 🚀 Como Usar

### Ativando Enhanced Parsing

```typescript
import { createParserService } from './services/parser-service';

const parser = createParserService();

// Ativar extração de entidades
parser.enableEnhancedParsing(true);

// Parse um arquivo
const chunks = await parser.parseFile('docs/API.md');

// Chunks agora incluem metadata de entidades
for (const chunk of chunks) {
  console.log('Entities:', chunk.metadata.entities);
  console.log('Relationships:', chunk.metadata.relationships);
}
```

### Integrando com o Grafo

```typescript
import { createEntityGraphService } from './services/entity-graph-service';
import { createDocumentEnhancedParser } from './adapters/secondary/parsers/document-enhanced-parser';

const parser = createDocumentEnhancedParser();
await parser.initialize();

// Parse com extração de entidades
const chunks = await parser.parseFile('docs/AUTH.md', true);

// Extrair resultados de entidades
const extractionResults = chunks
  .filter(c => c.metadata.entities && c.metadata.entities.length > 0)
  .map(c => ({
    entities: c.metadata.entities!.map((name, i) => ({
      name,
      type: c.metadata.entityTypes![name],
      confidence: c.metadata.relationships?.[i]?.confidence || 0.8,
      context: c.metadata.relationships?.[i]?.context
    })),
    relationships: c.metadata.relationships || [],
    chunkId: c.id,
    metadata: {
      timestamp: c.metadata.extractedAt || new Date().toISOString(),
      model: c.metadata.extractionModel || 'unknown',
      processingTime: 0
    }
  }));

// Integrar com o grafo
const graphService = createEntityGraphService(graphStore);
await graphService.integrateEntities(chunks, extractionResults);
```

## 📊 Exemplo de Output

### Input (AUTH.md):
```markdown
# Authentication

Our API uses JWT tokens with Express middleware.
The UserService handles user validation.
```

### Output (Entidades Extraídas):
```json
{
  "entities": [
    {
      "name": "JWT",
      "type": "technology",
      "confidence": 0.9,
      "context": "uses JWT tokens with Express"
    },
    {
      "name": "Express",
      "type": "framework",
      "confidence": 0.9,
      "context": "with Express middleware"
    },
    {
      "name": "UserService",
      "type": "class",
      "confidence": 0.95,
      "context": "The UserService handles user validation"
    }
  ],
  "relationships": [
    {
      "from": "API",
      "to": "JWT",
      "type": "uses",
      "confidence": 0.9
    },
    {
      "from": "API",
      "to": "Express",
      "type": "uses",
      "confidence": 0.85
    },
    {
      "from": "UserService",
      "to": "validation",
      "type": "handles",
      "confidence": 0.8
    }
  ]
}
```

### Grafo Resultante:
```
[AUTH.md:chunk1] --mentions--> [JWT:technology]
[AUTH.md:chunk1] --mentions--> [Express:framework]
[AUTH.md:chunk1] --mentions--> [UserService:class]

[UserService:class] --defined_in--> [src/services/UserService.ts:chunk3]

[JWT:technology] --uses--> [Express:framework]
```

## 🧪 Testing

Execute os scripts de teste:

```bash
# Testar extração de entidades em Markdown
npm run test:entity-extraction

# Testar parsing de Word documents
npm run test:word-parsing
```

Ou manualmente:

```bash
npx tsx test-entity-extraction.ts
npx tsx test-word-parsing.ts
```

## 📁 Arquitetura

```
src/
├── types/
│   └── entity.ts                    # Tipos para entidades e relacionamentos
├── services/
│   ├── entity-extractor.ts          # Extração via LLM Copilot
│   ├── entity-graph-service.ts      # Integração com grafo
│   └── parser-service.ts            # Orquestração de parsers
└── adapters/secondary/parsers/
    └── document-enhanced-parser.ts  # Parser com entity extraction
```

## 🔧 Configuração

### Requisitos:
- ✅ GitHub Copilot extension instalada
- ✅ Copilot subscription ativa
- ✅ Modelo `gpt-4o` disponível

### Config Service:
```typescript
// Em config-service.ts
{
  indexing: {
    llm: {
      provider: 'copilot',
      enabledFor: {
        markdown: true,  // Ativar para .md
        typescript: false,
        javascript: false
      }
    }
  }
}
```

## 🎯 Benefícios

1. **🔍 Busca Semântica Melhorada**
   - "Como fazer auth?" → retorna docs + código relacionado
   
2. **📚 Documentação ↔️ Código**
   - Conecta automaticamente menções em docs com definições no código
   
3. **🧠 Context-Aware Copilot**
   - Copilot entende conceitos e padrões do projeto
   
4. **🔗 Cross-Reference Inteligente**
   - "UserService mencionado em AUTH.md e implementado em src/services/UserService.ts"

## 🛣️ Roadmap

- [x] Extração de entidades via LLM
- [x] Parsing de Markdown com entity extraction
- [x] Integração com GraphStore
- [x] Deduplicação de entidades
- [x] Suporte para Word (.doc/.docx) ✨ **NEW**
- [ ] Suporte para PDF
- [ ] Cache de extrações
- [ ] Batch processing otimizado
- [ ] UI para visualizar entidades extraídas
- [ ] Métricas de qualidade de extração

## 📖 Documentação Adicional

- [Entity Types](../types/entity.ts)
- [Entity Extractor](../services/entity-extractor.ts)
- [Entity Graph Service](../services/entity-graph-service.ts)
- [Document Enhanced Parser](../adapters/secondary/parsers/document-enhanced-parser.ts)

## 🤝 Contribuindo

Para adicionar suporte a novos tipos de documento:

1. Implementar parser em `document-enhanced-parser.ts`
2. Adicionar tipo ao `getSupportedExtensions()`
3. Testar com `test-entity-extraction.ts`
4. Atualizar documentação

---

**Versão:** 3.1.0  
**Autor:** Cappy Team  
**Data:** Outubro 2025
