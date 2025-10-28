# File Processing CronJob

## 📋 Visão Geral

O **FileProcessingCronJob** é um sistema automatizado para processar arquivos pendentes da fila de processamento. Ele executa em background, processando arquivos de forma sequencial (um de cada vez) a cada intervalo configurado.

## 🎯 Características

- **Processamento Automático**: Executa automaticamente a cada 10 segundos (configurável)
- **Semáforo de Proteção**: Previne processamento concorrente de arquivos
- **Dois Pipelines Distintos**: Um para documentação e outro para código
- **Tratamento de Erros**: Marca arquivos com erro e permite retry
- **Status Granular**: Atualiza progresso e etapa atual durante o processamento

## 🔄 Fluxo de Processamento

```
Cronjob (10s interval)
    ↓
Verifica se já está processando (Semáforo)
    ↓
Busca próximo arquivo "pending"
    ↓
Determina tipo (documentação ou código)
    ↓
┌─────────────────────┬────────────────────────┐
│   Documentação      │       Código           │
├─────────────────────┼────────────────────────┤
│ 1. Extract chunks   │ 1. Extract AST         │
│    com overlap      │    entities            │
│ 2. Extract entities │ 2. Create entity       │
│    de cada chunk    │    nodes               │
│ 3. Create entity    │ 3. Extract             │
│    nodes            │    relationships       │
│ 4. Create           │ 4. Analyze cross-file  │
│    relationships    │    relationships       │
│ 5. Index chunks     │ 5. Index file          │
└─────────────────────┴────────────────────────┘
    ↓
Marca como "processed" ou "error"
    ↓
Libera semáforo
```

## 📝 Pipeline de Documentação

Para arquivos `.md`, `.mdx`, `.pdf`, `.doc`, `.docx`, `.txt`, `.rst`:

1. **Extract Chunks com Overlap**
   - Divide documento em chunks de ~512 tokens
   - Overlap de ~100 tokens para preservar contexto

2. **Extract Entities**
   - Usa LLM (GitHub Copilot) para identificar entidades em cada chunk
   - Identifica: classes, funções, APIs, frameworks, conceitos, etc.

3. **Create Entity Nodes**
   - Cria relacionamentos `file -> CONTAINS_ENTITY -> entity`
   - Deduplicação automática de entidades

4. **Create Relationships**
   - Relaciona chunks com entidades extraídas
   - Tipo: `chunk -> CONTAINS_ENTITY -> entity`

5. **Index Chunks**
   - Salva chunks no IndexingService para busca semântica

## 💻 Pipeline de Código

Para arquivos `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.java`, etc.:

1. **Extract AST Entities**
   - Parser específico por linguagem
   - Extrai: funções, classes, variáveis, imports, exports

2. **Create Entity Nodes**
   - Cria relacionamentos `file -> CONTAINS -> entity`
   - Preserva metadados: linha, exportado, categoria

3. **Extract Relationships**
   - `CALLS`: chamadas de função
   - `REFERENCES`: referências a variáveis/tipos
   - `IMPORTS`: importações de módulos
   - `EXPORTS`: exportações

4. **Analyze Cross-File Relationships**
   - Detecta imports entre arquivos
   - Resolve caminhos relativos
   - Cria relacionamentos `file -> IMPORTS -> file`

5. **Index File**
   - Indexa conteúdo para busca semântica

## ⚙️ Configuração

```typescript
const cronjob = new FileProcessingCronJob(
  database,      // FileMetadataDatabase
  graphStore,    // GraphStorePort
  {
    intervalMs: 10000,  // 10 segundos
    autoStart: true,    // Inicia automaticamente
    workspaceRoot: '/path/to/workspace'
  },
  indexingService // Opcional
);
```

## 📊 Status de Processamento

Durante o processamento, o arquivo passa pelos seguintes status:

- `pending` → Aguardando processamento
- `processing` → Em processamento
- `processed` → Processado com sucesso
- `error` → Erro durante processamento

O progresso é atualizado de 0% a 100% durante cada etapa.

## 🔐 Semáforo de Proteção

O cronjob implementa um semáforo simples para evitar processamento concorrente:

```typescript
private isProcessing: boolean = false;

private async processNextFile(): Promise<void> {
  if (this.isProcessing) {
    console.log('⏳ Already processing, skipping...');
    return;
  }

  try {
    this.isProcessing = true;
    // ... processar arquivo
  } finally {
    this.isProcessing = false;
  }
}
```

## 🎛️ Controle Manual

### Iniciar Cronjob
```typescript
cronjob.start();
```

### Parar Cronjob
```typescript
cronjob.stop();
```

### Verificar Status
```typescript
const isRunning = cronjob.isRunning();
```

## 🔄 Integração com Extension

O cronjob é inicializado automaticamente quando a extensão é ativada:

```typescript
// extension.ts
fileCronJob = new FileProcessingCronJob(
  fileDatabase,
  graphStoreInstance,
  {
    intervalMs: 10000,
    autoStart: true,
    workspaceRoot
  },
  indexingService
);
```

E é parado automaticamente quando a extensão é desativada:

```typescript
context.subscriptions.push({
  dispose: async () => {
    if (fileCronJob) {
      fileCronJob.stop();
    }
  }
});
```

## 📈 Métricas

Após processar cada arquivo, as seguintes métricas são salvas:

- `chunksCount`: Número de chunks criados
- `nodesCount`: Número de entidades extraídas
- `relationshipsCount`: Número de relacionamentos criados

## 🛠️ Detecção de Tipo de Arquivo

### Documentação
- `.md`, `.mdx`, `.pdf`, `.doc`, `.docx`, `.txt`, `.rst`

### Código
- `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
- `.py`, `.java`, `.c`, `.cpp`, `.h`, `.hpp`
- `.cs`, `.go`, `.rs`, `.rb`, `.php`, `.swift`
- `.kt`, `.scala`, `.r`, `.m`, `.mm`

## 🔍 Cross-File Relationships

O cronjob detecta automaticamente imports entre arquivos:

**TypeScript/JavaScript:**
```typescript
import { foo } from './utils'
import './styles.css'
const bar = require('./bar')
```

**Python:**
```python
from utils import foo
import bar
```

Cria relacionamentos: `source_file -> IMPORTS -> target_file`

## 📁 Estrutura de Arquivos

```
src/nivel2/infrastructure/services/
  └── file-processing-cronjob.ts    # Implementação principal
```

## 🧪 Testes

TODO: Adicionar testes unitários para o cronjob

## 🚀 Próximos Passos

- [ ] Adicionar suporte para mais linguagens
- [ ] Implementar cache de resultados
- [ ] Adicionar métricas de performance
- [ ] Criar UI para visualizar status do cronjob
- [ ] Implementar priorização de arquivos
- [ ] Adicionar rate limiting para LLM calls

## 📖 Referências

- [File Metadata Database](./file-metadata-database.ts)
- [Document Parser](../parsers/document-parser.ts)
- [AST Entity Extractor](./entity-extraction/core/ASTEntityExtractor.ts)
- [AST Relationship Extractor](./ast-relationship-extractor.ts)
- [Graph Store Port](../../../domains/graph/ports/indexing-port.ts)
