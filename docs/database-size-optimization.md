# 🎯 Otimização do Tamanho do Database - Mini-LightRAG

## 🚨 Problema Identificado

Quando o database do LightRAG fica muito grande e impossível de visualizar, geralmente é porque **estamos armazenando CONTEÚDO em vez de PONTEIROS**.

## ❌ Antipadrão: Armazenar Conteúdo

```typescript
// ERRADO - Database vai explodir
interface ChunkComConteudo {
  id: string;
  path: string;
  content: string;          // ❌ Texto completo duplicado!
  vector: number[];
  // Resultado: 4-10 MB de texto duplicado
}
```

**Problema:**
- Projeto com 50k linhas = 4 MB de texto
- Texto duplicado no database + arquivo original
- Database gigante (>100 MB para projetos médios)
- Visualização impossível (milhares de nodes com texto)

## ✅ Padrão Correto: Ponteiros e Vetores

```typescript
// CERTO - Database enxuto
interface ChunkOtimizado {
  id: string;              // hash(path + linhas + textHash)
  path: string;            // Ponteiro para arquivo original
  startLine: number;       // Onde começa no arquivo
  endLine: number;         // Onde termina no arquivo
  textHash: string;        // Para validação de integridade
  fileHash: string;        // Hash do arquivo completo
  vector: number[];        // Embedding (384 números)
  
  // ❌ NÃO incluir:
  // content: string;
  // text: string;
  // snippet: string;
}
```

**Vantagens:**
- Database contém apenas metadados + vetores matemáticos
- Conteúdo real lido sob demanda do arquivo original
- Tamanho controlado: ~80-100 MB para projetos grandes
- Visualização eficiente: nodes leves com labels curtos

## 🔄 Fluxo Correto: Indexação → Busca

### 1. Indexação (offline, uma vez)

```typescript
async function indexFile(filePath: string) {
  // 1. Ler arquivo original
  const content = await fs.readFile(filePath, 'utf8');
  
  // 2. Dividir em chunks lógicos
  const chunks = await chunkContent(content, {
    minSize: 200,
    maxSize: 800,
    overlap: 50
  });
  
  // 3. Processar cada chunk
  for (const chunk of chunks) {
    // 3a. Gerar embedding vetorial
    const embedding = await embedder.embed(chunk.text);
    
    // 3b. Calcular hashes para detecção de mudanças
    const textHash = blake3(normalizeContent(chunk.text));
    const chunkId = blake3(`${filePath}${chunk.startLine}${chunk.endLine}${textHash}`);
    
    // 3c. Armazenar APENAS metadados + vetor
    await lanceDB.insert('chunks', {
      id: chunkId,
      path: filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      textHash: textHash,
      fileHash: await hashFile(filePath),
      vector: embedding,
      indexedAt: new Date().toISOString(),
      model: 'all-MiniLM-L6-v2',
      dim: 384
      // ❌ NÃO: content: chunk.text
    });
  }
}
```

### 2. Busca (runtime, sob demanda)

```typescript
async function search(query: string, options: SearchOptions) {
  // 1. Gerar vetor da query
  const queryVector = await embedder.embed(query);
  
  // 2. Buscar chunks similares (apenas metadados retornam)
  const results = await lanceDB.search('chunks', queryVector, {
    limit: options.limit || 20,
    filters: {
      lang: options.lang,
      path: options.path
    }
  });
  
  // 3. Ler conteúdo APENAS quando necessário para exibição
  const enrichedResults = await Promise.all(
    results.map(async (result) => {
      // Ler arquivo original apenas agora
      const fileContent = await fs.readFile(result.path, 'utf8');
      const snippet = extractLines(fileContent, result.startLine, result.endLine);
      
      return {
        ...result,
        snippet: snippet,        // Extraído na hora
        preview: snippet.slice(0, 200)  // Preview curto
      };
    })
  );
  
  return enrichedResults;
}
```

### 3. Visualização do Grafo (limitada e inteligente)

```typescript
async function getVisualizableGraph(query: string) {
  // 1. Buscar apenas top 10 chunks mais relevantes
  const topChunks = await search(query, { limit: 10 });
  
  // 2. Construir nodes leves (sem conteúdo)
  const nodes: Node[] = topChunks.map(chunk => ({
    id: `chunk:${chunk.id}`,
    type: 'Chunk',
    label: extractSymbolName(chunk.path, chunk.startLine),  // Nome curto
    path: chunk.path,
    // ❌ NÃO: content: chunk.snippet
  }));
  
  // 3. Expandir 1-hop com limite de 50 nodes
  const expanded = await expandGraph(nodes, {
    maxDepth: 1,
    maxNodes: 50,
    minWeight: 0.5  // Apenas arestas fortes
  });
  
  // 4. Filtrar para visualização
  return {
    nodes: expanded.nodes.slice(0, 100),  // Máx 100 nodes visíveis
    edges: expanded.edges.filter(e => e.weight > 0.5)
  };
}
```

## 📊 Comparação de Tamanhos

### Projeto Típico: 1000 arquivos, 50k linhas

| Componente | Com Conteúdo | Sem Conteúdo (Correto) |
|------------|--------------|------------------------|
| **Texto dos chunks** | 4 MB | 0 MB (lido sob demanda) |
| **Metadados** | 10 MB | 10 MB |
| **Embeddings** | 76 MB | 76 MB |
| **Grafo (nodes)** | 15 MB | 2 MB (apenas IDs) |
| **Grafo (edges)** | 8 MB | 8 MB |
| **TOTAL** | ~113 MB | ~96 MB |

