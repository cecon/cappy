# Sistema de Fila de Processamento Inteligente

## 📋 Visão Geral

O **CAPPY LightRAG** agora implementa um sistema completo de processamento em background com análise inteligente por **GitHub Copilot**. Em vez de processar documentos imediatamente no upload, o sistema usa uma fila assíncrona que permite análise chunk por chunk com IA.

## 🎯 Principais Funcionalidades

### 1. **Fila de Processamento** (`DocumentProcessingQueue`)
- Gerencia documentos em estados: `pending`, `processing`, `completed`, `failed`
- Persiste progresso e estatísticas
- Suporta retry de documentos falhados
- Thread-safe para processamento único por vez

### 2. **Processador em Background** (`BackgroundProcessor`)
- Verifica automaticamente disponibilidade do GitHub Copilot
- Processa fila a cada 5 segundos
- Análise chunk por chunk com IA semântica
- Extrai entidades e relacionamentos automaticamente

### 3. **Análise Inteligente com Copilot**
Para cada chunk do documento, o Copilot extrai:
- **Entidades**: conceitos, pessoas, lugares, tecnologias
- **Relacionamentos**: como as entidades se relacionam
- **Sumário**: resumo semântico do chunk

## 🏗️ Arquitetura

```
┌─────────────────┐
│  User Upload    │
│   Document      │
└────────┬────────┘
         │
         ├─► Valida Copilot Access
         │
         ├─► Adiciona na Fila (pending)
         │
         ├─► Armazena no LanceDB
         │
         └─► Notifica Usuário
                  │
                  ▼
         ┌─────────────────┐
         │ BackgroundProc  │◄──┐
         │   (Loop 5s)     │   │
         └────────┬────────┘   │
                  │             │
                  ├─► Pega próximo pending
                  │
                  ├─► Status: processing
                  │
                  ├─► Chunk Document
                  │
                  ├─► Para cada chunk:
                  │    ├─► Copilot Analyze
                  │    ├─► Extract Entities
                  │    ├─► Extract Relations
                  │    └─► Store em LanceDB
                  │
                  ├─► Status: completed/failed
                  │
                  └──────────────────────┘
```

## 🚀 Como Usar

### Upload de Documento

```typescript
// O handler verifica Copilot automaticamente
const processor = getBackgroundProcessor();
const copilotAvailable = await processor.checkCopilotAvailability();

if (!copilotAvailable) {
    // Exibe mensagem pedindo login no Copilot
    return;
}

// Adiciona à fila
const queue = getProcessingQueue();
const queueId = await queue.enqueue({
    documentId: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    content: doc.content
});

// Inicia processador (se não estiver rodando)
processor.start();
```

### Monitoramento de Progresso

```typescript
const queue = getProcessingQueue();

// Status da fila
const status = queue.getQueueStatus();
console.log(`Pending: ${status.pending}, Processing: ${status.processing}`);

// Progresso de documento específico
const doc = queue.getById(queueId);
console.log(`Progress: ${doc.progress}%`);
console.log(`Step: ${doc.currentStep}`);
console.log(`Entities: ${doc.extractedEntities}`);
```

### Retry de Falhas

```typescript
// Retry manual
await queue.retry(queueId);

// Limpar completados
await queue.clearCompleted();
```

## 📊 Estados do Documento

| Estado | Descrição | Ações Disponíveis |
|--------|-----------|-------------------|
| **pending** | Na fila aguardando processamento | Cancel, View |
| **processing** | Sendo analisado pelo Copilot | View Progress |
| **completed** | Processamento finalizado com sucesso | View Results, Delete |
| **failed** | Erro durante processamento | Retry, View Error, Delete |

## 🎨 Interface do Usuário

### Indicadores Visuais
- ⏳ **Pending**: Documento na fila
- ⚙️ **Processing**: Barra de progresso + chunk atual
- ✅ **Completed**: Badge verde com estatísticas
- ❌ **Failed**: Badge vermelho com mensagem de erro

### Estatísticas em Tempo Real
```
📊 Processing Queue
├─ Total: 5 documents
├─ Pending: 2
├─ Processing: 1
├─ Completed: 2
└─ Failed: 0
```

## 🔒 Verificação de Permissões Copilot

### Pré-Requisito
O sistema exige **GitHub Copilot ativo** para funcionar:

```typescript
const models = await vscode.lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4o'
});

if (models.length === 0) {
    // Copilot não disponível
    showCopilotRequiredMessage();
}
```

### Mensagem para Usuário
Se Copilot não estiver disponível:
```
⚠️ GitHub Copilot Required

Document processing requires GitHub Copilot for 
intelligent analysis. Please sign in to GitHub Copilot 
to enable this feature.

[Open Settings] [Learn More]
```

## 📈 Análise de Chunk

