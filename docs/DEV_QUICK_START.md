# 🛠️ Guia de Desenvolvimento Rápido - Cappy

## Reinstalar Extensão Rapidamente

### Método 1: Script Automatizado (Recomendado)

```powershell
.\reinstall-cappy.ps1
```

Este script:
1. ✅ Desinstala a versão anterior
2. ✅ Compila o TypeScript
3. ✅ Empacota a extensão (.vsix)
4. ✅ Instala a nova versão
5. ✅ Mostra instruções de próximos passos

### Método 2: Comandos Individuais

```powershell
# 1. Desinstalar
code --uninstall-extension eduardocecon.cappy

# 2. Compilar
npm run compile

# 3. Empacotar
npm run package

# 4. Instalar
code --install-extension cappy-2.9.14.vsix
```

### Método 3: NPM Scripts (Mais Rápido)

```powershell
# Se você adicionar ao package.json:
npm run reinstall

# Ou criar um alias:
npm run dev:reload
```

## Após Reinstalar

**IMPORTANTE**: Sempre recarregue o VS Code após instalar!

### Opção 1: Reload Window
1. `Ctrl+Shift+P`
2. Digite: `Developer: Reload Window`
3. Pressione Enter

### Opção 2: Fechar e Reabrir
Feche todas as janelas do VS Code e reabra.

## Comandos Úteis de Desenvolvimento

### Compilar em Modo Watch
```powershell
npm run watch
```
Compila automaticamente quando você salva arquivos.

### Testar no Extension Host
1. Pressione `F5` no VS Code
2. Uma nova janela se abrirá com a extensão carregada
3. Teste suas mudanças
4. Console de debug disponível

### Verificar Erros
```powershell
npm run compile
```

### Limpar Build
```powershell
Remove-Item -Recurse -Force out
npm run compile
```

## Workflow de Desenvolvimento Recomendado

### 1. Desenvolvimento Iterativo
```powershell
# Terminal 1: Watch mode
npm run watch

# Terminal 2: Quando quiser testar
.\reinstall-cappy.ps1
```

### 2. Teste Rápido (Extension Host)
1. Faça suas mudanças
2. Pressione `F5`
3. Teste na janela Extension Host
4. Feche e repita

### 3. Teste Real (Instalado)
1. Faça suas mudanças
2. Execute `.\reinstall-cappy.ps1`
3. Recarregue o VS Code
4. Teste no ambiente real

## Testar Comando de Visualização do Grafo

Após reinstalar:

```
Ctrl+Shift+P → Mini-LightRAG: Open Graph
```

Você deve ver:
- Um painel webview abrindo
- Interface com placeholder
- Configurações de maxNodes e maxEdges

## Verificar se a Extensão Está Ativa

### Via Command Palette
```
Ctrl+Shift+P → Cappy: Get Version
```
Deve mostrar `2.9.14`

### Via Developer Console
1. `Help` → `Toggle Developer Tools`
2. No Console, digite:
```javascript
vscode.extensions.getExtension('eduardocecon.cappy')
```
Deve retornar o objeto da extensão.

### Via Arquivo de Output
1. Verifique se `.cappy/output.txt` é criado
2. Execute qualquer comando Cappy
3. Veja o output no arquivo

## Troubleshooting

### Extensão não aparece após instalar
```powershell
# Listar extensões instaladas
code --list-extensions | Select-String "cappy"

# Se aparecer, recarregue o VS Code
```

### Comandos não aparecem
1. Verifique o `package.json` → `contributes.commands`
2. Recompile: `npm run compile`
3. Reinstale: `.\reinstall-cappy.ps1`
4. Recarregue VS Code

### Erros de compilação
```powershell
# Limpar e recompilar
Remove-Item -Recurse -Force out, node_modules
npm install
npm run compile
```

### VSIX muito grande (>100MB)
O warning é normal. Se quiser reduzir:
1. Adicione mais itens ao `.vscodeignore`
2. Use bundling com webpack (futuro)

## Estrutura de Comandos

### Comandos Principais
- `cappy.init` - Inicializar Cappy
- `cappy.reindex` - Reindexar (Mini-LightRAG)
- `miniRAG.openGraph` - **Visualizar grafo**
- `miniRAG.search` - Busca híbrida
- `miniRAG.indexWorkspace` - Indexar workspace

### Arquivos Relacionados
```
src/
├── extension.ts              # Registro de comandos
├── commands/
│   ├── reindexCommand.ts    # Reindexação
│   └── miniRAG/
│       ├── openGraph.ts     # Visualização do grafo ✨
│       ├── search.ts        # Busca
│       └── indexWorkspace.ts # Indexação
```

## Publicação

### Incrementar Versão
```powershell
# Patch: 2.9.14 → 2.9.15
npm version patch

# Minor: 2.9.15 → 2.10.0
npm version minor

# Major: 2.10.0 → 3.0.0
npm version major
```

### Publicar na Marketplace
```powershell
npm run publish
```

Requer Personal Access Token configurado.

## Links Úteis

- **Documentação do Grafo**: `docs/graph-visualization.md`
- **Referência Rápida**: `docs/QUICK_REFERENCE.md`
- **SPEC Mini-LightRAG**: `SPEC.md`
- **Resumo de Atualizações**: `docs/REINDEX_UPDATE_SUMMARY.md`

## Dicas de Produtividade

### Alias no PowerShell Profile
Adicione ao seu `$PROFILE`:

```powershell
function Reinstall-Cappy {
    Set-Location "C:\Projetos\cappy"
    .\reinstall-cappy.ps1
}
Set-Alias rc Reinstall-Cappy
```

Agora você pode simplesmente digitar `rc` para reinstalar!

### Task do VS Code
Adicione ao `.vscode/tasks.json`:

```json
{
  "label": "Reinstall Extension",
  "type": "shell",
  "command": ".\\reinstall-cappy.ps1",
  "problemMatcher": [],
  "group": {
    "kind": "build",
    "isDefault": true
  }
}
```

Execute com `Ctrl+Shift+B`

---

**Desenvolvimento Feliz! 🚀**
