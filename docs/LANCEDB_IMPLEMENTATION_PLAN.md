# 📋 Decisões Arquiteturais Finais - CAPPY Document System

**Versão:** 5.0.0 (Final)
**Data:** 12/10/2025
**Status:** ✅ Aprovado para Implementação

---

## 🎯 Arquitetura Híbrida: LanceDB + Kuzu

### Separação de Responsabilidades

```
┌─────────────────────────────────────────────────────────┐
│                    LANCEDB                              │
│  ────────────────────────────────────────────────────── │
│  • Conteúdo completo dos chunks                         │
│  • Embeddings vetoriais (384 dims)                      │
│  • Busca semântica                                      │
│  • Metadata mínima (filePath, lines, type)              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                      KUZU                               │
│  ────────────────────────────────────────────────────── │
│  • SÓ metadados (SEM conteúdo duplicado)                │
│  • Estrutura de grafo (nodes + relationships)           │
│  • Navegação e traversal                                │
│  • IDs são FK para LanceDB (mesmo ID!)                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  BUSCA HÍBRIDA                          │
│  ────────────────────────────────────────────────────── │
│  1. Vector search (LanceDB) → chunks relevantes         │
│  2. Graph traversal (Kuzu) → IDs relacionados           │
│  3. Fetch content (LanceDB) → enriquecer resultados     │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Tipos de Arquivos Suportados

### Categoria 1: Código com Documentação Estruturada

**Parser Estrutural (AST) - SEM LLM por padrão**

| Extensão | Linguagem        | Parser                      | Chunking                       | LLM         |
| -------- | ---------------- | --------------------------- | ------------------------------ | ----------- |
| `.ts`    | TypeScript       | `@typescript-eslint/parser` | AST natural (funções, classes) | ⚠️ Opcional |
| `.tsx`   | TypeScript React | `@typescript-eslint/parser` | AST natural (componentes)      | ⚠️ Opcional |
| `.js`    | JavaScript       | `@typescript-eslint/parser` | AST natural (funções, classes) | ⚠️ Opcional |
| `.jsx`   | JavaScript React | `@typescript-eslint/parser` | AST natural (componentes)      | ⚠️ Opcional |
| `.mjs`   | ES Modules       | `@typescript-eslint/parser` | AST natural                    | ⚠️ Opcional |

**Características:**

* ✅ JSDoc/TSDoc extraído via AST
* ✅ Zero overlap (boundaries naturais)
* ✅ Custo: $0
* ✅ Precisão: 100% (estruturado)

**O que vai para LanceDB:**

```typescript
{
  id: "chunk:api.ts:40-47",
  content: "Retrieves user by ID. Param id: user identifier. Returns: User | null",
  embedding: [0.23, -0.45, ...],
  metadata: {
    type: "jsdoc",
    filePath: "api.ts",
    symbolName: "getUserById",
    lineStart: 40,
    lineEnd: 47
  }
}
```

**O que vai para Kuzu:**

```cypher
(:Chunk {
  id: "chunk:api.ts:40-47",
  filePath: "api.ts",
  lineStart: 40,
  lineEnd: 47,
  chunkType: "jsdoc",
  symbolName: "getUserById"
  // ❌ SEM content
})
```

---

### Categoria 2: Documentação Textual

**LLM Obrigatório para Extração de Entidades**

| Extensão | Tipo             | Chunking                 | Overlap            | LLM           |
| -------- | ---------------- | ------------------------ | ------------------ | ------------- |
| `.md`    | Markdown         | Seções + Sliding Window  | ✅ 20%              | ✅ Obrigatório |
| `.mdx`   | Markdown + JSX   | Seções + Sliding Window  | ✅ 20%              | ✅ Obrigatório |
| `.pdf`   | PDF              | Páginas + Sliding Window | ✅ 20% + cross-page | ✅ Obrigatório |
| `.docx`  | Word             | Seções (Heading styles)  | ✅ 10-20%           | ✅ Obrigatório |
| `.txt`   | Plain Text       | Sliding Window           | ✅ 20%              | ✅ Obrigatório |
| `.rst`   | reStructuredText | Seções + Sliding Window  | ✅ 20%              | ✅ Obrigatório |
| `.adoc`  | AsciiDoc         | Seções + Sliding Window  | ✅ 20%              | ✅ Obrigatório |

**Características:**

* ✅ Overlap necessário (contexto contínuo)
* ✅ LLM extrai entidades de CADA chunk
* ✅ Merge de entidades duplicadas (smart deduplication)
* ⚠️ Custo: ~$0.001-0.004 por chunk (GPT-4o-mini)

**Exemplo de Chunk (MD):**

```typescript
{
  id: "chunk:docs.md:15-22",
  content: "## Authentication\n\nOur system uses JWT tokens...",
  embedding: [0.18, -0.62, ...],
  metadata: {
    type: "markdown_section",
    filePath: "docs.md",
    heading: "Authentication",
    headingLevel: 2,
    lineStart: 15,
    lineEnd: 22
  }
}
```

**LLM extrai:**

```json
{
  "entities": [
    {"name": "JWT Authentication", "category": "technology", "importance": 0.9},
    {"name": "RS256 Algorithm", "category": "technology", "importance": 0.7}
  ],
  "relationships": [
    {"from": "JWT Authentication", "to": "RS256 Algorithm", "type": "uses"}
  ]
}
```

---

### Categoria 3: Configuração e Dados

**Parser Estrutural - LLM Opcional**

| Extensão | Tipo        | Parser        | Chunking        | LLM   |
| -------- | ----------- | ------------- | --------------- | ----- |
| `.json`  | JSON        | Native        | Por objeto raiz | ❌ Não |
| `.yaml`  | YAML        | `js-yaml`     | Por seção       | ❌ Não |
| `.yml`   | YAML        | `js-yaml`     | Por seção       | ❌ Não |
| `.toml`  | TOML        | `@iarna/toml` | Por seção       | ❌ Não |
| `.env`   | Environment | Regex         | Por variável    | ❌ Não |

**Nota:** Arquivos de configuração geralmente NÃO precisam de vector search, mas podem ser indexados no Kuzu para rastrear dependências.

---

### Categoria 4: Código SEM Documentação Estruturada

**Parser Limitado ou Skip**

| Extensão | Linguagem | Status MVP  | Estratégia Futura          |
| -------- | --------- | ----------- | -------------------------- |
| `.py`    | Python    | ⚠️ Opcional | Tree-sitter ou AST externo |
| `.go`    | Go        | ❌ Não       | Tree-sitter                |
| `.rs`    | Rust      | ❌ Não       | Tree-sitter                |
| `.java`  | Java      | ❌ Não       | JavaDoc parser             |
| `.cpp`   | C++       | ❌ Não       | Doxygen parser             |
| `.c`     | C         | ❌ Não       | Doxygen parser             |
| `.cs`    | C#        | ❌ Não       | XML Doc parser             |
| `.rb`    | Ruby      | ❌ Não       | YARD parser                |
| `.php`   | PHP       | ❌ Não       | PHPDoc parser              |

**Recomendação MVP:** Focar apenas em TypeScript/JavaScript + Markdown/PDF/DOCX.

---

## 🤔 Por Que JSDoc NÃO Precisa de LLM?

### JSDoc/TSDoc É Estruturado e Completo

**Exemplo de JSDoc:**

```typescript
/**
 * Retrieves a user from the database by their unique identifier.
 * Uses parameterized queries to prevent SQL injection attacks.
 *
 * @param id - The unique identifier of the user (UUID v4)
 * @param options - Optional query options
 * @param options.includeDeleted - Whether to include soft-deleted users
 * @returns User object if found, null otherwise
 * @throws {DatabaseError} If database connection fails
 * @throws {ValidationError} If ID format is invalid
 * @see {@link https://docs.example.com/auth} for authentication flow
 * @example
 * const user = await getUserById('550e8400-e29b-41d4-a716-446655440000');
 */