### Exemplo de Prompt para Copilot

```
Analyze this text chunk from document "README.md" and extract:

1. **Entities**: Important concepts, people, places, technologies, or things mentioned.
2. **Relationships**: How entities relate to each other.
3. **Summary**: Brief summary of the chunk content.

Text chunk:
"""
CAPPY is a VS Code extension that provides intelligent
task management and context orchestration using LightRAG...
"""

Respond in JSON format:
{
    "entities": [
        {
            "name": "CAPPY",
            "type": "technology",
            "description": "VS Code extension for task management"
        },
        {
            "name": "LightRAG",
            "type": "technology",
            "description": "Knowledge graph system"
        }
    ],
    "relationships": [
        {
            "source": "CAPPY",
            "target": "LightRAG",
            "type": "uses",
            "description": "CAPPY uses LightRAG for knowledge graph"
        }
    ],
    "summary": "CAPPY is a VS Code extension that uses LightRAG..."
}
```

### Resposta Esperada

```json
{
  "entities": [
    {
      "name": "CAPPY",
      "type": "technology",
      "description": "VS Code extension for intelligent task management"
    },
    {
      "name": "VS Code",
      "type": "technology",
      "description": "Code editor platform"
    },
    {
      "name": "LightRAG",
      "type": "technology",
      "description": "Knowledge graph and RAG system"
    }
  ],
  "relationships": [
    {
      "source": "CAPPY",
      "target": "VS Code",
      "type": "extends",
      "description": "CAPPY is an extension for VS Code"
    },
    {
      "source": "CAPPY",
      "target": "LightRAG",
      "type": "uses",
      "description": "CAPPY uses LightRAG for context orchestration"
    }
  ],
  "summary": "CAPPY extends VS Code with intelligent task management powered by LightRAG knowledge graphs."
}
```

## 🔧 Configuração

### Iniciar Processador no Startup

```typescript
// src/extension.ts
import { getBackgroundProcessor } from './services/backgroundProcessor';

export async function activate(context: vscode.ExtensionContext) {
    // ... other activations
    
    // Start background processor
    const processor = getBackgroundProcessor();
    await processor.checkCopilotAvailability();
    processor.start();
    
    // Stop on deactivation
    context.subscriptions.push({
        dispose: () => processor.stop()
    });
}
```

## 📝 Exemplo Completo

### Upload e Processamento

```typescript
// 1. Upload documento
const data: DocumentUploadData = {
    title: 'Project Documentation',
    fileName: 'README.md',
    content: '... document content ...',
    fileSize: 5000,
    category: 'documentation'
};

await handleDocumentUpload(data, panel);

// 2. Monitor progresso
const queue = getProcessingQueue();
const queuedDoc = queue.getById(queueId);

console.log(`📊 ${queuedDoc.currentStep}`);
console.log(`📈 Progress: ${queuedDoc.progress}%`);
console.log(`📦 Chunks: ${queuedDoc.processedChunks}/${queuedDoc.totalChunks}`);
console.log(`🏷️  Entities: ${queuedDoc.extractedEntities}`);
console.log(`🔗 Relationships: ${queuedDoc.extractedRelationships}`);

// 3. Quando completo
if (queuedDoc.status === ProcessingStatus.completed) {
    vscode.window.showInformationMessage(
        `✅ "${queuedDoc.title}" processed successfully!
         ${queuedDoc.extractedEntities} entities, 
         ${queuedDoc.extractedRelationships} relationships extracted.`
    );
}
```

## 🎯 Benefícios

### Antes (Processamento Síncrono)
- ❌ Upload travava a interface
- ❌ Análise simples por frequência de palavras
- ❌ Sem contexto semântico
- ❌ Sem retry em falhas
- ❌ Resultados genéricos

### Depois (Fila + Copilot)
- ✅ Upload instantâneo + processamento assíncrono
- ✅ Análise semântica profunda com IA
- ✅ Contexto rico e inteligente
- ✅ Retry automático + gerenciamento de erros
- ✅ Grafos de conhecimento precisos

## 🚦 Status e Notificações

O sistema notifica automaticamente o usuário:

- **Upload**: "✨ Document added to processing queue"
- **Processing**: Progress bar na UI
- **Completed**: "✅ Document processed successfully! 15 entities, 8 relationships"
- **Failed**: "❌ Failed to process document: [error]"

## 📚 Referências

- [LightRAG Paper](https://arxiv.org/abs/2410.05779) - Base teórica
- [GitHub Copilot API](https://code.visualstudio.com/api/extension-guides/language-model) - Integração
- [LanceDB](https://lancedb.com/) - Armazenamento vetorial

---

**Autor**: CAPPY Team  
**Versão**: 2.9.42+  
**Data**: 2025-01-04
