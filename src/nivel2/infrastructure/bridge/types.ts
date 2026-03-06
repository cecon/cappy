/**
 * @fileoverview Bridge types for Cappy WhatsApp ↔ VS Code communication
 * @module bridge/types
 */

/**
 * Role of this VS Code instance in the bridge network
 */
export type BridgeRole = 'server' | 'client';

/**
 * Message types flowing through the bridge
 */
export type BridgeMessageType =
  | 'register'        // Client registers its project
  | 'unregister'      // Client disconnects
  | 'chat'            // Chat message (WhatsApp → VS Code or VS Code → WhatsApp)
  | 'response'        // Response from VS Code back to WhatsApp
  | 'status'          // Status update (build, test, etc.)
  | 'command'         // Special commands (/projetos, /status, etc.)
  | 'projects_list';  // List of connected projects

/**
 * A message flowing through the bridge
 */
export interface BridgeMessage {
  type: BridgeMessageType;
  /** Target project name (e.g., "erp-dsl") — used for routing */
  project?: string;
  /** The actual message content */
  text?: string;
  /** WhatsApp chat ID (for replies) */
  chatId?: string;
  /** Additional data */
  data?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/**
 * A connected project registration
 */
export interface ProjectRegistration {
  /** Project/workspace name */
  name: string;
  /** Workspace root path */
  path: string;
  /** When this project connected */
  connectedAt: number;
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Bridge configuration
 */
export interface BridgeConfig {
  /** WebSocket port for inter-VS Code communication */
  port: number;
  /** Path to store WhatsApp auth state */
  authDir: string;
  /** Owner's WhatsApp chat ID (for receiving messages) */
  ownerChatId?: string;
}

/**
 * WhatsApp connection status
 */
export type WhatsAppStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

/**
 * Events emitted by the bridge
 */
export interface BridgeEvents {
  onWhatsAppMessage: (text: string, chatId: string) => void;
  onWhatsAppStatus: (status: WhatsAppStatus) => void;
  onProjectMessage: (project: string, text: string) => void;
  onQRCode: (qr: string) => void;
}

export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  port: 9090,
  authDir: '.cappy/whatsapp-auth',
};
