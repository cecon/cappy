# File Metadata Module - Hexagonal Architecture

## 📐 Arquitetura

O módulo de metadados de arquivos foi refatorado seguindo a **Arquitetura Hexagonal** (Ports & Adapters), separando as responsabilidades em camadas distintas:

```
src/nivel2/infrastructure/services/file-metadata/
├── domain/           # Entidades e tipos de negócio
│   └── FileMetadata.ts
├── ports/            # Interfaces (contratos)
│   └── IFileMetadataRepository.ts
├── adapters/         # Implementações concretas
│   └── SQLiteFileMetadataRepository.ts
├── application/      # Casos de uso (serviços)
│   └── FileMetadataService.ts
└── index.ts          # Exports públicos e factory
```

## 🎯 Camadas

### **1. Domain (Domínio)**
Define as entidades e tipos de negócio, independentes de implementação:

- `FileMetadata`: Interface da entidade de metadados do arquivo
- `FileProcessingStatus`: Enum de status de processamento
- `DatabaseStats`: Interface de estatísticas do banco

### **2. Ports (Portas)**
Interfaces que definem contratos entre camadas:

- `IFileMetadataRepository`: Contrato do repositório de metadados

### **3. Adapters (Adaptadores)**
Implementações concretas das portas:

- `SQLiteFileMetadataRepository`: Implementação usando SQLite3

### **4. Application (Aplicação)**
Casos de uso e lógica de negócio:

- `FileMetadataService`: Orquestra operações de metadados com regras de negócio

## 🚀 Como Usar

### **Nova API (Recomendada)**

```typescript
import { createFileMetadataService } from './file-metadata';

// Criar serviço usando factory
const service = createFileMetadataService('/path/to/db.sqlite');
await service.initialize();

// Adicionar arquivo
await service.addFile({
  id: 'file-123',
  filePath: 'src/index.ts',
  fileName: 'index.ts',
  fileSize: 1024,
  fileHash: 'abc123',
  status: 'pending',
  progress: 0,
  retryCount: 0,
  maxRetries: 3
});

// Atualizar status
await service.updateFileStatus('file-123', 'processing');

// Buscar arquivos
const allFiles = await service.getAllFiles();
const pendingFiles = await service.getPendingFiles(10);

// Fechar conexão
await service.close();
```

### **API Direta com Repository**

```typescript
import { SQLiteFileMetadataRepository } from './file-metadata/adapters/SQLiteFileMetadataRepository';

const repo = new SQLiteFileMetadataRepository('/path/to/db.sqlite');
await repo.initialize();

await repo.insertFile({...});
const files = await repo.getAllFiles();
await repo.close();
```

### **API Antiga (Compatibilidade)**

```typescript
import { FileMetadataDatabase } from './file-metadata-database';

// DEPRECADO mas ainda funciona
const db = new FileMetadataDatabase('/path/to/db.sqlite');
await db.initialize();

// Métodos síncronos (bloqueantes - não recomendado)
db.insertFile({...});
const files = db.getAllFileMetadata();

// Métodos assíncronos (recomendado)
await db.insertFileAsync({...});
const files = await db.getAllFilesAsync();

db.close();
```

## ✨ Vantagens da Nova Arquitetura

### **1. Separação de Responsabilidades**
Cada camada tem uma responsabilidade única e bem definida:
- Domain: Entidades de negócio
- Ports: Contratos
- Adapters: Implementação técnica
- Application: Lógica de negócio

### **2. Testabilidade**
Fácil criar mocks das portas para testes:

```typescript
class MockFileMetadataRepository implements IFileMetadataRepository {
  // Mock implementation
}

const service = new FileMetadataService(new MockFileMetadataRepository());
```

### **3. Substituição de Adaptadores**
Fácil trocar SQLite por outro banco sem alterar a lógica de negócio:

```typescript
// Implementar novo adapter
class PostgresFileMetadataRepository implements IFileMetadataRepository {
  // Postgres implementation
}

// Usar sem mudar nada no código
const service = new FileMetadataService(new PostgresFileMetadataRepository());
```

### **4. Métodos Assíncronos**
Todos os métodos do repository são assíncronos (Promise-based), evitando bloqueios:

```typescript
// Antes (síncrono, bloqueante)
const files = db.getAllFileMetadata(); // ❌ Bloqueia

// Agora (assíncrono)
const files = await repo.getAllFiles(); // ✅ Não bloqueia
```

### **5. Regras de Negócio Centralizadas**
O `FileMetadataService` encapsula lógica de negócio:

```typescript
// Atualiza status E define timestamps automaticamente
await service.updateFileStatus('file-123', 'processing');
// → Seta processingStartedAt automaticamente

await service.updateFileStatus('file-123', 'processed');
// → Seta processingCompletedAt e progress=100 automaticamente

// Marca erro E incrementa retry count
await service.markFileAsError('file-123', 'Parse error');
// → Incrementa retryCount, verifica maxRetries, etc.
```

## 📦 Exports

O módulo exporta:

```typescript
// Types (Domain)
export type { FileMetadata, FileProcessingStatus, DatabaseStats };

// Ports
export type { IFileMetadataRepository };

// Adapters
export { SQLiteFileMetadataRepository };

// Application
export { FileMetadataService };

// Factory
export { createFileMetadataService };
```

## 🔄 Migração

### **Passo 1: Atualizar Imports**

```typescript
// Antes
import { FileMetadataDatabase } from './file-metadata-database';

// Depois
import { createFileMetadataService } from './file-metadata';
```

### **Passo 2: Trocar Instanciação**

```typescript
// Antes
const db = new FileMetadataDatabase(dbPath);
await db.initialize();

// Depois
const service = createFileMetadataService(dbPath);
await service.initialize();
```

### **Passo 3: Usar Métodos Assíncronos**

```typescript
// Antes
db.insertFile(metadata);
const files = db.getAllFileMetadata();

// Depois
await service.addFile(metadata);
const files = await service.getAllFiles();
```

## 🧪 Testes

Exemplo de teste com mock:

```typescript
import { describe, it, expect } from 'vitest';
import { FileMetadataService } from './application/FileMetadataService';
import type { IFileMetadataRepository } from './ports/IFileMetadataRepository';

class MockRepository implements IFileMetadataRepository {
  private files: Map<string, FileMetadata> = new Map();
  
  async insertFile(metadata: Omit<FileMetadata, 'createdAt' | 'updatedAt'>) {
    this.files.set(metadata.id, {
      ...metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  async getAllFiles() {
    return Array.from(this.files.values());
  }
  
  // ... outros métodos
}

describe('FileMetadataService', () => {
  it('should add file and set timestamps', async () => {
    const service = new FileMetadataService(new MockRepository());
    await service.addFile({...});
    const files = await service.getAllFiles();
    expect(files).toHaveLength(1);
  });
});
```

## 📚 Referências

- [Hexagonal Architecture (Ports & Adapters)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
