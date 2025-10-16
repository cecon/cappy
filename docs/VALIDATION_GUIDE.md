# 🧪 Guia de Validação - Workspace Scanner

## Como Validar que Tudo Está Funcionando

Este guia ajuda você a validar que todos os TODOs foram implementados corretamente e que o sistema está 100% funcional.

---

## ✅ Checklist de Validação

### 1. Compilação e Build

```bash
# No diretório do projeto
npm run compile
```

**Esperado:**
- ✅ Nenhum erro de compilação
- ✅ Todos os arquivos TypeScript compilam

**Status:** Se houver erros, verifique os imports e tipos.

---

### 2. Inicialização da Extensão

```bash
# Abra o VS Code
code .

# Pressione F5 para debug
# OU
# Abra Command Palette: Ctrl+Shift+P
# Digite: "Developer: Run Extension"
```

**Esperado:**
```
🦫 Cappy extension is now active!
✅ Registered Language Model Tool: cappy_create_file
✅ Registered Language Model Tool: cappy_fetch_web
✅ Registered Chat View Provider: cappy.chatView
✅ Registered command: cappy.scanWorkspace
```

**Status:** Verifique no Output Channel "Extension Host"

---

### 3. Teste: Scan Inicial (Workspace Vazio)

**Objetivo:** Validar que o scan funciona em um workspace sem índice prévio.

**Passos:**
1. Abra um projeto TypeScript/JavaScript
2. Delete a pasta `.cappy` se existir
3. Execute: `Ctrl+Shift+P` → "Cappy: Scan Workspace"

**Esperado:**
```
🔍 Initializing workspace scanner...
📋 Loaded .gitignore patterns
📋 Using default .cappyignore patterns
📚 Loading file index from Kuzu...
✅ Loaded 0 files from index
✅ Workspace scanner initialized

🚀 Starting workspace scan...
📁 Found 342 files to process
📝 342 files need processing

📄 Processing: src/extension.ts
🔍 Parsing TypeScript/JavaScript: src/extension.ts
📝 TypeScript: Parsed 8 JSDoc chunks from src/extension.ts
📑 Indexing src/extension.ts with 8 chunks...
🤖 Generating embeddings for 8 chunks...
📊 Found 5 imports, 3 exports, 12 calls, 8 type refs
  📥 Imports: vscode, ./GraphPanel
  📤 Exports: activate, deactivate
  🔗 Created 15 intra-file relationships

... (continua para todos os arquivos)

✅ Workspace scan completed in 45.32s
   Processed: 342/342 files
   Errors: 0
```

**Validação:**
- ✅ Todos os arquivos foram processados
- ✅ Relacionamentos foram criados
- ✅ Nenhum erro crítico

---

### 4. Teste: Scan Incremental (Com Mudanças)

**Objetivo:** Validar que apenas arquivos modificados são reprocessados.

**Passos:**
1. Modifique um único arquivo (ex: adicione um comentário)
2. Salve o arquivo
3. Execute novamente: "Cappy: Scan Workspace"

**Esperado:**
```
📚 Loading file index from Kuzu...
✅ Loaded 342 files from index

📁 Found 342 files to process
📝 1 files need processing  <-- Apenas 1 arquivo!

📄 Processing: src/extension.ts
...

✅ Workspace scan completed in 2.5s  <-- Muito mais rápido!
   Processed: 1/342 files
   Errors: 0
```

**Validação:**
- ✅ Índice foi carregado do Kuzu
- ✅ Apenas arquivo modificado foi processado
- ✅ Scan muito mais rápido (2s vs 45s)

---

### 5. Teste: Cleanup de Arquivos Deletados

**Objetivo:** Validar que arquivos deletados são removidos do banco.

**Passos:**
1. Crie um arquivo temporário: `test-delete.ts`
2. Execute scan (arquivo será indexado)
3. Delete o arquivo `test-delete.ts`
4. Execute scan novamente

