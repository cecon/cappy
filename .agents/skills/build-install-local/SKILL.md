---
name: build-install-local
description: Compila a extensao Cappy, gera VSIX e instala localmente no VS Code com comandos PowerShell e fallback para erros de dependencias. Use quando o usuario pedir build local, pacote VSIX, reinstalacao local ou validacao rapida da extensao no ambiente local.
---

# Build + Install Local (VS Code)

## Objetivo

Executar build local confiavel da extensao e instalar a VSIX no VS Code com `--force`.

## Quando usar

- Usuario pedir para "instalar local", "buildar", "gerar VSIX" ou "reinstalar extensao".
- Validacao rapida apos mudancas no codigo da extensao.

## Workflow padrao (PowerShell — Windows e macOS/Linux)

O projeto usa **pnpm** como package manager.

1) Build completo (extensao + webview), a partir do root do workspace:

```powershell
cd D:\projetos\cappy
pnpm run build
```

2) Gerar VSIX com versao dinamica, a partir da pasta `extension/`:

```powershell
cd D:\projetos\cappy\extension
$ver = (node -p "require('./package.json').version")
pnpm exec vsce package --no-dependencies --allow-package-all-secrets --allow-package-env-file -o "eduardocecon.cappy-$ver.vsix"
```

3) Se falhar por dependencia invalida (`ELSPROBLEMS`), adicionar `--no-dependencies` (ja incluso acima).

4) Instalar VSIX no VS Code — **sempre com caminho absoluto para o .vsix E para o code**:

```powershell
# Windows — usar bin\code.cmd (nao Code.exe nem o alias `code`)
& "C:\Users\cecon\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd" --install-extension "D:\projetos\cappy\extension\eduardocecon.cappy-$ver.vsix" --force

# macOS / Linux
code --install-extension "$PWD/eduardocecon.cappy-$ver.vsix" --force
```

> **IMPORTANTE:**
> - No Windows, **nunca usar `code`** sozinho (o alias pode nao retornar output). Usar sempre o caminho completo do `bin\code.cmd`.
> - Nunca usar glob (`cappy-*.vsix`) ou caminho relativo. Sempre construir o caminho absoluto do arquivo .vsix.

5) Opcional: confirmar a versao instalada:

```powershell
# Windows
& "C:\Users\cecon\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd" --list-extensions --show-versions | Select-String "eduardocecon.cappy"

# macOS / Linux
code --list-extensions --show-versions | grep "eduardocecon.cappy"
```

## Validacao rapida

- [ ] `pnpm run build` sem erro
- [ ] VSIX gerada em `extension/eduardocecon.cappy-<versao>.vsix`
- [ ] Instalacao no VS Code concluida com sucesso (caminho absoluto)

## Guardrails

- Sempre executar `pnpm run build` a partir do root do workspace.
- Sempre usar **caminho absoluto** no `code --install-extension`.
- Nao fazer `npm version` automaticamente em fluxo local.
- Nao publicar no marketplace neste fluxo.
