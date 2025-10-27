ocumentacao# 🔧 Correções Implementadas - SCAN Pipeline

## 📋 Resumo das Mudanças

### 1. ✅ Correção do Hash Service (BLAKE3)

**Arquivo**: `src/nivel2/infrastructure/services/file-hash-service.ts`

#### Antes:
- ❌ Usava `crypto.createHash('sha256')` 
- ❌ Comentário dizia BLAKE3 mas implementação era SHA256

#### Depois:
- ✅ Usa biblioteca `hash-wasm` com algoritmo BLAKE3
- ✅ Método `hashFile()` retorna hash BLAKE3 verdadeiro
- ✅ Método `hashString()` também usa BLAKE3 (async)
- ✅ Adicionado `hashStringSync()` para compatibilidade (usado em `generateFileId`)

**Instalação necessária**:
```bash
npm install hash-wasm --save
```

---

### 2. 🔄 Modificação do Pipeline SCAN (Fase 8)

**Arquivo**: `src/nivel2/infrastructure/services/workspace-scanner.ts`

#### ANTES - Processo Completo Imediato:
```typescript
// FASE 8: Processar todos os arquivos imediatamente
for (const file of sortedFiles.sourceFiles) {
  queue.enqueue(async () => {
    await this.processFile(file); // Parse + Embeddings + Graph
  });
}
await queue.drain(); // Aguarda conclusão
```

#### DEPOIS - Apenas Metadata + Pendente:
```typescript
// FASE 8: Salvar apenas metadata (marcar como pending)
for (const file of sortedFiles.sourceFiles) {
  await this.saveFileMetadata(file); // Apenas metadata + pendingGraph=true
}
// Processamento real será feito por cronjob
```

---

### 3. 📊 Novo Método: `saveFileMetadata()`

**Usado para gravar apenas metadata sem processar chunks/embeddings**

**O que faz**:
1. Extrai metadata básica (LOC, etc) via `FileMetadataExtractor`
2. **Salva registro na tabela SQLite `file_metadata`** (não no grafo!)
3. Marca arquivo com status `'pending'` e `currentStep='Queued for processing'`
4. Atualiza fileIndex em memória com `pendingGraph=true`
5. **NÃO** processa chunks/embeddings/relacionamentos

**Tabela SQLite**: `file_metadata`
```sql
CREATE TABLE file_metadata (
  id TEXT PRIMARY KEY,              -- file:{hash}
  file_path TEXT NOT NULL UNIQUE,   -- src/app.ts
  file_name TEXT NOT NULL,          -- app.ts
  file_size INTEGER NOT NULL,       -- bytes
  file_hash TEXT NOT NULL,          -- BLAKE3 hash
  file_content TEXT,                -- base64 (para uploads)
  status TEXT NOT NULL,             -- 'pending'
  progress INTEGER DEFAULT 0,       -- 0-100
  current_step TEXT,                -- 'Queued for processing'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  processing_started_at TEXT,
  processing_completed_at TEXT,
  chunks_count INTEGER,
  nodes_count INTEGER,
  relationships_count INTEGER
);
```

**Fluxo**:
```
Arquivo descoberto
    ↓
saveFileMetadata()
    ↓
INSERT/UPDATE na tabela file_metadata
    ├─ status = 'pending'
    ├─ progress = 0
    └─ current_step = 'Queued for processing'
    ↓
Aguarda cronjob processar
```

**Fallback**: Se `metadataDatabase` não for fornecido, usa comportamento legado (cria File node no grafo).

---

### 4. 🤖 Novo Método: `processPendingFiles()`

**Usado pelo cronjob para processar arquivos pendentes em background**

```typescript
async processPendingFiles(
  limit: number = 10,      // Máximo de arquivos por batch
  concurrency: number = 3  // Quantos em paralelo
): Promise<{ processed: number; errors: number }>
```

**Funcionalidades**:
- Busca arquivos com `pendingGraph=true`
- Processa em batches controlados
- Executa `processFile()` completo:
  - Parse AST
  - Extração de chunks
  - Geração de embeddings
  - Criação de nodes/relationships no grafo
- Atualiza `pendingGraph=false` após sucesso

---

### 5. 🆕 Novo Comando VS Code

**Arquivo**: `src/nivel1/adapters/vscode/commands/process-pending-files.ts`

