/**
 * @fileoverview ConnectionManager — WebSocket server/client election and lifecycle
 * @module bridge/ConnectionManager
 *
 * Owns: port binding, server/client auto-election, socket map, raw send/broadcast.
 * Does NOT know about WhatsApp, routing, or message semantics.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { BridgeMessage, BridgeRole } from './types';

type ClientConnectHandler    = (project: string, path: string, socket: WebSocket) => void;
type ClientDisconnectHandler = (project: string) => void;
type ClientMessageHandler    = (socket: WebSocket, msg: BridgeMessage) => void;
type ServerMessageHandler    = (msg: BridgeMessage) => void;
type ServerCloseHandler      = () => void;

export class ConnectionManager {
  private role: BridgeRole | null = null;
  private wss: WebSocketServer | null = null;
  private clientSockets = new Map<string, WebSocket>(); // project → socket (server-side)
  private clientSocket: WebSocket | null = null;         // our socket when we are a client

  // Callbacks
  private onClientConnectCb:    ClientConnectHandler    | null = null;
  private onClientDisconnectCb: ClientDisconnectHandler | null = null;
  private onClientMessageCb:    ClientMessageHandler    | null = null;
  private onServerMessageCb:    ServerMessageHandler    | null = null;
  private onServerCloseCb:      ServerCloseHandler      | null = null;

  // ── Event registration ────────────────────────────────────────────

  onClientConnect(cb: ClientConnectHandler):       void { this.onClientConnectCb    = cb; }
  onClientDisconnect(cb: ClientDisconnectHandler): void { this.onClientDisconnectCb = cb; }
  onClientMessage(cb: ClientMessageHandler):       void { this.onClientMessageCb    = cb; }
  onServerMessage(cb: ServerMessageHandler):       void { this.onServerMessageCb    = cb; }
  onServerClose(cb: ServerCloseHandler):           void { this.onServerCloseCb      = cb; }

  // ── Election ──────────────────────────────────────────────────────

  /**
   * Try to bind `port` as the WebSocket server.
   * Resolves if successful (this instance is now the SERVER).
   * Rejects if port is already in use (caller should try connectAsClient).
   */
  async tryBecomeServer(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port });

      this.wss.on('listening', () => {
        this.role = 'server';
        this._attachServerHandlers();
        resolve();
      });

      this.wss.on('error', (err) => {
        this.wss = null;
        reject(err);
      });
    });
  }

  /**
   * Connect to an existing server on `port`.
   * Resolves when the WebSocket handshake is complete.
   */
  async connectAsClient(port: number, projectName: string, workspaceRoot: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.clientSocket = new WebSocket(`ws://localhost:${port}`);

      this.clientSocket.on('open', () => {
        this.role = 'client';
        // Register our project with the server immediately
        const registerMsg: BridgeMessage = {
          type: 'register',
          project: projectName,
          text: workspaceRoot,
          timestamp: Date.now(),
        };
        this.clientSocket!.send(JSON.stringify(registerMsg));
        resolve();
      });

      this.clientSocket.on('message', (data) => {
        try {
          const msg: BridgeMessage = JSON.parse(data.toString());
          this.onServerMessageCb?.(msg);
        } catch (err) {
          console.error('[ConnectionManager] Invalid message from server:', err);
        }
      });

      this.clientSocket.on('close', () => {
        console.log('[ConnectionManager] Disconnected from server');
        this.clientSocket = null;
        this.onServerCloseCb?.();
      });

      this.clientSocket.on('error', reject);
    });
  }

  // ── Send helpers ──────────────────────────────────────────────────

  sendToServer(msg: BridgeMessage): boolean {
    if (this.clientSocket?.readyState === WebSocket.OPEN) {
      this.clientSocket.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  sendToClient(project: string, msg: BridgeMessage): boolean {
    const socket = this.clientSockets.get(project.toLowerCase());
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  broadcastToClients(msg: BridgeMessage): void {
    const payload = JSON.stringify(msg);
    for (const socket of this.clientSockets.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  // ── Queries ───────────────────────────────────────────────────────

  getRole(): BridgeRole | null { return this.role; }

  hasClient(project: string): boolean {
    const s = this.clientSockets.get(project.toLowerCase());
    return !!s && s.readyState === WebSocket.OPEN;
  }

  isConnectedToServer(): boolean {
    return !!this.clientSocket && this.clientSocket.readyState === WebSocket.OPEN;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  stop(): void {
    if (this.role === 'server') {
      for (const socket of this.clientSockets.values()) {
        try { socket.close(); } catch { /* ignore */ }
      }
      this.clientSockets.clear();
      this.wss?.close();
      this.wss = null;
    } else if (this.role === 'client') {
      this.clientSocket?.close();
      this.clientSocket = null;
    }
    this.role = null;
  }

  // ── Private ───────────────────────────────────────────────────────

  private _attachServerHandlers(): void {
    this.wss!.on('connection', (socket) => {
      socket.on('message', (data) => {
        try {
          const msg: BridgeMessage = JSON.parse(data.toString());

          // Track socket for register messages
          if (msg.type === 'register' && msg.project) {
            this.clientSockets.set(msg.project.toLowerCase(), socket);
            this.onClientConnectCb?.(msg.project, msg.text ?? '', socket);
          }

          this.onClientMessageCb?.(socket, msg);
        } catch (err) {
          console.error('[ConnectionManager] Invalid message from client:', err);
        }
      });

      socket.on('close', () => {
        for (const [name, s] of this.clientSockets) {
          if (s === socket) {
            this.clientSockets.delete(name);
            this.onClientDisconnectCb?.(name);
            break;
          }
        }
      });
    });
  }
}
