# Arquitetura do Projeto Cappy

## Visão Geral
O projeto **Cappy** é uma extensão para o Visual Studio Code que fornece uma interface de chat baseada em LLMs, com suporte a ferramentas (MCP), histórico, configuração e integração com o webview.  Ele está organizado em três áreas principais:

1. **extension** – código da extensão VS Code (backend)
2. **webview** – aplicação React que roda dentro do painel da extensão
3. **cli‑mock** – servidor mock usado para testes/local development

A seguir detalhamos a estrutura de diretórios, principais módulos e como eles se comunicam.

---

## 1. Extension (backend)
```
extension/
├─ src/
│  ├─ extension.ts               # ponto de entrada da extensão (activate / deactivate)
│  ├─ bridge/
│  │   └─ webview.ts            # cria e gerencia o WebviewPanel, envia/recebe mensagens
│  ├─ config/
│  │   └─ index.ts              # carrega e salva configuração do usuário (workspaceState)
│  ├─ agent/
│  │   ├─ types.ts              # tipos de mensagens, estado, tools
│  │   └─ loop.ts               # ciclo principal do agente (recebe prompt, invoca tools, gera resposta)
│  ├─ mcp/
│  │   └─ client.ts             # implementação do client MCP (chamadas a ferramentas externas)
│  ├─ tools/
│  │   ├─ index.ts              # exportação de utilitários
│  │   ├─ readFile.ts           # wrapper para VS Code workspace.fs.readFile
│  │   ├─ writeFile.ts          # wrapper para VS Code workspace.fs.writeFile
│  │   ├─ listDir.ts            # wrapper para VS Code workspace.fs.readDirectory
│  │   ├─ globFiles.ts          # wrapper para vscode.workspace.findFiles
│  │   ├─ searchCode.ts         # utiliza ripgrep para buscar código
│  │   ├─ runTerminal.ts         # execuções de comandos no terminal integrado
│  │   └─ ripgrep.ts            # helper que invoca o binário rg
│  └─ utils (pode conter helpers adicionais)
├─ package.json
├─ tsconfig.json
└─ README.md
```
### Comunicação
- **Webview ↔ Extension**: mensagens JSON via `postMessage`/`onDidReceiveMessage`.  O webview envia eventos (`userPrompt`, `invokeTool`, `configUpdate`) e a extensão responde (`assistantMessage`, `toolResult`, `config`).
- **Ferramentas (MCP)**: o `agent/loop.ts` decide quando chamar `client.ts`, que por sua vez usa os `tools/*` para realizar ações no filesystem ou executar comandos.
- **Persistência**: configurações e histórico são armazenados usando `vscode.ExtensionContext.globalState`/`workspaceState` através de `config/index.ts`.

---

## 2. Webview (frontend)
```
webview/
├─ src/
│  ├─ main.tsx                  # bootstrap React e conecta ao bridge
│  ├─ App.tsx                    # container principal da UI
│  ├─ components/
│  │   ├─ Chat.tsx               # exibe mensagens de usuário e assistente
│  │   ├─ InputBar.tsx           # caixa de texto + botão enviar
│  │   ├─ HistoryPanel.tsx       # lista de sessões/histórico salvo
│  │   ├─ ConfigPanel.tsx        # UI para alterar settings (model, temperature, etc.)
│  │   ├─ McpToolsPanel.tsx      # visualiza e aciona ferramentas disponíveis
│  │   └─ ToolConfirmCard.tsx    # modal de confirmação antes de executar tool
│  ├─ lib/
│  │   ├─ vscode-bridge.ts       # wrapper thin sobre `acquireVsCodeApi()`
│  │   ├─ vscode-mock.ts         # mock para desenvolvimento fora do VS Code
│  │   └─ types.ts               # tipos compartilhados com a extensão
│  ├─ styles/
│  │   ├─ reset.css
│  │   └─ tokens.css
│  └─ App.module.css
├─ index.html                    # página carregada pelo WebviewPanel
├─ vite.config.ts                # configuração do Vite (build para VS Code webview)
├─ tsconfig.json
└─ package.json
```
### Fluxo de Dados
1. **User Input** → `InputBar` → `bridge.postMessage({type:"prompt", payload:…})`
2. **Extension** processa → responde com `assistantMessage` ou `toolResult`
3. **Webview** atualiza estado React (useReducer) e renderiza novos componentes.
4. **Ferramentas**: Quando o assistente quer usar uma tool, a extensão envia `requestTool` → webview mostra `ToolConfirmCard` → usuário confirma → extensão executa a tool e devolve o resultado.

---

## 3. CLI Mock (servidor local)
```
cli-mock/
├─ src/server.ts                # Express server que simula endpoints da API LLM
├─ package.json
└─ tsconfig.json
```
Usado apenas para desenvolvimento; pode ser iniciado com `npm run dev` e a extensão pode apontar para ele via configuração `apiBaseUrl`.

---

## 4. Build & Deploy
- **Extension**: `pnpm run compile` (tsc) → gera JavaScript em `out/` (não versionado).  O VSIX é empacotado com `vsce package`.
- **Webview**: `pnpm run build` dentro da pasta `webview` usa Vite para produzir arquivos estáticos em `dist/`.  O `extension/bridge/webview.ts` aponta para `webview/dist/index.html`.
- **CI**: GitHub Actions (`.github/workflows/cappy-publish.yml`) executa lint, test, build e publica o VSIX como release.

---

## 5. Dependências Principais
| Área | Pacote | Uso |
|------|--------|-----|
| Extension | `vscode` | API do VS Code (WebviewPanel, workspace.fs, commands) |
| | `node-fetch` (ou `axios`) | chamadas HTTP à API LLM |
| | `fast-json-stable-stringify` | serialização consistente de mensagens |
| Webview | `react`, `react-dom` | UI declarativa |
| | `vite` | bundling rápido para webview |
| | `typescript` | tipagem estática |
| CLI Mock | `express` | servidor mock de completions |

---

## 6. Diagrama de Comunicação (texto)
```
+-------------------+            +-------------------+            +-------------------+
| VS Code (IDE)     |            | Extension (Node)  |            | Webview (React)   |
+-------------------+            +-------------------+            +-------------------+
        ^                              ^  |  ^                               |
        | VS Code API (commands)       |  |  |  postMessage / onMessage      |
        |                              |  |  |                               |
        |                              |  |  |                               |
        |                              |  |  |                               |
        |                              |  |  |                               |
        |                              |  |  |                               |
        |                              |  |  |                               |
        |                              |  |  |                               |
        |        Tool Invocation        |  |  |   UI Interaction (click)      |
        +------------------------------+  +-------------------------------+
```
---

## 7. Extensibilidade
- **Adicionar nova ferramenta**: criar arquivo em `extension/src/tools/` exportando a lógica, registrar no `client.ts` e definir o schema JSON usado pelo assistente.
- **Novo modelo LLM**: ajustar `agent/loop.ts` para chamar a URL/headers apropriados; expor configuração em `ConfigPanel`.
- **Tema/Estilos**: modificar arquivos CSS em `webview/src/styles` ou usar CSS‑in‑JS dentro dos componentes.

---

*Este documento (`stack.md`) resume a arquitetura do repositório Cappy e serve como ponto de partida para novos desenvolvedores entenderem como as partes se encaixam.*
