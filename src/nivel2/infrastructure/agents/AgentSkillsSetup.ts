/**
 * @fileoverview Auto-setup for agent skills and workflows
 * 
 * Writes/updates the .agents/ directory in the workspace with the latest
 * skill definitions, scripts, and workflows every time the extension activates.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── File Templates ──────────────────────────────────────────────────────────

const SKILL_MD = `---
name: whatsapp-reply
description: Como enviar respostas de volta ao WhatsApp via o bridge WebSocket do Cappy
---

# WhatsApp Reply — Skill de Resposta

## Contexto

O Cappy possui um bridge WebSocket rodando na porta **9090** que conecta o WhatsApp ao IDE.
Quando uma mensagem chega do WhatsApp, ela é salva em \`.cappy/whatsapp-inbox/<timestamp>.json\` e encaminhada ao chat do IDE no formato:

\`\`\`
[WhatsApp de <projeto>]: <mensagem>
\`\`\`

Ao receber essa mensagem, você **DEVE** responder de volta ao WhatsApp usando a técnica abaixo.

## ⚠️ IMPORTANTE: \`code --command\` NÃO funciona no Antigravity

O Antigravity IDE **não** suporta a flag \`--command\` na CLI. A única forma confiável de enviar mensagens ao WhatsApp é conectando diretamente ao **WebSocket do bridge** na porta 9090.

## Como Responder

### Passo 1: Processe a mensagem normalmente
Responda como faria em qualquer conversa — de forma curta, útil e direta.

### Passo 2: Envie a resposta via script permanente
Execute o seguinte comando, substituindo \`RESPOSTA_AQUI\` pelo texto da sua resposta:

\`\`\`bash
node .agents/skills/whatsapp-reply/scripts/reply.js "RESPOSTA_AQUI"
\`\`\`

> O script \`reply.js\` já cuida de tudo: conecta ao WebSocket, lê o último chatId do inbox e envia a mensagem. Não precisa criar arquivos temporários.

## 📢 Mantenha o WhatsApp informado

O usuário está no WhatsApp e **NÃO VÊ** o chat do IDE. Por isso:

- **Para tarefas rápidas**: envie a resposta final diretamente.
- **Para tarefas longas** (compilar, debugar, pesquisar, etc.): envie **atualizações de progresso** ao WhatsApp ao longo do trabalho, assim como faria no chat do IDE. Exemplos:
  - \`"⏳ Analisando o código..."\` — no início
  - \`"🔧 Encontrei o problema, corrigindo..."\` — durante
  - \`"✅ Pronto! O bug foi corrigido em arquivo.ts"\` — no final
- Pode enviar **várias mensagens** ao longo da tarefa, reutilizando o mesmo comando acima.

### Formato da resposta no WhatsApp
O bridge automaticamente adiciona o prefixo \`*Cappy*\` antes da mensagem. Não adicione esse prefixo manualmente.

## Arquitetura do Fluxo

\`\`\`
WhatsApp → Bridge (porta 9090) → persistInbox() → sendPromptToAgentPanel → IDE AI
IDE AI → WebSocket (porta 9090) → handleClientMessage(type:'response') → whatsapp.sendMessage() → WhatsApp
\`\`\`

## Arquivos Relevantes

- **Bridge**: \`src/nivel2/infrastructure/bridge/cappy-bridge.ts\`
- **Bootstrap**: \`src/nivel1/adapters/vscode/bootstrap/ExtensionBootstrap.ts\`
- **Inbox**: \`.cappy/whatsapp-inbox/*.json\` (formato: \`{ text, chatId, timestamp, project }\`)
- **Workflow**: \`.agents/workflows/whatsapp-reply.md\`
`;

const REPLY_JS = `#!/usr/bin/env node
/**
 * Script para enviar respostas ao WhatsApp via WebSocket do bridge Cappy.
 * 
 * Uso: node .agents/skills/whatsapp-reply/scripts/reply.js "Sua mensagem aqui"
 * 
 * O script:
 * 1. Lê o último chatId do inbox (.cappy/whatsapp-inbox/)
 * 2. Conecta ao WebSocket do bridge (porta 9090)
 * 3. Envia a mensagem como type:'response'
 */
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const message = process.argv[2];
if (!message) {
  console.error('Uso: node reply.js "mensagem"');
  process.exit(1);
}

