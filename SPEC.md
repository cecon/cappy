# Mini-LightRAG - Especificação Arquitetural

> Gerado em: 2025-10-03  
> Baseado em: [.cappy/TODO/](/.cappy/TODO/) Steps 1-15

## Visão Geral

Sistema de recuperação híbrida 100% local que combina busca vetorial (LanceDB) com expansão de grafo (LightGraph) para busca precisa em símbolos/documentação com abertura direta no arquivo/linha.

### Objetivos Principais
- **Busca precisa** em símbolos/docs com abertura direta no arquivo/linha
- **Subgrafo explicativo** mostrando "por que apareceu" (caminho, arestas)
- **Indexação incremental** rápida (só o que mudou)
- **100% local** - sem dependências externas de rede

## Decisões Arquiteturais

### Armazenamento Vetorial
- **Tecnologia**: LanceDB in-process
- **Localização**: `context.globalStorageUri.fsPath + '/mini-lightrag'`
- **Estrutura**:
  ```
  globalStorage/mini-lightrag/
  ├── chunks/          # Coleção principal de chunks
  ├── nodes/           # Nós do grafo
  ├── edges/           # Arestas do grafo
  └── indexes/         # Índices HNSW/IVF
  ```

### Estratégia de Grafo
- **Abordagem**: LightGraph integrado no próprio LanceDB
- **Tipos de Nós**: Document, Section, Keyword, Symbol
- **Tipos de Arestas**: CONTAINS, HAS_KEYWORD, REFERS_TO, MEMBER_OF, SIMILAR_TO
- **Armazenamento**: Tabelas separadas `nodes` e `edges` no LanceDB

### Modelos de Embedding
- **Principal**: all-MiniLM-L6-v2 (384 dimensões)
- **Runtime**: transformers.js local (46.6MB aceitável)
- **Normalização**: L2 normalization
- **Futuro**: BGE-M3 (fase 2, maior qualidade)

### Sistema de Hash
- **Algoritmo**: BLAKE3 (8.6kB, nativo + WebAssembly)
- **Aplicação**: Por chunk com `textHash`, `startLine`, `endLine`
- **Finalidade**: Detecção de mudanças incrementais
- **Formato ID**: `hash(path + startLine + endLine + textHash)`

### Fonte de Documentos
- **Prioridade 1**: JSDoc/TypeDoc JSON (estruturado)
- **Prioridade 2**: Arquivos .md (quando houver)
- **Detecção**: Automática por extensão e conteúdo

## Estrutura de Dados

### Chunk (Unidade Buscável)
```typescript
interface Chunk {
  id: string;              // hash(path + startLine + endLine + textHash)
  path: string;
  lang: string;
  startLine: number;       // 1-based
  endLine: number;         // 1-based
  startChar?: number;      // opcional
  endChar?: number;        // opcional
  textHash: string;        // BLAKE3 do texto
  fileHash: string;        // BLAKE3 do arquivo
  keywords?: string[];     // opcional
  symbolId?: string;       // para JSDoc/TypeDoc
  vector: number[];        // 384 dimensões
  indexedAt: string;       // ISO datetime
  model: string;           // "all-MiniLM-L6-v2"
  dim: number;             // 384
}
```

### Node (Grafo)
```typescript
interface Node {
  id: string;              // ex: "doc:...", "sym:...", "kw:..."
  type: "Document" | "Section" | "Keyword" | "Symbol";
  label: string;
  path?: string;
  lang?: string;
  score?: number;
  tags?: string[];
  updatedAt: string;       // ISO datetime
}
```

### Edge (Grafo)
```typescript
interface Edge {
  id: string;              // "sourceId->targetId:type"
  source: string;
  target: string;
  type: "CONTAINS" | "HAS_KEYWORD" | "REFERS_TO" | "MENTIONS_SYMBOL" | "MEMBER_OF" | "SIMILAR_TO";
  weight: number;
  updatedAt: string;       // ISO datetime
}
```

## Arquitetura de Módulos

### src/core/ - Contratos e Fundamentos
- **Schemas**: Definições TypeScript dos contratos
- **Chunking**: Estratégias de divisão de texto
- **Hashing**: Utilitários BLAKE3
- **Ranking**: Algoritmos de ranking híbrido

### src/indexer/ - Ingestão Incremental
- **Document Scanner**: Descoberta de arquivos
- **Content Parser**: Parsing por tipo
- **Incremental Updater**: Lógica de diff/update
- **Batch Processor**: Processamento em lotes

### src/store/ - Persistência LanceDB
- **LanceDB Client**: Cliente principal
- **Embedding Service**: Integração transformers.js
- **Vector Index**: Configuração HNSW/IVF
- **Storage Manager**: Gestão do globalStorage

### src/graph/ - Expansão de Grafo
- **Graph Builder**: Construção de grafo
- **Node Expander**: Expansão 1-hop
- **Subgraph Generator**: Geração de subgrafos
- **Path Finder**: Algoritmos de caminho

