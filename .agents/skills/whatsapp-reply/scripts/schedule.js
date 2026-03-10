#!/usr/bin/env node
/**
 * Script para agendar tarefas no CronScheduler via WebSocket do bridge Cappy.
 *
 * Uso:
 *   node schedule.js --name "Lembrete" --delay 5 --message "Hora de dormir!"
 *   node schedule.js --name "Build" --workflow "/build" --interval 30
 *
 * Parâmetros:
 *   --name       Nome da tarefa (obrigatório)
 *   --message    Mensagem WhatsApp (cria workflow tipo "whatsapp:mensagem")
 *   --workflow   Workflow a executar (ex: "/build")
 *   --delay      Delay em minutos para tarefa one-shot (default: 1)
 *   --interval   Intervalo em minutos para tarefa recorrente
 *   --no-notify  Não notificar via WhatsApp
 */
const WebSocket = require('ws');

// ── Parse arguments ──
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'no-notify') {
      args.noNotify = true;
      continue;
    }
    const val = argv[++i];
    if (val !== undefined) args[key] = val;
  }
  return args;
}

const args = parseArgs(process.argv);

if (!args.name) {
  console.error('Uso: node schedule.js --name "Nome" --message "Texto" [--delay MIN]');
  console.error('  ou: node schedule.js --name "Nome" --workflow "/build" [--interval MIN]');
  process.exit(1);
}

// Determine workflow and run mode
let workflow, runMode, intervalMinutes, delayMinutes;

if (args.message) {
  // WhatsApp reminder: special "whatsapp:" prefix
  workflow = `whatsapp:${args.message}`;
  runMode = 'once';
  delayMinutes = parseInt(args.delay || '1', 10);
  intervalMinutes = delayMinutes;
} else if (args.workflow) {
  workflow = args.workflow;
  if (args.interval) {
    runMode = 'recurring';
    intervalMinutes = parseInt(args.interval, 10);
  } else {
    runMode = 'once';
    delayMinutes = parseInt(args.delay || '1', 10);
    intervalMinutes = delayMinutes;
  }
} else {
  console.error('Erro: especifique --message ou --workflow');
  process.exit(1);
}

const taskData = {
  name: args.name,
  workflow,
  intervalMinutes,
  runMode,
  delayMinutes,
  notifyWhatsApp: !args.noNotify,
  executionMode: 'new_chat',
};

// ── Connect to bridge and send ──
const ws = new WebSocket('ws://127.0.0.1:9090');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'scheduler_add',
    data: taskData,
    timestamp: Date.now(),
  }));
  console.log(`Tarefa "${args.name}" enviada ao scheduler`);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'scheduler_add') {
      if (msg.data && msg.data.success) {
        const task = msg.data.task;
        const label = task.runMode === 'once'
          ? `em ${task.delayMinutes || task.intervalMinutes}min`
          : `a cada ${task.intervalMinutes}min`;
        console.log(`✅ Tarefa agendada: "${task.name}" (${label})`);
      } else {
        console.error(`❌ Erro ao agendar: ${msg.data?.error || 'desconhecido'}`);
      }
      setTimeout(() => { ws.close(); process.exit(0); }, 300);
    }
  } catch {
    // ignore non-JSON or irrelevant messages
  }
});

ws.on('error', (e) => {
  console.error('Erro ao conectar ao bridge:', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('Timeout ao conectar ao bridge (8s)');
  process.exit(1);
}, 8000);
