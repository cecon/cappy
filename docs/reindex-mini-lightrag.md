# Comando Reindex - Mini-LightRAG

## Resumo da Atualização

O comando `cappy.reindex` foi atualizado para implementar a arquitetura **Mini-LightRAG** conforme especificado no `SPEC.md`.

## Mudanças Principais

### Antes (Sistema Legacy)
- Indexação simples baseada em keywords extraídas
- Arquivos JSON com metadados básicos
- Sem suporte a embeddings vetoriais
- Sem grafo de conhecimento

### Depois (Mini-LightRAG)
- **Chunking** inteligente de arquivos (50 linhas por chunk, ajustável)
- **Embeddings vetoriais** (384 dimensões, preparado para all-MiniLM-L6-v2)
- **Grafo de conhecimento** com nós (Document, Section, Keyword, Symbol) e arestas (CONTAINS, HAS_KEYWORD, etc.)
- **Normalização de conteúdo** conforme SPEC (LF, Unicode NFC, trim trailing whitespace)
- **Hashing** SHA256 (preparado para BLAKE3)
- **Armazenamento** no globalStorage do VS Code (`mini-lightrag/`)

## Estrutura de Armazenamento

```
globalStorage/mini-lightrag/
├── chunks/
│   └── chunks.json          # Todos os chunks vetorizados
├── nodes/
│   └── nodes.json           # Nós do grafo de conhecimento
├── edges/
│   └── edges.json           # Arestas do grafo
├── indexes/                 # Índices HNSW (futuro)
└── stats.json               # Estatísticas da indexação
```

## Schemas Implementados

### Chunk
```typescript
interface Chunk {
  id: string;              // hash(path + startLine + endLine + textHash)
  path: string;            // Caminho relativo
  lang: string;            // Linguagem inferida
  startLine: number;       // Linha inicial (1-based)
  endLine: number;         // Linha final (1-based)
  textHash: string;        // Hash do texto normalizado
  fileHash: string;        // Hash do arquivo completo
  keywords?: string[];     // Keywords extraídas
  vector: number[];        // Embedding 384d
  indexedAt: string;       // ISO timestamp
  model: string;           // Modelo de embedding
  dim: number;             // Dimensões do vetor
}
```

### Node
```typescript
interface Node {
  id: string;              // "doc:hash", "sec:hash", "kw:word", "sym:fqn"
  type: "Document" | "Section" | "Keyword" | "Symbol";
  label: string;           // Nome legível
  path?: string;           // Caminho (para Document/Section)
  lang?: string;           // Linguagem
  tags?: string[];         // Tags categóricas
  updatedAt: string;       // ISO timestamp
}
```

### Edge
```typescript
interface Edge {
  id: string;              // "${source}->${target}:${type}"
  source: string;          // ID do nó origem
  target: string;          // ID do nó destino
  type: "CONTAINS" | "HAS_KEYWORD" | "REFERS_TO" | "MENTIONS_SYMBOL" | "MEMBER_OF" | "SIMILAR_TO";
  weight: number;          // Peso 0.0-1.0
  updatedAt: string;       // ISO timestamp
}
```

## Tipos de Arestas e Pesos

- **CONTAINS** (0.4): Document contém Section
- **HAS_KEYWORD** (0.3): Section tem Keyword
- **REFERS_TO** (1.0): Referência direta (futuro)
- **MENTIONS_SYMBOL** (0.8): Menção a símbolo (futuro)
- **MEMBER_OF** (0.6): Relação de pertencimento (futuro)
- **SIMILAR_TO** (0.2): Similaridade semântica (futuro)

## Fluxo de Execução

1. **Inicialização**: Criar estrutura Mini-LightRAG no globalStorage
2. **Scan**: Buscar todos os arquivos suportados no workspace
3. **Chunking**: Dividir arquivos em chunks de ~50 linhas
4. **Normalização**: Aplicar normalização conforme SPEC
5. **Hashing**: Calcular fileHash e textHash
6. **Embeddings**: Gerar vetores 384d (placeholder por enquanto)
7. **Grafo**: Construir nós e arestas
8. **Persistência**: Salvar JSON (futuro: LanceDB)
9. **Legacy**: Manter compatibilidade com índices antigos

## Compatibilidade

O comando mantém **fallback para modo legacy** quando globalStorage não está disponível, garantindo que projetos existentes continuem funcionando.

## Próximos Passos

1. ✅ Implementar schemas Mini-LightRAG
2. ✅ Criar estrutura de armazenamento
3. ✅ Implementar chunking básico
4. ✅ Construir grafo de conhecimento
5. ⏳ Implementar BLAKE3 hashing
6. ⏳ Integrar transformers.js para embeddings reais
7. ⏳ Implementar LanceDB para armazenamento vetorial
8. ⏳ Adicionar indexação incremental
9. ⏳ Otimizar estratégias de chunking

## Uso

```bash
# Executar comando via VS Code
Ctrl+Shift+P -> "Cappy: Reindex Files"

# Ou via API
await vscode.commands.executeCommand('cappy.reindex');
```

## Output Esperado

```
Mini-LightRAG reindexation completed successfully:

📊 Vector Database Stats:
- Chunks indexed: 1234
- Knowledge graph nodes: 567
- Knowledge graph edges: 2345
- Files processed: 123
- Storage location: /path/to/globalStorage/mini-lightrag
- Indexing completed: 2025-10-04T12:34:56.789Z

🔍 Hybrid Search Features:
- Vector similarity search: Ready
- Knowledge graph expansion: Ready
- Incremental indexing: Prepared
- VS Code integration: Active
```
