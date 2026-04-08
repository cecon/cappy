---
name: local-install-cursor
description: Builda, empacota e instala localmente extensões no Cursor via VSIX. Use quando o usuário pedir para instalar localmente no Cursor, reinstalar versão de teste, validar build webview/extension ou confirmar se a extensão carregada no Cursor é a mais recente.
---

# Local Install Cursor

## Quando usar

- Pedido de "instalar local no Cursor", "reinstalar VSIX", "atualizar extensão no Cursor".
- Suspeita de cache/versão antiga após mudanças de UI.

## Fluxo padrão

1. Descobrir diretório do projeto e da extensão.
2. Rodar build completo.
3. Gerar VSIX.
4. Instalar VSIX no Cursor com `--force`.
5. Verificar extensão instalada e assets gerados.
6. Orientar reload da janela para invalidar cache de webview.

## Comandos (PowerShell)

```powershell
# Na raiz do monorepo
pnpm install
npm run build
npm run package

# Instalar no Cursor (macOS)
& "/Applications/Cursor.app/Contents/Resources/app/bin/cursor" `
  --install-extension "/caminho/absoluto/extension/<publisher>.<name>-<version>.vsix" `
  --force

# Conferir versão instalada no Cursor
& "/Applications/Cursor.app/Contents/Resources/app/bin/cursor" `
  --list-extensions --show-versions
```

## Validações obrigatórias

- Confirmar `npm run typecheck` sem erros.
- Confirmar que o VSIX existe no caminho esperado.
- Confirmar que a extensão aparece em `cursor --list-extensions --show-versions`.
- Se houver queixa de "não mudou nada", conferir timestamps em:
  - `~/.cursor/extensions/<publisher>.<name>-<version>/out/webview/assets`

## Troubleshooting

- **Instala mas UI não muda**: pedir `Developer: Reload Window` no Cursor.
- **Comando cursor não encontrado**: usar caminho absoluto do binário do Cursor.
- **Permissão negada em ambiente sandbox**: executar instalação com permissões amplas.
- **Instalou no VS Code em vez do Cursor**: repetir com binário `Cursor.app`.

## Resultado esperado na resposta

- Informar objetivamente:
  - build executado,
  - VSIX gerado (nome e caminho),
  - instalação concluída,
  - próxima ação manual (reload da janela).
