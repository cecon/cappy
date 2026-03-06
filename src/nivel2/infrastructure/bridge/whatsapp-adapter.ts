/**
 * @fileoverview WhatsApp adapter using Baileys
 * @module bridge/whatsapp-adapter
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as vscode from 'vscode';
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
 * 
 * Message filtering modes (cappy.bridge.chatFilter):
 * - "self": Only process messages you send to yourself (safest)
 * - "group": Only process messages from a specific WhatsApp group
 * - "allow_all": Process all messages (not recommended)
 */
export class WhatsAppAdapter {
  private socket: WASocket | null = null;
  private status: WhatsAppStatus = 'disconnected';
  private authDir: string;
  private events: WhatsAppAdapterEvents;
  private ownJid: string | null = null;

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
        // Store our own JID for self-chat filtering
        this.ownJid = sock.user?.id || null;
        console.log(`🦫 [WhatsApp] Connected! Own JID: ${this.ownJid}`);
        this.setStatus('connected');
      }
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', ({ messages, type }: any) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '';

        if (!text.trim()) continue;

        const chatId = msg.key.remoteJid || '';
        const pushName = msg.pushName || 'Unknown';
        const fromMe = msg.key.fromMe === true;

        // Apply message filter based on config
        if (!this.shouldProcessMessage(chatId, fromMe, msg)) {
          continue;
        }

        console.log(`🦫 [WhatsApp] Message from ${pushName}: ${text}`);
        this.events.onMessage(text, chatId, pushName);
      }
    });
  }

  /**
   * Check if a message should be processed based on the chat filter config.
   * 
   * Modes:
   * - "self": Only messages from self-chat (you → you) 
   * - "group": Only messages from a specific group
   * - "allow_all": All messages
   */
  private shouldProcessMessage(chatId: string, fromMe: boolean, _msg: any): boolean {
    const config = vscode.workspace.getConfiguration('cappy.bridge');
    const filter = config.get<string>('chatFilter', 'self');

    switch (filter) {
      case 'self': {
        // Self-chat: message must be fromMe AND the chat must be our own JID
        // In WhatsApp, self-chat remoteJid is your own number
        if (!fromMe) return false;
        
        // Check if chatId matches our own JID (strip :XX suffix from JID)
        if (this.ownJid) {
          const ownNumber = this.ownJid.split(':')[0].split('@')[0];
          const chatNumber = chatId.split('@')[0];
          return chatNumber === ownNumber;
        }
        
        // Fallback: accept fromMe if we don't know our JID yet
        return true;
      }

      case 'group': {
        // Only process messages from a specific group
        if (!chatId.endsWith('@g.us')) return false;
        
        // Note: group name matching requires fetching group metadata
        // For now, we accept any group message and the bridge can filter by name
        return true;
      }

      case 'allow_all':
        // Process everything (except our own non-self messages to avoid loops)
        if (fromMe && !chatId.includes(this.ownJid?.split(':')[0]?.split('@')[0] || '')) {
          return false; // Skip messages WE send to others
        }
        return !fromMe; // Accept messages from others

      default:
        return false;
    }
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

  private setStatus(status: WhatsAppStatus): void {
    this.status = status;
    this.events.onStatusChange(status);
  }
}

