/**
 * @fileoverview WhatsApp adapter using Baileys
 * @module bridge/whatsapp-adapter
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { WhatsAppStatus } from './types';

// Baileys is ESM-only, so we use dynamic import. Socket type is any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WASocket = any;

export interface WhatsAppAdapterEvents {
  onMessage: (text: string, chatId: string, pushName: string) => void;
  onStatusChange: (status: WhatsAppStatus) => void;
  onQRCode: (qr: string) => void;
}

/**
 * WhatsApp adapter using Baileys library.
 * Handles connection, authentication (QR code), sending and receiving messages.
 */
export class WhatsAppAdapter {
  private socket: WASocket | null = null;
  private status: WhatsAppStatus = 'disconnected';
  private authDir: string;
  private events: WhatsAppAdapterEvents;
  private ownerChatId: string | null = null;

  constructor(authDir: string, events: WhatsAppAdapterEvents) {
    this.authDir = authDir;
    this.events = events;
  }

  /**
   * Connect to WhatsApp. Shows QR code for authentication.
   */
  async connect(workspaceRoot: string): Promise<void> {
    const fullAuthDir = path.join(workspaceRoot, this.authDir);

    // Ensure auth directory exists
    if (!fs.existsSync(fullAuthDir)) {
      fs.mkdirSync(fullAuthDir, { recursive: true });
    }

    this.setStatus('connecting');

    // Dynamic import for ESM module
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, DisconnectReason } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(fullAuthDir);

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    }) as unknown as WASocket;

    const sock = this.socket as any;

    // Handle connection updates
    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.setStatus('qr_ready');
        this.events.onQRCode(qr);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log('🦫 [WhatsApp] Connection closed. Reconnect:', shouldReconnect);
        this.setStatus('disconnected');

        if (shouldReconnect) {
          setTimeout(() => this.connect(workspaceRoot), 3000);
        }
      }

      if (connection === 'open') {
        console.log('🦫 [WhatsApp] Connected successfully!');
        this.setStatus('connected');
      }
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', ({ messages, type }: any) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '';

        if (!text.trim()) continue;

        const chatId = msg.key.remoteJid || '';
        const pushName = msg.pushName || 'Unknown';

        if (!this.ownerChatId) {
          this.ownerChatId = chatId;
          console.log(`🦫 [WhatsApp] Owner set to: ${pushName} (${chatId})`);
        }

        console.log(`🦫 [WhatsApp] Message from ${pushName}: ${text}`);
        this.events.onMessage(text, chatId, pushName);
      }
    });
  }

  /**
   * Send a text message to a WhatsApp chat
   */
  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.socket || this.status !== 'connected') {
      console.warn('🦫 [WhatsApp] Cannot send — not connected');
      return;
    }

    await (this.socket as any).sendMessage(chatId, { text });
  }

  /**
   * Disconnect from WhatsApp
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      (this.socket as any).end(undefined);
      this.socket = null;
    }
    this.setStatus('disconnected');
    console.log('🦫 [WhatsApp] Disconnected');
  }

  /**
   * Get current connection status
   */
  getStatus(): WhatsAppStatus {
    return this.status;
  }

  /**
   * Get the owner's chat ID
   */
  getOwnerChatId(): string | null {
    return this.ownerChatId;
  }

  private setStatus(status: WhatsAppStatus): void {
    this.status = status;
    this.events.onStatusChange(status);
  }
}

