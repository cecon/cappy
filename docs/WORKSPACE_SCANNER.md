# Workspace Scanner

## Visão Geral

O **Workspace Scanner** é um sistema completo de indexação de arquivos que analisa todo o workspace do projeto, extrai metadados, realiza parsing AST, cria chunks de documentação e estabelece relacionamentos entre entidades de código.

## Características

### ✅ Implementado

1. **Descoberta de Arquivos**
   - Respeita `.gitignore` e `.cappyignore`
   - Exclusão automática de `node_modules`, `.git`, `dist`, `build`, `.cappy`
   - Detecção automática de linguagem por extensão

2. **Hash-based Change Detection**
   - Usa SHA256 (fallback para BLAKE3)
   - Processa apenas arquivos novos ou modificados
   - Cleanup automático de arquivos deletados

3. **Fila de Processamento**
   - Controle de concorrência (padrão: 3 workers)
   - Processamento em lotes (padrão: 10 arquivos)
   - Tratamento de erros por arquivo

4. **Extração de Metadados**
   - Contagem de linhas de código (LOC)
   - Detecção de shebang
   - Tamanho e encoding
   - Timestamps (mtime)

5. **Parsing AST**
   - TypeScript/JavaScript via `@typescript-eslint/parser`
   - Extração de JSDoc/TSDoc
   - Identificação de símbolos (functions, classes, interfaces, types, variables)
   - Extração de imports/exports
   - Detecção de chamadas de função
   - Referências de tipos

6. **Indexação Dual**
   - **LanceDB**: Armazena chunks com embeddings e conteúdo completo
   - **Kuzu**: Armazena estrutura de grafo e relacionamentos

7. **Relacionamentos**
   - `CONTAINS`: File → Chunks
   - `DOCUMENTS`: JSDoc → Code
   - Suporte para relacionamentos customizados

8. **Arquivos de Configuração**
   - Indexação especial para `package.json`, `tsconfig.json`, etc.
   - Armazenados sem chunking

### 🚧 Próximos Passos (Fase 2)

1. **Cross-File Relationships**
   - Relacionamento entre imports e exports
   - Rastreamento de chamadas cross-file
   - Mapeamento de herança de classes
   - Detecção de referências de tipos entre arquivos

2. **Persistência de File Index**
   - Salvar índice de arquivos no Kuzu
   - Recuperação rápida do estado
   - Sincronização incremental

3. **File Watchers**
   - Monitoramento em tempo real de mudanças
   - Reindexação automática
   - Integração com VS Code FileSystemWatcher

4. **Suporte a Mais Linguagens**
   - Python parser
   - Java parser
   - Go parser
   - Rust parser

5. **Análise de Dependências**
   - Grafo de dependências do package.json
   - Análise de imports npm
   - Detecção de versões conflitantes

## Arquitetura

```
WorkspaceScanner (orquestrador)
├── WorkspaceScanQueue (fila de processamento)
├── FileHashService (hashing)
├── IgnorePatternMatcher (filtros)
├── FileMetadataExtractor (metadados)
├── ASTRelationshipExtractor (relacionamentos)
├── ParserService (parsing)
│   ├── TypeScriptParser
│   └── MarkdownParser
└── IndexingService (indexação)
    ├── LanceDBAdapter (vetores)
    └── KuzuAdapter (grafo)
```

## Uso

### Comando VS Code

```
Ctrl+Shift+P → Cappy: Scan Workspace
```

### Programático

```typescript
import { WorkspaceScanner } from './services/workspace-scanner';

const scanner = new WorkspaceScanner({
  workspaceRoot: '/path/to/workspace',
  repoId: 'my-repo',
  parserService,
  indexingService,
  graphStore,
  batchSize: 10,
  concurrency: 3
});

scanner.onProgress((progress) => {
  console.log(`${progress.processedFiles}/${progress.totalFiles}`);
});

await scanner.initialize();
await scanner.scanWorkspace();
```

## Estrutura de Dados

### FileIndexEntry

```typescript
interface FileIndexEntry {
  repoId: string;
  fileId: string;
  relPath: string;
  isAvailable: boolean;
  isDeleted: boolean;
  sizeBytes: number;
  mtimeEpochMs: number;
  hashAlgo: 'blake3' | 'sha256' | 'md5';
  contentHash: string;
  hashStatus: 'OK' | 'MISMATCH' | 'UNKNOWN';
  hashVerifiedAtEpochMs?: number;
  language?: string;
  lastIndexedAtEpochMs: number;
  pendingGraph: boolean;
}
```

