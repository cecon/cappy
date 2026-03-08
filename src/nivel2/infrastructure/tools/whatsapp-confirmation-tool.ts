/**
 * @fileoverview WhatsApp Confirmation Tool — HITL (Human-in-the-Loop) via WhatsApp
 * @module tools/whatsapp-confirmation-tool
 *
 * This tool allows AI assistants (Antigravity, Copilot, etc.) to request
 * user confirmation for sensitive actions via WhatsApp.
 *
 * Flow:
 * 1. AI calls this tool with a description of what needs approval
 * 2. Cappy sends a confirmation message to WhatsApp
 * 3. User replies SIM/NÃO via WhatsApp
 * 4. Tool returns the user's decision to the AI
 */

import * as vscode from 'vscode';

interface WhatsAppConfirmationInput {
  /** Description of the action that needs approval */
  action: string;
  /** Optional: the exact command to be executed (shown to user for transparency) */
  command?: string;
  /** Optional: risk level hint (low, medium, high) */
  risk?: 'low' | 'medium' | 'high';
}

/**
 * Singleton manager for pending WhatsApp approvals.
 * Shared between the tool and the bridge so WhatsApp responses
 * can resolve pending promises.
 */
export class WhatsAppApprovalManager {
  private static instance: WhatsAppApprovalManager;

  /** Map of approval ID → resolver function */
  private pendingApprovals = new Map<string, {
    resolve: (approved: boolean) => void;
    action: string;
    command?: string;
    createdAt: number;
  }>();

  /** Timeout for approvals (5 minutes) */
  private readonly APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

  static getInstance(): WhatsAppApprovalManager {
    if (!WhatsAppApprovalManager.instance) {
      WhatsAppApprovalManager.instance = new WhatsAppApprovalManager();
    }
    return WhatsAppApprovalManager.instance;
  }

  /**
   * Create a new pending approval and return a promise that resolves 
   * when the user responds via WhatsApp.
   */
  requestApproval(action: string, command?: string): { id: string; promise: Promise<boolean> } {
    const id = `approval-${Date.now()}`;

    const promise = new Promise<boolean>((resolve) => {
      this.pendingApprovals.set(id, {
        resolve,
        action,
        command,
        createdAt: Date.now(),
      });

      // Auto-reject after timeout
      setTimeout(() => {
        if (this.pendingApprovals.has(id)) {
          this.pendingApprovals.delete(id);
          resolve(false);
          console.log(`[HITL] Approval ${id} expired (timeout)`);
        }
      }, this.APPROVAL_TIMEOUT_MS);
    });

    return { id, promise };
  }

  /**
   * Called by the bridge when the user responds via WhatsApp.
   * Returns true if there was a pending approval to resolve.
   */
  resolveApproval(approved: boolean): boolean {
    // Resolve the most recent pending approval
    const entries = Array.from(this.pendingApprovals.entries());
    if (entries.length === 0) return false;

    // Get the latest pending approval
    const [id, approval] = entries[entries.length - 1];
    approval.resolve(approved);
    this.pendingApprovals.delete(id);
    console.log(`[HITL] Approval ${id} resolved: ${approved ? 'APPROVED' : 'REJECTED'}`);
    return true;
  }

  /**
   * Check if there are any pending approvals
   */
  hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0;
  }

  /**
   * Get info about the current pending approval (for display)
   */
  getCurrentApproval(): { action: string; command?: string } | null {
    const entries = Array.from(this.pendingApprovals.entries());
    if (entries.length === 0) return null;
    const [, approval] = entries[entries.length - 1];
    return { action: approval.action, command: approval.command };
  }
}

/**
 * LM Tool that sends confirmation requests to WhatsApp
 * and waits for the user's response.
 */
export class WhatsAppConfirmationTool implements vscode.LanguageModelTool<WhatsAppConfirmationInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<WhatsAppConfirmationInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { action, command, risk } = options.input;

    const manager = WhatsAppApprovalManager.getInstance();

    // Check if WhatsApp bridge is available
    const bridge = (globalThis as any).__cappyBridge;
    if (!bridge) {
      return {
        content: [new vscode.LanguageModelTextPart(
          'ERRO: Cappy Bridge não está ativo. Não é possível enviar confirmação via WhatsApp. ' +
          'O comando NÃO foi autorizado. Peça ao usuário para habilitar o bridge.'
        )]
      };
    }

    // Build the WhatsApp message
    const riskEmoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
    let message = `${riskEmoji} *AUTORIZAÇÃO NECESSÁRIA*\n\n`;
    message += `📋 *Ação:* ${action}\n`;
    if (command) {
      message += `💻 *Comando:* \`${command}\`\n`;
    }
    message += `\n✅ Responda *SIM* para autorizar\n❌ Responda *NÃO* para negar\n`;
    message += `\n⏳ _Expira em 5 minutos_`;

    // Create the approval request
    const { promise } = manager.requestApproval(action, command);

    // Send to WhatsApp
    try {
      bridge.sendConfirmationToWhatsApp(message);
    } catch (err) {
      return {
        content: [new vscode.LanguageModelTextPart(
          `ERRO: Falha ao enviar mensagem para WhatsApp: ${err}. Comando NÃO autorizado.`
        )]
      };
    }

    // Wait for user response (blocks until user replies or timeout)
    const approved = await promise;

    if (approved) {
      return {
        content: [new vscode.LanguageModelTextPart(
          `✅ AUTORIZADO pelo usuário via WhatsApp.\n` +
          `Ação: ${action}\n` +
          (command ? `Comando: ${command}\n` : '') +
          `Pode prosseguir com a execução.`
        )]
      };
    } else {
      return {
        content: [new vscode.LanguageModelTextPart(
          `❌ NEGADO pelo usuário via WhatsApp.\n` +
          `Ação: ${action}\n` +
          (command ? `Comando: ${command}\n` : '') +
          `NÃO execute esta ação. Informe ao usuário que a ação foi cancelada.`
        )]
      };
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<WhatsAppConfirmationInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { action, command } = options.input;
    return {
      invocationMessage: `Solicitando autorização via WhatsApp: ${action}${command ? ` (${command})` : ''}`
    };
  }
}
