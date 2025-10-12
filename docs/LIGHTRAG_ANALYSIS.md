# 🔬 Análise LightRAG - Processamento de Documentos

## 📋 Overview
Análise detalhada de como o LightRAG processa documentos para determinar se conseguimos replicar (no mínimo) essa funcionalidade no CAPPY.

**Data**: 11/10/2025  
**Fonte**: [LightRAG GitHub](https://github.com/HKUDS/LightRAG) | [Paper arXiv:2410.05779](https://arxiv.org/abs/2410.05779)

---

## 🎯 O que o LightRAG faz?

### **Arquitetura Principal**
```
Document Input
     ↓
Text Chunking
     ↓
Entity & Relation Extraction (LLM)
     ↓
Graph Construction (NetworkX/Neo4j)
     ↓
Vector Embeddings (Entities + Relations + Chunks)
     ↓
Dual Storage: Graph DB + Vector DB
     ↓
Dual-Level Retrieval (Low + High level)
```

---

## 📊 Pipeline de Processamento do LightRAG

### **1. Document Ingestion**
```python
# LightRAG aceita múltiplos formatos
supported_formats = [
    ".txt", ".pdf", ".doc", ".docx", 
    ".ppt", ".pptx", ".csv", ".md"
]

# Usa 'textract' para extração
await rag.ainsert(document_text)
```

**Features**:
- ✅ Multi-formato (PDF, DOC, PPT, CSV, MD)
- ✅ Batch insert
- ✅ Incremental updates
- ✅ Document ID tracking

---

### **2. Text Chunking**

```python
# Chunking Strategy (configurável)
chunk_config = {
    "chunk_token_size": 1200,      # Tamanho do chunk
    "chunk_overlap_token_size": 100, # Overlap entre chunks
    "tiktoken_model_name": "gpt-4o"  # Tokenizer
}
```

**Características**:
- **Token-based chunking**: Não por linhas, mas por tokens
- **Overlap**: 100 tokens de overlap para manter contexto
- **Configurável**: Pode ajustar tamanho e overlap
- **Semantic boundaries**: Tenta respeitar limites semânticos

**Diferencial**: Chunking por tokens (não caracteres/linhas) garante melhor controle sobre context window do LLM.

---

### **3. Entity & Relation Extraction** ⭐ **核心**

Aqui está o **diferencial chave** do LightRAG:

```python
# Prompt para extração (simplificado)
extraction_prompt = """
Given the text chunk:
{chunk_content}

Extract:
1. Named entities (people, organizations, locations, concepts)
2. Relationships between entities
3. Entity descriptions
4. Relationship types and strength

Output as structured JSON:
{
  "entities": [
    {"name": "...", "type": "...", "description": "..."}
  ],
  "relations": [
    {"source": "...", "target": "...", "type": "...", "description": "...", "strength": 0.0-1.0}
  ]
}
"""
```

**Process**:
1. **Para cada chunk** → chamar LLM
2. LLM extrai **entities** e **relations**
3. Cada entidade tem:
   - `name`: Nome da entidade
   - `type`: Tipo (Person, Organization, Concept, Location, etc.)
   - `description`: Descrição extraída do contexto
4. Cada relação tem:
   - `source` → `target`: Direção
   - `type`: Tipo de relacionamento (works_at, related_to, part_of, etc.)
   - `description`: Contexto da relação
   - `strength`: Score de confiança (0-1)

**Exemplo Real**:
```json
{
  "entities": [
    {"name": "Scrooge", "type": "Person", "description": "Wealthy, cold-hearted businessman"},
    {"name": "Bob Cratchit", "type": "Person", "description": "Scrooge's underpaid clerk"},
    {"name": "Christmas", "type": "Concept", "description": "Holiday celebration"}
  ],
  "relations": [
    {
      "source": "Scrooge",
      "target": "Bob Cratchit",
      "type": "employs",
      "description": "Scrooge employs Bob as his clerk with poor conditions",
      "strength": 0.95
    },
    {
      "source": "Scrooge",
      "target": "Christmas",
      "type": "dislikes",
      "description": "Scrooge famously despises Christmas celebration",
      "strength": 0.9
    }
  ]
}
```

**Requisitos**:
- ⚠️ **LLM com 32B+ parâmetros** recomendado
- ⚠️ **Context length 32KB-64KB** necessário
- ⚠️ **Não usar reasoning models** na indexação (muito lento)
- ✅ Pode usar modelos locais (Ollama, HuggingFace)

---

### **4. Graph Construction**

```python
# Constrói grafo direcionado
graph_storage_options = [
    "NetworkX",      # Default, in-memory
    "Neo4j",         # Production (recomendado)
    "PostgreSQL+AGE", # Graph extension
    "Memgraph"       # Memory-first
]

# Estrutura do grafo
Node: {
    "id": "entity_name",
    "type": "entity_type",
    "description": "...",
    "source_chunks": ["chunk_id_1", "chunk_id_2"],
    "embedding": [0.1, 0.2, ...]  # Vector embedding
}

Edge: {
    "source": "entity_1",
    "target": "entity_2",
    "type": "relation_type",
    "description": "...",
    "weight": 0.0-1.0,
    "source_chunks": ["chunk_id_1"]
}
```

**Features**:
- **Dual representation**: Graph structure + Vector embeddings
- **Bidirectional edges**: Relações são bidirecionais quando apropriado
- **Entity merging**: Entidades duplicadas são mescladas
- **Incremental updates**: Novos documentos atualizam grafo existente

---

### **5. Vector Embeddings**

```python
# Três tipos de embeddings
embedding_targets = {
    "entities": "entity name + description",
    "relations": "source + relation_type + target + description",
    "chunks": "original text chunk"
}

# Modelos recomendados
recommended_models = [
    "BAAI/bge-m3",              # Multilingual, 1024 dims
    "text-embedding-3-large",   # OpenAI, 3072 dims
    "Xenova/all-MiniLM-L6-v2"   # Local, 384 dims
]
```

**Storage**:
```python
# Vector DB options
vector_storage_options = [
    "NanoVectorDB",    # Default, local
    "Milvus",          # Production
    "Qdrant",          # Production
    "PostgreSQL+pgvector",
    "Faiss",           # Local, high-performance
    "MongoDB"
]
```

**Indexação**:
- Entities são indexadas por seus embeddings
- Relations são indexadas por embeddings compostos
- Chunks são indexados por conteúdo completo

---

### **6. Dual-Level Retrieval** ⭐

O **grande diferencial** do LightRAG:

#### **Low-Level Retrieval** (Local Mode)
```python
# Busca focada em contexto específico
mode = "local"

# Process:
# 1. Query embedding
# 2. Find similar entities (vector search)
# 3. Get connected subgraph (1-hop neighbors)
# 4. Retrieve source chunks
# 5. Rank and return
```

**Uso**: Perguntas específicas sobre entidades/conceitos individuais.

#### **High-Level Retrieval** (Global Mode)
```python
# Busca focada em conhecimento amplo
mode = "global"

# Process:
# 1. Query embedding
# 2. Find similar relations (vector search)
# 3. Get connected entities
# 4. Community detection (graph algorithms)
# 5. Summarize communities
# 6. Rank and return
```

**Uso**: Perguntas amplas, temas gerais, sínteses.

#### **Hybrid Mode**
```python
mode = "hybrid"

# Combina Local + Global
# Melhor para maioria dos casos
```

#### **Mix Mode**
```python
mode = "mix"

# Graph retrieval + Vector retrieval
# Recomendado quando usa Reranker
```

---

## 🎯 Comparação: LightRAG vs CAPPY (Proposto)

| Aspecto | LightRAG | CAPPY (Nossa Proposta) | Status |
|---------|----------|------------------------|--------|
| **Document Formats** | PDF, DOC, PPT, CSV, MD | MD, TS, PY, JS, TSX | ✅ Diferente mas equivalente |
| **Chunking Strategy** | Token-based, overlap | AST-based (code), Section-based (MD) | ⭐ **Melhor para código** |
| **Entity Extraction** | LLM-based (32B+) | Rule-based + Pattern matching | ⚠️ **Precisamos LLM** |
| **Relation Extraction** | LLM-based | Code analysis (imports, calls) | ✅ **Mais preciso para código** |
| **Graph Storage** | NetworkX, Neo4j, PG+AGE | Graphology (in-memory) | ✅ Similar |
| **Vector Storage** | Nano, Milvus, Qdrant | LanceDB | ✅ Equivalente |
| **Embeddings** | OpenAI, BGE, local | Xenova Transformers | ✅ Equivalente |
| **Dual-Level Retrieval** | Local + Global | Planejado | ⚠️ **Precisamos implementar** |
| **Incremental Updates** | ✅ Sim | ✅ Planejado (FileWatcher) | ✅ OK |

---

## 🚨 Gaps Críticos que Precisamos Resolver

### **1. Entity Extraction com LLM** ⚠️ **CRÍTICO**

**O que LightRAG faz**:
- Usa LLM (GPT-4, Claude, Llama 70B) para extrair entidades
- Extração semântica, não apenas sintática
- Captura relacionamentos implícitos

**Nossa abordagem atual**:
- Rule-based (regex, AST parsing)
- Apenas entidades explícitas (nomes de funções, classes)
- Não captura semântica ou relacionamentos implícitos

**Solução**:
```typescript
// Opção 1: Usar VS Code Language Model API
const llm = vscode.lm.selectChatModels({ family: 'gpt-4o' })[0];

// Opção 2: Usar modelo local (Ollama)
const ollama = new OllamaLLM('llama3.1:70b');

// Opção 3: Híbrido - Rule-based + LLM para enriquecimento
const entities = extractWithAST(code);  // Rule-based
const enriched = await enrichWithLLM(entities, code);  // LLM
```

**Recomendação**: **Opção 3 (Híbrido)**
- Rápido para entidades óbvias (funções, classes)
- LLM apenas para enriquecimento semântico
- Balança performance e qualidade

---

### **2. Dual-Level Retrieval** ⚠️ **IMPORTANTE**

**O que precisamos**:
```typescript
interface DualLevelRetrieval {
  // Low-level: Busca focada
  localSearch(query: string, depth: number): Promise<Result[]>;
  
  // High-level: Busca ampla
  globalSearch(query: string): Promise<Result[]>;
  
  // Híbrido
  hybridSearch(query: string): Promise<Result[]>;
}
```

**Implementação**:
```typescript
class DualLevelSearchService {
  async localSearch(query: string, depth: number) {
    // 1. Vector search inicial (LanceDB)
    const seeds = await this.vectorDB.search(query, limit: 10);
    
    // 2. Graph expansion (Graphology)
    const expanded = await this.graphEngine.bfs(seeds, depth);
    
    // 3. Enriquecer com chunks
    return await this.vectorDB.enrichNodes(expanded);
  }
  
  async globalSearch(query: string) {
    // 1. Busca por relations (não entities)
    const relations = await this.vectorDB.searchRelations(query);
    
    // 2. Community detection
    const communities = await this.graphEngine.detectCommunities(relations);
    
    // 3. Summarize communities
    return await this.summarizeCommunities(communities);
  }
}
```

---

### **3. Relation Embeddings** ⚠️ **MÉDIO**

**LightRAG**:
```python
# Embedding de relação é composto
relation_text = f"{source} {relation_type} {target}: {description}"
relation_embedding = embed(relation_text)
```

**Nossa implementação**:
```typescript
// Precisamos adicionar tabela de relations no LanceDB
interface RelationTable {
  id: string;
  source_entity: string;
  target_entity: string;
  relation_type: string;
  description: string;
  embedding: number[];  // Embedding composto
  source_chunks: string[];
  weight: number;
}
```

---

### **4. Token-based Chunking** ✅ **OPCIONAL**

Para Markdown, podemos melhorar:

```typescript
// Atual: Section-based
function chunkMarkdown(content: string) {
  return content.split(/\n#+\s+/);  // Por headers
}

// LightRAG style: Token-based com overlap
function chunkMarkdownTokenBased(content: string, config: {
  chunkSize: number;    // 1200 tokens
  overlap: number;      // 100 tokens
}) {
  const tokens = tokenize(content);
  const chunks = [];
  
  for (let i = 0; i < tokens.length; i += config.chunkSize - config.overlap) {
    const chunk = tokens.slice(i, i + config.chunkSize);
    chunks.push(chunk);
  }
  
  return chunks;
}
```

**Vantagem**: Melhor controle sobre tamanho de contexto.
**Desvantagem**: Pode quebrar no meio de seções importantes.

**Recomendação**: Híbrido - respeitar headers quando possível, token-based quando necessário.

---

## ✅ O que JÁ fazemos bem (melhor que LightRAG)

### **1. Code-Specific Analysis** ⭐
```typescript
// LightRAG: Generic entity extraction
// CAPPY: AST-based, language-aware

// TypeScript
const ast = parseTypeScript(code);
const entities = {
  functions: extractFunctions(ast),
  classes: extractClasses(ast),
  interfaces: extractInterfaces(ast),
  imports: extractImports(ast),
  exports: extractExports(ast)
};

// Relations são explícitas
const relations = {
  "UserService": {
    imports: ["UserRepository", "EmailService"],
    extends: ["BaseService"],
    implements: ["IUserService"]
  }
};
```

**Vantagem sobre LightRAG**:
- ✅ Precisão 100% para code entities
- ✅ Relacionamentos explícitos (imports, extends, implements)
- ✅ Não precisa LLM (mais rápido, mais barato)
- ✅ Funciona offline

---

### **2. Multi-Language Support** ⭐
```typescript
// LightRAG: Focado em texto
// CAPPY: Multi-language code

const analyzers = {
  ".ts": TypeScriptAnalyzer,
  ".py": PythonAnalyzer,
  ".js": JavaScriptAnalyzer,
  ".md": MarkdownAnalyzer
};

// Cada analyzer entende sintaxe específica
```

---

### **3. IDE Integration** ⭐
```typescript
// LightRAG: Standalone server
// CAPPY: Integrado ao VS Code

// FileWatcher automático
vscode.workspace.createFileSystemWatcher("**/*.{ts,py,js,md}");

// LSP integration
vscode.languages.registerDefinitionProvider();
vscode.languages.registerReferenceProvider();
```

---

## 🎯 Plano de Ação: Alcançar Paridade com LightRAG

### **MVP (Mínimo Viável)** - 2 semanas

✅ **O que já temos planejado**:
1. LanceDB para vectors
2. Graphology para graph
3. AST-based entity extraction
4. FileWatcher para updates

⚠️ **O que falta para MVP**:
1. **Relation embeddings** (tabela separada)
2. **Local search** (vector + graph expansion)
3. **Enriquecimento semântico básico** (opcional LLM)

---

### **Paridade Completa** - 4 semanas

Adicionar:
1. **Global search** (community detection + summarization)
2. **Hybrid mode** (combina local + global)
3. **LLM-based enrichment** (semântica para code)
4. **Token-based chunking** (para MD)
5. **Reranker** (melhorar ranking)

---

### **Além do LightRAG** - 6 semanas

Nossos diferenciais:
1. **LSP Integration**: Go to definition, find references via graph
2. **Code-aware queries**: "Find all functions that use React hooks"
3. **Dependency analysis**: Impacto de mudanças via graph
4. **Multi-repo support**: Graph atravessa repositórios
5. **Real-time updates**: FileWatcher + incremental indexing

---

## 📊 Arquitetura Final Proposta

```
┌─────────────────────────────────────────────────────┐
│              CAPPY Document Processor                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │  Multi-Format    │      │  Entity          │   │
│  │  Analyzers       │─────►│  Extraction      │   │
│  │                  │      │                  │   │
│  │ - MD (section)   │      │ - AST-based      │   │
│  │ - TS (AST)       │      │ - Rule-based     │   │
│  │ - PY (AST)       │      │ - LLM-enriched   │   │
│  └──────────────────┘      └──────────────────┘   │
│           │                         │              │
│           ↓                         ↓              │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │  Chunking        │      │  Relation        │   │
│  │  Strategy        │      │  Extraction      │   │
│  │                  │      │                  │   │
│  │ - Token-based    │      │ - Import deps    │   │
│  │ - Section-aware  │      │ - Call graph     │   │
│  │ - Overlap        │      │ - Inheritance    │   │
│  └──────────────────┘      └──────────────────┘   │
│           │                         │              │
│           ↓                         ↓              │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │  LanceDB         │◄────►│  Graphology      │   │
│  │  (Vectors)       │      │  (Graph)         │   │
│  │                  │      │                  │   │
│  │ - Chunk vectors  │      │ - Entities       │   │
│  │ - Entity vectors │      │ - Relations      │   │
│  │ - Relation vect  │      │ - Communities    │   │
│  └──────────────────┘      └──────────────────┘   │
│           │                         │              │
│           └────────┬────────────────┘              │
│                    ↓                               │
│  ┌─────────────────────────────────────────┐      │
│  │     Dual-Level Retrieval Engine         │      │
│  │                                          │      │
│  │  ┌──────────┐  ┌──────────┐  ┌────────┐│      │
│  │  │  Local   │  │  Global  │  │ Hybrid ││      │
│  │  │  Search  │  │  Search  │  │ Search ││      │
│  │  └──────────┘  └──────────┘  └────────┘│      │
│  └─────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Resposta à Pergunta Original

### **Conseguimos fazer no mínimo igual ao LightRAG?**

**Resposta: SIM, com algumas ressalvas** ✅⚠️

#### **O que faremos MELHOR**:
✅ Code-specific entity extraction (AST > LLM para código)
✅ Precisão de relacionamentos em código
✅ Performance (não precisa LLM para tudo)
✅ IDE integration nativa
✅ Multi-language support

#### **O que precisamos adicionar**:
⚠️ LLM-based enrichment (opcional mas recomendado)
⚠️ Dual-level retrieval (local + global + hybrid)
⚠️ Relation embeddings (tabela separada)
⚠️ Community detection e summarization

#### **O que é opcional**:
🔹 Token-based chunking (nossa abordagem funciona)
🔹 Multiple vector DB backends (LanceDB suficiente)
🔹 Multiple graph DB backends (Graphology suficiente)

---

## 📝 Próximos Passos Imediatos

### **1. Decisão Arquitetural** (Hoje)
- [ ] Aprovar arquitetura híbrida (LanceDB + Graphology)
- [ ] Definir se usaremos LLM para enriquecimento
- [ ] Escolher estratégia de chunking

### **2. Implementação MVP** (2 semanas)
- [ ] Tabela de relations no LanceDB
- [ ] Local search (vector + graph)
- [ ] Sync service (LanceDB ↔ Graphology)
- [ ] FileWatcher integration

### **3. Paridade** (4 semanas)
- [ ] Global search
- [ ] Hybrid mode
- [ ] LLM enrichment (se aprovado)
- [ ] Testes e benchmarks

---

## 🔗 Referências

- [LightRAG GitHub](https://github.com/HKUDS/LightRAG)
- [LightRAG Paper](https://arxiv.org/abs/2410.05779)
- [Graphology](https://graphology.github.io/)
- [LanceDB](https://lancedb.github.io/lancedb/)

---

**Conclusão**: Não apenas conseguimos replicar o LightRAG, como podemos **superá-lo em casos de uso específicos de código**, mantendo a simplicidade de uma solução embedded local. 🚀
