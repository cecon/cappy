# Reindex Command - Integração com LanceDB

## 📋 Resumo

O comando `cappy.reindex` foi completamente reformulado para usar **LanceDB como storage principal** e gerar backup em JSON.

## 🔄 Mudanças Principais

### Antes (v2.9.15 e anteriores)
- ❌ Salvava apenas em arquivos JSON (`.cappy/mini-lightrag/chunks.json`, `nodes.json`, `edges.json`)
- ❌ Não limpava dados antigos ao reindexar
- ❌ Sem suporte para embeddings ou busca semântica
- ❌ Sem integração com o sistema de grafos

### Depois (v2.9.16+)
- ✅ **Limpa completamente** o diretório LanceDB antes de reindexar
- ✅ Salva em **LanceDB** (chunks, nodes, edges em tabelas separadas)
- ✅ Mantém **backup JSON** para fallback/debug
- ✅ Integra com o **sistema de grafos Mini-LightRAG**
- ✅ Suporte para embeddings (vector: Array<number>)
- ✅ Usa `writeMode: 'overwrite'` para garantir reset completo

---

## 🗑️ Limpeza de Bancos Antigos

```typescript
private async cleanAndSetupStorage(): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    // 📂 Banco de dados LOCAL ao workspace
    const cappyPath = path.join(workspaceFolder.uri.fsPath, '.cappy');
    const dataPath = path.join(cappyPath, 'data');
    const miniLightRagPath = path.join(dataPath, 'mini-lightrag');
    
    // 🗑️ APAGAR TUDO se já existir
    if (fs.existsSync(miniLightRagPath)) {
        await fs.promises.rm(miniLightRagPath, { recursive: true, force: true });
    }

    // Criar estrutura limpa
    await fs.promises.mkdir(miniLightRagPath, { recursive: true });
    await fs.promises.mkdir(path.join(miniLightRagPath, 'backup'));
    
    console.log(`✅ Estrutura criada em: ${miniLightRagPath}`);
    return miniLightRagPath;
}
```

**Mudança crítica:** Agora usa `.cappy/data/` no workspace, não `globalStorage`!

### Estrutura de Diretórios

**IMPORTANTE:** Banco de dados é **LOCAL ao workspace** (não global!)

```
workspace-root/
└── .cappy/
    └── data/
        └── mini-lightrag/
            ├── chunks.lance/        # LanceDB (principal)
            ├── nodes.lance/         # LanceDB (principal)
            ├── edges.lance/         # LanceDB (principal)
            └── backup/              # JSON (fallback)
                ├── chunks.json
                ├── nodes.json
                ├── edges.json
                └── metadata.json
```

**Por que local ao workspace?**
- ✅ Cada projeto tem seu próprio contexto/grafo
- ✅ Não mistura dados de projetos diferentes
- ✅ Permite versionamento seletivo (`.gitignore` em `.cappy/data/`)
- ✅ Modelos LLM podem ser globais, mas dados não!

---

## 💾 Salvamento no LanceDB

```typescript
private async saveToLanceDB(chunks: Chunk[], nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    // Converter chunks para o schema
    const schemaChunks = chunks.map(chunk => ({
        id: chunk.id,
        path: chunk.source,
        language: chunk.metadata.lang || 'unknown',
        type: this.mapChunkType(chunk.metadata.type),
        textHash: chunk.hash,
        text: chunk.content,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        keywords: chunk.metadata.tags || [],
        metadata: {
            heading: chunk.metadata.heading,
            tokens: chunk.tokens,
            complexity: 0
        },
        vector: new Array(384).fill(0), // TODO: Gerar embeddings reais
        updatedAt: new Date().toISOString(),
        version: 1
    }));

    await this.lancedb.upsertChunks(schemaChunks);
    await this.lancedb.upsertNodes(schemaNodes);
    await this.lancedb.upsertEdges(schemaEdges);
}
```

---

## 🔧 Mapeamento de Tipos

### Chunk Type Mapping
```typescript
private mapChunkType(type: string): ChunkType {
    const mapping: Record<string, ChunkType> = {
        'code': 'code-function',
        'markdown': 'markdown-section',
        'documentation': 'documentation'
    };
    return mapping[type] || 'documentation';
}
```

