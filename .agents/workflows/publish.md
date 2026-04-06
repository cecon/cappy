---
description: Compilar, bumpar versão e publicar a extensão Cappy no marketplace
---

# Publish

Compilar, incrementar a versão (patch), empacotar e publicar no VS Code Marketplace.

## Passos

// turbo-all

1. Compilar o TypeScript:
```powershell
npm run compile-extension
```

2. Bumpar versão (patch), empacotar e publicar:
```powershell
npm run package
```

3. Publicar no marketplace (caso o passo anterior nao publique):
```powershell
npx vsce publish
```

4. Instalar a nova versão localmente:
```powershell
$latestVsix = Get-ChildItem -Path . -Filter "cappy-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latestVsix) { throw "Nenhum arquivo cappy-*.vsix encontrado." }
code --install-extension $latestVsix.FullName --force
```

5. Fazer commit da versão:
```powershell
$version = node -p "require('./package.json').version"
git add package.json package-lock.json
git commit -m "chore: bump version $version"
```
