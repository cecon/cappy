# Cappy

Monorepo inicial do Cappy com tres pacotes:

- `extension`: Extension Host do VS Code (TypeScript)
- `webview`: UI React 18 + Vite
- `cli-mock`: servidor local para simular host fora do VS Code

## Requisitos

- Node.js 20+
- npm 10+

## Instalar dependencias

```bash
npm install
```

## Rodar em modo dev (browser)

Este modo sobe:

- `webview` em Vite
- `cli-mock` em `localhost:3333`

```bash
npm run dev
```

Fluxo de comunicacao no browser:

1. A UI tenta usar `window.acquireVsCodeApi`.
2. Se nao existir, conecta via WebSocket em `ws://localhost:3333`.
3. O `cli-mock` responde mensagens e expoe endpoints HTTP basicos.

## Rodar typecheck

```bash
npm run typecheck
```

## Rodar modo extensao VS Code

1. Instale dependencias na raiz: `npm install`
2. Gere build da extensao: `npm run build -w extension`
3. Abra o projeto no VS Code.
4. Pressione `F5` para iniciar Extension Development Host.
5. Execute o comando `Cappy: Start`.

## Estrutura

- `extension/src/extension.ts`: entrypoint da extensao
- `extension/src/agent/loop.ts`: loop manual do agente (stub)
- `extension/src/tools/*`: tools com contrato padrao
- `extension/src/bridge/webview.ts`: bridge de mensagens no host da extensao
- `webview/src/lib/vscode-bridge.ts`: interface de bridge para UI
- `webview/src/lib/vscode-mock.ts`: auto-detect VS Code API ou WebSocket
- `cli-mock/src/server.ts`: servidor HTTP + WebSocket para dev local
