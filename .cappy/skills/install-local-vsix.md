---
description: Como compilar e instalar o Cappy localmente no VS Code (Windows)
---

# Instalar Cappy localmente (Windows)

## Pré-requisitos

- Node.js 18+
- pnpm (`npm i -g pnpm`)
- VS Code instalado em `C:\Users\cecon\AppData\Local\Programs\Microsoft VS Code\`

## Passos

### 1. Build completo

```powershell
cd d:\projetos\cappy
pnpm run build
```

### 2. Gerar VSIX

```powershell
cd extension
npx @vscode/vsce package --no-dependencies
```

O ficheiro `cappy-<version>.vsix` é gerado em `extension/`.

### 3. Instalar no VS Code

Use o caminho completo do `code.cmd` (o alias `code` pode não funcionar em todos os terminais):

```powershell
& "C:\Users\cecon\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd" --install-extension "D:\projetos\cappy\extension\cappy-<version>.vsix" --force
```

### 4. Recarregar

Após instalar, reinicie o VS Code:
- `Ctrl+Shift+P` → **Developer: Reload Window**
- Ou fechar e abrir o VS Code

## Notas

- A versão local deve ser **igual ou superior** à do marketplace para o VS Code aceitar a instalação. A versão do marketplace segue o padrão `3.2.<GITHUB_RUN_NUMBER>`. Consulte com:
  ```powershell
  npx @vscode/vsce show eduardocecon.cappy --json 2>&1 | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log(j.versions?.[0]?.version)"
  ```
- Para alterar a versão local, edite `extension/package.json` campo `"version"`.
- O ícone da activity bar (`media/icon.svg`) tem cache agressivo — só atualiza após reload completo.
- Use `--no-dependencies` no `vsce package` porque as dependências já estão bundled pelo esbuild.
