# 🚀 Quick Start - Workspace Scanner

## Instalação

O Workspace Scanner já está integrado ao Cappy. Não precisa instalar nada adicional.

## Uso Básico

### 1. Via Command Palette

A forma mais simples de usar:

```
1. Abra seu projeto no VS Code
2. Pressione Ctrl+Shift+P (Cmd+Shift+P no Mac)
3. Digite: "Cappy: Scan Workspace"
4. Pressione Enter
```

Você verá uma barra de progresso no canto inferior direito mostrando o andamento.

### 2. Via Código (para desenvolvedores)

```typescript
import { WorkspaceScanner } from './services/workspace-scanner';
import { ParserService } from './services/parser-service';
import { IndexingService } from './services/indexing-service';
// ... outros imports

// Configure os serviços
const scanner = new WorkspaceScanner({
  workspaceRoot: '/path/to/your/project',
  repoId: 'my-project',
  parserService,
  indexingService,
  graphStore,
  batchSize: 10,
  concurrency: 3
});

// Setup callback de progresso (opcional)
scanner.onProgress((progress) => {
  console.log(`Processando: ${progress.processedFiles}/${progress.totalFiles}`);
  console.log(`Arquivo atual: ${progress.currentFile}`);
  console.log(`Status: ${progress.status}`);
});

// Execute o scan
await scanner.initialize();
await scanner.scanWorkspace();
```

## O que Acontece Durante o Scan?

### Fase 1: Descoberta (5-10s)
```
🔍 Initializing workspace scanner...
📋 Loaded .gitignore patterns
📋 Loaded .cappyignore patterns
✅ Workspace scanner initialized
🚀 Starting workspace scan...
📁 Found 342 files to process
```

O scanner:
- Procura todos os arquivos no workspace
- Aplica filtros de `.gitignore` e `.cappyignore`
- Calcula hash de cada arquivo
- Determina quais arquivos precisam ser processados

### Fase 2: Limpeza (< 1s)
```
🗑️  Cleaning up 3 deleted files...
🗑️  Deleting: old-file.ts
```

O scanner:
- Detecta arquivos que foram deletados desde o último scan
- Remove esses arquivos do banco de dados
- Limpa relacionamentos órfãos

### Fase 3: Processamento (maior parte do tempo)
```
📝 125 files need processing

📄 Processing: src/extension.ts
🔍 Parsing TypeScript/JavaScript: src/extension.ts
📝 TypeScript: Parsed 8 JSDoc chunks from src/extension.ts
📑 Indexing src/extension.ts with 8 chunks...
🤖 Generating embeddings for 8 chunks...

📄 Processing: src/services/parser-service.ts
🔍 Parsing TypeScript/JavaScript: src/services/parser-service.ts
📝 TypeScript: Parsed 12 JSDoc chunks from src/services/parser-service.ts
📑 Indexing src/services/parser-service.ts with 12 chunks...
🤖 Generating embeddings for 12 chunks...

... (continua para todos os arquivos)
```

Para cada arquivo, o scanner:
1. Extrai metadados (LOC, size, etc.)
2. Faz parsing AST (se aplicável)
3. Extrai chunks (JSDoc, code, markdown, etc.)
4. Gera embeddings para os chunks
4. Gera chunks (documentação + código)
5. Indexa no SQLite com sqlite-vec (vetores + conteúdo)
6. Cria nós no grafo SQLite (File, Chunks, Relacionamentos)
7. Cria relacionamentos (CONTAINS, DOCUMENTS, etc.)

### Fase 4: Conclusão
```
✅ Workspace scan completed in 45.32s
   Processed: 125/342 files
   Errors: 0
```

## Visualizando os Resultados

### 1. Ver Logs Detalhados

```
View → Output → Cappy
```

Aqui você verá todos os logs detalhados do processo.

### 2. Ver Grafo

```
Ctrl+Shift+P → Cappy: Open Graph
```

Isso abrirá uma visualização interativa do grafo de conhecimento gerado.

### 3. Fazer Queries

Use o chat do Cappy para fazer perguntas sobre o código:

```
"Quais arquivos contêm funções relacionadas a parsing?"
"Mostre a documentação do WorkspaceScanner"
"Quantos chunks foram criados no último scan?"
```

## Configuração

### .cappyignore

Crie um arquivo `.cappyignore` na raiz do projeto para ignorar arquivos específicos:

```
# Ignorar arquivos temporários
*.tmp
*.cache

# Ignorar diretórios específicos
legacy/
experiments/

# Ignorar arquivos grandes
*.mp4
*.avi
```

### Ajustar Performance

Se o scan estiver muito lento ou muito rápido, você pode ajustar:

**No código (scan-workspace.ts):**

```typescript
const scanner = new WorkspaceScanner({
  // ...
  batchSize: 20,     // Aumentar para mais throughput
  concurrency: 5     // Aumentar se CPU permitir
});
```

