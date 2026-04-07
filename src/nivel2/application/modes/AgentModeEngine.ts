/**
 * @fileoverview Agent mode engine with optional MCP tool loop.
 * @module application/modes/AgentModeEngine
 */

import type {
  AgentModeResult,
  IAgentModeEngine,
  IProviderGateway,
  McpToolRequest,
  UserTurnInput,
} from '../../../shared/types/agent';
import { ToolBroker } from '../tools/ToolBroker';
import { ApprovalGate } from '../../infrastructure/sandbox/ApprovalGate';

/**
 * Runs an agent-like turn using provider + optional MCP tool execution.
 */
export class AgentModeEngine implements IAgentModeEngine {
  private readonly approvalGate = new ApprovalGate();

  constructor(
    private readonly providerGateway: IProviderGateway,
    private readonly toolBroker: ToolBroker,
  ) {}

  /**
   * Executes one Agent turn and returns markdown with tool timeline.
   */
  async run(input: UserTurnInput): Promise<AgentModeResult> {
    const toolCalls: AgentModeResult['toolCalls'] = [];
    const request = this.extractToolRequest(input.prompt);
    let toolOutputSummary = '';

    if (request) {
      const risk = this.classifyRisk(request);
      const approved = await this.approvalGate.requestApproval({
        action: `Executar tool MCP ${request.server}/${request.toolName}`,
        risk,
        command: JSON.stringify(request.arguments),
      });
      if (!approved) {
        toolCalls.push({
          tool: `${request.server}/${request.toolName}`,
          status: 'error',
          input: JSON.stringify(request.arguments, null, 2),
          output: 'Execução negada pelo usuário.',
        });
        return {
          markdown: [
            '## Agent',
            '',
            'A execução da ferramenta foi negada pelo usuário.',
            '',
            'Você pode reenviar com confirmação para continuar.',
          ].join('\n'),
          toolCalls,
        };
      }

      toolCalls.push({
        tool: `${request.server}/${request.toolName}`,
        status: 'running',
        input: JSON.stringify(request.arguments, null, 2),
      });

      try {
        const output = await this.toolBroker.executeMcpTool(request, {
          sessionId: input.sessionId,
          runId: input.runId,
          actor: 'orchestrator',
          attempt: 1,
        });
        const formatted = this.formatToolOutput(output);
        toolCalls.push({
          tool: `${request.server}/${request.toolName}`,
          status: 'done',
          output: formatted,
        });
        toolOutputSummary = formatted;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toolCalls.push({
          tool: `${request.server}/${request.toolName}`,
          status: 'error',
          output: message,
        });
        toolOutputSummary = `Falha na tool: ${message}`;
      }
    }

    const finalText = await this.providerGateway.chat({
      systemPrompt: [
        'Você é o modo Agent do Cappy.',
        'Responda em português.',
        'Se houver saída de tool, incorpore em um plano de ação direto.',
      ].join(' '),
      prompt: this.buildProviderPrompt(input.prompt, toolOutputSummary),
    });

    return {
      markdown: finalText.text,
      toolCalls,
    };
  }

  /**
   * Extracts MCP request from prompt when present.
   */
  private extractToolRequest(prompt: string): McpToolRequest | null {
    const match = prompt.match(/mcp:([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(\s+\{[\s\S]*\})?/);
    if (!match) {
      return null;
    }
    const rawArgs = match[3]?.trim();
    let args: Record<string, unknown> = {};
    if (rawArgs) {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        args = { rawInput: rawArgs };
      }
    }
    return {
      server: match[1],
      toolName: match[2],
      arguments: args,
    };
  }

  /**
   * Maps tool name to an approval risk level.
   */
  private classifyRisk(request: McpToolRequest): 'low' | 'medium' | 'high' {
    const tool = request.toolName.toLowerCase();
    if (/(delete|drop|remove|destroy|truncate)/.test(tool)) {
      return 'high';
    }
    if (/(write|update|insert|create|merge|publish|deploy)/.test(tool)) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Formats tool output for user-visible markdown.
   */
  private formatToolOutput(output: unknown): string {
    if (typeof output === 'string') {
      return output;
    }
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }

  /**
   * Builds final provider prompt with optional tool output context.
   */
  private buildProviderPrompt(prompt: string, toolOutputSummary: string): string {
    if (!toolOutputSummary) {
      return `Solicitação do usuário: ${prompt}`;
    }
    return [
      `Solicitação do usuário: ${prompt}`,
      '',
      'Saída da ferramenta executada:',
      toolOutputSummary,
      '',
      'Com base nisso, proponha próximos passos objetivos.',
    ].join('\n');
  }
}

