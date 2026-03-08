#!/usr/bin/env node
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
