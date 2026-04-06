---
name: publish-cappy-extension
description: Publica a extensao Cappy no VS Code Marketplace com fluxo seguro para Windows/PowerShell, incluindo compile, package, publish, instalacao local e commit de versao. Use quando o usuario pedir para publicar, gerar VSIX, instalar versao local ou executar release da extensao.
---

# Publish Cappy Extension

## Objetivo

Executar publicacao da extensao com passos padronizados e verificacao minima de seguranca.

## Quando usar

- Usuario pedir para publicar a extensao.
- Usuario pedir para gerar ou instalar arquivo `.vsix`.
- Usuario pedir release no marketplace.

## Workflow padrao (PowerShell)

1) Compilar:

```powershell
npm run compile-extension
```

2) Gerar pacote/release:

```powershell
npm run package
```

3) Publicar manualmente se necessario:

```powershell
npx vsce publish
```

4) Instalar a ultima VSIX localmente:

```powershell
$latestVsix = Get-ChildItem -Path . -Filter "cappy-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latestVsix) { throw "Nenhum arquivo cappy-*.vsix encontrado." }
code --install-extension $latestVsix.FullName --force
```

5) Commit do bump de versao:

```powershell
$version = node -p "require('./package.json').version"
git add package.json package-lock.json
git commit -m "chore: bump version $version"
```

## Checklist rapido

- [ ] `npm run compile-extension` sem erro
- [ ] VSIX gerado
- [ ] Publicacao concluida
- [ ] Instalacao local validada
- [ ] Commit de versao criado

## Guardrails

- Nao executar comandos destrutivos de git.
- Nao usar caminhos fixos de maquina (sempre relativo ao workspace atual).
- Nao publicar sem confirmar que o build compilou.