### DocumentChunk

```typescript
interface DocumentChunk {
  id: string;
  content: string;
  vector?: number[];
  metadata: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
    chunkType: 'jsdoc' | 'code' | 'markdown_section' | 'plain_text';
    symbolName?: string;
    symbolKind?: 'function' | 'class' | 'interface' | 'type' | 'variable';
  };
}
```

### GraphRelationship

```typescript
interface GraphRelationship {
  from: string;
  to: string;
  type: 'CONTAINS' | 'DOCUMENTS' | 'REFERENCES' | 'DEFINES' | 'RELATES_TO';
  properties?: Record<string, string | number | boolean>;
}
```

## Esquema do Grafo (Kuzu)

### Nodes

1. **File**
   - `path: STRING (PRIMARY KEY)`
   - `language: STRING`
   - `linesOfCode: INT64`

2. **Chunk**
   - `id: STRING (PRIMARY KEY)`
   - `filePath: STRING`
   - `lineStart: INT64`
   - `lineEnd: INT64`
   - `chunkType: STRING`
   - `symbolName: STRING`
   - `symbolKind: STRING`

3. **Workspace**
   - `name: STRING (PRIMARY KEY)`

### Relationships

1. **CONTAINS**: `File → Chunk`
   - `order: INT64`

2. **DOCUMENTS**: `Chunk → Chunk` (JSDoc → Code)

3. **BELONGS_TO**: `File → Workspace`

## Ignore Patterns

### .cappyignore (padrão)

```
node_modules/
.git/
dist/
build/
.cappy/
*.log
.DS_Store
coverage/
```

### Custom .cappyignore

Crie um arquivo `.cappyignore` na raiz do workspace com padrões customizados (usa sintaxe .gitignore).

## Performance

- **Velocidade**: ~100-200 arquivos/minuto (depende do tamanho)
- **Concorrência**: Configurável (padrão: 3 workers)
- **Batch Size**: Configurável (padrão: 10 arquivos)
- **Memória**: Chunks são processados em streaming

## Observabilidade

### Logs

Todos os logs são emitidos no console e podem ser visualizados no Output Channel do VS Code:

```
View → Output → Cappy
```

### Progress Reporting

```typescript
scanner.onProgress((progress: ScanProgress) => {
  console.log(`Status: ${progress.status}`);
  console.log(`Files: ${progress.processedFiles}/${progress.totalFiles}`);
  console.log(`Current: ${progress.currentFile}`);
  console.log(`Errors: ${progress.errors.length}`);
});
```

## Troubleshooting

### "No workspace folder open"

Certifique-se de ter uma pasta aberta no VS Code.

### "Failed to initialize graph database"

Verifique se o diretório `.cappy/data` tem permissões de escrita.

### "Parser error"

Alguns arquivos podem ter sintaxe inválida. O scanner continua e reporta os erros no final.

### Arquivos não sendo indexados

Verifique se não estão listados em `.gitignore` ou `.cappyignore`.

## Exemplo de Output

```
🔍 Initializing workspace scanner...
📋 Loaded .gitignore patterns
📋 Using default .cappyignore patterns
✅ Workspace scanner initialized

🚀 Starting workspace scan...
📁 Found 342 files to process
📝 125 files need processing

📄 Processing: src/extension.ts
🔍 Parsing TypeScript/JavaScript: src/extension.ts
📝 TypeScript: Parsed 8 JSDoc chunks from src/extension.ts
📑 Indexing src/extension.ts with 8 chunks...
🤖 Generating embeddings for 8 chunks...

...

✅ Workspace scan completed in 45.32s
   Processed: 125/342 files
   Errors: 0
```

## Integração com VS Code

O scan é automaticamente registrado como comando do VS Code e pode ser invocado via:

1. **Command Palette**: `Ctrl+Shift+P` → "Cappy: Scan Workspace"
2. **Programático**: `vscode.commands.executeCommand('cappy.scanWorkspace')`

## Próximas Melhorias

1. ☐ Scan incremental (file watchers)
2. ☐ Persistência de índice
3. ☐ Cross-file relationships
4. ☐ Suporte a mais linguagens
5. ☐ UI de progresso detalhada
6. ☐ Configuração por workspace
7. ☐ Estatísticas e métricas
8. ☐ Export/import de índices
