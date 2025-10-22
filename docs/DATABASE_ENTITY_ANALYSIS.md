# Análise de Entidades Armazenadas no Banco de Dados

**Data da Análise**: 22 de Outubro de 2025  
**Versão do Cappy**: 3.1.0

## 🗄️ Estrutura do Banco de Dados (SQLite)

O Cappy utiliza **SQLite via sql.js (WASM)** para armazenar o grafo de conhecimento. Localização: `.cappy/graph-store.db`

### Tabelas Principais

```sql
-- Tabela de Nós (Nodes)
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  properties TEXT  -- JSON serializado
)

-- Tabela de Arestas (Edges)
CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  properties TEXT,  -- JSON serializado
  UNIQUE(from_id, to_id, type)
)

-- Tabela de Vetores (Vectors)
CREATE TABLE IF NOT EXISTS vectors (
  chunk_id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  metadata TEXT  -- JSON serializado
)
```

---

## 📦 Entidades (Nodes) Armazenadas

### 1. **File Nodes** (Nós de Arquivo)
**Type**: `"file"`

**Propriedades**:
```json
{
  "language": "typescript",
  "linesOfCode": 450
}
```

**ID**: Caminho absoluto do arquivo  
**Label**: Nome base do arquivo (ex: `"extension.ts"`)

**Quando criado**: Ao processar qualquer arquivo do workspace

---

### 2. **Chunk Nodes** (Nós de Pedaço de Código)
**Type**: `"chunk"`

**Propriedades**:
```json
{
  "filePath": "d:/projetos/cappy/src/extension.ts",
  "lineStart": 10,
  "lineEnd": 45,
  "chunkType": "jsdoc|code|markdown_section|plain_text|document_section",
  "symbolName": "activate",
  "symbolKind": "function|class|interface|type|variable"
}
```

**ID**: Hash único do chunk (ex: `"chunk-abc123"`)  
**Label**: 
- Com símbolo: `"activate"` (nome da função/classe)
- Sem símbolo: `"code [10-45]"` (tipo e linhas)

**Chunk Types**:
- `jsdoc` - Comentários JSDoc
- `code` - Blocos de código
- `markdown_section` - Seções de Markdown
- `plain_text` - Texto simples
- `document_section` - Seções de documentos (PDF, Word)

---

### 3. **Entity Nodes** (Nós de Entidade Extraída) ✨ **NOVO v3.1.0**
**Type**: `"entity"` (via prefixo `entity:`)

**ID**: `"entity:{name}_{type}"` (ex: `"entity:GraphService_class"`)

**Entity Types Suportados**:
```typescript
'class' | 'function' | 'interface' | 'type' | 'api' | 'library' | 
'framework' | 'concept' | 'pattern' | 'technology' | 'service' | 
'component' | 'module' | 'package' | 'tool' | 'other'
```

**Contexto**: Entidades semânticas extraídas via LLM de documentação

---

### 4. **Package Nodes** (Nós de Pacotes Externos)
**Type**: `"package"` (via prefixo `pkg:`)

**ID**: `"pkg:{packageName}"` (ex: `"pkg:vscode"`, `"pkg:react"`)

**Quando criado**: Ao detectar imports de pacotes externos npm

---

### 5. **Workspace Node** (Nó do Workspace)
**Type**: `"workspace"`

**ID**: `"workspace"`  
**Label**: Nome do workspace

**Único por workspace** - representa a raiz do projeto

---

## 🔗 Relacionamentos (Edges) Armazenados

### Relacionamentos de Código

| Tipo | De | Para | Descrição | Propriedades |
|------|----|----|-----------|--------------|
| `CONTAINS` | File | Chunk | Arquivo contém pedaço de código | `{ lineStart, lineEnd }` |
| `DOCUMENTS` | Chunk (jsdoc) | Chunk (code) | JSDoc documenta código | `{ symbolName }` |
| `IMPORTS` | Chunk/File | File | Import de arquivo local | `{ importPath, symbols[] }` |
| `IMPORTS_SYMBOL` | Chunk | Chunk | Import de símbolo específico | `{ symbolName, importPath }` |
| `IMPORTS_PKG` | File/Chunk | Package | Import de pacote npm | `{ packageName, confidence }` |
| `REFERENCES` | Chunk | Chunk | Referência entre chunks | `{ context }` |
| `DEFINES` | Chunk | Symbol | Chunk define símbolo | `{ symbolName, symbolKind }` |
| `RELATES_TO` | Chunk | Chunk | Relação genérica | `{ reason }` |

