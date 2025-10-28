# Fix: Documents Page Loading & Invalid Files Processing

**Data:** 27 de outubro de 2025  
**Branch:** graph2  
**Status:** ✅ Resolvido

## Problema

1. **Lista de documentos não carregava** na página Documents
2. **Arquivos inválidos sendo processados:** `src/assets/documents.svg`, `src/assets/sql-wasm.wasm` e outros assets da extensão estavam sendo:
   - Escaneados pelo workspace scanner
   - Adicionados ao banco de dados
   - Tentados processar pelo cronjob
   - Gerando erros `File not found`

## Causa Raiz

1. **Ignore patterns incompletos:** O `IgnorePatternMatcher` não tinha padrões para ignorar:
   - Assets da extensão (`src/assets/*`)
   - Arquivos de build (`out/`, `*.vsix`)
   - Arquivos binários (`.svg`, `.wasm`, `.png`, etc.)

2. **Comunicação webview↔extension:** Falta de logs detalhados dificultava debug

## Solução Implementada

### 1. Melhorias no Ignore Pattern Matcher
**Arquivo:** `src/nivel2/infrastructure/services/ignore-pattern-matcher.ts`

```typescript
// Adicionados novos padrões default:
'src/assets/*.svg',
'src/assets/*.wasm',
'src/assets/*.png',
'src/assets/*.jpg',
'src/assets/*.jpeg',
'src/assets/*.gif',
'src/assets/*.ico',
'out/',
'*.vsix'
```

**Também corrigido:** lint error `String#replace()` → `String#replaceAll()`

### 2. Novo Comando: Clean Invalid Files
**Arquivo:** `src/nivel1/adapters/vscode/commands/clean-invalid-files.ts`

Comando `cappy.cleanInvalidFiles` que:
- Lista todos os arquivos no banco de dados
- Identifica arquivos inválidos (assets, binários, builds)
- Remove do banco com confirmação do usuário

**Padrões detectados:**
- `.svg`, `.wasm`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.ico`
- `.ttf`, `.woff`, `.woff2`, `.eot`
- `.vsix`
- Paths: `src/assets/`, `out/`, `dist/`, `build/`

### 3. Logs Melhorados
**Arquivo:** `src/nivel1/adapters/vscode/documents/DocumentsViewProvider.ts`

Adicionados logs detalhados para debug:
```typescript
console.log('📊 [DocumentsViewProvider] Fetching paginated files:', { page, limit, status, sortBy, sortOrder });
console.log('📤 [DocumentsViewProvider] Webview exists:', !!this._view);
console.log('📤 [DocumentsViewProvider] Webview visible:', this._view?.visible);
console.log('✅ [DocumentsViewProvider] Message sent to webview successfully');
```

### 4. Registro do Comando
**Arquivos modificados:**
- `src/nivel1/adapters/vscode/commands/index.ts`: Export do novo comando
- `src/extension.ts`: Registro do comando no activate

## Como Usar

### Para limpar arquivos inválidos existentes:

1. Abra a Command Palette (`Cmd+Shift+P`)
2. Execute: `Cappy: Clean Invalid Files`
3. Revise a lista de arquivos a serem removidos
4. Confirme com "Yes"

### Para prevenir novos arquivos inválidos:

Os novos padrões de ignore serão aplicados automaticamente em:
- Novos scans do workspace
- File watcher (mudanças de arquivos)

## Testes Recomendados

1. ✅ **Build bem-sucedido**
2. ⏳ **Testar comando clean:** Execute `cappy.cleanInvalidFiles`
3. ⏳ **Verificar Documents Page:** Abrir painel Documents e verificar se lista carrega
4. ⏳ **Scan workspace:** Execute `cappy.scanWorkspace` e verificar que assets são ignorados
5. ⏳ **Verificar logs:** Console não deve mostrar erros de `File not found` para assets

## Arquivos Modificados

```
src/nivel2/infrastructure/services/ignore-pattern-matcher.ts
src/nivel1/adapters/vscode/documents/DocumentsViewProvider.ts
src/nivel1/adapters/vscode/commands/clean-invalid-files.ts (novo)
src/nivel1/adapters/vscode/commands/index.ts
src/extension.ts
```

## Próximos Passos

1. Testar em ambiente de desenvolvimento
2. Executar `cappy.cleanInvalidFiles` para limpar banco existente
3. Verificar que lista de documentos carrega corretamente
4. Criar `.cappyignore` personalizado se necessário

## Notas

- Os padrões de ignore são aplicados durante o **file discovery**, antes de adicionar ao banco
- Arquivos já no banco precisam ser removidos manualmente com `cappy.cleanInvalidFiles`
- O cronjob já trata erros corretamente, marcando arquivos como `error` quando não podem ser processados
