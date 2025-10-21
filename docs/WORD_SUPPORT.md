# Word Document Support - Implementation Summary

## 📄 Overview

Suporte completo para parsing de documentos Word (.doc e .docx) com extração automática de entidades usando GitHub Copilot LLM.

## ✨ Implementação

### **Biblioteca Utilizada**
- **mammoth** - Extrai texto de documentos Word
- Suporte nativo para `.docx` (formato OOXML)
- Suporte limitado para `.doc` (formato legado)

### **Funcionalidades**
✅ Leitura de arquivos `.docx` e `.doc`  
✅ Extração de texto raw (sem formatação)  
✅ Chunking com overlap (512 tokens, 100 overlap)  
✅ Extração de entidades via LLM  
✅ Extração de relacionamentos  
✅ Integração com grafo de conhecimento  

### **Fluxo de Processamento**

```
.docx/.doc file
    ↓
mammoth.extractRawText()
    ↓
Plain text content
    ↓
extractChunksWithOverlap()
    ↓
DocumentChunk[] (with overlap)
    ↓
enrichChunksWithEntities()
    ↓
EntityExtractor (Copilot LLM)
    ↓
Chunks with entities + relationships
    ↓
EntityGraphService
    ↓
Graph integration
```

## 🔧 Código Implementado

### **DocumentEnhancedParser.parseWord()**

```typescript
private async parseWord(filePath: string, extractEntities: boolean): Promise<DocumentChunk[]> {
  // 1. Lê arquivo como buffer
  const buffer = fs.readFileSync(filePath);
  
  // 2. Extrai texto com mammoth
  const result = await mammoth.extractRawText({ buffer });
  const wordContent = result.value;
  
  // 3. Cria chunks com overlap
  const chunks = await this.extractChunksWithOverlap(
    filePath,
    wordContent,
    512,  // maxTokens
    100   // overlapTokens
  );
  
  // 4. Extrai entidades se habilitado
  if (extractEntities && chunks.length > 0) {
    await this.initialize();
    await this.enrichChunksWithEntities(chunks);
  }
  
  return chunks;
}
```

## 📊 Exemplo de Uso

### **Input: API-Guide.docx**

```
# API Authentication Guide

Our authentication system uses JWT tokens with Express middleware.
The UserService class handles all authentication logic.

## Security

The AuthenticationMiddleware intercepts requests and verifies tokens
using the bcrypt library for password hashing.
```

### **Output: Entidades Extraídas**

```json
{
  "chunks": [
    {
      "id": "chunk:API-Guide.docx:0:1-25",
      "content": "# API Authentication Guide\n\nOur authentication...",
      "metadata": {
        "entities": ["JWT", "Express", "UserService", "AuthenticationMiddleware", "bcrypt"],
        "entityTypes": {
          "JWT": "technology",
          "Express": "framework",
          "UserService": "class",
          "AuthenticationMiddleware": "class",
          "bcrypt": "library"
        },
        "relationships": [
          {
            "from": "authentication",
            "to": "JWT",
            "type": "uses",
            "confidence": 0.9
          },
          {
            "from": "JWT",
            "to": "Express",
            "type": "uses",
            "confidence": 0.85
          },
          {
            "from": "AuthenticationMiddleware",
            "to": "bcrypt",
            "type": "uses",
            "confidence": 0.88
          }
        ]
      }
    }
  ]
}
```

### **Grafo Resultante**

```
[API-Guide.docx:chunk0] --mentions--> [JWT:technology]
[API-Guide.docx:chunk0] --mentions--> [Express:framework]
[API-Guide.docx:chunk0] --mentions--> [UserService:class]
[API-Guide.docx:chunk0] --mentions--> [AuthenticationMiddleware:class]
[API-Guide.docx:chunk0] --mentions--> [bcrypt:library]

[JWT:technology] --uses--> [Express:framework]
[AuthenticationMiddleware:class] --uses--> [bcrypt:library]

# Se UserService existir no código:
[UserService:class] --defined_in--> [src/services/UserService.ts:chunk5]
```

## 🧪 Testing

```bash
# Rodar teste
npm run test:word-parsing

# Ou manualmente
npx tsx test-word-parsing.ts
```

### **O que o teste faz:**

1. Procura arquivos `.docx` e `.doc` no workspace
2. Se não encontrar, cria conteúdo de exemplo
3. Extrai chunks com overlap
4. Enriquece com entidades via LLM
5. Exibe:
   - Preview de cada chunk
   - Entidades extraídas
   - Tipos de entidades
   - Relacionamentos
   - Estatísticas gerais

### **Output Esperado:**

```
🧪 Testing Word Document Parsing with Entity Extraction

======================================================================

📝 Creating a sample Word document for testing...

🔍 Testing with sample content...

✅ Extracted 3 chunks

📦 Chunk 1 (lines 1-34):
   Content preview: # API Authentication Guide

## Overview

This document describes the authentication system...
   Entities: JWT, Express, bcrypt, Redis, UserService
   Types:
      - JWT: technology
      - Express: framework
      - bcrypt: library
      - Redis: library
      - UserService: class
   Relationships:
      - authentication --[uses]--> JWT (confidence: 0.90)
      - authentication --[uses]--> Express (confidence: 0.88)
      - UserService --[handles]--> authentication (confidence: 0.85)

📊 Summary for sample-api-guide.docx:
   Total chunks: 3
   Chunks with entities: 3
   Total unique entities: 15
   Entity types:
      - class: 5
      - technology: 4
      - library: 3
      - framework: 2
      - interface: 1
   Total relationships: 12
   Key entities: JWT, Express, bcrypt, Redis, UserService, authenticate, generateToken...
```

## ⚠️ Limitações

### **Formato .doc (legado)**
- Suporte limitado pelo mammoth
- Pode falhar em documentos muito antigos
- **Recomendação:** converter para `.docx`

### **Formatação**
- Extrai apenas texto raw (sem formatação)
- Tabelas são convertidas em texto plano
- Imagens são ignoradas
- Gráficos são ignorados

### **Estrutura**
- Não preserva hierarquia de seções como no Markdown
- Headings são tratados como texto normal
- Links são convertidos em texto

## 🚀 Melhorias Futuras

- [ ] Preservar estrutura de headings
- [ ] Extrair tabelas como entidades estruturadas
- [ ] Suporte para metadados do documento
- [ ] Cache de documentos processados
- [ ] Detecção de mudanças (re-parse apenas se modificado)
- [ ] Suporte para macros e VBA (se relevante)
- [ ] Conversão automática de .doc para .docx

## 📦 Dependências

```json
{
  "dependencies": {
    "mammoth": "^1.x.x"
  }
}
```

## 🔗 Arquivos Relacionados

- `src/adapters/secondary/parsers/document-enhanced-parser.ts` - Parser implementado
- `test-word-parsing.ts` - Script de teste
- `docs/ENTITY_EXTRACTION.md` - Documentação geral
- `src/types/entity.ts` - Tipos de entidades

## ✅ Status

**✨ IMPLEMENTADO E FUNCIONAL** ✨

- [x] Leitura de .docx
- [x] Leitura de .doc (limitado)
- [x] Extração de texto
- [x] Chunking com overlap
- [x] Extração de entidades
- [x] Integração com grafo
- [x] Script de teste
- [x] Documentação

---

**Versão:** 3.1.0  
**Data:** 21 de outubro de 2025  
**Autor:** Cappy Team