### Relacionamentos de Entidades ✨ **NOVO v3.1.0**

| Tipo | De | Para | Descrição | Propriedades |
|------|----|----|-----------|--------------|
| `mentioned_in` | Entity | Chunk | Entidade mencionada em chunk | `{ confidence, context, entityType }` |
| `mentions` | Chunk | Entity | Chunk menciona entidade | `{ entityType, confidence, context }` |
| `uses` | Entity | Entity | Entidade usa outra | `{ confidence, context, discoveredIn, discoveredAt }` |
| `implements` | Entity | Entity | Implementa interface/padrão | ↑ |
| `extends` | Entity | Entity | Herda de classe | ↑ |
| `depends_on` | Entity | Entity | Depende de outra entidade | ↑ |
| `configures` | Entity | Entity | Configura outra entidade | ↑ |
| `calls` | Entity | Entity | Chama função/método | ↑ |
| `instantiates` | Entity | Entity | Instancia classe | ↑ |

---

## 📊 Estatísticas de Armazenamento

### Exemplo de Projeto TypeScript (médio porte):

```
📦 Nodes:
   - Files: ~150 arquivos .ts
   - Chunks: ~1,200 chunks (média 8 por arquivo)
   - Entities: ~300 entidades extraídas (classes, APIs, conceitos)
   - Packages: ~45 pacotes externos
   - Workspace: 1

Total Nodes: ~1,696

🔗 Edges:
   - CONTAINS: ~1,200 (1 por chunk)
   - DOCUMENTS: ~400 (JSDoc → code)
   - IMPORTS: ~800 (imports entre arquivos)
   - IMPORTS_PKG: ~600 (imports de pacotes)
   - Entity relationships: ~450 (mentions, uses, etc)
   - Outros: ~200

Total Edges: ~3,650
```

---

## 🎯 Extração de Entidades Semânticas

### Como Funciona

1. **Documentação processada** → chunks extraídos
2. **LLM analisa chunks** → identifica entidades e relacionamentos
3. **EntityGraphService** → integra ao grafo

### O Que é Extraído

```typescript
interface ExtractedEntity {
  name: string;           // "GraphService", "React Hooks", "REST API"
  type: EntityType;       // "class", "concept", "api"
  confidence: number;     // 0.0 - 1.0
  context?: string;       // Trecho onde foi mencionado
  metadata?: Record;      // Dados adicionais
}

interface EntityRelationship {
  from: string;           // Nome da entidade origem
  to: string;             // Nome da entidade destino
  type: RelationshipType; // "uses", "implements", "extends"
  confidence: number;     // 0.0 - 1.0
  context?: string;       // Contexto do relacionamento
}
```

### Exemplo Real

**Documento**: "The GraphService class uses the SQLiteAdapter to store nodes and edges."

**Entidades Extraídas**:
```typescript
[
  { name: "GraphService", type: "class", confidence: 0.95 },
  { name: "SQLiteAdapter", type: "class", confidence: 0.90 },
  { name: "nodes", type: "concept", confidence: 0.80 },
  { name: "edges", type: "concept", confidence: 0.80 }
]
```

**Relacionamentos Extraídos**:
```typescript
[
  { 
    from: "GraphService", 
    to: "SQLiteAdapter", 
    type: "uses", 
    confidence: 0.95,
    context: "uses the SQLiteAdapter to store"
  }
]
```

---

## 🔍 Consultas Típicas

### Buscar Entidades de um Tipo
```sql
SELECT * FROM nodes 
WHERE type = 'entity' 
  AND json_extract(properties, '$.entityType') = 'api';
```

### Buscar Relacionamentos de Entidade
```sql
SELECT e.*, n.label as target_label
FROM edges e
JOIN nodes n ON e.to_id = n.id
WHERE e.from_id LIKE 'entity:%'
  AND e.type IN ('uses', 'implements', 'extends');
```

