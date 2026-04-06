/**
 * @fileoverview UI approval gate for guarded sandbox actions.
 * @module infrastructure/sandbox/ApprovalGate
 */

import * as vscode from 'vscode';
import type { ApprovalRequest, IApprovalGate } from '../../../shared/types/agent';

/**
 * Approval gate backed by VS Code modal prompts.
 */
export class ApprovalGate implements IApprovalGate {
  /**
   * Requests explicit confirmation for medium/high risk actions.
   */
  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    if (request.risk === 'low') {
      return true;
    }
    const details = request.command ? `\n\nComando: ${request.command}` : '';
    const answer = await vscode.window.showWarningMessage(
      `Aprovar ação (${request.risk})?\n${request.action}${details}`,
      { modal: true },
      'Aprovar',
      'Negar',
    );
    return answer === 'Aprovar';
  }
}

