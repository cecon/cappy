#!/usr/bin/env node
/**
 * Script para enviar mídia (imagem/vídeo) ao WhatsApp via WebSocket do bridge Cappy.
 * 
 * Uso: node reply-media.js "/caminho/para/arquivo.png" "caption opcional"
 * 
 * O script:
 * 1. Lê o último chatId do inbox (.cappy/whatsapp-inbox/)
 * 2. Detecta o tipo de mídia pela extensão do arquivo
 * 3. Conecta ao WebSocket do bridge (porta 9090)
 * 4. Envia a mensagem como type:'media'
 */
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const mediaPath = process.argv[2];
const caption = process.argv[3] || '';

if (!mediaPath) {
  console.error('Uso: node reply-media.js "/caminho/para/arquivo.png" "caption opcional"');
  process.exit(1);
}

// Resolve to absolute path
const absoluteMediaPath = path.resolve(mediaPath);

if (!fs.existsSync(absoluteMediaPath)) {
  console.error(`Arquivo não encontrado: ${absoluteMediaPath}`);
  process.exit(1);
}

// Detect media type from extension
const ext = path.extname(absoluteMediaPath).toLowerCase();
const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const videoExts = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];

let mediaType;
if (imageExts.includes(ext)) {
  mediaType = 'image';
} else if (videoExts.includes(ext)) {
  mediaType = 'video';
} else {
  console.error(`Extensão não suportada: ${ext}`);
  console.error('Suportadas: ' + [...imageExts, ...videoExts].join(', '));
  process.exit(1);
}

// Resolve project root
const projectRootFromDir = path.resolve(__dirname, '..', '..', '..', '..');
const projectRootFromCwd = process.cwd();

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

// Connect to bridge and send
const ws = new WebSocket('ws://127.0.0.1:9090');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'media',
    project,
    mediaPath: absoluteMediaPath,
    mediaType,
    caption: caption || undefined,
    chatId,
    timestamp: Date.now()
  }));
  console.log(`Mídia enviada ao WhatsApp (${mediaType}: ${path.basename(absoluteMediaPath)})`);
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