### Schema Types
- `code-function`, `code-class`, `code-interface`
- `markdown-section`, `markdown-paragraph`
- `documentation`, `comment`, `import`, `export`

---

## 📊 Fluxo de Execução

```
1. cleanAndSetupStorage()
   └─> Remove .cappy/mini-lightrag/ completamente
   └─> Recria estrutura vazia

2. Inicializa LanceDB
   └─> new LanceDBStore({ writeMode: 'overwrite' })
   └─> await lancedb.initialize()

3. findDocuments()
   └─> Busca *.md, *.txt, *.ts, *.js

4. chunkFile() (para cada arquivo)
   └─> Divide em chunks de ~500 tokens
   └─> Extrai metadados (lang, tags, headings)

5. buildGraph()
   └─> Cria nodes (Document, Section, Keyword)
   └─> Cria edges (CONTAINS, MENTIONS, SIMILAR_TO)

6. saveToLanceDB()
   └─> upsertChunks(schemaChunks)
   └─> upsertNodes(schemaNodes)
   └─> upsertEdges(schemaEdges)

7. saveData() [backup JSON]
   └─> Salva em .cappy/mini-lightrag/backup/
```

---

## 🎯 Benefícios da Integração

### 1. **Busca Semântica**
```typescript
// Buscar chunks similares (quando embeddings reais forem gerados)
const results = await lancedb.searchChunks("como fazer deploy", 10);
```

### 2. **Navegação no Grafo**
```typescript
// Expandir nós relacionados
const edges = await lancedb.queryEdges({ source: "node_doc_1" });
const relatedNodes = await lancedb.queryNodesByIds(edges.map(e => e.target));
```

### 3. **Filtragem Avançada**
```typescript
// Buscar apenas código TypeScript
const tsChunks = await lancedb.queryChunks({ 
    language: 'typescript',
    type: 'code-function'
});
```

### 4. **Análise de Relacionamentos**
```typescript
// Encontrar keywords mais mencionadas
const keywordEdges = await lancedb.queryEdges({ type: 'MENTIONS' });
```

---

## 🚀 Próximos Passos

### TODO: Embeddings Reais
Atualmente os vetores são preenchidos com zeros:
```typescript
vector: new Array(384).fill(0) // TODO: Gerar embeddings reais
```

**Próxima implementação:**
- Usar modelo de embeddings (transformers.js ou API externa)
- Gerar vetores de 384 dimensões para cada chunk
- Permitir busca semântica real

### TODO: Indexação Incremental
- Detectar arquivos modificados (usar Git status ou file watchers)
- Atualizar apenas chunks/nodes/edges afetados
- Evitar reindexação completa a cada mudança

### TODO: UI de Progresso Detalhado
- Mostrar arquivos sendo processados em tempo real
- Exibir estatísticas durante o processo
- Indicador de performance (chunks/s, nodes/s)

---

## 🔗 Arquivos Relacionados

- `src/commands/reindexCommand.ts` - Comando principal
- `src/store/lancedb.ts` - Interface LanceDB
- `src/graph/node-expander.ts` - Expansão de grafos
- `src/models/schema.ts` - Definições de tipos
- `docs/mini-lightrag-integration.md` - Arquitetura geral

---

## 📝 Uso

```typescript
// Via VS Code Command Palette
> CAPPY: Reindex Workspace

// Via API
await vscode.commands.executeCommand('cappy.reindex');
```

**Resultado esperado:**
```
✅ Mini-LightRAG: Reindexação completa!
📊 45 arquivos, 892 chunks, 178 nós, 523 arestas
🗄️  Dados salvos em LanceDB e JSON
🌐 Use 'miniRAG.openGraph' para visualizar!
```

---

## ⚠️ Notas Importantes

1. **Limpeza Completa**: O comando DELETA todos os bancos antigos antes de reindexar
2. **Backup JSON**: Mantido para fallback e debug
3. **Embeddings Pendentes**: Vetores zerados até implementação de modelo real
4. **Performance**: Pode demorar alguns segundos em workspaces grandes (>100 arquivos)

---

**Versão:** 2.9.16  
**Data:** 2025-01-XX  
**Status:** ✅ Implementado e funcionando
