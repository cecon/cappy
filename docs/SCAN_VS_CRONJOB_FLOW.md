# Scan vs CronJob Flow
## Como funciona o fluxo de processamento de arquivos no Cappy

**Data:** 30 de outubro de 2025

---

## 🔄 Arquitetura de Processamento em 2 Etapas

### Visão Geral

O Cappy usa uma **arquitetura em 2 etapas** para processar arquivos:

1. **Scan (Rápido)**: Descobre arquivos e salva metadados
2. **CronJob (Background)**: Processa arquivos e gera embeddings/vectors

Esta separação permite:
- ✅ Scan rápido sem bloquear a UI
- ✅ Processamento pesado em background
- ✅ Feedback progressivo ao usuário
- ✅ Resiliência a falhas (retry automático)

---

## 📊 Fluxo Detalhado

### Etapa 1: Workspace Scan (Fast Discovery)

**Comando:** `Cappy: Scan Workspace`  
**Arquivo:** `src/nivel1/adapters/vscode/commands/scan-workspace.ts`  
**Worker:** `WorkspaceScanner` → `FileMetadadoProcessor`

#### O que faz:

```
1. Descobrir arquivos no workspace
   └─> FileDiscovery.discoverFiles()

2. Calcular hash dos arquivos (BLAKE3)
   └─> Detectar mudanças desde último scan

3. Filtrar arquivos que precisam processamento
   └─> Apenas novos ou modificados

4. Salvar APENAS metadados no banco
   └─> file_metadata.db
   └─> Status: 'pending'
   └─> Hash, path, timestamp
   └─> SEM processar conteúdo ainda!

5. Marcar arquivos como 'pending' na fila
   └─> Prontos para processamento pelo CronJob
```

#### O que NÃO faz:
- ❌ NÃO gera embeddings
- ❌ NÃO cria vectors
- ❌ NÃO cria chunks no grafo
- ❌ NÃO processa AST
- ❌ NÃO analisa relacionamentos

**Resultado:** Lista de arquivos `pending` no banco de metadados

---

### Etapa 2: CronJob (Background Processing)

**Serviço:** `FileProcessingCronJob`  
**Arquivo:** `src/nivel2/infrastructure/services/file-processing-cronjob.ts`  
**Worker:** `FileProcessingWorker` → `IndexingService`

#### Quando inicia:
- ✅ Automaticamente ao abrir workspace (se `autoStart: true`)
- ✅ Intervalo configurável (default: 10 segundos)
- ✅ Processa um arquivo por vez (semaphore)

#### O que faz:

```
1. Buscar próximo arquivo 'pending' no banco
   └─> FileMetadataDatabase.getFilesByStatus('pending')

2. Atualizar status para 'processing'
   └─> Evita processamento duplicado

3. Processar arquivo (FileProcessingWorker)
   ├─> Carregar conteúdo
   ├─> Parsear e extrair chunks (ParserService)
   ├─> Indexar arquivo (IndexingService)
   │   ├─> Gerar embeddings (EmbeddingService)
   │   ├─> Criar file node no grafo
   │   ├─> Criar chunk nodes no grafo
   │   ├─> Descobrir entities (AST)
   │   ├─> Criar relacionamentos (CONTAINS, DOCUMENTS, etc)
   │   └─> 🎯 Inserir vectors (VectorStore.upsertChunks)
   │
   └─> Retornar métricas (chunks, nodes, relationships)

4. Atualizar status para 'processed'
   └─> Marcar como completo com métricas

5. Repetir para próximo arquivo 'pending'
```

#### O que faz (Detalhes de IndexingService):

**Arquivo:** `src/nivel2/infrastructure/services/indexing-service.ts`

```typescript
async indexFile(filePath: string, language: string, chunks: DocumentChunk[]) {
  // 1. Gerar embeddings para todos os chunks
  const embeddings = await embeddingService.embedBatch(chunks);
  
  // 2. Criar file node no grafo
  await graphStore.createFileNode(filePath, language, linesOfCode);
  
  // 3. Criar chunk nodes no grafo
  await graphStore.createChunkNodes(chunks);
  
  // 4. Descobrir e resolver entities (AST analysis)
  await discoverAndResolveEntities(language, chunks);
  
  // 5. Criar relacionamentos CONTAINS (File -> Chunks)
  await graphStore.createRelationships(containsRels);
  
  // 6. Criar relacionamentos DOCUMENTS (JSDoc -> Code)
  await graphStore.createRelationships(documentsRels);
  
  // 7. Criar relacionamentos entre arquivos (imports, etc)
  await buildFileRelationshipsIncremental(filePath, chunks);
  
  // 🎯 8. INSERIR VECTORS COM EMBEDDINGS
  await vectorStore.upsertChunks(chunks);
}
```

**Resultado:** 
- ✅ Chunks no grafo (tabela `nodes`)
- ✅ Vectors no banco (tabela `vectors`)
- ✅ Embeddings no vec_vectors (sqlite-vec)
- ✅ Relacionamentos criados (tabela `edges`)