function getUserById(id: string, options?: QueryOptions): Promise<User | null>
```

### O que o Parser AST Extrai (100% preciso, $0 custo):

```json
{
  "entity": {
    "name": "getUserById",
    "type": "function",
    "description": "Retrieves a user from the database by their unique identifier. Uses parameterized queries to prevent SQL injection attacks.",
    "params": [
      {
        "name": "id",
        "type": "string",
        "description": "The unique identifier of the user (UUID v4)"
      },
      {
        "name": "options",
        "type": "QueryOptions",
        "optional": true,
        "description": "Optional query options",
        "properties": [
          {
            "name": "includeDeleted",
            "type": "boolean",
            "description": "Whether to include soft-deleted users"
          }
        ]
      }
    ],
    "returns": {
      "type": "Promise<User | null>",
      "description": "User object if found, null otherwise"
    },
    "throws": [
      {
        "type": "DatabaseError",
        "description": "If database connection fails"
      },
      {
        "type": "ValidationError",
        "description": "If ID format is invalid"
      }
    ],
    "seeAlso": [
      "https://docs.example.com/auth"
    ],
    "examples": [
      "const user = await getUserById('550e8400-e29b-41d4-a716-446655440000');"
    ]
  },
  "relationships": [
    {
      "from": "getUserById",
      "to": "database.query",
      "type": "CALLS",
      "detectedVia": "AST analysis"
    }
  ]
}
```

### Comparação: Parser vs LLM

| Aspecto           | Parser AST   | LLM                  |
| ----------------- | ------------ | -------------------- |
| **Precisão**      | ✅ 100%       | ⚠️ 85-95%            |
| **Estrutura**     | ✅ Completa   | ⚠️ Pode perder tags  |
| **Custo**         | ✅ $0         | ❌ $0.001-0.004/chunk |
| **Velocidade**    | ✅ <10ms      | ⚠️ 500-2000ms        |
| **Tipos**         | ✅ Exatos     | ❌ Inferidos          |
| **Relationships** | ✅ Sintáticos | ✅ Semânticos         |

### Quando LLM Adiciona Valor em Código

**Casos onde LLM PODE ser útil (opcional):**

1. **Enriquecimento Semântico:**

```typescript
// Parser: "Retrieves user by ID"
// LLM adiciona: "Core authentication dependency. Used by login flow."
```

2. **Relacionamentos Implícitos:**

```typescript
// Parser detecta: getUserById CALLS database.query
// LLM infere: "getUserById implements Repository Pattern for User entity"
```

3. **Categorização de Domínio:**

```typescript
// Parser: type = "function"
// LLM: category = "data_access", domain = "user_management"
```

**MAS:** Isso é **enriquecimento**, não extração. O JSDoc já tem TUDO estruturado.

---

## 📊 Decisão: Estratégia por Tipo de Arquivo

### TypeScript/JavaScript (JSDoc/TSDoc)

```
Fase 1: Parser Estrutural (SEMPRE)
├─ Extração via AST: 100% preciso, $0
├─ JSDoc → entities completas
├─ Function calls → relationships
└─ SUFICIENTE para MVP

