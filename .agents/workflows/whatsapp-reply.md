---
description: Responder mensagem do WhatsApp via chat do IDE
---

# WhatsApp Reply Workflow

Quando uma mensagem do WhatsApp chega no Cappy, ela é encaminhada ao chat do IDE com o formato:
`@cappy [WhatsApp de <projeto>]: <mensagem>`

## Passos

1. Leia a mensagem que chegou do WhatsApp (está no formato acima)
2. Processe a mensagem normalmente — responda como faria no chat
3. Ao final, envie a resposta de volta ao WhatsApp executando o comando:

// turbo
```
echo "<sua_resposta>" | xargs -0 -I {} code --command "cappy.whatsapp.reply" "{}"
```

Ou, se preferir, use o comando do VS Code diretamente na paleta:
- `Cappy: Reply to WhatsApp` — ele vai pedir o texto da resposta

## Notas

- A mensagem pendente fica salva em `.cappy/whatsapp-inbox/<timestamp>.json`
- Só existe uma mensagem pendente por vez
- Após o reply, a mensagem pendente é limpa automaticamente