### src/query/ - Orquestração Híbrida
- **Query Orchestrator**: Pipeline principal
- **Hybrid Ranker**: Algoritmos de ranking
- **Filter Engine**: Sistema de filtros
- **Result Formatter**: Formatação de saída

### src/tools/ - Ferramentas para LLMs
- **MCP Server**: Servidor MCP da extensão
- **LM Tools Registry**: Registro VS Code LM Tools
- **Tool Handlers**: Implementação das ferramentas
- **Response Formatter**: Formatação para LLMs

### src/webview/graph-ui/ - Interface React
- **Graph Webview**: Componente principal
- **Cytoscape Canvas**: Wrapper Cytoscape.js
- **Node Details Panel**: Painel de detalhes
- **Webview Provider**: Provider VS Code

## Pipeline de Consulta

### 1. Busca Vetorial
- Top-K em chunks (K=20 padrão)
- Similarity search no LanceDB
- Filtros por path, linguagem, data

### 2. Expansão 1-hop
- A partir dos chunks encontrados
- Expandir por: REFERS_TO, MEMBER_OF, HAS_KEYWORD
- Irmãos do mesmo doc/section
- Limitar crescimento do subgrafo

### 3. Ranking Híbrido
```
score_final = 0.6·cos + 0.2·overlap_keywords + 0.15·peso_aresta + 0.05·frescor
```
- **cos**: Similaridade cosine vetorial
- **overlap_keywords**: Jaccard de palavras-chave  
- **peso_aresta**: Força da conexão no grafo
- **frescor**: Baseado em updatedAt (dias)

### 4. Formatação de Saída
- Lista: `{path, startLine, endLine, snippet, score, why{}}`
- Subgrafo JSON: `{nodes[], edges[], view{}}`
- Metadados explicativos

## Integração VS Code

### GlobalStorage
```typescript
// No activation da extensão
const globalStoragePath = context.globalStorageUri.fsPath;
const miniLightRagPath = path.join(globalStoragePath, 'mini-lightrag');

// Estrutura criada automaticamente por cappy.init
await fs.ensureDir(path.join(miniLightRagPath, 'chunks'));
await fs.ensureDir(path.join(miniLightRagPath, 'nodes'));
await fs.ensureDir(path.join(miniLightRagPath, 'edges'));
await fs.ensureDir(path.join(miniLightRagPath, 'indexes'));
```

### Comandos da Extensão
- `cappy.init` - Criar estrutura Mini-LightRAG
- `cappy.lightrag.index` - Indexar workspace atual
- `cappy.lightrag.search` - Busca híbrida
- `cappy.lightrag.graph` - Abrir UI do grafo

### Ferramentas para LLMs
- **MCP Tools**: rag.search, graph.expand, symbols.lookup, cite.open
- **VS Code LM Tools**: Integração nativa com Copilot
- **Response Format**: Otimizado para consumo por LLMs

## Performance e Limites

### Índices Vetoriais
- **HNSW**: M=16, efConstruction=200
- **Dimensões**: 384 (all-MiniLM-L6-v2)
- **Batch Size**: 100 chunks por operação

### Limites Operacionais
- **Subgrafo UI**: Máx 5k nós / 10k arestas
- **Query Response**: Máx 200 nós
- **Chunk Size**: 200-800 tokens
- **Timeout**: 2s para operações comuns

### Otimizações
- **LOD**: Level of Detail no UI
- **Lazy Loading**: Chunks sob demanda
- **Cache**: Embeddings e resultados frequentes
- **Incremental**: Apenas chunks modificados

## Roadmap de Implementação

Baseado nos [Steps](.cappy/TODO/):
1. **Steps 1-2**: ✅ Estrutura e decisões
2. **Steps 3-5**: Schemas, hashing, chunking
3. **Steps 6-8**: LanceDB, embeddings, indexação
4. **Step 9**: Pipeline de consulta híbrida
5. **Step 10**: Integração VS Code
6. **Step 11**: UI React do grafo
7. **Step 12**: Ferramentas MCP/LM Tools
8. **Steps 13-15**: Performance, testes, roadmap

## Dependências Validadas

### LanceDB
- ✅ **Versão**: 0.22.1
- ✅ **Compatibilidade**: Node.js + Windows x64
- ✅ **Tamanho**: Apenas 1 dependência

### transformers.js  
- ✅ **Versão**: 2.17.2
- ✅ **Tamanho**: 46.6MB (aceitável pelo benefício)
- ✅ **Benefício**: Embeddings locais + privacidade total

### BLAKE3
- ✅ **Versão**: 3.0.0
- ✅ **Tamanho**: 8.6kB descompactado
- ✅ **Implementação**: Nativa + WebAssembly fallback

## Próximos Passos

1. ✅ Estrutura de diretórios criada
2. ✅ READMEs explicativos documentados  
3. ✅ SPEC.md arquitetural finalizado
4. 🔄 Integração no `cappy.init`
5. 📋 Implementação dos Steps 3-15 em sequência