### Visualização do Grafo

| Aspecto | Com Conteúdo | Sem Conteúdo (Correto) |
|---------|--------------|------------------------|
| **Nodes por query** | 1000+ (inviável) | 10-50 (gerenciável) |
| **Labels nos nodes** | Texto completo | Nomes de símbolos |
| **Performance** | Lento (carrega tudo) | Rápido (lazy loading) |
| **Usabilidade** | Impossível visualizar | Grafo limpo e navegável |

## 🎯 Regras de Ouro

### ✅ Sempre Fazer:

1. **Armazenar apenas metadados + vetores** no LanceDB
2. **Ler conteúdo sob demanda** dos arquivos originais
3. **Limitar visualização** a 50-100 nodes por vez
4. **Usar labels curtos** nos nodes (nome do símbolo, não código)
5. **Expandir grafo incrementalmente** (1-hop por vez)
6. **Filtrar arestas fracas** (weight < 0.5)

### ❌ Nunca Fazer:

1. **Armazenar texto completo** nos chunks
2. **Incluir snippets grandes** nos nodes do grafo
3. **Visualizar todos os nodes** de uma vez
4. **Duplicar conteúdo** entre database e arquivos
5. **Carregar grafo completo** sem limites
6. **Usar código como label** de nodes

## 🔧 Implementação no SPEC.md

### Schema Correto do Chunk:

```typescript
interface Chunk {
  // Identidade
  id: string;              // hash(path + startLine + endLine + textHash)
  
  // Localização (ponteiros)
  path: string;            // Caminho relativo do arquivo
  startLine: number;       // 1-based - início do chunk
  endLine: number;         // 1-based - fim do chunk
  startChar?: number;      // Opcional - caractere inicial
  endChar?: number;        // Opcional - caractere final
  
  // Hashes (validação e detecção de mudanças)
  textHash: string;        // BLAKE3 do texto normalizado
  fileHash: string;        // BLAKE3 do arquivo completo
  
  // Metadados leves
  lang: string;            // Linguagem do código
  keywords?: string[];     // Palavras-chave extraídas (curtas)
  symbolId?: string;       // ID do símbolo (ex: "FileManager.readFile")
  
  // Embedding vetorial
  vector: number[];        // 384 números (all-MiniLM-L6-v2)
  model: string;           // "all-MiniLM-L6-v2"
  dim: number;             // 384
  
  // Timestamps
  indexedAt: string;       // ISO datetime
  
  // ❌ CAMPOS PROIBIDOS:
  // content?: string;     // NÃO armazenar texto completo!
  // text?: string;        // NÃO armazenar texto completo!
  // snippet?: string;     // NÃO armazenar previews grandes!
}
```

### Schema Correto do Node:

```typescript
interface Node {
  // Identidade
  id: string;              // "doc:hash", "sym:fqn", "kw:word"
  type: "Document" | "Section" | "Keyword" | "Symbol";
  
  // Label CURTO para visualização
  label: string;           // Nome legível CURTO (max 50 chars)
  
  // Ponteiro para localização
  path?: string;           // Caminho do arquivo
  
  // Metadados leves
  lang?: string;           // Linguagem
  score?: number;          // Relevância
  tags?: string[];         // Tags curtas
  
  // Timestamp
  updatedAt: string;       // ISO datetime
  
  // ❌ CAMPOS PROIBIDOS:
  // content?: string;     // NÃO armazenar código!
  // code?: string;        // NÃO armazenar código!
  // text?: string;        // NÃO armazenar texto grande!
}
```

## 🎨 Exemplo de Visualização Correta

```typescript
// ✅ CERTO: Grafo com labels curtos
const node = {
  id: "sym:FileManager.readFile",
  type: "Symbol",
  label: "readFile",        // Nome curto, não código
  path: "src/utils.ts"      // Ponteiro
};

// ❌ ERRADO: Node com código completo
const nodeBad = {
  id: "sym:FileManager.readFile",
  type: "Symbol",
  label: `async readFile(path: string): Promise<string> {
    const content = await fs.readFile(path);
    return content.toString();
  }`,  // ← Impossível visualizar no grafo!
  path: "src/utils.ts"
};
```

## 📈 Crescimento Esperado

Para projetos de diferentes tamanhos:

| Tamanho | Linhas | Chunks | Nodes | Edges | Database |
|---------|--------|--------|-------|-------|----------|
| **Pequeno** | 5k | 1k | 500 | 2k | ~15 MB |
| **Médio** | 50k | 10k | 5k | 20k | ~100 MB |
| **Grande** | 500k | 100k | 50k | 200k | ~1 GB |

**Nota:** Valores sem armazenar conteúdo. Com conteúdo seria 5-10x maior!

## 🚀 Próximos Passos

1. ✅ **Validar SPEC.md** - Garantir que schemas não têm campos de conteúdo
2. ✅ **Atualizar documentação** - Esclarecer que conteúdo é lido sob demanda
3. ✅ **Implementar lazy loading** - Ler arquivos apenas quando necessário
4. ✅ **Limitar visualização** - MAX_NODES = 100 por query
5. ✅ **Otimizar labels** - Extrair nomes de símbolos curtos
6. ✅ **Configurar LOD** - Level of Detail para grafos grandes

---

**Conclusão:** O database do LightRAG deve ser uma **camada de índice vetorial + grafo de relações**, não um repositório de código. O código original permanece nos arquivos, e é lido sob demanda apenas quando necessário para exibição ao usuário.