Fase 2: LLM Opcional (V2+)
├─ Enriquecimento semântico
├─ Categorização de domínio
└─ Inferência de patterns
```

**Configuração:**

```json
{
  "typescript": {
    "parser": "ast",
    "llmEnrichment": "off"  // Default OFF
  }
}
```

---

### Markdown/PDF/DOCX (Documentação)

```
Fase 1: Chunking com Overlap (SEMPRE)
├─ Sliding window: 512 tokens
├─ Overlap: 20%
└─ Preservar contexto

Fase 2: LLM Extraction (OBRIGATÓRIO)
├─ Extrair entidades de CADA chunk
├─ Identificar relationships
├─ Merge deduplication
└─ NECESSÁRIO - não há estrutura
```

**Configuração:**

```json
{
  "markdown": {
    "chunking": "hybrid",
    "maxTokens": 512,
    "overlapTokens": 100,
    "llmExtraction": "required"  // OBRIGATÓRIO
  }
}
```

---

## 🔧 Schemas Finais

### LanceDB Schema

```sql
-- Tabela: document_chunks
CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,           -- "chunk:api.ts:40-47"
  content TEXT NOT NULL,         -- Conteúdo completo
  vector FLOAT[384] NOT NULL,    -- Embedding
  
  -- Metadata
  file_path TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  chunk_type TEXT NOT NULL,      -- "jsdoc" | "markdown_section" | "code"
  symbol_name TEXT,              -- "getUserById" (se aplicável)
  
  -- Indexes
  INDEX idx_file_path ON file_path,
  INDEX idx_chunk_type ON chunk_type,
  VECTOR INDEX idx_vector ON vector
);
```

---

### Kuzu Schema

```cypher
-- ═══ NODES ═══

