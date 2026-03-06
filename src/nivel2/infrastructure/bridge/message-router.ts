/**
 * @fileoverview Message router — routes WhatsApp messages to the correct VS Code project
 * @module bridge/message-router
 */

import type { ProjectRegistration } from './types';

/**
 * Routes messages between WhatsApp and connected VS Code projects.
 * Supports @project prefix for targeting and /commands for control.
 */
export class MessageRouter {
  /** Connected projects indexed by name */
  private projects = new Map<string, ProjectRegistration>();
  /** Last active project for default routing */
  private lastActiveProject: string | null = null;

  /**
   * Register a project
   */
  registerProject(name: string, workspacePath: string): void {
    this.projects.set(name.toLowerCase(), {
      name,
      path: workspacePath,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    });

    if (!this.lastActiveProject) {
      this.lastActiveProject = name.toLowerCase();
    }

    console.log(`🦫 [Router] Project registered: ${name}`);
  }

  /**
   * Unregister a project
   */
  unregisterProject(name: string): void {
    this.projects.delete(name.toLowerCase());

    if (this.lastActiveProject === name.toLowerCase()) {
      this.lastActiveProject = this.projects.keys().next().value ?? null;
    }

    console.log(`🦫 [Router] Project unregistered: ${name}`);
  }

  /**
   * Parse an incoming message and determine the target project.
   *
   * Supports:
   * - `@project message` → routes to specific project
   * - `/projetos` → returns project list (command)
   * - `/status` → returns status (command)
   * - Regular message → routes to last active project
   *
   * @returns Parsed result with target project and clean message
   */
  parseMessage(rawText: string): ParsedMessage {
    const text = rawText.trim();

    // Handle /commands
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase();
      return {
        type: 'command',
        command: command.slice(1), // remove "/"
        text: text.slice(command.length).trim(),
        targetProject: null,
      };
    }

    // Handle @project prefix
    if (text.startsWith('@')) {
      const spaceIndex = text.indexOf(' ');
      if (spaceIndex > 0) {
        const projectName = text.slice(1, spaceIndex).toLowerCase();
        const message = text.slice(spaceIndex + 1).trim();

        // Check if project exists (try exact match or partial)
        const resolved = this.resolveProject(projectName);
        if (resolved) {
          this.lastActiveProject = resolved;
          this.touchProject(resolved);
          return {
            type: 'chat',
            command: null,
            text: message,
            targetProject: resolved,
          };
        }
      }
    }

    // Default: route to last active project
    if (this.lastActiveProject) {
      this.touchProject(this.lastActiveProject);
      return {
        type: 'chat',
        command: null,
        text,
        targetProject: this.lastActiveProject,
      };
    }

    // No project available
    return {
      type: 'error',
      command: null,
      text,
      targetProject: null,
    };
  }

  /**
   * Handle /commands and return response text
   */
  handleCommand(command: string): string {
    switch (command) {
      case 'projetos':
      case 'projects': {
        if (this.projects.size === 0) {
          return '🦫 Nenhum projeto conectado.';
        }
        const lines = ['📂 *Projetos conectados:*', ''];
        let i = 1;
        for (const [key, proj] of this.projects) {
          const isActive = key === this.lastActiveProject;
          const marker = isActive ? '✅' : '⚪';
          const ago = this.timeAgo(proj.lastActivity);
          lines.push(`${i}. ${marker} *${proj.name}* (ativo ${ago})`);
          i++;
        }
        return lines.join('\n');
      }

      case 'status': {
        const count = this.projects.size;
        const active = this.lastActiveProject
          ? this.projects.get(this.lastActiveProject)?.name || '?'
          : 'nenhum';
        return `🦫 *Cappy Status*\n\n📂 Projetos: ${count}\n🎯 Ativo: ${active}`;
      }

      case 'help':
      case 'ajuda': {
        return [
          '🦫 *Cappy - Comandos*',
          '',
          '`@projeto mensagem` — Envia pro projeto específico',
          '`/projetos` — Lista projetos conectados',
          '`/status` — Status do Cappy',
          '`/ajuda` — Este menu',
          '',
          'Sem prefixo, a mensagem vai pro último projeto ativo.',
        ].join('\n');
      }

      default:
        return `🦫 Comando desconhecido: /${command}\nDigite /ajuda para ver os comandos.`;
    }
  }

  /**
   * Get list of connected project names
   */
  getProjectNames(): string[] {
    return Array.from(this.projects.values()).map((p) => p.name);
  }

  /**
   * Check if a project is registered
   */
  hasProject(name: string): boolean {
    return this.projects.has(name.toLowerCase());
  }

  /**
   * Resolve a project name (supports partial matching)
   */
  private resolveProject(input: string): string | null {
    const lower = input.toLowerCase();

    // Exact match
    if (this.projects.has(lower)) return lower;

    // Partial match (starts with)
    for (const key of this.projects.keys()) {
      if (key.startsWith(lower)) return key;
    }

    return null;
  }

  /**
   * Update last activity for a project
   */
  private touchProject(name: string): void {
    const proj = this.projects.get(name);
    if (proj) {
      proj.lastActivity = Date.now();
    }
  }

  /**
   * Format time ago string
   */
  private timeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `há ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours}h`;
    return `há ${Math.floor(hours / 24)}d`;
  }
}

/**
 * Result of parsing a WhatsApp message
 */
export interface ParsedMessage {
  type: 'chat' | 'command' | 'error';
  command: string | null;
  text: string;
  targetProject: string | null;
}