### Buscar Imports de Pacotes
```sql
SELECT e.from_id as file, e.to_id as package
FROM edges e
WHERE e.type = 'IMPORTS_PKG';
```

### Chunks que Mencionam Entidade Específica
```sql
SELECT c.id, c.label, e.properties
FROM nodes c
JOIN edges e ON e.to_id = c.id
WHERE e.from_id = 'entity:GraphService_class'
  AND e.type = 'mentioned_in';
```

---

## 💡 Insights

### O Que NÃO é Armazenado nos Nodes

❌ **Conteúdo textual dos chunks** → vai para `vectors` table  
❌ **Embeddings** → vai para `vectors.embedding_json`  
❌ **Código-fonte completo** → apenas referências (path + linhas)  
❌ **Histórico de mudanças** → apenas estado atual

### O Que é Duplicado

✅ **Mesma entidade mencionada N vezes** → 1 entity node, N edges `mentioned_in`  
✅ **Mesmo arquivo importado N vezes** → 1 file node, N edges `IMPORTS`  
✅ **Mesmo pacote usado N vezes** → 1 package node, N edges `IMPORTS_PKG`

### Cardinalidade

```
1 Workspace
  └─ N Files (150-500 típico)
      └─ N Chunks (~8/file)
          ├─ M Entities extraídas (~2-3/chunk docs)
          └─ K Package imports (~3-5/file)
```

---

## 🚀 Uso pela API

### Criar File Node
```typescript
await graphStore.createFileNode(
  '/path/to/file.ts',
  'typescript',
  450  // lines of code
);
```

### Criar Chunk Nodes
```typescript
await graphStore.createChunkNodes([
  {
    id: 'chunk-abc123',
    content: '...',
    metadata: {
      filePath: '/path/to/file.ts',
      lineStart: 10,
      lineEnd: 45,
      chunkType: 'code',
      symbolName: 'activate',
      symbolKind: 'function'
    }
  }
]);
```

### Criar Relacionamentos
```typescript
await graphStore.createRelationships([
  {
    from: '/path/to/file.ts',
    to: 'chunk-abc123',
    type: 'CONTAINS',
    properties: { lineStart: 10, lineEnd: 45 }
  },
  {
    from: 'chunk-abc123',
    to: 'pkg:vscode',
    type: 'IMPORTS_PKG',
    properties: { packageName: 'vscode', confidence: 1.0 }
  }
]);
```

### Integrar Entidades
```typescript
const entityService = new EntityGraphService(graphStore);
await entityService.integrateEntities(chunks, extractionResults);
```

---

## 📈 Performance

### Operações Otimizadas

- `INSERT OR REPLACE` → upsert atômico
- `INSERT OR IGNORE` → evita duplicatas
- Índices automáticos em PRIMARY KEY e UNIQUE
- Transações implícitas por batch

### Limitações

- **sql.js** roda em memória (WASM)
- Persistência via `fs.writeFileSync` após cada operação
- Não suporta concurrent writes (single-threaded)
- Max ~100k nodes recomendado (performance)

---

## 🎓 Resumo Executivo

### Entidades Principais

1. **Files** - Arquivos do workspace
2. **Chunks** - Pedaços de código/docs (8-12 por arquivo)
3. **Entities** - Conceitos semânticos (classes, APIs, tecnologias)
4. **Packages** - Dependências externas npm

### Relacionamentos Chave

1. **Estruturais**: `CONTAINS`, `DOCUMENTS`
2. **Dependências**: `IMPORTS`, `IMPORTS_PKG`, `IMPORTS_SYMBOL`
3. **Semânticos**: `mentions`, `uses`, `implements`, `extends`

### Propósito

✅ **Navegação** - Explorar código visualmente  
✅ **Contexto** - Recuperar chunks relacionados  
✅ **Busca** - Híbrida (semântica + grafo)  
✅ **Documentação** - Mapear conceitos do projeto  

### Diferencial v3.1.0

🌟 **Extração de Entidades Semânticas via LLM** - vai além de AST, entende conceitos e documentação