**Recomendações:**
- **CPU fraca**: `concurrency: 2, batchSize: 5`
- **CPU média**: `concurrency: 3, batchSize: 10` (padrão)
- **CPU forte**: `concurrency: 5, batchSize: 20`

## Quando Fazer um Scan?

### Scan Manual (Recomendado)

Faça um scan manual quando:
- ✅ Após clonar o projeto
- ✅ Após grandes refatorações
- ✅ Após merge de branches
- ✅ Antes de começar nova feature
- ✅ Quando quiser análise atualizada

### Scan Automático (Futuro)

Na Fase 3, o scanner será automático:
- 🚧 Ao salvar arquivos (incremental)
- 🚧 Ao criar/deletar arquivos
- 🚧 Ao fazer checkout de branch

## Troubleshooting

### "No workspace folder open"

**Problema:** Nenhuma pasta aberta no VS Code.

**Solução:** 
```
File → Open Folder → Escolha seu projeto
```

### Scan muito lento

**Problema:** Demora muito tempo para completar.

**Possíveis causas:**
- Muitos arquivos grandes
- CPU ocupada com outras tarefas
- Gerando embeddings para muitos chunks

**Soluções:**
- Adicione arquivos grandes ao `.cappyignore`
- Feche outros programas pesados
- Reduza a concorrência temporariamente

### Erros de parsing

**Problema:** Alguns arquivos têm erros de parsing.

**Exemplo:**
```
❌ Error processing src/broken.ts: Unexpected token
```

**Soluções:**
- Corrija a sintaxe do arquivo
- OU adicione ao `.cappyignore` se não for importante

### Arquivos não sendo indexados

**Problema:** Alguns arquivos não aparecem no grafo.

**Verificações:**
1. O arquivo está no `.gitignore`?
2. O arquivo está no `.cappyignore`?
3. A extensão é suportada? (`.ts`, `.js`, `.md`, etc.)
4. O arquivo está muito grande? (> 1MB)

**Solução:**
- Remova do `.cappyignore` se necessário
- Verifique os logs para erros específicos

### Banco de dados corrompido

**Problema:** Erros ao abrir o banco SQLite.

**Sintomas:**
```
❌ SQLite initialization error: Failed to open database
```

**Solução:**
```bash
# Apague o banco e refaça o scan
rm -rf .cappy/data/cappy.db
```

Depois execute o scan novamente.

## Próximos Passos

Após o primeiro scan completo:

1. **Explore o Grafo**
   ```
   Cappy: Open Graph
   ```

2. **Faça Perguntas no Chat**
   ```
   "Qual a estrutura do projeto?"
   "Onde está definida a função X?"
   "Quais arquivos usam a classe Y?"
   ```

3. **Configure .cappyignore**
   - Adicione arquivos/diretórios que não precisa indexar
   - Isso acelera scans futuros

4. **Monitore Performance**
   - Veja quanto tempo leva
   - Ajuste concorrência se necessário

## Exemplos de Projetos

### Projeto Pequeno (< 100 arquivos)
```
📁 Found 87 files to process
📝 45 files need processing
⏱️  Completed in 12.5s
```

### Projeto Médio (100-500 arquivos)
```
📁 Found 342 files to process
📝 125 files need processing
⏱️  Completed in 45.3s
```

### Projeto Grande (> 500 arquivos)
```
📁 Found 1,234 files to process
📝 523 files need processing
⏱️  Completed in 3m 42s
```

## Dicas de Performance

### ✅ DO

- Use `.cappyignore` para excluir arquivos desnecessários
- Faça scans incrementais quando possível (futuro)
- Monitore o Output Channel para identificar gargalos
- Ajuste concorrência baseado na sua CPU

### ❌ DON'T

- Não indexe `node_modules` (já excluído por padrão)
- Não indexe arquivos binários grandes
- Não faça scan durante compilação/build
- Não reduza muito a concorrência (mínimo 2)

## FAQ

### Q: Quanto tempo demora?
**A:** Depende do tamanho do projeto. ~10-30s para pequenos, ~30s-2min para médios, ~2-10min para grandes.

### Q: Usa muita memória?
**A:** Não, o processamento é em streaming. ~200-500MB típico.

### Q: Preciso fazer scan toda hora?
**A:** Não, apenas quando houver mudanças significativas. No futuro será automático.

### Q: Posso cancelar durante o scan?
**A:** Atualmente não. Será adicionado na Fase 3.

### Q: O que acontece se desligar o VS Code durante scan?
**A:** Os dados processados até então são salvos. Ao fazer novo scan, continuará de onde parou.

### Q: Funciona offline?
**A:** Sim, exceto a geração de embeddings que pode precisar de API externa (depende da configuração).

## Suporte

Problemas ou dúvidas?

1. Verifique os logs: `Output → Cappy`
2. Consulte documentação: `docs/WORKSPACE_SCANNER.md`
3. Abra issue no GitHub
4. Procure no troubleshooting acima

---

**Happy Scanning! 🦫**
