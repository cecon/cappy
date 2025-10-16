/**
 * Tool Call Actions
 * Lógica de negócio para aprovação/negação de ferramentas
 */

import type { PendingToolCall } from './types';

export class ToolCallActionHandler {
  private pendingToolCalls: Map<string, PendingToolCall>;

  constructor(pendingToolCalls: Map<string, PendingToolCall>) {
    this.pendingToolCalls = pendingToolCalls;
  }

  /**
   * Aprova a execução de uma ferramenta
   */
  approveToolCall(messageId: string): void {
    const pending = this.pendingToolCalls.get(messageId);
    if (pending) {
      console.log('[ToolCallActions] Approving tool:', messageId);
      pending.resolver(true);
      this.pendingToolCalls.delete(messageId);
    } else {
      console.warn('[ToolCallActions] Tool not found for approval:', messageId);
    }
  }

  /**
   * Nega a execução de uma ferramenta
   */
  denyToolCall(messageId: string): void {
    const pending = this.pendingToolCalls.get(messageId);
    if (pending) {
      console.log('[ToolCallActions] Denying tool:', messageId);
      pending.resolver(false);
      this.pendingToolCalls.delete(messageId);
    } else {
      console.warn('[ToolCallActions] Tool not found for denial:', messageId);
    }
  }

  /**
   * Adiciona uma nova ferramenta pendente
   */
  addPendingTool(pendingTool: PendingToolCall): void {
    console.log('[ToolCallActions] Adding pending tool:', pendingTool.messageId);
    this.pendingToolCalls.set(pendingTool.messageId, pendingTool);
  }

  /**
   * Obtém uma ferramenta pendente pelo ID
   */
  getPendingTool(messageId: string): PendingToolCall | undefined {
    return this.pendingToolCalls.get(messageId);
  }

  /**
   * Retorna o número de ferramentas pendentes
   */
  getPendingCount(): number {
    return this.pendingToolCalls.size;
  }
}
