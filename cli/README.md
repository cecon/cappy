# Cappy CLI

Execute o Cappy diretamente no terminal — o mesmo agente de IA que roda no VS Code, agora sem precisar abrir um editor.

---

## ⚡ Início rápido

### 1. Instalar dependências

```bash
# Na raiz do monorepo
pnpm install
```

### 2. Compilar a CLI

```bash
pnpm cli:build
```

Isso gera `cli/dist/index.js` — um bundle Node.js standalone com tudo incluído.

### 3. Rodar

```bash
# Diretamente com Node (sem instalar globalmente)
node cli/dist/index.js "explica o arquivo src/index.ts"

# Ou instalar globalmente
npm install -g .   # dentro de cli/
cappy "refatora o utils.ts"
```

---

## 🚀 Modos de uso

### Prompt direto (args)
```bash
cappy "quais são os principais módulos deste projeto?"
cappy "cria um arquivo de testes para src/loop.ts"
```

### Via stdin (pipe)
```bash
echo "explica o código" | cappy
cat error.log | cappy "o que causou esse erro?"
```

### REPL interativo (sem argumentos)
```bash
cappy
# Abre um loop de conversa com histórico mantido entre mensagens
```

---

## 🛠️ Opções

| Flag | Descrição |
|------|-----------|
| `-m, --mode <modo>` | `agent` (padrão) · `ask` (só leitura) · `plain` (sem tools) |
| `-w, --workspace <dir>` | Raiz do workspace (padrão: diretório atual) |
| `--allow-all` | Aprova automaticamente tools destrutivas (sem confirmação) |
| `--deny-all` | Nega automaticamente tools destrutivas |
| `--max-iterations <n>` | Limite de rodadas do agente por resposta |
| `--no-color` | Desativa cores ANSI |
| `-v, --version` | Exibe a versão |
| `-h, --help` | Exibe a ajuda |

---

## 🔐 Configuração

O Cappy lê `~/.cappy/config.json` (criado automaticamente na primeira execução):

```json
{
  "openrouter": {
    "apiKey": "sk-or-SUA_CHAVE_AQUI",
    "model": "anthropic/claude-3.5-sonnet",
    "visionModel": "meta-llama/llama-3.2-11b-vision-instruct:free"
  },
  "agent": {
    "systemPrompt": "You are Cappy, an expert coding assistant.",
    "maxIterations": 20
  }
}
```

Obtenha sua chave em: https://openrouter.ai/keys

---

## 🔒 HITL (Human-in-the-Loop)

Por padrão, o Cappy **pede confirmação** antes de executar qualquer tool destrutiva (escrever arquivos, rodar shell, etc.):

```
⚠  Tool destrutiva detectada — confirmação necessária
   Tool: Bash
   Args:
      command: "npm install express"

   [y] aprovar  [n] rejeitar  [a] aprovar todas  [d] negar todas
   Decisão [y/n/a/d]: 
```

- **`y`** — aprova esta execução
- **`n`** — rejeita esta execução (o agente é informado)
- **`a`** — aprova todas as tools destrutivas desta sessão
- **`d`** — nega todas as tools destrutivas desta sessão

Use `--allow-all` para pular todas as confirmações automaticamente.

---

## 📋 Comandos do REPL

No modo interativo, além de digitar mensagens, você pode usar:

| Comando | Ação |
|---------|------|
| `/sair` | Encerra o REPL |
| `/limpar` | Limpa o histórico da conversa |
| `/modo <agent\|ask\|plain>` | Muda o modo em tempo real |
| `/ajuda` | Exibe a ajuda |

---

## 🏗️ Arquitetura

```
cli/
├── src/
│   ├── index.ts        ← entry point: parse args, REPL, single-shot, stdin
│   ├── CliRenderer.ts  ← formata eventos do AgentLoop para o terminal (cores, spinner)
│   └── CliHitl.ts      ← HITL interativo via readline
└── dist/
    └── index.js        ← bundle compilado (gerado por pnpm cli:build)
```

A CLI **não duplica código** — importa diretamente:
- `extension/src/agent/loop.ts` → `AgentLoop`
- `extension/src/tools/index.ts` → `toolsRegistry`
- `extension/src/config/index.ts` → `loadConfig`

O `esbuild` faz bundle de tudo em um único arquivo `dist/index.js`.