CREATE NODE TABLE Chunk(
  id STRING PRIMARY KEY,        -- FK para LanceDB (MESMO ID!)
  filePath STRING,
  lineStart INT64,
  lineEnd INT64,
  chunkType STRING,             -- "jsdoc" | "markdown" | "code"
  symbolName STRING,            -- "getUserById" | NULL
  symbolKind STRING             -- "function" | "class" | NULL
);

CREATE NODE TABLE File(
  path STRING PRIMARY KEY,
  language STRING,              -- "typescript" | "markdown"
  linesOfCode INT64
);

CREATE NODE TABLE Entity(
  id STRING PRIMARY KEY,
  name STRING,
  category STRING,              -- "technology" | "concept" | "api"
  description STRING,
  importance FLOAT              -- 0.0 - 1.0
);

-- ═══ RELATIONSHIPS ═══

CREATE REL TABLE CONTAINS(
  FROM File TO Chunk,
  order INT64
);

CREATE REL TABLE DOCUMENTS(
  FROM Chunk TO Chunk           -- JSDoc DOCUMENTS Code
);

CREATE REL TABLE REFERENCES(
  FROM Chunk TO Chunk,
  refType STRING,               -- "calls" | "imports" | "wikilink"
  refText STRING
);

CREATE REL TABLE DEFINES(
  FROM Chunk TO Entity          -- Chunk onde Entity é definida
);

