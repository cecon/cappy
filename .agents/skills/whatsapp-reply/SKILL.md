---
name: whatsapp-reply
description: Como enviar respostas de volta ao WhatsApp via o bridge WebSocket do Cappy
---

# WhatsApp Reply — Skill de Resposta

## Contexto

O Cappy possui um bridge WebSocket rodando na porta **9090** que conecta o WhatsApp ao IDE.
Quando uma mensagem chega do WhatsApp, ela é salva em `.cappy/whatsapp-inbox/<timestamp>.json` e encaminhada ao chat do IDE no formato:

```
[WhatsApp de <projeto>]: <mensagem>
```

Ao receber essa mensagem, você **DEVE** responder de volta ao WhatsApp usando a técnica abaixo.

## ⚠️ IMPORTANTE: `code --command` NÃO funciona no Antigravity

O Antigravity IDE **não** suporta a flag `--command` na CLI. A única forma confiável de enviar mensagens ao WhatsApp é conectando diretamente ao **WebSocket do bridge** na porta 9090.

## Como Responder

### Passo 1: Processe a mensagem normalmente
Responda como faria em qualquer conversa — de forma curta, útil e direta.

### Passo 2: Envie a resposta via script permanente
Execute o seguinte comando, substituindo `RESPOSTA_AQUI` pelo texto da sua resposta:

```bash
node .agents/skills/whatsapp-reply/scripts/reply.js "RESPOSTA_AQUI"
```

> O script `reply.js` já cuida de tudo: conecta ao WebSocket, lê o último chatId do inbox e envia a mensagem. Não precisa criar arquivos temporários.

## 📢 Mantenha o WhatsApp informado

O usuário está no WhatsApp e **NÃO VÊ** o chat do IDE. Por isso:

- **Para tarefas rápidas**: envie a resposta final diretamente.
- **Para tarefas longas** (compilar, debugar, pesquisar, etc.): envie **atualizações de progresso** ao WhatsApp ao longo do trabalho, assim como faria no chat do IDE. Exemplos:
  - `"⏳ Analisando o código..."` — no início
  - `"🔧 Encontrei o problema, corrigindo..."` — durante
  - `"✅ Pronto! O bug foi corrigido em arquivo.ts"` — no final
- Pode enviar **várias mensagens** ao longo da tarefa, reutilizando o mesmo comando acima.

### Formato da resposta no WhatsApp
O bridge automaticamente adiciona o prefixo `*Cappy*` antes da mensagem. Não adicione esse prefixo manualmente.

## Arquitetura do Fluxo

```
WhatsApp → Bridge (porta 9090) → persistInbox() → sendPromptToAgentPanel → IDE AI
IDE AI → WebSocket (porta 9090) → handleClientMessage(type:'response') → whatsapp.sendMessage() → WhatsApp
```

## Arquivos Relevantes

- **Bridge**: `src/nivel2/infrastructure/bridge/cappy-bridge.ts`
- **Bootstrap**: `src/nivel1/adapters/vscode/bootstrap/ExtensionBootstrap.ts`
- **Inbox**: `.cappy/whatsapp-inbox/*.json` (formato: `{ text, chatId, timestamp, project }`)
- **Workflow**: `.agents/workflows/whatsapp-reply.md`
