/**
 * Teste standalone do Baileys — roda fora da extensão VS Code.
 * Usage: node test-whatsapp.mjs
 */

import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs';

const AUTH_DIR = path.join(process.cwd(), '.cappy/test-auth');

// Limpa auth para forçar novo QR
if (fs.existsSync(AUTH_DIR)) {
  fs.rmSync(AUTH_DIR, { recursive: true });
}
fs.mkdirSync(AUTH_DIR, { recursive: true });

console.log('🦫 Teste WhatsApp Baileys');
console.log('📁 Auth dir:', AUTH_DIR);

// Fetch the latest WhatsApp Web version
let version;
try {
  const result = await fetchLatestBaileysVersion();
  version = result.version;
  console.log('📦 WA version:', version);
} catch (e) {
  version = [2, 3000, 1015901307];
  console.log('⚠️ Using fallback version:', version);
}

console.log('');

const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

const sock = makeWASocket({
  auth: state,
  version,
  printQRInTerminal: false,
  connectTimeoutMs: 30_000,
  browser: ['Cappy', 'Chrome', '120.0.0'],
});

sock.ev.on('connection.update', (update) => {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    console.log('\n📱 QR CODE GERADO!\n');
    console.log('Escaneie este QR code com WhatsApp:');
    console.log('WhatsApp → Configurações → Dispositivos Conectados → Conectar\n');
    // Print QR as text
    console.log(qr);
    console.log('');
  }

  if (connection === 'close') {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const reason = lastDisconnect?.error?.message || 'unknown';
    console.log(`❌ Desconectado. Status: ${statusCode}, Razão: ${reason}`);
    
    if (statusCode !== DisconnectReason.loggedOut) {
      console.log('🔄 Tentando novamente em 5s...');
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    }
  }

  if (connection === 'open') {
    console.log('✅ CONECTADO! JID:', sock.user?.id);
    console.log('🎉 WhatsApp funcionando perfeitamente!');
    console.log('Ctrl+C para encerrar');
  }
});

sock.ev.on('creds.update', saveCreds);

sock.ev.on('messages.upsert', (m) => {
  const msg = m.messages[0];
  if (!msg.key.fromMe && m.type === 'notify') {
    console.log('📩 Mensagem:', msg.message?.conversation || '[media]');
  }
});

process.on('SIGINT', () => {
  console.log('\n👋 Encerrando...');
  sock.end(undefined);
  process.exit(0);
});
