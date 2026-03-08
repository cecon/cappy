/**
 * @fileoverview WhatsApp Reply Tool — allows the Antigravity Agent to send
 * messages back to WhatsApp as part of the bidirectional communication loop.
 *
 * Flow:
 * 1. WhatsApp msg → Cappy Bridge → sendPromptToAgentPanel
 * 2. Antigravity Agent processes with LLM
 * 3. Agent calls THIS tool → message goes to WhatsApp
 */

import * as vscode from 'vscode';

interface WhatsAppReplyInput {
  /** The message to send to WhatsApp */
  message: string;
}

/**
 * LM Tool that sends a message to WhatsApp via the Cappy Bridge.
 * Used by the Antigravity Agent to respond to WhatsApp messages.
 */
export class WhatsAppReplyTool implements vscode.LanguageModelTool<WhatsAppReplyInput> {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<WhatsAppReplyInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { message } = options.input;

    const bridge = (globalThis as any).__cappyBridge;
    if (!bridge) {
      return {
        content: [new vscode.LanguageModelTextPart(
          'ERROR: Cappy Bridge is not active. Cannot send message to WhatsApp.'
        )]
      };
    }

    try {
      bridge.sendConfirmationToWhatsApp(`*Cappy* 🤖\n${message}`);
      return {
        content: [new vscode.LanguageModelTextPart(
          `✅ Message sent to WhatsApp successfully.`
        )]
      };
    } catch (err) {
      return {
        content: [new vscode.LanguageModelTextPart(
          `ERROR: Failed to send message to WhatsApp: ${err}`
        )]
      };
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<WhatsAppReplyInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Sending reply to WhatsApp: ${options.input.message.substring(0, 80)}...`
    };
  }
}
