---
description: Compilar a extensão Cappy e instalar direto no IDE
---

# Build & Install Local

Compilar o TypeScript e instalar a extensão diretamente no IDE atual.

## Passos

// turbo-all

1. Compilar o TypeScript:
```
cd /Users/eduardomendonca/projetos/cappy && npm run compile-extension
```

2. Empacotar como VSIX (sem bumpar versão):
```
cd /Users/eduardomendonca/projetos/cappy && npx vsce package --dependencies --no-git-tag-version --no-update-package-json
```

3. Instalar a extensão no IDE:
```
cd /Users/eduardomendonca/projetos/cappy && code --install-extension $(ls -t cappy-*.vsix | head -1) --force
```

4. Recarregar a janela do IDE:
```
cd /Users/eduardomendonca/projetos/cappy && code --command workbench.action.reloadWindow
```