**Esperado:**
```
📁 Found 342 files to process
🗑️  Cleaning up 1 deleted files...
🗑️  Deleting: test-delete.ts
✅ Deleted test-delete.ts from graph store

📝 0 files need processing
✅ Workspace scan completed in 1.2s
```

**Validação:**
- ✅ Arquivo deletado foi detectado
- ✅ Arquivo removido do Kuzu
- ✅ Chunks associados removidos

---

### 6. Teste: Relacionamentos Intra-Arquivo

**Objetivo:** Validar que relacionamentos REFERENCES são criados.

**Passos:**
1. Crie arquivo `test-relations.ts`:
```typescript
/**
 * Helper function
 */
function helperFunction(): string {
  return "test";
}

/**
 * Main function that uses helper
 */
function mainFunction(): void {
  const result = helperFunction();  // <-- Chamada de função
  console.log(result);
}
```

2. Execute scan

**Esperado:**
```
📄 Processing: test-relations.ts
📊 Found 0 imports, 0 exports, 1 calls, 0 type refs
  🔗 Created 1 intra-file relationships  <-- Relacionamento criado!
```

3. Abra o grafo: `Ctrl+Shift+P` → "Cappy: Open Graph"

**Esperado no Grafo:**
```
File: test-relations.ts
  └─ Chunk: helperFunction [1-4]
  └─ Chunk: mainFunction [6-10]
       └─ REFERENCES → helperFunction (type: function_call)
```

**Validação:**
- ✅ Relacionamento REFERENCES criado
- ✅ Propriedade `referenceType: function_call`
- ✅ Visível no grafo

---

### 7. Teste: Imports e Exports

**Objetivo:** Validar que imports/exports são detectados (preparação para Fase 2).

**Passos:**
1. Verifique logs de um arquivo com imports

**Esperado:**
```
📊 Found 5 imports, 3 exports, 12 calls, 8 type refs
  📥 Imports: vscode, ./GraphPanel, ./ChatViewProvider
  📤 Exports: activate, deactivate, openGraph
```

**Validação:**
- ✅ Imports detectados corretamente
- ✅ Exports detectados corretamente
- ✅ Logs informativos

---

### 8. Teste: Arquivos de Configuração

**Objetivo:** Validar que config files são indexados sem chunking.

**Passos:**
1. Verifique log para `package.json` ou `tsconfig.json`

**Esperado:**
```
📄 Processing: package.json
⚙️  Indexing config file: package.json
```

**Validação:**
- ✅ Detectado como config file
- ✅ Sem chunking
- ✅ Apenas metadata

---

### 9. Teste: Error Handling

**Objetivo:** Validar que erros não quebram o scan completo.

**Passos:**
1. Crie arquivo com sintaxe inválida: `broken.ts`
```typescript
function test( {  // Sintaxe inválida
  console.log("broken");
}
```

2. Execute scan

**Esperado:**
```
❌ Error processing broken.ts: Unexpected token
...
✅ Workspace scan completed in 15.2s
   Processed: 341/342 files
   Errors: 1  <-- Erro registrado mas scan continuou
```

**Validação:**
- ✅ Erro capturado e logado
- ✅ Scan continua para outros arquivos
- ✅ Erro incluído no relatório final

---

### 10. Teste: Visualização do Grafo

**Objetivo:** Validar que o grafo está populado corretamente.

**Passos:**
1. Execute: `Ctrl+Shift+P` → "Cappy: Open Graph"

**Esperado:**
- ✅ Webview abre
- ✅ Nodes de File são visíveis
- ✅ Nodes de Chunk são visíveis
- ✅ Relacionamentos conectam nodes
- ✅ Interação funciona (zoom, pan, click)

---

## 🔍 Validação de Código

### Verificar Implementações

**1. deleteFileFromDatabase**
```typescript
// Em: src/services/workspace-scanner.ts
private async deleteFileFromDatabase(relPath: string): Promise<void> {
  await this.config.graphStore.deleteFile(relPath);  // <-- DEVE estar descomentado
}
```

