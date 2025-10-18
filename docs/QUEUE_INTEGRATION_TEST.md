# 🧪 File Processing Integration Test

## Overview

Este é um teste end-to-end completo do sistema de processamento de arquivos do Cappy. Ele valida todo o fluxo desde o enfileiramento até a criação de nós, vetores e relacionamentos no grafo.

## O que o teste faz

### 1. **Setup do Workspace**
- Cria um diretório temporário para o teste
- Inicializa banco SQLite com sqlite-vec (vector + metadata + graph)
- Configura embedding service (Transformers.js)

### 2. **Arquivo de Teste**
Gera um arquivo TypeScript (`user-service.ts`) contendo:
- Interface `User` com TSDoc
- Classe `UserService` com TSDoc
- Métodos com documentação:
  - `createUser()` - Cria um novo usuário
  - `getUserById()` - Busca usuário por ID
  - `updateUser()` - Atualiza informações do usuário
  - `deleteUser()` - Remove usuário
  - `listUsers()` - Lista todos os usuários
  - `isValidEmail()` - Valida email
  - `generateId()` - Gera ID único
- Função factory `createUserService()`

### 3. **Processamento**
- Adiciona arquivo na fila de processamento
- Worker processa o arquivo:
  1. Valida que o arquivo existe
  2. Calcula hash do arquivo
  3. Faz parsing do AST (TypeScript)
  4. Gera chunks (JSDoc + Code)
  5. Gera embeddings para cada chunk
  6. Insere chunks no SQLite (com sqlite-vec para embeddings)
  7. Cria nós no grafo SQLite (File, Chunk)
  8. Cria relacionamentos (CONTAINS, DOCUMENTS)
- Sistema de transação com rollback automático em caso de erro

### 4. **Validações**

#### Metadados no SQLite
- ✅ Arquivo registrado com status `pending`
- ✅ Status muda para `processing` durante execução
- ✅ Status final `completed` com métricas
- ✅ Contadores: `chunksCount`, `nodesCount`, `relationshipsCount`

#### Nós no Grafo (SQLite)
- ✅ Nó de arquivo (`File`) criado na tabela `graph_nodes`
- ✅ Nós de chunks (`Chunk`) criados na tabela `graph_nodes`
- ✅ Relacionamentos `CONTAINS` (File → Chunk) na tabela `graph_edges`
- ✅ Relacionamentos `DOCUMENTS` (JSDoc → Code) na tabela `graph_edges`

#### Vetores no SQLite (sqlite-vec)
- ✅ Embeddings gerados e armazenados na tabela `document_chunks`
- ✅ Busca vetorial funcional via sqlite-vec
- ✅ Chunks recuperáveis por similaridade usando vec_search

#### Busca Híbrida
Testa 3 tipos de queries:

1. **"UserService class"**
   - Deve encontrar a definição da classe
   - Deve retornar chunks diretos e relacionados

2. **"create user function"**
   - Deve encontrar o método `createUser()`
   - Deve encontrar documentação relacionada

3. **"email validation"**
   - Deve encontrar o método `isValidEmail()`
   - Busca semântica por conceito

4. **"how to manage users in the application"**
   - Busca conceitual mais abrangente
   - Testa capacidade de RAG semântico

### 5. **Teste de Erro e Retry**
- Tenta processar arquivo inexistente
- Valida sistema de retry (até 3 tentativas)
- Verifica que arquivo é marcado como `failed`
- Verifica que `errorMessage` é salva
- Verifica que `retryCount` é incrementado

## Como Executar

### Método 1: Script Shell
```bash
./test-file-processing.sh
```

### Método 2: NPM/Vitest direto
```bash
npx vitest run src/services/__tests__/file-processing-integration.test.ts --reporter=verbose
```

### Método 3: Modo Watch
```bash
npx vitest watch src/services/__tests__/file-processing-integration.test.ts
```

## Requisitos

- Node.js 18+
- Memória RAM: ~512MB disponível
- Espaço em disco: ~100MB temporário
- Tempo de execução: 30-60 segundos

## Estrutura do Teste

```typescript
describe('File Processing Integration Test', () => {
  
  it('should process TypeScript file and create nodes, vectors, and relationships', async () => {
    // Teste principal (60s timeout)
    // ✅ Inicializa serviços
    // ✅ Enfileira arquivo
    // ✅ Aguarda processamento
    // ✅ Valida nós e vetores
    // ✅ Testa busca híbrida
  });

  it('should handle file processing failure and retry', async () => {
    // Teste de erro (30s timeout)
    // ✅ Tenta processar arquivo inválido
    // ✅ Valida tentativas de retry
    // ✅ Verifica status failed
  });
  
});
```

## Saída Esperada