CREATE REL TABLE RELATES_TO(
  FROM Entity TO Entity,
  relationType STRING,          -- "uses" | "implements" | "extends"
  description STRING,
  confidence FLOAT
);
```

---

## ♻️ Atualização & Detecção de Arquivos Desatualizados

### Objetivo

Garantir que o índice (LanceDB + Kuzu) reflita o estado atual do workspace, detectando **novos arquivos**, **alterações de conteúdo**, **renomes/movimentos** e **remoções**, com **reindexação mínima necessária**.

### Identidade & Versionamento

* **repoId**: hash (xxh64) do path raiz do workspace.
* **fileId**: UUID estável por arquivo (persistido no índice). Se o arquivo for novo, gerar.
* **contentHash**: SHA-256 do conteúdo normalizado (EOL → `
  `, trim BOM).
* **chunkId** (MVP): `chunk:<repoId>/<relPath>:<start>-<end>@<contentHash8>`

  * V2 (opcional): `chunk:<repoId>/<fileId>:<start>-<end>@<contentHash8>` para **preservar identidade** em renomes sem reindexar relacionamentos.

### Tabelas de Controle (LanceDB)

```sql
-- Tabela: files_index (controle de atualização e integridade)
CREATE TABLE files_index (
  repo_id TEXT NOT NULL,
  file_id TEXT NOT NULL,             -- UUID estável por arquivo
  rel_path TEXT NOT NULL,            -- caminho relativo no workspace
  
  -- Presença no workspace
  is_available BOOLEAN NOT NULL DEFAULT TRUE,  -- arquivo existe fisicamente no último scan
  is_deleted BOOLEAN DEFAULT FALSE,            -- tombstone lógico (remoção confirmada)

  -- Fingerprint rápido
  size_bytes INTEGER NOT NULL,
  mtime_epoch_ms INTEGER NOT NULL,

  -- Integridade de conteúdo
  hash_algo TEXT NOT NULL DEFAULT 'blake3',    -- 'blake3' | 'md5' | 'sha256' (preferir blake3)
  content_hash TEXT NOT NULL,                  -- hash do conteúdo normalizado (EOL → 
)
  hash_status TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'OK' | 'MISMATCH' | 'UNKNOWN'
  hash_verified_at_epoch_ms INTEGER,           -- quando a integridade foi verificada

  -- Classificação / linguagem (opcional)
  language TEXT,                               -- "typescript" | "markdown" | ...

  -- Controle de indexação
  last_indexed_at_epoch_ms INTEGER NOT NULL,
  pending_graph BOOLEAN DEFAULT FALSE,

  PRIMARY KEY (repo_id, file_id),
  INDEX idx_repo_path ON rel_path
);
```

**Notas de semântica:**

* `is_available` indica **estado físico atual** (detectado no último scan/watcher). Se `FALSE`, o arquivo não está presente no workspace.
* `is_deleted` é um **tombstone lógico** para retenção/recuperação e auditoria; pode coexistir com `is_available=FALSE`.
* `hash_status` reflete o **resultado da última verificação de integridade** do arquivo disponível:

  * `OK`: hash atual == `content_hash` registrado.
  * `MISMATCH`: hash atual ≠ `content_hash` (arquivo mudou; requer reindex).
  * `UNKNOWN`: ainda não verificado (ex.: apenas mtime/size conferidos).

### Algoritmo de Detecção (Scan + FileWatcher)

1. **Coleta**

   * FileWatcher por eventos + *periodic scan* (fallback a cada N min).
   * Debounce por arquivo (300–500 ms) para evitar reprocesso em salvações múltiplas.
2. **Fingerprint Rápido**

   * Comparar `(size_bytes, mtime)` com `files_index`.
   * Se iguais, **pular** (hot path).
3. **Verificação Forte com BLAKE3 (preferencial)**

   * Se mudou tamanho/mtime, calcular hash de conteúdo **com `blake3`** (rápido e seguro).
   * Se `blake3` indisponível no ambiente, **fallback** para `sha256`; se indisponível, `md5` (apenas como último recurso).
   * **Persistir o algoritmo usado** em `files_index.hash_algo` e atualizar `hash_verified_at_epoch_ms`.
   * Atualizar `hash_status`:

     * `OK` → hash atual == `content_hash` registrado (não reindexar; apenas atualizar metadados).
     * `MISMATCH` → hash atual ≠ `content_hash` (arquivo mudou; **reindex obrigatório**).
     * `UNKNOWN` → estado intermediário quando ainda não calculado (evitar usar em decisão final).
4. **Novo Arquivo**

   * Não encontrado em `files_index` → gerar `fileId`, calcular **blake3** do conteúdo, definir `content_hash`, `hash_status=OK`, `is_available=TRUE` e **indexar** (chunks, embeddings, grafo).
5. **Remoção**

   * Ausente no scan, mas presente em `files_index` → `is_available=FALSE`, `is_deleted=TRUE` e tombstones (ver seção específica). Não recalcular hash.
6. **Renome/Move**

   * Arquivo com mesmo `contentHash` existente e `rel_path` diferente:

     * MVP (chunkId inclui `relPath`): atualizar `rel_path`, reemitir chunks e marcar anteriores como *superseded*.
     * V2 (chunkId baseado em `fileId`): atualizar somente `File.path` em Kuzu; **sem reindex de chunks**.

### Reindexação do Arquivo (Passo-a-passo)

1. **Chunking**

   * TS/JS: AST por símbolo (sem overlap).
   * Markdown/PDF/DOCX: janelas 512 tokens, 20% overlap.
2. **Embeddings**

   * Recalcular **apenas** para novos chunks.
3. **LanceDB (upsert)**

   * Inserir novos `document_chunks`.
   * Marcar antigos como **superseded** via coluna opcional `superseded_by` (V2) ou remoção direta (MVP mantém histórico opcionalmente 7 dias).
4. **Kuzu (upsert)**

   * `File{path, language, linesOfCode}` update.
   * `Chunk` nós novos; recriar `CONTAINS(File→Chunk)` com `order`.
   * Atualizar `DOCUMENTS` / `REFERENCES` (TS: imports/calls; MD: links).
5. **Commit de Controle**

   * Atualizar `files_index.content_hash`, `mtime`, `size`, `last_indexed_at` e `pending_graph=FALSE`.

### Tombstones & Superseded (Consistência)

* **Remoção de arquivo**: marcar `File.is_deleted=TRUE` (ou atributo no Kuzu), remover `CONTAINS` e desconectar do grafo, mantendo o nó por 7 dias para auditoria.
* **Chunks antigos**: criar relação `(:Chunk_old)-[:REPLACED_BY]->(:Chunk_new)` (V2) ou apagar diretamente no MVP.

### Erros & Robustez (MVP leve)

* Ordem de escrita: `LanceDB → (flag pending_graph=true) → Kuzu → unset pending_graph`.
* Se Kuzu falhar, `pending_graph=TRUE` e um job de reconciliação reprocessa.
* Retentativas exponenciais (3 tentativas) para operações Kuzu.

### Métricas (telemetria mínima)

* `files_scanned_total`, `files_changed_total`, `files_renamed_total`, `files_deleted_total`.
* Latências: `chunking_ms`, `embed_ms`, `lancedb_write_ms`, `kuzu_write_ms`.
* Tamanho médio de arquivo/chunk.

### API Interna (para WebView/CLI)

```ts
GET /status/file?path=... → {
  repoId, fileId, relPath, contentHash, lastIndexedAt, isDeleted,
  stale: boolean,                // derivado (hash atual ≠ index)
  pendingGraph: boolean,
  chunks: number
}

