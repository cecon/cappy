/**
 * @fileoverview WhatsApp Confirmation Tool — HITL (Human-in-the-Loop) via WhatsApp
 * @module tools/whatsapp-confirmation-tool
 *
 * Delegates approval state to ApprovalFlow (chatId-validated singleton).
 *
 * Flow:
 * 1. AI calls this tool with a description of what needs approval
 * 2. Cappy sends a confirmation message to WhatsApp
 * 3. User replies SIM/NÃO via WhatsApp
 * 4. Tool returns the user's decision to the AI
 */

import * as vscode from 'vscode';
import { ApprovalFlow } from '../bridge/ApprovalFlow';
import { AuditLog } from '../security/CommandPolicy';

/**
 * Re-export for backward compatibility — bridge uses ApprovalFlow directly.
 * @deprecated Use ApprovalFlow.getInstance() instead.
 */
export { ApprovalFlow as WhatsAppApprovalManager };

interface WhatsAppConfirmationInput {
  action: string;
  command?: string;
  risk?: 'low' | 'medium' | 'high';
}

export class WhatsAppConfirmationTool implements vscode.LanguageModelTool<WhatsAppConfirmationInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<WhatsAppConfirmationInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { action, command, risk = 'medium' } = options.input;

    const bridge = (globalThis as Record<string, unknown>)['__cappyBridge'] as {
      sendConfirmationToWhatsApp(msg: string): void;
      workspaceRoot?: string;
    } | undefined;

    if (!bridge) {
      return {
        content: [new vscode.LanguageModelTextPart(
          'ERRO: Cappy Bridge não está ativo. Não é possível enviar confirmação via WhatsApp. ' +
          'O comando NÃO foi autorizado. Peça ao usuário para habilitar o bridge.'
        )]
      };
    }

    // Build WhatsApp message
    const riskEmoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
    let message = `${riskEmoji} *AUTORIZAÇÃO NECESSÁRIA*\n\n`;
    message += `📋 *Ação:* ${action}\n`;
    if (command) message += `💻 *Comando:* \`${command}\`\n`;
    message += `\n✅ Responda *SIM* para autorizar\n❌ Responda *NÃO* para negar\n`;
    message += `\n⏳ _Expira em 5 minutos_`;

    // Send to WhatsApp — this also sets the chatId in the bridge
    let chatId: string | undefined;
    try {
      bridge.sendConfirmationToWhatsApp(message);
      // Retrieve chatId from bridge's session manager (exposed via getter)
      chatId = (bridge as Record<string, unknown>)['_pendingChatId'] as string | undefined;
    } catch (err) {
      return {
        content: [new vscode.LanguageModelTextPart(
          `ERRO: Falha ao enviar mensagem para WhatsApp: ${err}. Comando NÃO autorizado.`
        )]
      };
    }

    // Register approval with chatId (fallback to empty string if unavailable)
    const flow = ApprovalFlow.getInstance();
    const { promise } = flow.request(action, chatId ?? '', command, risk);

    const workspaceRoot = typeof bridge.workspaceRoot === 'string' ? bridge.workspaceRoot : '.';
    const audit = new AuditLog(workspaceRoot);
    audit.write({ type: 'hitl_requested', timestamp: new Date().toISOString(), project: 'unknown', chatId, action, risk });

    const approved = await promise;

    audit.write({ type: approved ? 'hitl_approved' : 'hitl_rejected', timestamp: new Date().toISOString(), project: 'unknown', chatId, action });

    return {
      content: [new vscode.LanguageModelTextPart(
        approved
          ? `✅ AUTORIZADO pelo usuário via WhatsApp.\nAção: ${action}\n${command ? `Comando: ${command}\n` : ''}Pode prosseguir com a execução.`
          : `❌ NEGADO pelo usuário via WhatsApp.\nAção: ${action}\n${command ? `Comando: ${command}\n` : ''}NÃO execute esta ação.`
      )]
    };
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
