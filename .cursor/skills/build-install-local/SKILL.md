---
name: build-install-local
description: Compila a extensao Cappy, gera VSIX e instala localmente no Cursor com comandos PowerShell e fallback para erros de dependencias. Use quando o usuario pedir build local, pacote VSIX, reinstalacao local ou validacao rapida da extensao no ambiente local.
---

# Build + Install Local (Cursor)

## Objetivo

Executar build local confiavel da extensao e instalar a VSIX no Cursor com `--force`.

## Quando usar

- Usuario pedir para "instalar local", "buildar", "gerar VSIX" ou "reinstalar extensao".
- Validacao rapida apos mudancas no codigo da extensao.

## Workflow padrao (PowerShell)

1) Compilar a extensao:

```powershell
npm run compile-extension
```

2) Gerar VSIX (tentativa padrao):

```powershell
npx vsce package --dependencies
```

3) Se falhar por dependencia invalida (`ELSPROBLEMS`), gerar sem validacao de dependencias:

```powershell
npx vsce package --no-dependencies
```

4) Instalar VSIX no Cursor (forcando atualizacao):

```powershell
& "/Applications/Cursor.app/Contents/Resources/app/bin/cursor" --install-extension "cappy-*.vsix" --force
```

5) Opcional: confirmar a versao instalada:

```powershell
& "/Applications/Cursor.app/Contents/Resources/app/bin/cursor" --list-extensions --show-versions | Select-String "eduardocecon.cappy"
```

## Validacao rapida

- [ ] `npm run compile-extension` sem erro
- [ ] VSIX gerada no root do projeto
- [ ] Instalacao no Cursor concluida com sucesso

## Guardrails

- Sempre executar a partir do root do workspace.
- Nao fazer `npm version` automaticamente em fluxo local.
- Nao publicar no marketplace neste fluxo.