```
📝 Test: Complete file processing workflow

⚙️  Step 1: Initializing services...
  ✓ SQLite database initialized (metadata + vector + graph)
  ✓ sqlite-vec extension loaded
  ✓ Embedding service initialized
  ✓ Indexing service initialized
  ✓ Parser and hash services initialized
  ✓ Worker initialized
  ✓ Queue initialized and started

⚙️  Step 2: Enqueuing test file...
  ✓ File enqueued with ID: file-1234567890-abc123
  ✓ File path: /tmp/cappy-test-xyz/user-service.ts
  ✓ File hash: a1b2c3d4e5f6...
  ✓ File metadata saved with status: pending

⚙️  Step 3: Waiting for file processing...
  🔄 Processing started: user-service.ts
  📊 Progress: 10% - Calculating hash...
  📊 Progress: 20% - Parsing file...
  📊 Progress: 40% - Generating embeddings...
  📊 Progress: 60% - Inserting chunks...
  📊 Progress: 80% - Creating relationships...
  ✅ Processing completed!
     - Chunks: 15
     - Nodes: 16
     - Relationships: 22
     - Duration: 5432ms
  ✓ Final status: completed

⚙️  Step 4: Verifying graph nodes...
  ✓ Graph nodes and edges verified in SQLite

⚙️  Step 5: Verifying vector embeddings...
  ✓ Found chunks for "UserService": 8 (via sqlite-vec)
     - Direct matches: 5
     - Related chunks: 3
     1. UserService (class)
     2. createUser (method)
     3. getUserById (method)
  ✓ Found chunks for "create user": 6
  ✓ Found chunks for "email validation": 4

⚙️  Step 6: Verifying specific code elements...
  ✓ Unique symbols found: 10
    Symbols: UserService, createUser, getUserById, updateUser, deleteUser, ...
  ✓ UserService class found
  ✓ createUser method found

⚙️  Step 7: Testing hybrid search quality...
  ✓ Semantic search results: 12
     - Direct matches: 7
     - Related chunks: 5

⚙️  Step 8: Verifying queue statistics...
  ✓ Queue statistics:
     - Total: 1
     - Completed: 1
     - Pending: 0
     - Processing: 0
     - Failed: 0

✨ All verifications passed!
```

## Arquitetura Testada

```
┌─────────────────────────────────────────────────────────┐
│                   INTEGRATION TEST                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────┐               │
│  │           SQLite Database            │               │
│  │  (Metadata + Vectors + Graph)        │               │
│  │         with sqlite-vec              │               │
│  └──────────────────────────────────────┘               │
│         │                        │                       │
│         ▼                        ▼                       │
│  ┌──────────────┐         ┌──────────────┐             │
│  │   Progress   │         │    Queue     │             │
│  │   Tracking   │         │   Manager    │             │
│  └──────────────┘         └──────────────┘             │
│                                  │                       │
│                                  ▼                       │
│                           ┌──────────────┐              │
│                           │    Worker    │              │
│                           │  (Isolated)  │              │
│                           └──────────────┘              │
│                             │     │     │               │
│                             ▼     ▼     ▼               │
│                      ┌─────────────────────┐           │
│                      │   Parser Service    │           │
│                      │   Hash Service      │           │
│                      │   Embedding Service │           │
│                      └─────────────────────┘           │
│                                  │                       │
│                                  ▼                       │
│                      ┌──────────────────────┐           │
│                      │   SQLite Storage     │           │
│                      │  • document_chunks   │           │
│                      │  • graph_nodes       │           │
│                      │  • graph_edges       │           │
│                      │  • file_metadata     │           │
│                      └──────────────────────┘           │
│                                  │                       │
│                                  ▼                       │
│                          ┌──────────────┐               │
│                          │    Hybrid    │               │
│                          │    Search    │               │
│                          │ (SQL + vec)  │               │
│                          └──────────────┘               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Teste falha no timeout
- Aumentar timeout: `it('...', async () => {...}, 120000)`
- Verificar se há processos travados
- Verificar uso de memória

### Embeddings falham
- Verificar modelo Transformers.js baixado
- Verificar conexão de internet (primeira execução)
- Aumentar heap size: `NODE_OPTIONS=--max-old-space-size=4096`

### SQLite não inicializa
- Verificar permissões de escrita em `/tmp`
- Verificar espaço em disco disponível
- Verificar se sqlite-vec foi carregado corretamente
- Verificar logs do SQLite

### Busca não retorna resultados
- Verificar se embeddings foram gerados e salvos na tabela `document_chunks`
- Verificar se sqlite-vec está funcionando: `SELECT vec_version()`
- Verificar se a indexação foi concluída

## Métricas de Sucesso

Para o arquivo de teste gerado:
- **Chunks esperados**: 10-20 chunks
- **Nós esperados**: 11-21 nós (1 File + N Chunks)
- **Relacionamentos esperados**: 15-30 (CONTAINS + DOCUMENTS)
- **Tempo de processamento**: < 10 segundos
- **Busca híbrida**: > 80% precisão

## Contribuindo

Ao adicionar novos recursos ao sistema de fila, atualize este teste para incluir:
1. Validações dos novos campos no metadata
2. Verificações dos novos tipos de nós/relacionamentos
3. Testes de novos casos de erro
4. Exemplos de uso dos novos recursos

## Licença

Mesmo licenciamento do projeto Cappy.
