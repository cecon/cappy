---
description: Como agendar tarefas automáticas (cron) no Cappy
---

# /schedule — Agendar Tarefas Automáticas

O Cappy permite agendar workflows para execução automática em intervalos configuráveis.

## Pelo Dashboard (Recomendado)

1. Abra o painel lateral do Cappy (ícone na barra de atividade)
2. Na seção **Tarefas Agendadas**, clique em **+ Nova Tarefa**
3. Preencha:
   - **Nome**: Um nome descritivo (ex: "Build Automático")
   - **Workflow**: O caminho do workflow (ex: `/build`)
   - **Intervalo**: Tempo em minutos entre execuções
   - **Notificar WhatsApp**: Se deseja receber notificação a cada execução
4. Clique em **Criar Tarefa**

## Gerenciamento

No dashboard você pode:
- ▶️ **Executar agora**: Dispara a tarefa imediatamente
- ⏸️ **Pausar/Ativar**: Alterna entre ativo e pausado
- ❌ **Remover**: Remove a tarefa permanentemente

## Como Funciona

- As tarefas são salvas em `.cappy/scheduled-tasks.json` no workspace
- Cada tarefa usa `setInterval` para disparar no intervalo configurado
- O despacho é feito via `antigravity.sendPromptToAgentPanel`
- O VS Code precisa estar aberto para as tarefas executarem
- Resultados podem ser notificados via WhatsApp

## Exemplo de scheduled-tasks.json

```json
{
  "tasks": [
    {
      "id": "uuid-aqui",
      "name": "Build Automático",
      "workflow": "/build",
      "intervalMinutes": 30,
      "enabled": true,
      "notifyWhatsApp": true,
      "lastRun": null,
      "lastStatus": null,
      "createdAt": "2026-03-08T19:00:00Z"
    }
  ]
}
```

## Via Terminal (para o agente AI)

Quando o agente precisa criar tarefas programaticamente (ex: recebendo pedido via WhatsApp), use o script `schedule.js`:

```bash
# Lembrete WhatsApp (one-shot, envia mensagem direto)
node .agents/skills/whatsapp-reply/scripts/schedule.js --name "Lembrete" --delay 5 --message "Hora de dormir!"

# Workflow recorrente
node .agents/skills/whatsapp-reply/scripts/schedule.js --name "Build Auto" --workflow "/build" --interval 30

# Workflow one-shot
node .agents/skills/whatsapp-reply/scripts/schedule.js --name "Deploy" --workflow "/publish" --delay 10
```

O script conecta ao WebSocket (porta 9090) e cria a tarefa no CronScheduler, que aparece automaticamente no dashboard.