// Resolve o root do projeto de duas formas: __dirname (relativo ao script) ou cwd
const projectRootFromDir = path.resolve(__dirname, '..', '..', '..', '..');
const projectRootFromCwd = process.cwd();

// Usa __dirname primeiro; cai para cwd se inbox não existir lá
function findInboxDir() {
  const fromDir = path.join(projectRootFromDir, '.cappy', 'whatsapp-inbox');
  if (fs.existsSync(fromDir)) return fromDir;

  const fromCwd = path.join(projectRootFromCwd, '.cappy', 'whatsapp-inbox');
  if (fs.existsSync(fromCwd)) return fromCwd;

  return null;
}

const inboxDir = findInboxDir();
if (!inboxDir) {
  console.error('Inbox não encontrado em nenhum caminho conhecido.');
  console.error('  Tentou:', path.join(projectRootFromDir, '.cappy', 'whatsapp-inbox'));
  console.error('  Tentou:', path.join(projectRootFromCwd, '.cappy', 'whatsapp-inbox'));
  process.exit(1);
}

const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.json')).sort();
if (!files.length) {
  console.error('Sem mensagens pendentes no inbox');
  process.exit(1);
}

const last = JSON.parse(fs.readFileSync(path.join(inboxDir, files[files.length - 1]), 'utf-8'));
const chatId = last.chatId;
const project = last.project || 'cappy';

// Conecta ao bridge e envia
const ws = new WebSocket('ws://127.0.0.1:9090');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'response',
    project,
    text: message,
    chatId,
    timestamp: Date.now()
  }));
  console.log('Resposta enviada ao WhatsApp');
  setTimeout(() => { ws.close(); process.exit(0); }, 500);
});

ws.on('error', e => {
  console.error('Erro ao conectar ao bridge:', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('Timeout ao conectar ao bridge (8s)');
  process.exit(1);
}, 8000);
`;

const WORKFLOW_MD = `---
description: Responder mensagem do WhatsApp via chat do IDE
---

# WhatsApp Reply Workflow

> **Antes de tudo**, leia a skill em \`.agents/skills/whatsapp-reply/SKILL.md\` para entender o mecanismo de reply.

Quando uma mensagem do WhatsApp chega no Cappy, ela é encaminhada ao chat do IDE com o formato:
\`[WhatsApp de <projeto>]: <mensagem>\`

## Passos

1. Leia a mensagem que chegou do WhatsApp (está no formato acima)
2. Processe a mensagem normalmente — responda como faria no chat
3. Ao final, envie a resposta de volta ao WhatsApp via **WebSocket na porta 9090**, conforme documentado na skill \`whatsapp-reply\`.

// turbo
\`\`\`
node .agents/skills/whatsapp-reply/scripts/reply.js "<sua_resposta>"
\`\`\`

## Notas

- Substitua \`<sua_resposta>\` pelo texto real da resposta
- A mensagem pendente fica salva em \`.cappy/whatsapp-inbox/<timestamp>.json\`
- O bridge adiciona automaticamente o prefixo \`*Cappy*\` — não duplique
- **\`code --command\` NÃO funciona no Antigravity IDE** — sempre use WebSocket direto
`;

// ─── File Definitions ────────────────────────────────────────────────────────

interface SkillFile {
  /** Relative path from workspace root */
  relativePath: string;
  /** File content */
  content: string;
}

const SKILL_FILES: SkillFile[] = [
  {
    relativePath: '.agents/skills/whatsapp-reply/SKILL.md',
    content: SKILL_MD,
  },
  {
    relativePath: '.agents/skills/whatsapp-reply/scripts/reply.js',
    content: REPLY_JS,
  },
  {
    relativePath: '.agents/workflows/whatsapp-reply.md',
    content: WORKFLOW_MD,
  },
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Creates or updates all agent skill files in the workspace.
 * Called on every extension activation to ensure files are always up-to-date.
 */
export function setupAgentSkills(workspaceRoot: string): void {
  let written = 0;

  for (const file of SKILL_FILES) {
    const fullPath = path.join(workspaceRoot, file.relativePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Always overwrite to keep up-to-date
    fs.writeFileSync(fullPath, file.content, 'utf-8');
    written++;
  }

  console.log(`  ✅ Agent skills setup: ${written} files written to .agents/`);
}