POST /reindex?path=... → { ok: true, reindexedChunks: number }
```

### Estratégia de V2 (Incremental Real)

* **chunkHash** por conteúdo do chunk para **evitar re-embed** de trechos inalterados.
* **fileId-based chunkId** para renomes sem reindex.
* **SimHash/MinHash** para reaproveitar embeddings em mudanças pequenas (threshold de similaridade).

---

## 🔍 Busca Híbrida - Workflow

```typescript
async function hybridSearch(query: string, depth: number = 2) {
  // 1. VECTOR SEARCH (LanceDB)
  const vectorResults = await lancedb.query(`
    SELECT id, content, file_path, line_start, symbol_name
    FROM document_chunks
    WHERE vector <-> embedding('${query}')
    ORDER BY distance
    LIMIT 10
  `);
  
  // Resultado: chunks semanticamente relevantes COM conteúdo
  
  // 2. GRAPH TRAVERSAL (Kuzu)
  const chunkIds = vectorResults.map(r => r.id);
  
  const graphExpansion = await kuzu.query(`
    MATCH (seed:Chunk)
    WHERE seed.id IN $ids
    
    MATCH path = (seed)-[*1..${depth}]-(related:Chunk)
    
    RETURN DISTINCT related.id, related.filePath, related.lineStart
  `, { ids: chunkIds });
  
  // Resultado: IDs de chunks relacionados estruturalmente
  
  // 3. ENRICH (LanceDB novamente)
  const relatedIds = graphExpansion.map(r => r.id);
  
  const relatedContent = await lancedb.query(`
    SELECT id, content, file_path, line_start, symbol_name
    FROM document_chunks
    WHERE id IN (${relatedIds.join(',')})
  `);
  
  // 4. MERGE E RETORNAR
  return {
    directMatches: vectorResults,      // Alta relevância
    relatedChunks: relatedContent      // Contexto adicional
  };
}
```

---

## ⚙️ Configuração do Sistema

```typescript
// .cappy/config.json
{
  "indexing": {
    "enabledFileTypes": [".ts", ".tsx", ".js", ".jsx", ".md", ".pdf", ".docx"],
    
    "chunking": {
      "typescript": {
        "strategy": "ast",
        "extractJSDoc": true,
        "extractCode": false  // Só JSDoc no vector
      },
      "markdown": {
        "strategy": "hybrid",
        "maxTokens": 512,
        "overlapTokens": 100,
        "respectHeaders": true
      },
      "pdf": {
        "strategy": "sliding_window",
        "maxTokens": 512,
        "overlapTokens": 100,
        "crossPageOverlap": true
      }
    },
    
    "llm": {
      "provider": "copilot",
      "model": "gpt-4o-mini",
      
      "enabledFor": {
        "typescript": false,    // Parser AST suficiente
        "javascript": false,
        "markdown": true,       // OBRIGATÓRIO
        "pdf": true,           // OBRIGATÓRIO
        "docx": true           // OBRIGATÓRIO
      },
      
      "batchSize": 5,
      "maxTokensPerRequest": 2000
    }
  },
  
  "embeddings": {
    "model": "Xenova/all-MiniLM-L6-v2",
    "dimensions": 384,
    "batchSize": 32
  },
  
  "databases": {
    "lancedb": {
      "path": ".cappy/data/lancedb",
      "autoCompact": true
    },
    "kuzu": {
      "path": ".cappy/data/kuzu",
      "bufferPoolSize": "256MB"
    }
  }
}
```

---

## 📦 Dependências do Projeto

```json
{
  "dependencies": {
    "vectordb": "^0.4.x",
    "kuzu": "^0.1.x",
    "@xenova/transformers": "^2.x",
    "@typescript-eslint/parser": "^6.x",
    "gray-matter": "^4.0.3",
    "reagraph": "^4.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "typescript": "^5.x",
    "vitest": "^1.x"
  }
}
```

---

## 🚀 Roadmap de Implementação MVP (4 semanas)

### Semana 1: Base

**Dias 1-2:**

* [ ] Setup estrutura de pastas
* [ ] Install dependencies
* [ ] LanceDB connection + schema
* [ ] Kuzu connection + schema

**Dias 3-5:**

* [ ] Parser TypeScript (AST) - JSDoc extraction
* [ ] Parser Markdown (sections)
* [ ] Chunking básico
* [ ] Embedding service (Xenova)

**Validação:** Consegue parsear 1 arquivo .ts e 1 arquivo .md?

---

### Semana 2: Indexação

**Dias 6-7:**

* [ ] LanceDB insert (chunks + embeddings)
* [ ] Kuzu insert (nodes + relationships)
* [ ] Dual-write simples (sem reliability patterns)

**Dias 8-10:**

* [ ] Vector search básico (LanceDB)
* [ ] Graph query básico (Kuzu)
* [ ] Busca híbrida simples

**Validação:** Consegue indexar e buscar 10 arquivos?

---

### Semana 3: WebView

**Dias 11-13:**

* [ ] Setup React + Vite para webview-ui
* [ ] Reagraph mostrando grafo estático
* [ ] WebView controller (VS Code side)

**Dias 14-15:**

* [ ] Kuzu query → Reagraph format
* [ ] Node click → open in editor
* [ ] Básico de UI (search, filters)

**Validação:** Consegue ver grafo de 1 arquivo no VS Code?

---

### Semana 4: Integration & Polish

**Dias 16-17:**

* [ ] FileWatcher para auto-index
* [ ] Comandos VS Code (`cappy.indexFile`, `cappy.showGraph`)
* [ ] Status bar integration

**Dias 18-20:**

* [ ] Bug fixes
* [ ] Performance optimization
* [ ] README.md documentation
* [ ] Validação end-to-end

**MVP Pronto:** ✅ Indexa .ts/.md, busca híbrida, visualiza grafo

---

## ✅ Critérios de Sucesso MVP

### Funcional

* [ ] Indexa arquivos .ts (JSDoc via AST)
* [ ] Indexa arquivos .md (sections)
* [ ] Busca semântica retorna resultados relevantes
* [ ] Grafo mostra relacionamentos corretos
* [ ] Auto-index quando arquivo é salvo

### Performance

* [ ] Indexar 100 arquivos < 30 segundos
* [ ] Busca < 500ms
* [ ] Uso de memória < 500MB

### Qualidade

* [ ] Zero duplicação de conteúdo (LanceDB vs Kuzu)
* [ ] IDs consistentes entre bancos
* [ ] Rastreamento de linhas correto

---

## 🎯 Escopo FORA do MVP

### Não Implementar Agora

❌ Python parser (complexo)
❌ LLM enrichment para TypeScript (desnecessário)
❌ PDF/DOCX support (V2)
❌ Reliability patterns (WAL, circuit breaker)
❌ Document Manager UI completo (V2)
❌ Reconciliation service
❌ Multi-workspace support

### Implementar em V2 (Semanas 5-8)

✅ PDF chunking + LLM extraction
✅ DOCX support
✅ LLM optional enrichment
✅ Document Manager WebView UI
✅ Upload buttons
✅ Progress indicators

---

## 📊 Estimativa de Custos

### Workspace Típico (500 arquivos)

**Arquivos TypeScript/JavaScript (400):**

* Parser AST: $0
* Embeddings: ~2,000 chunks × $0 (local) = $0
* **Total: $0**

**Arquivos Markdown (100):**

* Chunking: gratuito
* Embeddings: ~500 chunks × $0 (local) = $0
* LLM extraction (se V2): 500 × $0.002 = $1.00
* **Total MVP: $0** (sem LLM)
* **Total V2: $1.00** (com LLM)

**Total Workspace:**

* MVP: **$0**
* V2: **$1.00-2.00**

---

## 🔄 Próximos Passos Imediatos

1. ✅ Aprovar este documento
2. [ ] Criar issue/project no GitHub
3. [ ] Setup estrutura inicial do projeto
4. [ ] Instalar dependências base
5. [ ] Começar Semana 1 - Dia 1

---

**Documento Aprovado por:** _________________
**Data:** 12/10/2025
**Versão Final:** 5.0.0

---

## 📚 Referências

* [LanceDB Documentation](https://lancedb.github.io/lancedb/)
* [Kuzu Documentation](https://kuzudb.com/)
* [Kuzu Cypher Queries](https://kuzudb.com/docs/cypher/)
* [Reagraph Documentation](https://reagraph.dev/)
* [TypeScript ESLint Parser](https://typescript-eslint.io/packages/parser)
* [Xenova Transformers](https://huggingface.co/docs/transformers.js)

---

## 🚀 Roadmap de Implementação MVP (4 semanas)

### Semana 1: Base

**Dias 1-2:**

* [ ] Setup estrutura de pastas
* [ ] Install dependencies
* [ ] LanceDB connection + schema
* [ ] Kuzu connection + schema

**Dias 3-5:**

* [ ] Parser TypeScript (AST) - JSDoc extraction
* [ ] Parser Markdown (sections)
* [ ] Chunking básico
* [ ] Embedding service (Xenova)

**Validação:** Consegue parsear 1 arquivo .ts e 1 arquivo .md?

---

### Semana 2: Indexação

**Dias 6-7:**

* [ ] LanceDB insert (chunks + embeddings)
* [ ] Kuzu insert (nodes + relationships)
* [ ] Dual-write simples (sem reliability patterns)

**Dias 8-10:**

* [ ] Vector search básico (LanceDB)
* [ ] Graph query básico (Kuzu)
* [ ] Busca híbrida simples

**Validação:** Consegue indexar e buscar 10 arquivos?

---

### Semana 3: WebView

**Dias 11-13:**

* [ ] Setup React + Vite para webview-ui
* [ ] Reagraph mostrando grafo estático
* [ ] WebView controller (VS Code side)

**Dias 14-15:**

* [ ] Kuzu query → Reagraph format
* [ ] Node click → open in editor
* [ ] Básico de UI (search, filters)

**Validação:** Consegue ver grafo de 1 arquivo no VS Code?

---

### Semana 4: Integration & Polish

**Dias 16-17:**

* [ ] FileWatcher para auto-index (com **BLAKE3** preferencial e fallback para `sha256`/`md5`)
* [ ] Comandos VS Code (`cappy.indexFile`, `cappy.showGraph`)
* [ ] Status bar integration

**Dias 18-20:**

* [ ] Bug fixes
* [ ] Performance optimization
* [ ] README.md documentation
* [ ] Validação end-to-end

**MVP Pronto:** ✅ Indexa .ts/.md, busca híbrida, visualiza grafo

---

**FIM DO DOCUMENTO**
