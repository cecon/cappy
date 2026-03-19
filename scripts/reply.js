#!/usr/bin/env node
/**
 * Cappy WhatsApp Reply Script — Bundled inside the extension.
 *
 * Usage: node "<extensionPath>/scripts/reply.js" "Your message here"
 *
 * This script:
 * 1. Reads the last chatId from the workspace inbox (.cappy/whatsapp-inbox/)
 * 2. Connects to the Cappy bridge WebSocket (port 9090)
 * 3. Sends the message as type:'response'
 *
 * The inbox is always at <workspaceRoot>/.cappy/whatsapp-inbox/
 * The AI runs this from the workspace root, so process.cwd() is the workspace.
 */
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const message = process.argv[2];
if (!message) {
  console.error('Usage: node reply.js "message"');
  process.exit(1);
}

// The inbox lives in the workspace root (where the AI is running from)
const inboxDir = path.join(process.cwd(), '.cappy', 'whatsapp-inbox');

if (!fs.existsSync(inboxDir)) {
  console.error('Inbox not found:', inboxDir);
  console.error('Make sure you are running from the project workspace root.');
  process.exit(1);
}

const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.json')).sort();
if (!files.length) {
  console.error('No pending messages in inbox');
  process.exit(1);
}

const last = JSON.parse(fs.readFileSync(path.join(inboxDir, files[files.length - 1]), 'utf-8'));
const chatId = last.chatId;
const project = last.project || 'cappy';

// Connect to the bridge and send
const ws = new WebSocket('ws://127.0.0.1:9090');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'response',
    project,
    text: message,
    chatId,
    timestamp: Date.now()
  }));
  console.log('Reply sent to WhatsApp');
  setTimeout(() => { ws.close(); process.exit(0); }, 500);
});

ws.on('error', e => {
  console.error('Error connecting to bridge:', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('Timeout connecting to bridge (8s)');
  process.exit(1);
}, 8000);
