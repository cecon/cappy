---
description: Responder mensagem do WhatsApp via chat do IDE
---

# WhatsApp Reply Workflow

> **Antes de tudo**, leia a skill em `.agents/skills/whatsapp-reply/SKILL.md` para entender o mecanismo de reply.

Quando uma mensagem do WhatsApp chega no Cappy, ela é encaminhada ao chat do IDE com o formato:
`[WhatsApp de <projeto>]: <mensagem>`

## Passos

1. Leia a mensagem que chegou do WhatsApp (está no formato acima)
2. Processe a mensagem normalmente — responda como faria no chat
3. Ao final, envie a resposta de volta ao WhatsApp via **WebSocket na porta 9090**, conforme documentado na skill `whatsapp-reply`.

// turbo
```
node .agents/skills/whatsapp-reply/scripts/reply.js "<sua_resposta>"
```

## Notas

- Substitua `<sua_resposta>` pelo texto real da resposta
- A mensagem pendente fica salva em `.cappy/whatsapp-inbox/<timestamp>.json`
- O bridge adiciona automaticamente o prefixo `*Cappy*` — não duplique
- **`code --command` NÃO funciona no Antigravity IDE** — sempre use WebSocket direto