**Comando**: `cappy.processPendingFiles`

**Uso**:
```typescript
// Processar até 10 arquivos, 3 em paralelo (padrão)
await vscode.commands.executeCommand('cappy.processPendingFiles');

// Customizado
await vscode.commands.executeCommand('cappy.processPendingFiles', {
  limit: 20,
  concurrency: 5,
  silent: true  // Não mostrar notificações
});
```

**Registrado em**: `src/extension.ts` (linha ~208)

---

## 🎯 Novo Fluxo Completo

### SCAN (Descoberta + Metadata)
```
1. Descobrir arquivos no workspace
2. Calcular hash BLAKE3 de cada arquivo
3. Filtrar novos/modificados (por hash)
4. Ordenar (source code → documentation)
5. SALVAR APENAS METADATA na tabela SQLite
   ├─ INSERT/UPDATE file_metadata table
   ├─ status = 'pending'
   ├─ progress = 0
   └─ pendingGraph = true (fileIndex)
6. Construir relacionamentos cross-file
7. FIM (rápido, ~segundos)
```

### CRONJOB (Processamento Real)
```
Executado periodicamente ou manualmente:

1. Buscar arquivos com pendingGraph=true
2. Processar batch (ex: 10 arquivos)
   ├─ Parse AST
   ├─ Extrair chunks
   ├─ Gerar embeddings
   ├─ Criar nodes/relationships
   └─ Marcar pendingGraph=false
3. Repetir até não haver mais pendentes
```

---

## 🔍 Como Testar

### 1. Teste o SCAN (rápido):
```typescript
await vscode.commands.executeCommand('cappy.scanWorkspace');
// Deve completar rapidamente (apenas metadata)
```

### 2. Verificar arquivos pendentes:
```typescript
const scanner = new WorkspaceScanner({...});
await scanner.initialize();
const pending = await scanner.getPendingFiles();
console.log(`Pendentes: ${pending.length}`);
```

### 3. Processar pendentes manualmente:
```typescript
await vscode.commands.executeCommand('cappy.processPendingFiles', {
  limit: 5,
  concurrency: 2
});
```

---

## 📊 Benefícios

### ANTES:
- ⏱️ SCAN travava por minutos/horas
- 🚫 Bloqueava UI do VS Code
- 😤 Experiência ruim para projetos grandes

### DEPOIS:
- ⚡ SCAN completa em segundos (apenas metadata)
- ✅ UI responsiva
- 🤖 Processamento real em background (cronjob)
- 📊 Controle de batch/concurrency
- 🔄 Pode parar/retomar processamento

---

## 🚀 Próximos Passos

### 1. Implementar Cronjob Automático
Criar timer que executa `processPendingFiles()` periodicamente:
```typescript
setInterval(async () => {
  await vscode.commands.executeCommand('cappy.processPendingFiles', {
    limit: 10,
    silent: true
  });
}, 30000); // A cada 30 segundos
```

### 2. UI de Progresso
Mostrar quantos arquivos estão pendentes no status bar:
```
Cappy: 47 files pending processing
```

### 3. Priorização
Processar arquivos mais importantes primeiro:
- Arquivos abertos recentemente
- Arquivos modificados hoje
- Arquivos de dependência crítica

---

## ⚠️ Notas Importantes

1. **Método `processFile()` ainda existe** - Marcado como DEPRECATED mas mantido para o cronjob usar
2. **Queue ainda existe** - Mas não é mais usada no SCAN, apenas no cronjob interno
3. **Cross-file relationships** - Ainda construídos durante SCAN (podem ser movidos para cronjob depois)
4. **BLAKE3 é async** - Use `hashStringSync()` quando precisar de hash síncrono simples

---

## 📝 Commits Sugeridos

```bash
git add src/nivel2/infrastructure/services/file-hash-service.ts
git commit -m "feat: implement BLAKE3 hashing using hash-wasm"

git add src/nivel2/infrastructure/services/workspace-scanner.ts
git commit -m "refactor: separate scan (metadata) from processing (chunks+embeddings)"

git add src/nivel1/adapters/vscode/commands/process-pending-files.ts
git commit -m "feat: add cronjob command to process pending files"

git add src/extension.ts
git commit -m "feat: register process-pending-files command"
```

---

Data: 26 de outubro de 2025