**2. loadFileIndex**
```typescript
// Em: src/services/workspace-scanner.ts
private async loadFileIndex(): Promise<void> {
  const files = await this.config.graphStore.listAllFiles();  // <-- DEVE estar implementado
  // ... mapeamento para fileIndex
}
```

**3. ASTRelationshipExtractor.extract**
```typescript
// Em: src/services/ast-relationship-extractor.ts
async extract(filePath: string, chunks: DocumentChunk[]): Promise<GraphRelationship[]> {
  // chunks usado (não mais _chunks)
  const symbolToChunkId = new Map<string, string>();  // <-- Mapeamento implementado
  // ... criação de relacionamentos
}
```

**4. KuzuAdapter.listAllFiles**
```typescript
// Em: src/adapters/secondary/graph/kuzu-adapter.ts
async listAllFiles(): Promise<Array<{ path: string; language: string; linesOfCode: number }>> {
  // DEVE existir e retornar lista de arquivos
}
```

**5. GraphStorePort.listAllFiles**
```typescript
// Em: src/domains/graph/ports/indexing-port.ts
export interface GraphStorePort {
  listAllFiles(): Promise<Array<{ path: string; language: string; linesOfCode: number }>>;
  // DEVE estar na interface
}
```

---

## 📊 Métricas de Sucesso

### Performance

| Métrica | Valor Esperado | Como Medir |
|---------|----------------|------------|
| Scan inicial | 30s-120s | Tempo total no log |
| Scan incremental | < 5s | Tempo quando modifica 1 arquivo |
| Cleanup | < 2s | Tempo para remover arquivos |
| Relacionamentos | > 0 | Contagem no log |

### Qualidade

| Métrica | Valor Esperado | Como Verificar |
|---------|----------------|----------------|
| Taxa de erro | < 5% | `errors / totalFiles` |
| Arquivos indexados | > 90% | Verificar no grafo |
| Relacionamentos | > 100 | Verificar no log |
| Chunks criados | > 500 | Verificar no log |

---

## 🐛 Troubleshooting

### Problema: "Cannot find module"

**Sintoma:** Erros de compilação nos imports

**Solução:**
```bash
npm install
npm run compile
# Reinicie o VS Code
```

### Problema: "Kuzu not initialized"

**Sintoma:** Erro ao executar scan

**Solução:**
```bash
# Delete e recrie o banco
rm -rf .cappy/data
# Execute scan novamente
```

### Problema: Scan muito lento

**Sintoma:** Demora muito tempo mesmo em scans incrementais

**Solução:**
- Verifique se o índice está sendo carregado
- Verifique logs: deve mostrar "Loaded X files from index"
- Se não aparecer, há problema na implementação de `loadFileIndex`

### Problema: Arquivos deletados não são limpos

**Sintoma:** Arquivos antigos ainda aparecem no grafo

**Solução:**
- Verifique se `deleteFile` está sendo chamado
- Verifique logs: deve mostrar "Cleaning up X deleted files"
- Verifique implementação de `cleanupDeletedFiles`

### Problema: Relacionamentos não são criados

**Sintoma:** No log aparece "Created 0 intra-file relationships"

**Solução:**
- Verifique se o arquivo tem funções/tipos
- Verifique se o parsing AST funcionou
- Verifique implementação do mapeamento de chunks

---

## ✅ Checklist Final de Validação

- [ ] Compilação sem erros
- [ ] Extensão carrega corretamente
- [ ] Scan inicial funciona
- [ ] Scan incremental é rápido
- [ ] Arquivos deletados são limpos
- [ ] Relacionamentos são criados
- [ ] Imports/exports são detectados
- [ ] Config files são indexados
- [ ] Erros não quebram o scan
- [ ] Grafo é visualizável
- [ ] Logs são informativos
- [ ] Performance é adequada

---

## 🎉 Validação Completa

Se todos os testes acima passaram, o sistema está **100% funcional!**

Próximos passos:
1. Testar em projetos reais
2. Coletar métricas de performance
3. Iniciar Fase 2 (cross-file relationships)

---

**Data: 15 de outubro de 2025**  
**Desenvolvido por: Cappy Team**
