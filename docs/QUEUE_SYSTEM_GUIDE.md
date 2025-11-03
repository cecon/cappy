# Sistema de Filas - Guia de Uso

## 🎯 Visão Geral

O Cappy agora usa uma **arquitetura moderna baseada em filas com máquina de estados** para processar arquivos. Todo o processamento acontece em background de forma incremental e pode ser pausado/retomado a qualquer momento.

## 🏗️ Arquitetura

```
📁 Descoberta de Arquivos
├─► WorkspaceScanner (scan workspace)
├─► Upload (via web UI)  
└─► FileChangeWatcher (auto-detect)
        │
        ▼
    ┌─────────────────┐
    │ metadata table  │ status: pending
    │   (SQLite)      │
    └────────┬────────┘
             │
             ▼
    FileProcessingQueue (background loop)
             │
             ├─► pending → processing
             ├─► extracting_entities (parse + extract)
             ├─► creating_relationships (graph)
             ├─► entity_discovery (LLM)
             └─► processed ✅
```

## 📊 Estados do Processamento

| Estado | Descrição |
|--------|-----------|
| `pending` | Aguardando processamento |
| `processing` | Iniciando processamento |
| `extracting_entities` | Extraindo entidades do arquivo (parse, AST) |
| `creating_relationships` | Criando relacionamentos no grafo |
| `entity_discovery` | Descoberta de entidades via LLM (apenas código) |
| `processed` | Processamento completo ✅ |
| `error` | Erro (com retry automático) |
| `paused` | Pausado manualmente |

## 🎮 Comandos Disponíveis

### Controle da Fila

```
⏸️  Cappy: Pause Processing Queue
    Para todo o processamento
    
▶️  Cappy: Resume Processing Queue
    Retoma o processamento
    
📊 Cappy: Show Queue Status
    Mostra estatísticas detalhadas
```

### Outros Comandos

```
🚀 Cappy: Scan Workspace
    Descobre arquivos e adiciona à fila
    
🗑️  Cappy: Reset Graph Database
    Limpa toda a base de dados
```

## 🔄 Fluxos de Uso

### 1. Upload de Arquivo

```typescript
// Frontend envia POST /enqueue
{
  "fileName": "document.pdf",
  "content": "base64_encoded_content"
}

// Sistema adiciona à metadata table com status: pending
// FileProcessingQueue pega e processa automaticamente
```

### 2. Workspace Scan

```typescript
// Comando: cappy.scanWorkspace
// 1. Descobre todos os arquivos
// 2. Adiciona novos arquivos à metadata table
// 3. Marca arquivos modificados (hash diferente) como pending
// 4. FileProcessingQueue processa em background
```

### 3. Mudança de Arquivo

```typescript
// FileChangeWatcher detecta mudança
// 1. Calcula novo hash
// 2. Se hash diferente, marca como pending
// 3. FileProcessingQueue reprocessa
```

## 📈 Monitoramento

### Verificar Status

```bash
# Via VS Code Command Palette
Ctrl+Shift+P → "Cappy: Show Queue Status"
```

Exemplo de output:
```
📊 Queue Status:
   Running: ✅
   Paused: ▶️
   Active: 2

📁 Files:
   Total: 150
   Pending: 12
   Processing: 2
   Extracting Entities: 1
   Creating Relationships: 1
   Entity Discovery: 0
   Processed: 120
   Error: 2
   Paused: 0
```

### Via API (HTTP)

```bash
# Status de um arquivo específico
GET http://localhost:3456/status?fileId=file-123

# Listar todos os arquivos
GET http://localhost:3456/list
```

## ⚙️ Configuração

### FileProcessingQueue

```typescript
{
  concurrency: 2,        // Max 2 arquivos em paralelo
  maxRetries: 3,         // Tenta até 3x antes de marcar erro
  autoStart: true        // Inicia automaticamente
}
```

### FileChangeWatcher

```typescript
{
  workspaceRoot: string,
  autoAddNewFiles: true,      // Auto-adiciona arquivos criados
  reprocessModified: true,     // Auto-reprocessa modificados
  removeDeleted: true          // Remove arquivos deletados
}
```

## 🎨 Características

### ✅ Persistência Automática
- Estado salvo no SQLite (`file-metadata.db`)
- Sobrevive a fechamento do VS Code
- Retoma de onde parou

### ✅ Background Processing
- Não bloqueia VS Code
- Processa continuamente
- Baixo uso de recursos

### ✅ Retry Inteligente
- Até 3 tentativas automáticas
- Backoff de 5 segundos
- Marca erro permanente após esgotar retries

### ✅ Monitoramento em Tempo Real
- Eventos para UI: `file:start`, `file:progress`, `file:complete`, `file:error`
- Atualização do grafo em tempo real
- Status detalhado por arquivo

### ✅ File Watching
- Detecta criação, modificação, deleção
- Comparação de hash (reprocessa apenas se mudou de verdade)
- Respeita `.gitignore` e `.cappyignore`

## 🔧 Troubleshooting

### Fila não está processando

```bash
# Verifique se está pausada
Ctrl+Shift+P → "Cappy: Show Queue Status"

# Se pausada, retome
Ctrl+Shift+P → "Cappy: Resume Processing Queue"
```

### Arquivo não foi processado

```bash
# Verifique o status do arquivo
GET http://localhost:3456/status?fileId=file-123

# Status possíveis:
# - pending: aguardando
# - processing: em andamento
# - error: falhou (veja errorMessage)
# - paused: fila está pausada
```

### Reset Completo

```bash
# Se algo der muito errado
Ctrl+Shift+P → "Cappy: Reset Graph Database"

# Depois faça novo scan
Ctrl+Shift+P → "Cappy: Scan Workspace"
```

## 📝 Logs

```typescript
// Logs do FileProcessingQueue
✅ FileProcessingQueue initialized and started

// Logs de processamento
📝 File enqueued: document.pdf (file-xxx)
🔄 File changed, marked for reprocessing: src/main.ts
➕ New file added to queue: src/new-file.ts
➖ Deleted file removed from queue: old-file.ts

// Logs de estado
⏸️  Processing queue paused
▶️  Processing queue resumed
🛑 File processing queue stopped
```

## 🚀 Próximos Passos

1. **UI de Queue Management** - Dashboard visual com spinners
2. **Priorização** - Processar arquivos importantes primeiro
3. **Estatísticas** - Tempo médio, taxa de sucesso, etc.
4. **Notificações** - Alertas quando processamento completa

## 📚 Arquitetura Completa

Ver documento detalhado: `docs/architecture/QUEUE_BASED_PROCESSING_ARCHITECTURE.md`
