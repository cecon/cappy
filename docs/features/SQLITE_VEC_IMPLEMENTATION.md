# SQLite Vector Search Implementation

## Visão Geral

Migração de `sql.js` para `sqlite3` nativo com suporte a busca vetorial usando `sqlite-vec`.

## Mudanças Realizadas

### 1. Dependências

- ✅ **Instalado**: `sqlite-vec` (extensão nativa para busca vetorial)
- ❌ **Removido**: `sql.js` (versão WebAssembly)
- ✅ **Mantido**: `sqlite3` (binding nativo Node.js)

### 2. Arquitetura de Vector Search

#### Antes (sql.js)
- Banco em memória/WASM
- Sem suporte a busca vetorial
- `searchSimilar()` retornava últimos chunks (sem cálculo de similaridade)

#### Depois (sqlite3 + sqlite-vec)
- Banco nativo em disco
- Busca vetorial real via extensão `sqlite-vec`
- Cálculo de distância cosine/euclidiana
- Fallback automático se extensão falhar

### 3. Estrutura de Dados

#### Tabela `vectors` (persistência)
```sql
CREATE TABLE vectors (
  chunk_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  content TEXT NOT NULL,
  embedding_json TEXT NOT NULL,  -- Array serializado em JSON
  embedding_model TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

#### Tabela Virtual `vec_vectors` (busca otimizada)
```sql
CREATE VIRTUAL TABLE vec_vectors USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding float[1536]  -- Dimensão configurável
)
```

### 4. Fluxo de Operação

#### Inicialização
1. Abrir banco SQLite3
2. Carregar extensão sqlite-vec via `loadExtension()`
3. Criar tabelas: `vectors` (regular) + `vec_vectors` (virtual)
4. Flag `vecExtensionLoaded` indica se extensão está ativa

#### Inserção de Embeddings
```typescript
await storeEmbeddings([{
  id: 'chunk-123',
  content: 'código ou texto',
  embedding: [0.1, 0.2, ...], // 1536 dimensões
  metadata: { filePath, lineStart, lineEnd }
}]);
```

- Insere em `vectors` (formato JSON para persistência)
- Insere em `vec_vectors` (formato binário otimizado)
- Fallback: se vec falhar, mantém em `vectors`

#### Busca Vetorial
```typescript
const results = await searchSimilar(queryEmbedding, limit);
```

**Com sqlite-vec (busca vetorial real):**
```sql
SELECT chunk_id, distance
FROM vec_vectors
WHERE embedding MATCH ?  -- vetor da query
ORDER BY distance
LIMIT ?
```

**Sem sqlite-vec (fallback):**
```sql
SELECT chunk_id, content, metadata
FROM vectors
LIMIT ?  -- retorna últimos chunks
```

### 5. Modelo de Embeddings

- **Modelo padrão**: `text-embedding-3-small` (OpenAI)
- **Dimensões**: 1536
- **Configurável** via `EmbeddingsConfig` no config

### 6. Benefícios

✅ **Performance**: Busca vetorial nativa (C/C++)
✅ **Escalabilidade**: Banco em disco (não limitado à memória)
✅ **Compatibilidade**: Funciona em VS Code Extension Host
✅ **Fallback robusto**: Continua funcionando se extensão falhar
✅ **Precisão**: Cálculo real de similaridade vetorial

### 7. Limitações e Trade-offs

⚠️ **Dimensões fixas**: Tabela `vec_vectors` precisa conhecer dimensão na criação
⚠️ **Rebuild necessário**: Mudar modelo de embedding requer recriar tabela virtual
⚠️ **Plataforma específica**: Extensão .so/.dll precisa estar disponível para o OS

### 8. Próximos Passos

- [ ] Métricas de performance da busca vetorial
- [ ] Suporte a múltiplos modelos de embedding
- [ ] Compressão de vetores (PQ, scalar quantization)
- [ ] Índices HNSW para datasets grandes (>100k chunks)

## Referências

- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [SQLite Virtual Tables](https://www.sqlite.org/vtab.html)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