---

## 🔍 Problema Identificado: 839 Chunks Sem Vectors

### Causa Raiz

**Hipótese:** Arquivos foram processados parcialmente ou o CronJob falhou

Possíveis causas:
1. **CronJob não estava rodando** quando scan foi feito
2. **Processo interrompido** antes de completar
3. **Erro no IndexingService** ao gerar embeddings
4. **VectorStore estava null** durante processamento
5. **Race condition** entre scan e cronjob

### Como Confirmar

```sql
-- Ver arquivos que estão 'pending' (não processados ainda)
SELECT COUNT(*) FROM file_metadata WHERE status = 'pending';

-- Ver arquivos com erro
SELECT filePath, errorMessage, retryCount 
FROM file_metadata 
WHERE status = 'error';

-- Ver arquivos processados mas sem vectors
SELECT n.id, n.label 
FROM nodes n
WHERE n.type = 'chunk'
  AND NOT EXISTS (SELECT 1 FROM vectors WHERE chunk_id = n.id)
LIMIT 10;
```

### Solução Correta

**NÃO** rodar "Cappy: Scan Workspace" novamente!  
O scan só marca arquivos como `pending`, não gera vectors.

**Opção 1: Deixar CronJob processar** (recomendado)
```
1. Verificar se CronJob está rodando
2. Aguardar processamento automático
3. Monitorar progresso no painel
```

**Opção 2: Forçar reprocessamento**
```sql
-- Marcar chunks sem vectors como 'pending' novamente
UPDATE file_metadata 
SET status = 'pending', 
    retryCount = 0,
    errorMessage = NULL
WHERE id IN (
  SELECT fm.id FROM file_metadata fm
  INNER JOIN nodes n ON n.id LIKE fm.filePath || '%'
  WHERE n.type = 'chunk'
    AND NOT EXISTS (SELECT 1 FROM vectors WHERE chunk_id = n.id)
);
```

**Opção 3: Reset e rescan completo** (último recurso)
```
1. "Cappy: Reset Graph Database"
2. "Cappy: Scan Workspace"
3. Aguardar CronJob processar tudo
```

---

## 📊 Monitoramento

### Como verificar se CronJob está rodando

```typescript
// No código da extensão
const cronJob = context.globalState.get('fileProcessingCronJob');
console.log('CronJob running:', cronJob?.isRunning());
```

### Como ver progresso

```sql
-- Ver arquivos por status
SELECT status, COUNT(*) 
FROM file_metadata 
GROUP BY status;

-- Ver arquivos sendo processados
SELECT filePath, currentStep, progress 
FROM file_metadata 
WHERE status = 'processing';

-- Ver últimos processados
SELECT filePath, processingCompletedAt, chunksCount, nodesCount
FROM file_metadata 
WHERE status = 'processed'
ORDER BY processingCompletedAt DESC
LIMIT 10;
```

---

## 🎯 Resumo para o Dev

### O que o Scan faz:
```
Scan = Descoberta rápida + Metadados + Fila de 'pending'
```

### O que o CronJob faz:
```
CronJob = Processar 'pending' → Parse → Embeddings → Vectors → Grafo
```

### Onde vectors são criados:
```
IndexingService.indexFile() 
  └─> vectorStore.upsertChunks(chunks) 
      └─> Insere na tabela 'vectors' com embeddings
```

### Por que 839 chunks não têm vectors:
```
Possível causa:
1. Scan criou chunks no grafo
2. CronJob não processou (parou, erro, não rodando)
3. Resultado: Chunks existem mas sem vectors
```

### Solução:
```
1. Verificar CronJob está rodando
2. Verificar logs de erro no file_metadata
3. Reprocessar arquivos 'pending' ou com erro
4. NÃO rodar scan novamente (não resolve)
```

---

## 🔧 Comandos Úteis

### Verificar estado atual
```bash
# Contar arquivos por status
sqlite3 .cappy/data/file-metadata.db \
  "SELECT status, COUNT(*) FROM file_metadata GROUP BY status;"

# Ver chunks sem vectors
sqlite3 .cappy/data/graph-store.db \
  "SELECT COUNT(*) FROM nodes n WHERE n.type = 'chunk' 
   AND NOT EXISTS (SELECT 1 FROM vectors WHERE chunk_id = n.id);"
```

### Forçar reprocessamento de arquivos específicos
```sql
UPDATE file_metadata 
SET status = 'pending' 
WHERE filePath IN ('src/path/to/file.ts');
```

### Ver logs do CronJob
```
# No VS Code Developer Tools Console
# Filtrar por [CronJob]
```

---

**Conclusão:** O scan é rápido porque **não processa** os arquivos, apenas os **descobre e marca como pending**. O processamento pesado (embeddings, vectors, AST, relacionamentos) acontece no **CronJob em background**.

Os 839 chunks sem vectors provavelmente foram criados durante um scan, mas o CronJob não os processou ainda ou falhou ao processar.
