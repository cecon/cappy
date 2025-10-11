# Forçar Reload do Chat com Cache Buster

## ⚡ Solução Rápida

### 1. Fechar e reabrir o chat
```
1. Feche a view do Cappy (X na aba)
2. Ctrl+Shift+P → "Cappy: Open Chat"
```

### 2. Recarregar janela do VS Code
```
Ctrl+Shift+P → "Developer: Reload Window"
ou apenas: Ctrl+R
```

### 3. Se ainda não funcionar - Limpar cache do webview
```powershell
# PowerShell - Limpar cache de extensões
Remove-Item "$env:APPDATA\Code\User\workspaceStorage\*" -Recurse -Force -ErrorAction SilentlyContinue
```

## 🔧 O que foi implementado

### Cache Buster Automático
Adicionamos um timestamp nas URLs dos assets para forçar reload:

```typescript
// ChatViewProvider.ts
private _getHtmlForWebview(webview: vscode.Webview) {
  // Add cache buster to force reload of assets
  const cacheBuster = Date.now()
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'main.js'))
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'style.css'))
  
  const scriptWithCache = `${scriptUri}?v=${cacheBuster}`
  const styleWithCache = `${styleUri}?v=${cacheBuster}`
  
  // ...
  <link rel="stylesheet" href="${styleWithCache}">
  <script type="module" src="${scriptWithCache}"></script>
}
```

### Benefícios
- ✅ **Sempre carrega a versão mais recente** dos assets
- ✅ **Não depende de cache do browser**
- ✅ **Funciona automaticamente** em cada reload do webview

## 🎯 Teste Final

1. **Recarregar VS Code**: `Ctrl+R`
2. **Abrir Chat**: `Ctrl+Shift+P` → "Cappy: Open Chat"
3. **Verificar ícone**: Deve aparecer a capivara do Cappy 🦫✨

## 🐛 Debug - Se ainda aparecer robô

### Verificar se SVG está correto
```powershell
# Ver conteúdo do SVG compilado
Get-Content "c:\Projetos\cappy1\out\cappy-icon.svg"
```

Deve mostrar:
```xml
<svg width="24" height="24" ...>
  <!-- Simple capybara head -->
  <ellipse cx="12" cy="14" rx="8" ry="6" fill="currentColor"/>
  <!-- Eyes, Nose, Ears -->
  ...
  <!-- AI sparkle -->
  <path d="M18 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="#007ACC"/>
</svg>
```

### Ver console do webview
```
1. Ctrl+Shift+P → "Developer: Open Webview Developer Tools"
2. Console → Ver se há erros de carregamento de assets
3. Network → Ver se cappy-icon.svg está sendo carregado
```

### Verificar import no React
Abrir `out/main.js` e procurar por:
```javascript
import cappyIcon from './cappy-icon.svg'
```

## 📊 Status da Instalação

```
✓ Versão: 3.0.3
✓ Cache buster: Implementado
✓ SVG: Compilado em out/cappy-icon.svg
✓ Extension: Instalada
```

## 🔄 Próximo Reload

Após qualquer mudança no código:
```powershell
# Build completo
npm run build
npm run compile-extension

# Empacotar nova versão (incrementar número)
npx @vscode/vsce package --out cappy-3.0.4.vsix --allow-missing-repository
code --install-extension cappy-3.0.4.vsix --force

# IMPORTANTE: Recarregar VS Code
# Ctrl+R
```

## 💡 Dica Pro

Para desenvolvimento mais rápido, use watch mode:
```powershell
# Terminal 1 - Watch frontend
npm run build -- --watch

# Terminal 2 - Watch extension
npm run compile-extension -- --watch

# Após mudanças, apenas:
# 1. Salvar arquivo
# 2. Ctrl+R para recarregar VS Code
```

---

**Versão atual**: 3.0.3  
**Status**: ✅ Cache buster implementado  
**Próximo passo**: Recarregar VS Code (Ctrl+R)
